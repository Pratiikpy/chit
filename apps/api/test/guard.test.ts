/**
 * Abuse-control tests.
 *
 * chit has no accounts, so signature verification stops forgery but nothing stops a flood
 * of *valid* requests or a single enormous one. These are the only controls standing
 * between the service and either, so their edges are asserted rather than assumed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { bodyLimit, clientKey, rateLimit, securityHeaders } from '../src/guard.ts';

const BASE = 'http://chit.test';

function appWith(...middleware: Parameters<Hono['use']>[1][]) {
  const app = new Hono();
  for (const handler of middleware) app.use('*', handler);
  app.get('/ping', (c) => c.json({ ok: true }));
  app.post('/ping', async (c) => c.json({ ok: true, seen: (await c.req.text()).length }));
  return app;
}

test('requests are allowed up to the limit, then refused with a reason', async () => {
  const app = appWith(rateLimit({ limit: 3, windowMs: 60_000 }));

  for (let i = 1; i <= 3; i++) {
    const response = await app.fetch(new Request(`${BASE}/ping`));
    assert.equal(response.status, 200, `request ${i} should pass`);
    assert.equal(response.headers.get('RateLimit-Remaining'), String(3 - i));
  }

  const blocked = await app.fetch(new Request(`${BASE}/ping`));
  assert.equal(blocked.status, 429);
  assert.equal(((await blocked.json()) as { code: string }).code, 'rate-limited');
  assert.ok(blocked.headers.get('Retry-After'), 'the client is told when to come back');
});

test('the window resets, so a limited client is not locked out forever', async () => {
  const app = appWith(rateLimit({ limit: 1, windowMs: 60 }));

  assert.equal((await app.fetch(new Request(`${BASE}/ping`))).status, 200);
  assert.equal((await app.fetch(new Request(`${BASE}/ping`))).status, 429);

  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.equal((await app.fetch(new Request(`${BASE}/ping`))).status, 200, 'allowed again');
});

test('⭐ x-forwarded-for is ignored unless a proxy is actually configured', () => {
  // Trusting the header with nothing in front lets any client mint a fresh bucket per
  // request, which is worse than no limiter because it looks like protection.
  const fake = {
    req: { header: (name: string) => (name === 'x-forwarded-for' ? '1.2.3.4' : undefined) },
    env: { incoming: { socket: { remoteAddress: '10.0.0.1' } } },
  } as never;

  assert.equal(clientKey(fake, 0), '10.0.0.1', 'the socket address, not the header');
  assert.equal(clientKey(fake, 1), '1.2.3.4', 'the header, once a proxy is declared');
});

test('with several hops, the address is counted from the trusted end', () => {
  const fake = {
    req: { header: () => '9.9.9.9, 1.2.3.4, 5.6.7.8' },
    env: { incoming: { socket: { remoteAddress: '10.0.0.1' } } },
  } as never;

  // One trusted proxy: the last hop was added by it, so the client is the one before.
  assert.equal(clientKey(fake, 1), '5.6.7.8');
  assert.equal(clientKey(fake, 2), '1.2.3.4');
});

test('a missing address never crashes the limiter', () => {
  assert.equal(clientKey({ req: { header: () => undefined }, env: undefined } as never, 0), 'unknown');
});

test('an oversized body is refused before it is parsed', async () => {
  const app = appWith(bodyLimit(1024));
  const huge = 'x'.repeat(4096);

  const response = await app.fetch(
    new Request(`${BASE}/ping`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(huge.length) },
      body: huge,
    }),
  );

  assert.equal(response.status, 413);
  assert.equal(((await response.json()) as { code: string }).code, 'body-too-large');
});

test('a body within the limit passes through untouched', async () => {
  const app = appWith(bodyLimit(1024));
  const body = JSON.stringify({ hello: 'world' });
  const response = await app.fetch(
    new Request(`${BASE}/ping`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
      body,
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { seen: number }).seen, body.length);
});

test('⭐ a body with no content-length is still bounded', async () => {
  // A chunked request declares no length, so a limiter that only reads the header lets
  // an unbounded body straight through.
  const app = appWith(bodyLimit(64));
  const response = await app.fetch(
    new Request(`${BASE}/ping`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'x'.repeat(4096),
    }),
  );
  assert.equal(response.status, 413);
});

test('a GET is never treated as having a body', async () => {
  const app = appWith(bodyLimit(1));
  assert.equal((await app.fetch(new Request(`${BASE}/ping`))).status, 200);
});

test('every response carries the security headers', async () => {
  const app = appWith(securityHeaders());
  const response = await app.fetch(new Request(`${BASE}/ping`));

  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY', 'a chit link is opened, never embedded');
  assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
  assert.match(response.headers.get('Permissions-Policy') ?? '', /geolocation=\(\)/);
});

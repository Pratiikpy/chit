/**
 * Abuse controls.
 *
 * chit has no accounts, so there is no login to rate-limit behind. Every write is
 * signature-verified, which makes forging someone else's chit impossible — but it does
 * nothing to stop a flood of *valid* requests, or a single enormous one.
 *
 * Two honest limitations, stated rather than papered over:
 *
 * - **The limiter is per-process and in memory.** It resets on deploy and does not span
 *   replicas. For a single-instance service that is the right trade; if chit is ever run
 *   behind more than one instance this must move to shared storage, or the effective limit
 *   silently multiplies by the replica count.
 * - **A client IP behind a proxy is only as trustworthy as the proxy.** The forwarded
 *   header is used only when a trusted-proxy count is configured, because an attacker can
 *   otherwise set it freely and mint a fresh bucket per request.
 */

import type { Context, MiddlewareHandler, Next } from 'hono';

/** Requests allowed per window, per client. */
export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  /**
   * How many proxies sit in front of this service. `0` means the socket address is used
   * and `x-forwarded-for` is ignored entirely — the safe default.
   */
  trustedProxies?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Identify the client.
 *
 * With no trusted proxies the header is ignored: anyone can send
 * `x-forwarded-for: <random>` and get an unlimited number of fresh buckets, which would
 * make the limiter worse than none at all by giving false confidence.
 */
export function clientKey(c: Context, trustedProxies = 0): string {
  if (trustedProxies > 0) {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
      const hops = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
      // Count from the right: the rightmost entries were added by proxies we control.
      const index = Math.max(0, hops.length - trustedProxies);
      const candidate = hops[index];
      if (candidate) return candidate;
    }
  }

  const info = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return info?.incoming?.socket?.remoteAddress ?? 'unknown';
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();

  // Sweep expired buckets so a long-running process does not accumulate one entry per
  // address seen since boot.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.max(options.windowMs, 60_000));
  sweep.unref?.();

  return async (c: Context, next: Next) => {
    const key = clientKey(c, options.trustedProxies ?? 0);
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;

    const remaining = Math.max(0, options.limit - bucket.count);
    c.header('RateLimit-Limit', String(options.limit));
    c.header('RateLimit-Remaining', String(remaining));
    c.header('RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > options.limit) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return c.json(
        {
          code: 'rate-limited',
          error: 'Too many requests from this connection. Wait a moment and try again — nothing was lost.',
        },
        429,
      );
    }

    await next();
  };
}

/**
 * Reject a request body larger than `maxBytes` before it is parsed.
 *
 * A chit's canonical form is bounded by `MAX_TEXT_BYTES` in core, so a legitimate request
 * is small. Anything far larger is either a mistake or an attempt to make the process
 * allocate; either way it should be refused at the door rather than after `await json()`
 * has already built the string in memory.
 */
export function bodyLimit(maxBytes: number): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const declared = c.req.header('content-length');
    if (declared && Number(declared) > maxBytes) {
      return c.json(
        { code: 'body-too-large', error: `That request is too big. A chit is one line of text.` },
        413,
      );
    }

    // A body with no `content-length` (chunked) still has to be bounded, so the raw text
    // is measured before anything tries to parse it.
    if (!declared && c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const text = await c.req.text();
      if (text.length > maxBytes) {
        return c.json(
          { code: 'body-too-large', error: 'That request is too big. A chit is one line of text.' },
          413,
        );
      }
      // Re-expose the body we consumed so downstream handlers can still read it.
      c.set('rawBody', text);
    }

    await next();
  };
}

/**
 * Headers every response carries.
 *
 * chit renders no user HTML — every string goes through `textContent` — but the headers
 * are set anyway: they cost nothing, and they are the difference between one future
 * mistake being contained and being exploitable.
 */
export function securityHeaders(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    // A chit link is meant to be opened directly, never embedded in someone else's page.
    c.header('X-Frame-Options', 'DENY');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), payment=()');
  };
}

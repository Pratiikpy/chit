/**
 * The board at the HTTP boundary, driven end to end through real signed chits.
 *
 * `board.test.ts` proves the ranking. This proves the parts a pure function cannot reach and where
 * the interesting failures actually live: that a chit created through the API turns up on the board,
 * that it leaves the moment somebody takes it, that a hostile query string is refused rather than
 * quietly ignored, and that the height the whole thing depends on is never assumed.
 *
 * A filter that is silently dropped is the specific failure worth guarding: the caller gets a
 * confident page of the wrong results, and nothing anywhere looks broken.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { KeyPair } from '@nimiq/core';
import { canonicalise, newNonce, type Chit } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';

import { SqliteRepository } from '../src/repository.ts';
import { createRoutes } from '../src/routes.ts';
import { SettlementWatcher } from '../src/watcher.ts';
import type { ChainTransaction } from '../src/chain.ts';

const BASE_URL = 'http://chit.test';
const HEIGHT = 4_100_000;

function sign(keyPair: KeyPair, text: string) {
  return {
    publicKeyHex: keyPair.publicKey.toHex(),
    signatureHex: keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(text))).toHex(),
  };
}

class FakeChain {
  height = HEIGHT;
  getBlockNumber(): Promise<number> {
    return Promise.resolve(this.height);
  }
  getTransactionsByAddress(): Promise<ChainTransaction[]> {
    return Promise.resolve([]);
  }
}

function harness() {
  const store = new SqliteRepository(':memory:');
  const chain = new FakeChain();
  const watcher = new SettlementWatcher({ store, chain, intervalMs: 1_000_000 });
  // The watcher has not polled, so the route falls back to `currentHeight` — which is the path a
  // freshly started server actually takes and therefore the one worth exercising.
  const app = createRoutes({
    store,
    watcher,
    chain: 'test',
    baseUrl: BASE_URL,
    rateLimitPerMinute: 0,
    currentHeight: () => chain.getBlockNumber(),
  });

  const call = async (path: string, init?: RequestInit) => {
    const response = await app.fetch(new Request(`${BASE_URL}${path}`, init));
    const body = response.status === 204 ? null : await response.json();
    return { status: response.status, body: body as Record<string, unknown> };
  };
  const post = (path: string, payload: unknown) =>
    call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

  return { store, chain, call, post };
}

function openChit(overrides: Partial<Chit> = {}): Chit {
  return {
    chain: 'test',
    kind: 'race',
    nonce: newNonce(),
    text: 'design a logo for a coffee shop',
    amountMinor: 4000n,
    currency: 'USD',
    luna: 1_000_000n,
    rateBlock: HEIGHT - 100,
    deadlineBlock: HEIGHT + 100_000,
    payer: KeyPair.generate().toAddress().toUserFriendlyAddress(),
    payee: '',
    deliverables: 1,
    ...overrides,
  };
}

/** Create a chit through the real route, signed by whoever authors it. */
async function publish(
  post: (path: string, payload: unknown) => Promise<{ status: number; body: Record<string, unknown> }>,
  author: KeyPair,
  overrides: Partial<Chit> = {},
) {
  const kind = overrides.kind ?? 'race';
  const chit =
    kind === 'quote'
      ? openChit({ ...overrides, kind: 'quote', payer: '', payee: author.toAddress().toUserFriendlyAddress() })
      : openChit({ ...overrides, kind: 'race', payer: author.toAddress().toUserFriendlyAddress() });

  const canonical = canonicalise(chit);
  const response = await post('/api/chits', { canonical, payerSignature: sign(author, canonical) });
  // 201 on first create, 200 when the same canonical text is posted again — both mean stored.
  assert.ok(response.status === 201 || response.status === 200, JSON.stringify(response.body));
  // The id comes back from the server rather than being recomputed here. `chitHash` is the *memo*,
  // not the storage id, and a test that derived one from the other would be asserting against its
  // own arithmetic instead of against what a client actually receives.
  return { chit, canonical, id: response.body['id'] as string };
}

type Entry = { kind: string; author: string; chit: { id: string; chit: { text: string } }; why: Record<string, unknown> };
const entriesOf = (body: Record<string, unknown>): Entry[] => body['entries'] as Entry[];

/* ------------------------------------------------------------------ the ordinary path */

test('⭐ a chit posted through the API is findable by a stranger', async () => {
  const { call, post } = harness();
  const author = KeyPair.generate();
  const { id } = await publish(post, author);

  const found = await call('/api/board');
  assert.equal(found.status, 200, JSON.stringify(found.body));
  assert.equal(found.body['total'], 1);
  assert.equal(entriesOf(found.body)[0]?.chit.id, id);
  assert.equal(entriesOf(found.body)[0]?.kind, 'work');
});

test('and a worker offering their time is findable too', async () => {
  const { call, post } = harness();
  await publish(post, KeyPair.generate(), { kind: 'quote', text: 'i will edit your video' });

  const found = await call('/api/board?kind=offer');
  assert.equal(found.body['total'], 1);
  assert.equal(entriesOf(found.body)[0]?.kind, 'offer');
});

test('search narrows the board to what was asked for', async () => {
  const { call, post } = harness();
  await publish(post, KeyPair.generate(), { text: 'design a logo for a coffee shop' });
  await publish(post, KeyPair.generate(), { text: 'translate a restaurant menu to spanish' });

  const logos = await call('/api/board?q=logo');
  assert.equal(logos.body['total'], 1);
  assert.match(entriesOf(logos.body)[0]!.chit.chit.text, /logo/);

  const nothing = await call('/api/board?q=plumbing');
  assert.equal(nothing.body['total'], 0);
});

test('⭐ a chit leaves the board the moment somebody takes it', async () => {
  const { call, post } = harness();
  const author = KeyPair.generate();
  const { canonical, id } = await publish(post, author);
  assert.equal((await call('/api/board')).body['total'], 1);

  const worker = KeyPair.generate();
  const taken = await post(`/api/chits/${id}/countersign`, { signature: sign(worker, canonical) });
  assert.equal(taken.status, 200, JSON.stringify(taken.body));

  const after = await call('/api/board');
  assert.equal(after.body['total'], 0, 'a chit somebody is already working on is not work available');
});

test('an expired chit is not shown, because the deadline is the chain’s clock and not ours', async () => {
  const { call, post, chain } = harness();
  await publish(post, KeyPair.generate(), { deadlineBlock: HEIGHT + 10 });
  assert.equal((await call('/api/board')).body['total'], 1);

  chain.height = HEIGHT + 11;
  assert.equal((await call('/api/board')).body['total'], 0);
});

test('every entry publishes why it ranks where it does', async () => {
  const { call, post } = harness();
  await publish(post, KeyPair.generate());
  const why = entriesOf((await call('/api/board')).body)[0]?.why;
  assert.ok(why);
  for (const field of ['relevance', 'performance', 'freshness', 'newcomer']) {
    assert.ok(field in why, `missing ${field}`);
  }
  assert.equal(why['newcomer'], true, 'a wallet with no history is a newcomer and should say so');
});

test('the board says who each entry belongs to, so a stranger can open their record', async () => {
  const { call, post } = harness();
  const author = KeyPair.generate();
  await publish(post, author);
  const entry = entriesOf((await call('/api/board')).body)[0];
  assert.equal(entry?.author.replace(/\s/g, ''), author.toAddress().toUserFriendlyAddress().replace(/\s/g, ''));
});

/* ------------------------------------------------------------------ hostile input */

test('an unknown sort is refused by name rather than silently ignored', async () => {
  const { call } = harness();
  const answer = await call('/api/board?sort=byPrice');
  assert.equal(answer.status, 400);
  assert.equal(answer.body['code'], 'bad-sort');
});

test('an unknown kind is refused', async () => {
  const { call } = harness();
  assert.equal((await call('/api/board?kind=everything')).body['code'], 'bad-kind');
});

test('an amount that is not an integer is refused, not coerced to zero', async () => {
  const { call } = harness();
  // `Number('1e9')` is a number and `BigInt('1e9')` throws — coercing here would 500 on a query string.
  for (const bad of ['1e9', '-5', '1.5', 'lots', '0x10']) {
    const answer = await call(`/api/board?min=${encodeURIComponent(bad)}`);
    assert.equal(answer.status, 400, `min=${bad} should be refused`);
    assert.equal(answer.body['code'], 'bad-amount');
  }
});

test('a currency that is not a currency is refused', async () => {
  const { call } = harness();
  assert.equal((await call('/api/board?currency=DOLLARS')).body['code'], 'bad-currency');
  assert.equal((await call('/api/board?currency=usd')).status, 200, 'lowercase is a real request');
});

test('a nonsense limit falls back to the default rather than failing the page', async () => {
  const { call, post } = harness();
  await publish(post, KeyPair.generate());
  // A bad *filter* is refused because it changes which results are correct; a bad *page size*
  // cannot, so it is defaulted. That distinction is the rule, and it is worth pinning.
  assert.equal((await call('/api/board?limit=banana')).status, 200);
  assert.equal((await call('/api/board?limit=-3')).status, 200);
});

test('paging carries a cursor and ends', async () => {
  const { call, post } = harness();
  for (let i = 0; i < 5; i++) await publish(post, KeyPair.generate(), { text: `design a logo number ${i}` });

  const first = await call('/api/board?limit=2');
  assert.equal(first.body['total'], 5);
  assert.equal(first.body['next'], 2);

  const last = await call('/api/board?limit=2&cursor=4');
  assert.equal(last.body['next'], null);
  assert.equal(entriesOf(last.body).length, 1);
});

/* ------------------------------------------------------------------ the chain */

test('⭐ with no readable height the board refuses rather than showing expired work', async () => {
  const store = new SqliteRepository(':memory:');
  const dead = {
    getBlockNumber: () => Promise.reject(new Error('no node')),
    getTransactionsByAddress: () => Promise.resolve([]),
  };
  const watcher = new SettlementWatcher({ store, chain: dead });
  const app = createRoutes({ store, watcher, chain: 'test', baseUrl: BASE_URL, rateLimitPerMinute: 0 });

  const response = await app.fetch(new Request(`${BASE_URL}/api/board`));
  assert.equal(response.status, 503);
  const body = (await response.json()) as { code: string; error: string };
  assert.equal(body.code, 'no-chain');
  // The sentence has to explain the consequence, not the cause: a person reading this is deciding
  // whether to wait, and "the chain height could not be read" alone does not tell them.
  assert.match(body.error, /still open/i);
});

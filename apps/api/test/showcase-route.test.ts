/**
 * A portfolio piece is the only thing chit publishes to strangers, so the tests are about the two
 * rules that make publishing safe, and one that makes it worth anything:
 *
 *  1. **No payment, no piece.** This is what every other portfolio cannot claim.
 *  2. **The worker proposes, the payer agrees.** A deliverable can be the client's unreleased work;
 *     a worker who could publish alone would be one bad judgement from real harm.
 *  3. **A published piece is frozen.** Otherwise the worker could swap the link for something the
 *     payer never saw, and the second signature would mean nothing.
 *
 * Each of those failing is silent — the piece just appears, or quietly changes — which is exactly
 * why they are asserted rather than assumed from the code.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { KeyPair } from '@nimiq/core';
import { canonicalise, canonicaliseShowcase, newNonce, type Chit } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';

import { SqliteRepository } from '../src/repository.ts';
import { createRoutes } from '../src/routes.ts';
import { SettlementWatcher } from '../src/watcher.ts';
import type { ChainTransaction } from '../src/chain.ts';

const BASE_URL = 'http://chit.test';
const HEIGHT = 4_100_000;
const TX = 'b'.repeat(64);
const LINK = 'https://example.com/work/logo.png';

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

/** A handshake between two named parties, countersigned and settled — a finished job. */
async function finishedJob(
  store: SqliteRepository,
  post: (path: string, payload: unknown) => Promise<{ status: number; body: Record<string, unknown> }>,
  payer: KeyPair,
  worker: KeyPair,
  settle = true,
) {
  const chit: Chit = {
    chain: 'test',
    kind: 'handshake',
    nonce: newNonce(),
    text: '$80 to design a logo for a coffee shop',
    amountMinor: 8000n,
    currency: 'USD',
    luna: 1_000_000n,
    rateBlock: HEIGHT - 100,
    deadlineBlock: HEIGHT + 100_000,
    payer: payer.toAddress().toUserFriendlyAddress(),
    payee: worker.toAddress().toUserFriendlyAddress(),
    deliverables: 1,
  };
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: sign(payer, canonical) });
  assert.ok(created.status === 201 || created.status === 200, JSON.stringify(created.body));
  const id = created.body['id'] as string;

  await post(`/api/chits/${id}/countersign`, { signature: sign(worker, canonical) });
  if (settle) {
    await store.markSettled(id, { hash: TX, blockNumber: HEIGHT + 1 });
  }
  return { id, canonical };
}

const offer = (
  post: (path: string, payload: unknown) => Promise<{ status: number; body: Record<string, unknown> }>,
  id: string,
  worker: KeyPair,
  link = LINK,
  caption = 'Rebrand in two days.',
) =>
  post(`/api/chits/${id}/showcase`, {
    link,
    caption,
    signature: sign(worker, canonicaliseShowcase({ chitId: id, txHash: TX, link, caption })),
  });

type Piece = { link: string; caption: string; worker: string; agreed?: { at: number } };
const pieceOf = (body: Record<string, unknown>): Piece | null => body['showcase'] as Piece | null;

/* ------------------------------------------------------------------ the ordinary path */

test('⭐ a worker offers a piece, the payer agrees, and it is published', async () => {
  const { store, call, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id, canonical: _c } = await finishedJob(store, post, payer, worker);

  const offered = await offer(post, id, worker);
  assert.equal(offered.status, 201, JSON.stringify(offered.body));
  assert.equal(pieceOf(offered.body)?.agreed, undefined, 'offering alone must not publish');

  const piece = await store.showcase(id);
  const agreed = await post(`/api/chits/${id}/showcase/agree`, { signature: sign(payer, piece!.canonical) });
  assert.equal(agreed.status, 200, JSON.stringify(agreed.body));
  assert.ok(pieceOf(agreed.body)?.agreed, 'both signatures means published');

  // And it reaches the worker's public record.
  const listed = await store.showcasesFor(worker.toAddress().toUserFriendlyAddress());
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.link, LINK);
});

/* ------------------------------------------------------------------ the rules */

test('⭐ no payment, no piece', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker, false);

  const offered = await offer(post, id, worker);
  assert.equal(offered.status, 409);
  assert.equal(offered.body['code'], 'not-settled');
});

test('⭐ only the person who was paid may offer the work', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker);

  // The payer offering their contractor's work is exactly the confusion the rule prevents.
  const offered = await offer(post, id, payer);
  assert.equal(offered.status, 403);
  assert.equal(offered.body['code'], 'not-yours');
});

test('⭐ only the person who paid may agree to it being shown', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker);
  await offer(post, id, worker);
  const piece = await store.showcase(id);

  for (const impostor of [worker, KeyPair.generate()]) {
    const agreed = await post(`/api/chits/${id}/showcase/agree`, { signature: sign(impostor, piece!.canonical) });
    assert.equal(agreed.status, 403, 'nobody but the payer agrees');
  }
  assert.equal((await store.showcase(id))?.agreed, undefined);
});

test('⭐ nothing is on the public record until both have signed', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker);
  await offer(post, id, worker);

  assert.equal((await store.showcasesFor(worker.toAddress().toUserFriendlyAddress())).length, 0);

  const piece = await store.showcase(id);
  await post(`/api/chits/${id}/showcase/agree`, { signature: sign(payer, piece!.canonical) });
  assert.equal((await store.showcasesFor(worker.toAddress().toUserFriendlyAddress())).length, 1);
});

test('a worker may fix an unpublished offer — a wrong link is an ordinary mistake', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker);

  await offer(post, id, worker, 'https://example.com/wrong.png');
  const fixed = await offer(post, id, worker, 'https://example.com/right.png');
  assert.equal(fixed.status, 201);
  assert.equal((await store.showcase(id))?.link, 'https://example.com/right.png');
});

test('⭐ but a published piece is frozen — the link cannot be swapped afterwards', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker);
  await offer(post, id, worker, 'https://example.com/agreed.png');
  const piece = await store.showcase(id);
  await post(`/api/chits/${id}/showcase/agree`, { signature: sign(payer, piece!.canonical) });

  const swapped = await offer(post, id, worker, 'https://example.com/something-else.png');
  assert.equal(swapped.status, 409);
  assert.equal(swapped.body['code'], 'already-published');
  assert.equal((await store.showcase(id))?.link, 'https://example.com/agreed.png');
});

test('⭐ agreeing to bytes that are no longer the stored ones is refused', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker);

  await offer(post, id, worker, 'https://example.com/first.png');
  const first = await store.showcase(id);

  // The worker changes it while the payer is reading. The payer's signature is over the old text.
  await offer(post, id, worker, 'https://example.com/second.png');

  const agreed = await post(`/api/chits/${id}/showcase/agree`, { signature: sign(payer, first!.canonical) });
  assert.equal(agreed.status, 403, 'the signature is over text that is no longer the piece');
  assert.equal((await store.showcase(id))?.agreed, undefined);
});

test('a piece with no link is refused by the canonical form', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker);

  const offered = await post(`/api/chits/${id}/showcase`, {
    link: '',
    caption: 'nothing to see',
    signature: sign(worker, canonicaliseShowcase({ chitId: id, txHash: TX, link: LINK, caption: 'x' })),
  });
  assert.equal(offered.status, 400);
  assert.equal(offered.body['code'], 'bad-showcase');
});

test('a link that is not safe to show is refused', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker);

  const offered = await post(`/api/chits/${id}/showcase`, {
    link: 'javascript:alert(1)',
    caption: '',
    signature: sign(worker, canonicaliseShowcase({ chitId: id, txHash: TX, link: LINK, caption: '' })),
  });
  assert.equal(offered.status, 400);
  assert.equal(offered.body['code'], 'bad-showcase');
});

test('agreeing before anything was offered is a 404, not a 500', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker);

  const agreed = await post(`/api/chits/${id}/showcase/agree`, { signature: sign(payer, 'anything') });
  assert.equal(agreed.status, 404);
  assert.equal(agreed.body['code'], 'no-showcase');
});

test('a chit with no piece answers with null rather than an error', async () => {
  const { store, call, post } = harness();
  const { id } = await finishedJob(store, post, KeyPair.generate(), KeyPair.generate());
  const read = await call(`/api/chits/${id}/showcase`);
  assert.equal(read.status, 200);
  assert.equal(pieceOf(read.body), null);
});

test('offering and agreeing both land on the chit’s timeline', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await finishedJob(store, post, payer, worker);
  await offer(post, id, worker);
  const piece = await store.showcase(id);
  await post(`/api/chits/${id}/showcase/agree`, { signature: sign(payer, piece!.canonical) });

  const events = (await store.events(id)).map((e) => e.event);
  assert.ok(events.includes('showcase-proposed'), events.join(','));
  assert.ok(events.includes('showcase-agreed'), events.join(','));
});

/**
 * Reviews and the public record they feed.
 *
 * The claim being tested is narrow and load-bearing: a review here cannot be bought, cannot
 * be written by a stranger, cannot exist without a payment, and cannot be changed once made.
 * Each of those is a rule in `routes.ts`, and each is checked below against the real handler,
 * the real database and real Ed25519 keys.
 *
 * The profile is tested as the thing a stranger reads: every number on it has to come out of
 * the same rows the receipts do, so a page that flatters its subject is a failing test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KeyPair } from '@nimiq/core';
import { canonicalise, canonicaliseReview, newNonce, type Chit } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';
import { SqliteRepository } from '../src/repository.ts';
import { createRoutes } from '../src/routes.ts';
import { SettlementWatcher } from '../src/watcher.ts';
import { normaliseTransaction, type ChainTransaction } from '../src/chain.ts';

const BASE_URL = 'http://chit.test';
const key = (address: string) => address.replace(/\s/g, '').toUpperCase();

function signAsWallet(keyPair: KeyPair, text: string) {
  return {
    publicKeyHex: keyPair.publicKey.toHex(),
    signatureHex: keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(text))).toHex(),
  };
}

class FakeChain {
  height = 4_100_000;
  transactions = new Map<string, ChainTransaction[]>();
  getBlockNumber(): Promise<number> {
    return Promise.resolve(this.height);
  }
  getTransactionsByAddress(address: string): Promise<ChainTransaction[]> {
    return Promise.resolve(this.transactions.get(key(address)) ?? []);
  }
  pay(to: string, from: string, luna: bigint, memo: string) {
    const tx = normaliseTransaction({
      hash: Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''),
      blockNumber: ++this.height,
      timestamp: Date.now(),
      from,
      to,
      value: Number(luna),
      recipientData: memo,
    });
    assert.ok(tx);
    this.transactions.set(key(to), [...(this.transactions.get(key(to)) ?? []), tx]);
    return tx;
  }
}

function harness() {
  const store = new SqliteRepository(':memory:');
  const fakeChain = new FakeChain();
  const watcher = new SettlementWatcher({ store, chain: fakeChain, intervalMs: 1_000_000 });
  const app = createRoutes({ store, watcher, chain: 'test', baseUrl: BASE_URL, rateLimitPerMinute: 0, chainClient: fakeChain });
  const call = async (path: string, init?: RequestInit) => {
    const response = await app.fetch(new Request(`${BASE_URL}${path}`, init));
    const body = response.status === 204 ? null : await response.json();
    return { status: response.status, body: body as Record<string, unknown> };
  };
  const post = (path: string, payload: unknown) =>
    call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  return { store, fakeChain, watcher, call, post };
}

function makeChit(payer: string, payee: string, overrides: Partial<Chit> = {}): Chit {
  return {
    chain: 'test',
    kind: 'handshake',
    nonce: newNonce(),
    text: '$40 for 3 thumbnails by Friday',
    amountMinor: 4000n,
    currency: 'USD',
    luna: 120_400_000n,
    rateBlock: 4_100_000,
    deadlineBlock: 4_110_000,
    payer,
    payee,
    deliverables: 3,
    ...overrides,
  };
}

/** Create, countersign, pay and confirm. Returns everything a review needs. */
async function settledChit(h: ReturnType<typeof harness>) {
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const payerAddress = payer.toAddress().toUserFriendlyAddress();
  const payeeAddress = payee.toAddress().toUserFriendlyAddress();
  const chit = makeChit(payerAddress, payeeAddress);
  const canonical = canonicalise(chit);
  const created = await h.post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const id = String(created.body['id']);
  await h.post(`/api/chits/${encodeURIComponent(id)}/countersign`, { signature: signAsWallet(payee, canonical) });
  const tx = h.fakeChain.pay(payeeAddress, payerAddress, chit.luna, id);
  assert.equal(await h.watcher.poll(), 1);
  return { payer, payee, payerAddress, payeeAddress, id, tx, chit };
}

const review = (id: string, txHash: string, rating: number, text: string) =>
  canonicaliseReview({ chitId: id, txHash: txHash.toLowerCase(), rating, text });

test('the payer reviews the worker, and the record says who wrote it and about whom', async () => {
  const h = harness();
  const { payer, payerAddress, payeeAddress, id, tx } = await settledChit(h);

  const canonical = review(id, tx.hash, 5, 'Delivered a day early and the files were right.');
  const posted = await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(payer, canonical),
    rating: 5,
    text: 'Delivered a day early and the files were right.',
  });

  assert.equal(posted.status, 200);
  const reviews = posted.body['reviews'] as Array<Record<string, unknown>>;
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]!['from'], 'payer');
  assert.equal(key(String(reviews[0]!['by'])), key(payerAddress), 'the author is derived from the key, not the body');
  assert.equal(key(String(reviews[0]!['about'])), key(payeeAddress));
  assert.equal(reviews[0]!['txHash'], tx.hash.toLowerCase(), 'bound to the payment that happened');
  // The proof travels with it. A review whose signature stayed on the server would be one
  // this service could quietly rewrite.
  const signature = reviews[0]!['signature'] as Record<string, string>;
  assert.match(signature['signatureHex']!, /^[0-9a-f]{128}$/);
});

test('both sides may review, and the worker reviewing the client is recorded the other way round', async () => {
  const h = harness();
  const { payer, payee, payerAddress, payeeAddress, id, tx } = await settledChit(h);

  await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(payer, review(id, tx.hash, 5, '')),
    rating: 5,
    text: '',
  });
  const second = await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(payee, review(id, tx.hash, 4, 'Paid within the hour. Brief was clear.')),
    rating: 4,
    text: 'Paid within the hour. Brief was clear.',
  });

  const reviews = second.body['reviews'] as Array<Record<string, unknown>>;
  assert.equal(reviews.length, 2);
  const fromWorker = reviews.find((r) => r['from'] === 'payee')!;
  assert.equal(key(String(fromWorker['by'])), key(payeeAddress));
  assert.equal(key(String(fromWorker['about'])), key(payerAddress), 'the client is the one being reviewed');
});

test('a stranger cannot review a deal they were not in, at any price', async () => {
  const h = harness();
  const { id, tx } = await settledChit(h);
  const stranger = KeyPair.generate();

  const posted = await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(stranger, review(id, tx.hash, 5, 'Excellent seller A+++')),
    rating: 5,
    text: 'Excellent seller A+++',
  });

  assert.equal(posted.status, 403);
  assert.equal(posted.body['code'], 'not-a-party');
});

test('no payment, no review — the endpoint refuses before money has moved', async () => {
  const h = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), payee.toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);
  const created = await h.post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const id = String(created.body['id']);

  const posted = await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(payer, review(id, 'a'.repeat(64), 5, '')),
    rating: 5,
    text: '',
  });

  assert.equal(posted.status, 409);
  assert.equal(posted.body['code'], 'not-settled', 'there is nothing to review yet');
});

test('a review signed over a different payment does not verify against this one', async () => {
  const h = harness();
  const { payer, id, tx } = await settledChit(h);
  // Same words, same rating, same chit — but signed over somebody else's transaction hash.
  const wrongHash = 'b'.repeat(64);
  assert.notEqual(wrongHash, tx.hash.toLowerCase());

  const posted = await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(payer, review(id, wrongHash, 5, 'great')),
    rating: 5,
    text: 'great',
  });

  assert.equal(posted.status, 403, 'the server rebuilds the canonical text from its own record');
});

test('a second review from the same side is refused, and the first one stands', async () => {
  const h = harness();
  const { payer, id, tx } = await settledChit(h);

  await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(payer, review(id, tx.hash, 1, 'terrible')),
    rating: 1,
    text: 'terrible',
  });
  const second = await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(payer, review(id, tx.hash, 5, 'actually fine')),
    rating: 5,
    text: 'actually fine',
  });

  assert.equal(second.status, 200);
  assert.equal(second.body['alreadyReviewed'], true);
  const reviews = second.body['reviews'] as Array<Record<string, unknown>>;
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]!['rating'], 1, 'there is no edit and no delete — the first one stands');
});

test('a rating outside one to five is refused before anything is stored', async () => {
  const h = harness();
  const { payer, id, tx } = await settledChit(h);
  const posted = await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    // Signed over something valid so the only defect is the rating the body claims.
    signature: signAsWallet(payer, review(id, tx.hash, 5, '')),
    rating: 6,
    text: '',
  });
  assert.equal(posted.status, 400);
  assert.equal(posted.body['code'], 'bad-review');
});

test('the review is recorded in the history, so nothing about a chit is invisible', async () => {
  const h = harness();
  const { payer, id, tx } = await settledChit(h);
  await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(payer, review(id, tx.hash, 4, '')),
    rating: 4,
    text: '',
  });
  const events = (await h.store.events(id)).map((e) => e.event);
  assert.deepEqual(events, ['created', 'countersigned', 'settled', 'reviewed']);
});

/* ------------------------------------------------------------------ the public record */

test('the profile shows settled work, the reviews about that wallet, and the mean rating', async () => {
  const h = harness();
  const { payer, payeeAddress, payerAddress, id, tx } = await settledChit(h);
  await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(payer, review(id, tx.hash, 5, 'Sharp work.')),
    rating: 5,
    text: 'Sharp work.',
  });

  const page = await h.call(`/api/addresses/${encodeURIComponent(payeeAddress)}/profile`);
  assert.equal(page.status, 200);

  const work = page.body['work'] as Array<Record<string, unknown>>;
  assert.equal(work.length, 1);
  assert.equal(work[0]!['text'], '$40 for 3 thumbnails by Friday');
  assert.equal(work[0]!['txHash'], tx.hash, 'every line on the page opens onto a real payment');
  assert.equal(key(String(work[0]!['counterparty'])), key(payerAddress));

  const reviews = page.body['reviews'] as Array<Record<string, unknown>>;
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0]!['chitText'], '$40 for 3 thumbnails by Friday', 'a rating is read next to what it was for');
  assert.equal(page.body['averageRating'], 5);
  assert.equal(typeof page.body['since'], 'number');
});

test('the profile carries no unpaid work — an unpaid chit says nothing about the worker', async () => {
  const h = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const payeeAddress = payee.toAddress().toUserFriendlyAddress();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), payeeAddress);
  const canonical = canonicalise(chit);
  const created = await h.post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  await h.post(`/api/chits/${encodeURIComponent(String(created.body['id']))}/countersign`, {
    signature: signAsWallet(payee, canonical),
  });

  const page = await h.call(`/api/addresses/${encodeURIComponent(payeeAddress)}/profile`);
  assert.deepEqual(page.body['work'], []);
  assert.equal(page.body['since'], null);
  assert.equal(page.body['averageRating'], null);
});

test('a wallet nobody has dealt with gets an empty record, not an error', async () => {
  const h = harness();
  const unknown = KeyPair.generate().toAddress().toUserFriendlyAddress();
  const page = await h.call(`/api/addresses/${encodeURIComponent(unknown)}/profile`);
  assert.equal(page.status, 200);
  assert.deepEqual(page.body['work'], []);
  assert.deepEqual(page.body['reviews'], []);
});

test('a review about the client appears on the client’s record, not the worker’s', async () => {
  const h = harness();
  const { payee, payerAddress, payeeAddress, id, tx } = await settledChit(h);
  await h.post(`/api/chits/${encodeURIComponent(id)}/review`, {
    signature: signAsWallet(payee, review(id, tx.hash, 5, 'Paid straight away.')),
    rating: 5,
    text: 'Paid straight away.',
  });

  const client = await h.call(`/api/addresses/${encodeURIComponent(payerAddress)}/profile`);
  assert.equal((client.body['reviews'] as unknown[]).length, 1);
  assert.equal(client.body['averageRating'], 5);

  const worker = await h.call(`/api/addresses/${encodeURIComponent(payeeAddress)}/profile`);
  assert.equal((worker.body['reviews'] as unknown[]).length, 0, 'writing a review does not rate yourself');
});

test('the balance hint reads the chain and degrades to silence when it cannot', async () => {
  const h = harness();
  const address = KeyPair.generate().toAddress().toUserFriendlyAddress();
  // The fake chain has no `getAccountByAddress`, which is the honest shape of a node that
  // cannot answer: the endpoint must say "unknown", never fail the request.
  const unknown = await h.call(`/api/balance/${encodeURIComponent(address)}`);
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body['known'], false);

  const bad = await h.call('/api/balance/not-an-address');
  assert.equal(bad.status, 400);
});

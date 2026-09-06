/**
 * A chit with no money in it — an amended scope, or a cancellation both sides signed.
 *
 * It is the same object as every other chit: same canonical form, same digest, same two
 * signatures. What has to be proven here is that the *absence* of money is handled honestly
 * rather than as a degenerate payment:
 *
 *  - the watcher never looks for a payment that will not come, and — the dangerous one — a
 *    zero floor never lets an unrelated transaction settle it;
 *  - a deadline on something nobody owes never produces an "expired" mark;
 *  - a chit that claims zero on one side and a real figure on the other is refused outright,
 *    because there is no reading of it the two parties would both recognise.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KeyPair } from '@nimiq/core';
import { canonicalise, isRecordOnly, newNonce, type Chit } from '@chit/core';
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
      hash: 'c'.repeat(64),
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
  const app = createRoutes({
    store,
    watcher,
    chain: 'test',
    baseUrl: BASE_URL,
    rateLimitPerMinute: 0,
    chainClient: fakeChain,
    currentHeight: () => fakeChain.getBlockNumber(),
  });
  const call = async (path: string, init?: RequestInit) => {
    const response = await app.fetch(new Request(`${BASE_URL}${path}`, init));
    const body = response.status === 204 ? null : await response.json();
    return { status: response.status, body: body as Record<string, unknown> };
  };
  const post = (path: string, payload: unknown) =>
    call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  return { store, fakeChain, watcher, call, post };
}

function recordChit(payer: string, payee: string, overrides: Partial<Chit> = {}): Chit {
  return {
    chain: 'test',
    kind: 'handshake',
    nonce: newNonce(),
    text: 'Change agreed — one extra round of edits, same price',
    amountMinor: 0n,
    currency: 'USD',
    luna: 0n,
    rateBlock: 4_100_000,
    deadlineBlock: 4_110_000,
    payer,
    payee,
    deliverables: 1,
    ...overrides,
  };
}

test('the core recognises a chit with no money in it, and only that', () => {
  assert.equal(isRecordOnly({ amountMinor: 0n, luna: 0n }), true);
  assert.equal(isRecordOnly({ amountMinor: 4000n, luna: 120n }), false);
  // Half-zero is not a record: one side of it still describes a payment.
  assert.equal(isRecordOnly({ amountMinor: 0n, luna: 120n }), false);
  assert.equal(isRecordOnly({ amountMinor: 4000n, luna: 0n }), false);
});

test('an amended scope is created and countersigned like any other chit', async () => {
  const h = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const chit = recordChit(payer.toAddress().toUserFriendlyAddress(), payee.toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);

  const created = await h.post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  assert.equal(created.status, 201);
  assert.equal(created.body['settled'], false);

  const id = String(created.body['id']);
  const signed = await h.post(`/api/chits/${encodeURIComponent(id)}/countersign`, { signature: signAsWallet(payee, canonical) });
  assert.equal(signed.status, 200);
  assert.equal(signed.body['countersigned'], true, 'the second signature is what finishes it');
  assert.equal(signed.body['settled'], false, 'and there is no payment to call it settled');
});

test('a chit that is zero on one side only is refused, not stored and reinterpreted later', async () => {
  const h = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  for (const broken of [{ amountMinor: 0n, luna: 500n }, { amountMinor: 4000n, luna: 0n }]) {
    const chit = recordChit(payer.toAddress().toUserFriendlyAddress(), payee.toAddress().toUserFriendlyAddress(), broken);
    const canonical = canonicalise(chit);
    const created = await h.post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
    assert.equal(created.status, 400, JSON.stringify(broken, (_k, v) => (typeof v === 'bigint' ? String(v) : v)));
    assert.equal(created.body['code'], 'bad-amount');
  }
});

test('⭐ a payment cannot settle a chit that carries no payment, even with the right memo', async () => {
  const h = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const payerAddress = payer.toAddress().toUserFriendlyAddress();
  const payeeAddress = payee.toAddress().toUserFriendlyAddress();
  const chit = recordChit(payerAddress, payeeAddress);
  const canonical = canonicalise(chit);
  const created = await h.post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const id = String(created.body['id']);
  await h.post(`/api/chits/${encodeURIComponent(id)}/countersign`, { signature: signAsWallet(payee, canonical) });

  /*
   * The trap this test exists for. Settlement accepts anything from 97% of the signed Luna
   * upwards, and 97% of nothing is nothing — so without an explicit exclusion, *any* payment
   * to the right wallet carrying this digest would mark an unpayable chit paid.
   */
  h.fakeChain.pay(payeeAddress, payerAddress, 1n, id);
  assert.equal(await h.watcher.poll(), 0, 'the watcher does not look at it at all');

  const read = await h.call(`/api/chits/${encodeURIComponent(id)}`);
  assert.equal(read.body['settled'], false, 'and a read does not settle it either');
  assert.equal(read.body['settledTx'], null);
});

test('a deadline on something nobody owes never becomes an expiry', async () => {
  const h = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const chit = recordChit(payer.toAddress().toUserFriendlyAddress(), payee.toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);
  const created = await h.post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const id = String(created.body['id']);

  h.fakeChain.height = chit.deadlineBlock + 100;
  const read = await h.call(`/api/chits/${encodeURIComponent(id)}`);
  const events = (read.body['events'] as Array<{ event: string }>).map((e) => e.event);
  assert.ok(!events.includes('expired'), `nothing is owed, so nothing is overdue — got ${events.join(', ')}`);
});

test('a record answers the chit it is about, and the original is untouched', async () => {
  const h = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const payerAddress = payer.toAddress().toUserFriendlyAddress();
  const payeeAddress = payee.toAddress().toUserFriendlyAddress();

  const original = recordChit(payerAddress, payeeAddress, { text: '$40 for 3 thumbnails by Friday', amountMinor: 4000n, luna: 120_400_000n });
  const originalCanonical = canonicalise(original);
  const first = await h.post('/api/chits', { canonical: originalCanonical, payerSignature: signAsWallet(payer, originalCanonical) });
  const originalId = String(first.body['id']);

  const amendment = recordChit(payerAddress, payeeAddress);
  const amendmentCanonical = canonicalise(amendment);
  const second = await h.post('/api/chits', {
    canonical: amendmentCanonical,
    payerSignature: signAsWallet(payer, amendmentCanonical),
    parent: originalId,
  });

  assert.equal(second.status, 201);
  assert.equal(second.body['parent'], originalId);

  const back = await h.call(`/api/chits/${encodeURIComponent(originalId)}`);
  const chitBody = back.body['chit'] as Record<string, unknown>;
  assert.equal(chitBody['amountMinor'], '4000', 'the amount both parties signed cannot be edited by a later chit');
  assert.equal(chitBody['text'], '$40 for 3 thumbnails by Friday');
  assert.ok((back.body['events'] as Array<{ event: string }>).some((e) => e.event === 'answered'));
});

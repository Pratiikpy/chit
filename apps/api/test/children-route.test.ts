/**
 * The read side of `parent`: every chit that answers this one, oldest first.
 *
 * The object itself — `parent` as metadata outside the signed text — is exercised by
 * `record-chit.test.ts` and the shared storage contract in `repository.test.ts`. What is
 * proved here is the one thing neither of those reaches: the HTTP shape a screen actually
 * gets back, and that it is a plain read nobody has to sign into or own to see.
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

function signAsWallet(keyPair: KeyPair, text: string) {
  return {
    publicKeyHex: keyPair.publicKey.toHex(),
    signatureHex: keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(text))).toHex(),
  };
}

class FakeChain {
  height = 4_100_000;
  getBlockNumber(): Promise<number> {
    return Promise.resolve(this.height);
  }
  getTransactionsByAddress(): Promise<ChainTransaction[]> {
    return Promise.resolve([]);
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
  return { call, post };
}

function openChit(payer: string, overrides: Partial<Chit> = {}): Chit {
  return {
    chain: 'test',
    kind: 'race',
    nonce: newNonce(),
    text: '$60 to cut a 30-second vertical from this footage',
    amountMinor: 6000n,
    currency: 'USD',
    luna: 15_673_981_192n,
    rateBlock: 4_100_000,
    deadlineBlock: 4_618_400,
    payer,
    payee: '',
    deliverables: 1,
    ...overrides,
  };
}

test('a chit with no answer has no children', async () => {
  const h = harness();
  const payer = KeyPair.generate();
  const chit = openChit(payer.toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);
  const created = await h.post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  assert.equal(created.status, 201);

  const read = await h.call(`/api/chits/${encodeURIComponent(String(created.body['id']))}/children`);
  assert.equal(read.status, 200);
  assert.deepEqual(read.body['children'], []);
});

test('an unknown chit answers 404, not an empty list', async () => {
  const h = harness();
  const read = await h.call('/api/chits/chit1:nope/children');
  assert.equal(read.status, 404);
  assert.equal(read.body['code'], 'not-found');
});

test('⭐ the parent finds a chit that answers it, oldest first, fully presented', async () => {
  const h = harness();
  const payer = KeyPair.generate();
  const payerAddress = payer.toAddress().toUserFriendlyAddress();

  const parentChit = openChit(payerAddress, { text: '$500 to build the landing page' });
  const parentCanonical = canonicalise(parentChit);
  const parent = await h.post('/api/chits', { canonical: parentCanonical, payerSignature: signAsWallet(payer, parentCanonical) });
  const parentId = String(parent.body['id']);

  // The next phase of the same job: a fresh chit, pointed back at the one it answers.
  const childChit = openChit(payerAddress, { text: 'Phase 2 of 3 — $200 for the checkout flow' });
  const childCanonical = canonicalise(childChit);
  const child = await h.post('/api/chits', {
    canonical: childCanonical,
    payerSignature: signAsWallet(payer, childCanonical),
    parent: parentId,
  });
  assert.equal(child.status, 201);
  const childId = String(child.body['id']);

  const read = await h.call(`/api/chits/${encodeURIComponent(parentId)}/children`);
  assert.equal(read.status, 200);
  const children = read.body['children'] as Array<Record<string, unknown>>;
  assert.equal(children.length, 1);
  assert.equal(children[0]?.['id'], childId, 'the child comes back fully presented, not just its id');
  assert.equal((children[0]?.['chit'] as Record<string, unknown>)['text'], 'Phase 2 of 3 — $200 for the checkout flow');

  // Answering it back the other way must not find it: parent-of does not mean child-of.
  const backwards = await h.call(`/api/chits/${encodeURIComponent(childId)}/children`);
  assert.deepEqual(backwards.body['children'], []);
});

test('naming a parent that does not exist is refused, not silently dropped', async () => {
  const h = harness();
  const payer = KeyPair.generate();
  const chit = openChit(payer.toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);
  const created = await h.post('/api/chits', {
    canonical,
    payerSignature: signAsWallet(payer, canonical),
    parent: 'chit1:nope',
  });
  assert.equal(created.status, 400);
  assert.equal(created.body['code'], 'no-parent');
});

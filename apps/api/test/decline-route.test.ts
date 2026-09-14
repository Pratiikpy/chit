/**
 * Decline used to take no signature at all — the route trusted whoever called it. That was an
 * unauthenticated way to mutate someone else's chit: a stranger who merely saw the link (or, for
 * an open race, merely read its id off the public board) could decline it on the named worker's
 * behalf, or knock an open listing off the board for everyone, with no wallet and no proof of
 * anything. These tests are about the two rules that make declining mean something:
 *
 *  1. **Only the wallet the offer was sent to may decline it**, proven the same way a
 *     countersignature is — over a canonical form bound to this one chit.
 *  2. **A chit with nobody named on it yet cannot be declined by anyone** — there is no "them"
 *     to decline as, and the payer's own way to withdraw an open listing is a different action.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { KeyPair } from '@nimiq/core';
import { canonicalise, canonicaliseDecline, newNonce, type Chit } from '@chit/core';
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

  return { store, post };
}

async function openHandshake(
  post: (path: string, payload: unknown) => Promise<{ status: number; body: Record<string, unknown> }>,
  payer: KeyPair,
  worker: KeyPair,
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
  return { id: created.body['id'] as string, canonical };
}

async function openRace(
  post: (path: string, payload: unknown) => Promise<{ status: number; body: Record<string, unknown> }>,
  payer: KeyPair,
) {
  const chit: Chit = {
    chain: 'test',
    kind: 'race',
    nonce: newNonce(),
    text: '$25 for a 30-second edit',
    amountMinor: 2500n,
    currency: 'USD',
    luna: 500_000n,
    rateBlock: HEIGHT - 100,
    deadlineBlock: HEIGHT + 100_000,
    payer: payer.toAddress().toUserFriendlyAddress(),
    payee: '',
    deliverables: 1,
  };
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: sign(payer, canonical) });
  assert.ok(created.status === 201 || created.status === 200, JSON.stringify(created.body));
  return created.body['id'] as string;
}

const declineAs = (
  post: (path: string, payload: unknown) => Promise<{ status: number; body: Record<string, unknown> }>,
  id: string,
  signer: KeyPair,
) => post(`/api/chits/${id}/decline`, { signature: sign(signer, canonicaliseDecline({ chitId: id })) });

/* ------------------------------------------------------------------ the ordinary path */

test('⭐ the named worker declines with a valid signature, and it sticks', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await openHandshake(post, payer, worker);

  const declined = await declineAs(post, id, worker);
  assert.equal(declined.status, 200, JSON.stringify(declined.body));
  assert.equal(declined.body['declined'], true);
});

/* ------------------------------------------------------------------ the rules */

test('⭐ a stranger cannot decline a handshake that was not sent to them', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await openHandshake(post, payer, worker);

  for (const impostor of [payer, KeyPair.generate()]) {
    const declined = await declineAs(post, id, impostor);
    assert.equal(declined.status, 403, 'only the named payee may decline');
    assert.equal(declined.body['code'], 'not-yours');
  }
  assert.equal((await post(`/api/chits/${id}/decline`, {})).body['declined'], undefined);
});

test('⭐ declining with no signature at all is refused, not treated as a bare click', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id } = await openHandshake(post, payer, worker);

  const declined = await post(`/api/chits/${id}/decline`, {});
  assert.equal(declined.status, 400);
  assert.equal(declined.body['code'], 'missing-signature');
});

test('⭐ an open race names nobody, so anyone with a real signature may decline it — the same as anyone may countersign it', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();

  // A stranger, unrelated to the payer entirely, is exactly as entitled to decline as the payer is.
  const idA = await openRace(post, payer);
  const declinedByStranger = await declineAs(post, idA, KeyPair.generate());
  assert.equal(declinedByStranger.status, 200, JSON.stringify(declinedByStranger.body));
  assert.equal(declinedByStranger.body['declined'], true);

  const idB = await openRace(post, payer);
  const declinedByPayer = await declineAs(post, idB, payer);
  assert.equal(declinedByPayer.status, 200, JSON.stringify(declinedByPayer.body));
});

test('⭐ but an open race still refuses a signature that does not verify — "anyone" means any real wallet, not no proof at all', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const id = await openRace(post, payer);

  const forged = await post(`/api/chits/${id}/decline`, {
    signature: { publicKeyHex: KeyPair.generate().publicKey.toHex(), signatureHex: '00'.repeat(64) },
  });
  assert.equal(forged.status, 403);
  assert.equal(forged.body['code'], 'bad-signature');
});

test('⭐ a declined race stays open for someone else — decline is not a countersignature', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const decliner = KeyPair.generate();
  const laterWorker = KeyPair.generate();
  const id = await openRace(post, payer);

  const declined = await declineAs(post, id, decliner);
  assert.equal(declined.status, 200);

  const stored = await store.get(id);
  const signed = await post(`/api/chits/${id}/countersign`, { signature: sign(laterWorker, stored!.canonical) });
  assert.equal(signed.status, 200, JSON.stringify(signed.body));
  assert.equal(signed.body['countersigned'], true);
});

test('⭐ a decline signed for one chit does not carry over to another', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id: idA } = await openHandshake(post, payer, worker);
  const { id: idB } = await openHandshake(post, payer, worker);

  // A valid decline signature for A, replayed against B.
  const replayed = await post(`/api/chits/${idB}/decline`, { signature: sign(worker, canonicaliseDecline({ chitId: idA })) });
  assert.equal(replayed.status, 403);
  assert.equal((await post(`/api/chits/${idA}/decline`, {})).body['declined'], undefined);
});

test('a quote still has no counterparty to decline it', async () => {
  const { post } = harness();
  const worker = KeyPair.generate();
  const chit: Chit = {
    chain: 'test',
    kind: 'quote',
    nonce: newNonce(),
    text: '$40 for a logo animation',
    amountMinor: 4000n,
    currency: 'USD',
    luna: 100_000_000n,
    rateBlock: HEIGHT - 100,
    deadlineBlock: HEIGHT + 100_000,
    payer: '',
    payee: worker.toAddress().toUserFriendlyAddress(),
    deliverables: 1,
  };
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: sign(worker, canonical) });
  const id = created.body['id'] as string;

  const declined = await declineAs(post, id, worker);
  assert.equal(declined.status, 409);
  assert.equal(declined.body['code'], 'not-declinable');
});

test('a chit that has already been countersigned is too late to decline', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const { id, canonical } = await openHandshake(post, payer, worker);

  const countersigned = await post(`/api/chits/${id}/countersign`, { signature: sign(worker, canonical) });
  assert.equal(countersigned.status, 200, JSON.stringify(countersigned.body));

  const declined = await declineAs(post, id, worker);
  assert.equal(declined.status, 409);
  assert.equal(declined.body['code'], 'too-late');
});

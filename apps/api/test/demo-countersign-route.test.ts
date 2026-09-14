/**
 * The demo worker used to countersign whatever open chit id it was handed, for anyone who asked
 * — which is not "a judge with nobody to send a chit to completes their own demo," it is any
 * stranger able to make the server's own fixed wallet claim someone else's real, open race
 * listing. These tests are about the rule that makes it safe: only the chit's own payer, proven
 * by a signature bound to this one chit, may ask for the demo worker.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { KeyPair } from '@nimiq/core';
import { canonicalise, canonicaliseDemoRequest, newNonce, type Chit } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';

import { SqliteRepository } from '../src/repository.ts';
import { createRoutes } from '../src/routes.ts';
import { SettlementWatcher } from '../src/watcher.ts';
import { DemoWorker } from '../src/bounty.ts';
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

function harness(withDemo = true) {
  const store = new SqliteRepository(':memory:');
  const chain = new FakeChain();
  const watcher = new SettlementWatcher({ store, chain, intervalMs: 1_000_000 });
  const demoWorker = withDemo ? new DemoWorker(KeyPair.generate().privateKey.toHex()) : undefined;
  const app = createRoutes({
    store,
    watcher,
    chain: 'test',
    baseUrl: BASE_URL,
    rateLimitPerMinute: 0,
    currentHeight: () => chain.getBlockNumber(),
    ...(demoWorker ? { demoWorker } : {}),
  });

  const call = async (path: string, init?: RequestInit) => {
    const response = await app.fetch(new Request(`${BASE_URL}${path}`, init));
    const body = response.status === 204 ? null : await response.json();
    return { status: response.status, body: body as Record<string, unknown> };
  };
  const post = (path: string, payload: unknown) =>
    call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

  return { store, post, demoWorker };
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

const requestDemoAs = (
  post: (path: string, payload: unknown) => Promise<{ status: number; body: Record<string, unknown> }>,
  id: string,
  signer: KeyPair,
) => post(`/api/chits/${id}/demo-countersign`, { signature: sign(signer, canonicaliseDemoRequest({ chitId: id })) });

test('⭐ the chit’s own payer may ask the demo worker to countersign it', async () => {
  const { post, demoWorker } = harness();
  const payer = KeyPair.generate();
  const id = await openRace(post, payer);

  const result = await requestDemoAs(post, id, payer);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body['countersigned'], true);
  assert.equal(result.body['payTo'], demoWorker!.address);
});

test('⭐ a stranger cannot make the demo worker claim someone else’s open race', async () => {
  const { store, post } = harness();
  const payer = KeyPair.generate();
  const id = await openRace(post, payer);

  const result = await requestDemoAs(post, id, KeyPair.generate());
  assert.equal(result.status, 403);
  assert.equal(result.body['code'], 'not-yours');
  assert.equal((await store.get(id))?.payeeSignature, undefined, 'the real listing must stay unclaimed');
});

test('⭐ asking with no signature at all is refused', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const id = await openRace(post, payer);

  const result = await post(`/api/chits/${id}/demo-countersign`, {});
  assert.equal(result.status, 400);
  assert.equal(result.body['code'], 'missing-signature');
});

test('⭐ a request signed for one chit does not carry over to another', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const idA = await openRace(post, payer);
  const idB = await openRace(post, payer);

  const replayed = await post(`/api/chits/${idB}/demo-countersign`, { signature: sign(payer, canonicaliseDemoRequest({ chitId: idA })) });
  assert.equal(replayed.status, 403);
  assert.equal(replayed.body['code'], 'not-yours');
});

test('asking again once it is already countersigned is answered calmly, not with a second signing', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const id = await openRace(post, payer);

  const first = await requestDemoAs(post, id, payer);
  assert.equal(first.status, 200);
  const again = await post(`/api/chits/${id}/demo-countersign`, {});
  assert.equal(again.status, 200);
  assert.equal(again.body['alreadyCountersigned'], true);
});

test('no demo worker on this deployment answers plainly, before anything else is checked', async () => {
  const { post } = harness(false);
  const payer = KeyPair.generate();
  const id = await openRace(post, payer);

  const result = await post(`/api/chits/${id}/demo-countersign`, {});
  assert.equal(result.status, 404);
  assert.equal(result.body['code'], 'no-demo');
});

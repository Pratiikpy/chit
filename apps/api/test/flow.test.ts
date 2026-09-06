/**
 * Door one, end to end, with nothing stubbed but the chain.
 *
 * Real Ed25519 keys, the real canonical form, the real HTTP handlers, the real database,
 * the real watcher. The only fake is the chain client, because we cannot mine a block in a
 * test — and even that returns transactions in the exact shape the RPC does.
 *
 * If this suite is green, the flow works. What it cannot prove is that Nimiq Pay frames
 * `sign()` the way the four reference implementations do; only a device settles that
 * (`PRODUCT_SPEC.md` §19).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KeyPair } from '@nimiq/core';
import { canonicalise, canonicaliseDelivery, chitHash, newNonce, type Chit } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';
import { ChitStore } from '../src/db.ts';
import { SqliteRepository } from '../src/repository.ts';
import { createRoutes } from '../src/routes.ts';
import { SettlementWatcher } from '../src/watcher.ts';
import { matchSettlements, normaliseTransaction, type ChainTransaction } from '../src/chain.ts';

const BASE_URL = 'http://chit.test';

/** Addresses are compared without their display spacing, the same way the matcher does. */
const key = (address: string) => address.replace(/\s/g, '').toUpperCase();

function signAsWallet(keyPair: KeyPair, text: string) {
  return {
    publicKeyHex: keyPair.publicKey.toHex(),
    signatureHex: keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(text))).toHex(),
  };
}

/** A chain client whose transaction list the test controls. */
class FakeChain {
  height = 4_100_000;
  transactions = new Map<string, ChainTransaction[]>();

  getBlockNumber(): Promise<number> {
    return Promise.resolve(this.height);
  }

  getTransactionsByAddress(address: string): Promise<ChainTransaction[]> {
    return Promise.resolve(this.transactions.get(key(address)) ?? []);
  }

  /** Add a settling payment in the exact shape the RPC returns. */
  pay(to: string, from: string, luna: bigint, memo: string, hash = `tx_${Math.random().toString(36).slice(2)}`) {
    const tx = normaliseTransaction({
      hash,
      blockNumber: ++this.height,
      timestamp: Date.now(),
      from,
      // The RPC echoes the address in its user-friendly, space-grouped form while the
      // canonical chit stores it tight. Keeping the difference here is deliberate: it is
      // what the real endpoint does, so the matcher's normalisation gets exercised.
      to,
      value: Number(luna),
      recipientData: memo,
    });
    assert.ok(tx, 'fixture must normalise');
    this.transactions.set(key(to), [...(this.transactions.get(key(to)) ?? []), tx]);
    return tx;
  }
}

function harness(chain: 'main' | 'test' = 'test') {
  const store = new SqliteRepository(':memory:');
  const fakeChain = new FakeChain();
  const watcher = new SettlementWatcher({ store, chain: fakeChain, intervalMs: 1_000_000 });
  const app = createRoutes({ store, watcher, chain, baseUrl: BASE_URL, rateLimitPerMinute: 0 });

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

test('⭐ the whole of door one: paste, sign, share, countersign, settle, verify', async () => {
  const { post, call, fakeChain, watcher } = harness();

  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const payerAddress = payer.toAddress().toUserFriendlyAddress();
  const payeeAddress = payee.toAddress().toUserFriendlyAddress();

  // 1. The payer signs the line they agreed elsewhere.
  const chit = makeChit(payerAddress, payeeAddress);
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });

  assert.equal(created.status, 201);
  assert.equal(created.body['id'], chitHash(chit));
  assert.equal(created.body['countersigned'], false);
  assert.equal(created.body['settled'], false);
  assert.match(String(created.body['shareUrl']), /\/c\/chit1%3A/, 'a link to send the other side');

  const id = String(created.body['id']);

  // 2. The other side opens the link and countersigns.
  const countersigned = await post(`/api/chits/${encodeURIComponent(id)}/countersign`, {
    signature: signAsWallet(payee, canonical),
  });
  assert.equal(countersigned.status, 200);
  assert.equal(countersigned.body['countersigned'], true);
  assert.equal(countersigned.body['settled'], false, 'agreeing is not paying');

  // 3. The payer pays, carrying the chit's digest in the memo.
  const tx = fakeChain.pay(payeeAddress, payerAddress, chit.luna, id);

  // 4. The watcher notices — not the client, which has an interest in claiming it did.
  assert.equal(await watcher.poll(), 1);

  // 5. The receipt now exists and verifies for a stranger with no wallet.
  const verified = await call(`/api/verify/${encodeURIComponent(tx.hash)}`);
  assert.equal(verified.status, 200);
  const verification = verified.body['verification'] as Record<string, unknown>;
  assert.equal(verification['ok'], true);
  assert.equal(verification['countersigned'], true);
  assert.equal(verification['settled'], true);
  assert.equal(verified.body['settledTx'], tx.hash);

  // The full history is on the record, in order.
  const events = (verified.body['events'] as Array<{ event: string }>).map((e) => e.event);
  assert.deepEqual(events, ['created', 'countersigned', 'settled']);
});

test('creating the same chit twice is idempotent — a mobile retry is not a second deal', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), KeyPair.generate().toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);
  const payload = { canonical, payerSignature: signAsWallet(payer, canonical) };

  const first = await post('/api/chits', payload);
  const second = await post('/api/chits', payload);

  assert.equal(first.status, 201, 'created');
  assert.equal(second.status, 200, 'already existed');
  assert.equal(first.body['id'], second.body['id']);
});

test('a forged signature is refused before anything is stored', async () => {
  const { post, store } = harness();
  const payer = KeyPair.generate();
  const impostor = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), KeyPair.generate().toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);

  const response = await post('/api/chits', { canonical, payerSignature: signAsWallet(impostor, canonical) });
  assert.equal(response.status, 400);
  assert.equal(response.body['code'], 'address-mismatch');
  assert.equal(await store.get(chitHash(chit)), undefined, 'nothing was written');
});

test('⭐ a chit for the wrong network is refused', async () => {
  // sign() has no domain separation, so without this a testnet signature is accepted by a
  // mainnet service and the receipt means nothing.
  const { post } = harness('main');
  const payer = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), KeyPair.generate().toAddress().toUserFriendlyAddress(), { chain: 'test' });
  const canonical = canonicalise(chit);

  const response = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  assert.equal(response.status, 400);
  assert.equal(response.body['code'], 'chain-mismatch');
});

test('⭐ a stranger cannot countersign a handshake meant for someone else', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const stranger = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), payee.toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);

  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const response = await post(`/api/chits/${encodeURIComponent(String(created.body['id']))}/countersign`, {
    signature: signAsWallet(stranger, canonical),
  });

  assert.equal(response.status, 400);
  assert.equal(response.body['code'], 'address-mismatch');
});

test('opening the countersign link twice is calm, not an error', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), payee.toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);

  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const id = encodeURIComponent(String(created.body['id']));
  const signature = signAsWallet(payee, canonical);

  const first = await post(`/api/chits/${id}/countersign`, { signature });
  const second = await post(`/api/chits/${id}/countersign`, { signature });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200, 'a second open is not a failure');
  assert.equal(second.body['alreadyCountersigned'], true);
});

test('⭐ a payment to the wrong address does not settle a chit, even with the right memo', async () => {
  // The digest is public once shared. Without the recipient check, anyone could copy it
  // into a 1-Luna payment of their own and mark someone else's chit paid.
  const { post, fakeChain, watcher, store } = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), payee.toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const id = String(created.body['id']);

  const elsewhere = KeyPair.generate().toAddress().toUserFriendlyAddress();
  fakeChain.pay(elsewhere, payer.toAddress().toUserFriendlyAddress(), chit.luna, id);

  assert.equal(await watcher.poll(), 0, 'nothing settled');
  assert.equal((await store.get(id))?.settledTx, undefined);
});

test('an unrelated payment to the right address does not settle a chit', async () => {
  const { post, fakeChain, watcher, store } = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const payeeAddress = payee.toAddress().toUserFriendlyAddress();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), payeeAddress);
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });

  fakeChain.pay(payeeAddress, payer.toAddress().toUserFriendlyAddress(), 500n, 'hello, unrelated');

  assert.equal(await watcher.poll(), 0);
  assert.equal((await store.get(String(created.body['id'])))?.settledTx, undefined);
});

test('settlement is recorded once, however many times the watcher runs', async () => {
  const { post, fakeChain, watcher, store } = harness();
  const payer = KeyPair.generate();
  const payee = KeyPair.generate();
  const payeeAddress = payee.toAddress().toUserFriendlyAddress();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), payeeAddress);
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const id = String(created.body['id']);

  fakeChain.pay(payeeAddress, payer.toAddress().toUserFriendlyAddress(), chit.luna, id);

  assert.equal(await watcher.poll(), 1);
  assert.equal(await watcher.poll(), 0, 'already settled');
  assert.equal(await watcher.poll(), 0);
  assert.equal((await store.events(id)).filter((e) => e.event === 'settled').length, 1);
});

test('the watcher survives an RPC failure and keeps going', async () => {
  const store = new SqliteRepository(':memory:');
  let calls = 0;
  const flaky = {
    getBlockNumber: () => {
      calls++;
      return calls === 1 ? Promise.reject(new Error('rpc down')) : Promise.resolve(4_100_000);
    },
    getTransactionsByAddress: () => Promise.resolve([]),
  };
  const watcher = new SettlementWatcher({ store, chain: flaky });
  const app = createRoutes({ store, watcher, chain: 'test', baseUrl: BASE_URL, rateLimitPerMinute: 0 });

  const payer = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), KeyPair.generate().toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);
  await app.fetch(
    new Request(`${BASE_URL}/api/chits`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ canonical, payerSignature: signAsWallet(payer, canonical) }),
    }),
  );

  await watcher.poll();
  assert.equal(watcher.stats.errors, 1, 'the failure was counted, not swallowed');
  await watcher.poll();
  assert.equal(watcher.stats.polls, 1, 'and the next cycle ran');
});

test('malformed requests are rejected with a code the UI can branch on', async () => {
  const { post, call } = harness();

  const badJson = await call('/api/chits', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });
  assert.equal(badJson.status, 400);
  assert.equal(badJson.body['code'], 'bad-json');

  assert.equal((await post('/api/chits', {})).body['code'], 'missing-canonical');
  assert.equal((await post('/api/chits', { canonical: 'x' })).body['code'], 'missing-signature');
  assert.equal(
    (await post('/api/chits', { canonical: 'nope', payerSignature: { publicKeyHex: 'aa'.repeat(32), signatureHex: 'bb'.repeat(64) } })).body['code'],
    'malformed-canonical',
  );
  assert.equal((await call('/api/chits/chit1%3Anope')).status, 404);
  assert.equal((await call('/api/verify/nosuchtx')).status, 404);
});

test('the amount survives the wire as a string, never a float', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  // A value above 2^53 would lose precision as a JSON number.
  const huge = 9_007_199_254_740_993n;
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), KeyPair.generate().toAddress().toUserFriendlyAddress(), { luna: huge });
  const canonical = canonicalise(chit);

  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const returned = created.body['chit'] as Record<string, unknown>;
  assert.equal(returned['luna'], '9007199254740993', 'exact, as a string');
  assert.equal(BigInt(String(returned['luna'])), huge);
});

test('health reports the watcher, so a silent stall is visible', async () => {
  const { call, watcher } = harness();
  await watcher.poll();
  const health = await call('/health');
  assert.equal(health.status, 200);
  assert.equal(health.body['ok'], true);
  assert.equal(health.body['chain'], 'test');
  const stats = health.body['watcher'] as { lastPollAt: number; polls: number };
  assert.ok(stats.lastPollAt > 0, 'the watcher reports when it last ran');
  assert.equal(stats.polls, 1);
});

test('matchSettlements needs both the memo and the recipient', () => {
  // Real-length memos: `isChitMemo` requires the exact 49-byte shape, so a truncated
  // stand-in would be rejected for the wrong reason and prove nothing.
  const mine = chitHash(makeChit('NQ56M67GT26X3N9VXDGEQ3BNHSVUE13YQNGV', 'NQ0700000000000000000000000000000000'));
  const other = chitHash(makeChit('NQ56M67GT26X3N9VXDGEQ3BNHSVUE13YQNGV', 'NQ0700000000000000000000000000000000', { nonce: newNonce() }));
  assert.notEqual(mine, other);

  const payee = 'NQ56M67GT26X3N9VXDGEQ3BNHSVUE13YQNGV';
  const open = [{ id: mine, payee, luna: 100n }];
  const base = { hash: 'h', blockNumber: 1, timestamp: 0, from: 'NQ07', value: 100n };

  assert.equal(matchSettlements([{ ...base, to: payee, memo: mine }], open).length, 1);
  assert.equal(
    matchSettlements([{ ...base, to: 'NQ56 M67G T26X 3N9V XDGE Q3BN HSVU E13Y QNGV', memo: mine }], open).length,
    1,
    'the display-spaced form of the same address still matches',
  );
  assert.equal(matchSettlements([{ ...base, to: 'NQ07OTHER', memo: mine }], open).length, 0, 'wrong recipient');
  assert.equal(matchSettlements([{ ...base, to: payee, memo: other }], open).length, 0, 'wrong memo');
  assert.equal(matchSettlements([{ ...base, to: payee, memo: null }], open).length, 0, 'no memo');
  assert.equal(matchSettlements([{ ...base, to: payee, memo: 'chit1:tooshort' }], open).length, 0, 'malformed memo');
});

test('⭐ an open chit learns the payee from whoever countersigns, and settles to them', async () => {
  // The real door-one shape: the payer agreed a deal in a Fiverr DM and knows the person,
  // but not their Nimiq address. They sign an open chit; countersigning supplies the
  // address, derived from the key that signed rather than typed in by anyone.
  const { post, call, fakeChain, watcher } = harness();

  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const payerAddress = payer.toAddress().toUserFriendlyAddress();
  const workerAddress = worker.toAddress().toUserFriendlyAddress();

  const chit = makeChit(payerAddress, '', { kind: 'race' });
  const canonical = canonicalise(chit);

  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  assert.equal(created.status, 201);
  assert.equal(created.body['payTo'], null, 'nobody to pay yet');

  const countersigned = await post(`/api/chits/${encodeURIComponent(String(created.body['id']))}/countersign`, {
    signature: signAsWallet(worker, canonical),
  });
  assert.equal(countersigned.status, 200);
  assert.equal(
    String(countersigned.body['payTo']).replace(/\s/g, ''),
    workerAddress.replace(/\s/g, ''),
    'the address arrives with the countersignature',
  );

  // Paying that address settles it.
  fakeChain.pay(workerAddress, payerAddress, chit.luna, String(created.body['id']));
  assert.equal(await watcher.poll(), 1);

  const after = await call(`/api/chits/${encodeURIComponent(String(created.body['id']))}`);
  assert.equal(after.body['settled'], true);
});

test('an open chit with nobody countersigned is not watched', async () => {
  // There is no destination yet, so there is nothing a payment could match against.
  const { post, watcher, fakeChain } = harness();
  const payer = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), '', { kind: 'race' });
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });

  fakeChain.pay(KeyPair.generate().toAddress().toUserFriendlyAddress(), payer.toAddress().toUserFriendlyAddress(), chit.luna, String(created.body['id']));
  assert.equal(await watcher.poll(), 0);
});

test('⭐ the chain height is recorded even when there is nothing to settle', async () => {
  // Read only when open chits existed, a freshly started service reported height 0 — and
  // the first chit anyone created showed a raw block number with no due date.
  const store = new SqliteRepository(':memory:');
  const fakeChain = new FakeChain();
  const watcher = new SettlementWatcher({ store, chain: fakeChain, intervalMs: 1_000_000 });

  assert.equal((await store.awaitingSettlement()).length, 0, 'nothing to settle');
  await watcher.poll();
  assert.equal(watcher.stats.lastHeight, fakeChain.height, 'the height was still read');
});

test('a chit response carries the height, so a deadline can be shown in days', async () => {
  const { post, call, watcher } = harness();
  await watcher.poll();

  const payer = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), '', { kind: 'race' });
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });

  const fetched = await call(`/api/chits/${encodeURIComponent(String(created.body['id']))}`);
  assert.ok(Number(fetched.body['currentBlock']) > 0, 'the client can compute days remaining');
});

test('⭐ a payment below the floor does not settle, and leaves a settlement-mismatch trace', async () => {
  // Until the floor existed the amount was never checked: a 1-Luna transaction carrying
  // the digest would have marked a $60 chit paid. Now it is refused and recorded.
  const { post, call, watcher, store, fakeChain } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), '', { kind: 'race' });
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const id = String(created.body['id']);
  await post(`/api/chits/${encodeURIComponent(id)}/countersign`, { signature: signAsWallet(worker, canonical) });

  fakeChain.pay(worker.toAddress().toUserFriendlyAddress(), payer.toAddress().toUserFriendlyAddress(), chit.luna / 2n, id);
  assert.equal(await watcher.poll(), 0, 'half the agreed amount settles nothing');
  const events = (await store.events(id)).map((e) => e.event);
  assert.ok(events.includes('settlement-mismatch'), `the underpayment is recorded: ${events.join(',')}`);
  assert.equal((await call(`/api/chits/${encodeURIComponent(id)}`)).body['settled'], false);

  // The exact amount settles, and the sender is recorded on the chit.
  fakeChain.pay(worker.toAddress().toUserFriendlyAddress(), payer.toAddress().toUserFriendlyAddress(), chit.luna, id);
  assert.equal(await watcher.poll(), 1);
  const settled = await store.get(id);
  assert.equal(settled?.settledFrom?.replace(/\s/g, ''), payer.toAddress().toUserFriendlyAddress().replace(/\s/g, ''));
});

test('⭐ "here it is" is signed by the party being paid, and by nobody else', async () => {
  const { post, store } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const stranger = KeyPair.generate();

  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), worker.toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  assert.equal(created.status, 201);
  const id = created.body['id'] as string;

  const deliver = (kp: KeyPair, link = 'https://drive.example/final.mp4', note = '') =>
    post(`/api/chits/${encodeURIComponent(id)}/delivered`, {
      signature: signAsWallet(kp, canonicaliseDelivery({ chitId: id, link, note })),
      link,
      note,
    });

  // A stranger's signature is refused even though the canonical text is exactly right.
  const bad = await deliver(stranger);
  assert.equal(bad.status, 400);

  // Nor may the payer declare their own job delivered.
  assert.equal((await deliver(payer)).status, 400);

  const ok = await deliver(worker, 'https://drive.example/final.mp4', 'final cut, 30s');
  assert.equal(ok.status, 200);
  const delivery = ok.body['delivery'] as { link: string; note: string; at: number };
  assert.equal(delivery.link, 'https://drive.example/final.mp4');
  assert.equal(delivery.note, 'final cut, 30s');
  assert.equal(typeof delivery.at, 'number');
  assert.equal(ok.body['settled'], false, 'saying it is delivered pays nobody');

  // Said twice, answered calmly: the first mark stands.
  const again = await deliver(worker, 'https://drive.example/other.mp4');
  assert.equal(again.status, 200);
  assert.equal(again.body['alreadyDelivered'], true);
  const stored = await store.get(id);
  assert.equal(stored?.delivery?.link, 'https://drive.example/final.mp4');

  assert.deepEqual((await store.events(id)).map((e) => e.event), ['created', 'delivered']);
});

test('a delivery link can never be a script URL, however it is signed', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), worker.toAddress().toUserFriendlyAddress());
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const id = created.body['id'] as string;

  for (const link of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd']) {
    const response = await post(`/api/chits/${encodeURIComponent(id)}/delivered`, {
      signature: signAsWallet(worker, 'anything'),
      link,
      note: '',
    });
    assert.equal(response.status, 400, `accepted ${link}`);
    assert.equal(response.body['code'], 'bad-delivery');
  }
});

test('nothing can be delivered before anyone has agreed to do it', async () => {
  const { post } = harness();
  const payer = KeyPair.generate();
  const worker = KeyPair.generate();
  // An open race chit names no payee, so there is nobody whose signature would count.
  const chit = makeChit(payer.toAddress().toUserFriendlyAddress(), '', { kind: 'race' });
  const canonical = canonicalise(chit);
  const created = await post('/api/chits', { canonical, payerSignature: signAsWallet(payer, canonical) });
  const id = created.body['id'] as string;

  const response = await post(`/api/chits/${encodeURIComponent(id)}/delivered`, {
    signature: signAsWallet(worker, canonicaliseDelivery({ chitId: id, link: '', note: '' })),
    link: '',
    note: '',
  });
  assert.equal(response.status, 409);
  assert.equal(response.body['code'], 'no-payee');
});

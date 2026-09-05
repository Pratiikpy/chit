/**
 * The bounty is the part of chit most likely to be read as a faucet, so every rule that
 * makes it work — and every limit — is pinned here, against a fake chain that records what
 * it was asked to broadcast.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KeyPair } from '@nimiq/core';
import { nimiqSignedMessageDigest } from '@chit/verify';
import { SqliteRepository } from '../src/repository.ts';
import { BountyService, DemoWorker, checkAnswer } from '../src/bounty.ts';
import type { PayoutRpc } from '../src/payout.ts';

class FakeRpc implements PayoutRpc {
  height = 4_100_000;
  broadcasts: string[] = [];
  balance = 10_000_00000n;
  failNext = false;
  async getBlockNumber() {
    return this.height;
  }
  async sendRawTransaction(hex: string) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('node refused');
    }
    this.broadcasts.push(hex);
    return `0xfake${this.broadcasts.length}`;
  }
  async getAccountByAddress() {
    return { balance: this.balance };
  }
}

const POOL_KEY = KeyPair.generate();
const poolHex = POOL_KEY.privateKey.toHex();

function signAs(kp: KeyPair, canonical: string) {
  return {
    publicKeyHex: kp.publicKey.toHex(),
    signatureHex: kp.sign(nimiqSignedMessageDigest(new TextEncoder().encode(canonical))).toHex(),
  };
}

const device = (n: number) => n.toString(16).padStart(64, '0');

test('an answer is real work or it is refused, by the same rules for everyone', () => {
  assert.equal(checkAnswer('', []).ok, false);
  assert.equal((checkAnswer('nice app', []) as { code: string }).code, 'too-short');
  assert.equal((checkAnswer('see https://example.com for my thoughts here', []) as { code: string }).code, 'link');
  assert.equal((checkAnswer('Test chit. Tell us one thing that confused you, in one sentence.', []) as { code: string }).code, 'echo');
  const first = checkAnswer('I did not understand why the deadline is shown as a block number.', []);
  assert.equal(first.ok, true);
  const copy = checkAnswer('I did not understand why the deadline is shown as a block number!!', ['I did not understand why the deadline is shown as a block number.']);
  assert.equal((copy as { code: string }).code, 'duplicate', 'near-duplicates are refused');
  const fresh = checkAnswer('The currency chips did not explain what tapping one would change.', ['I did not understand why the deadline is shown as a block number.']);
  assert.equal(fresh.ok, true, 'a genuinely different sentence passes');
});

test('⭐ the pool posts open chits, a tester claims one with an answer, and the pool pays with the digest in the memo', async () => {
  const repo = new SqliteRepository(':memory:');
  const rpc = new FakeRpc();
  const bounty = new BountyService(repo, rpc, undefined, { privateKeyHex: poolHex, chain: 'test', openSlots: 2 });

  const open = await bounty.ensureOpen();
  assert.equal(open.length, 2, 'the configured number of bounties is open');
  assert.ok(open.every((c) => bounty.isBounty(c)), 'each one is signed by the pool and open');
  assert.ok(open.every((c) => c.chit.payer.replace(/\s/g, '') === bounty.address.replace(/\s/g, '')));

  const tester = KeyPair.generate();
  const target = open[0]!;
  const claim = await bounty.claim({
    stored: target,
    signature: signAs(tester, target.canonical),
    workerAddress: tester.toAddress().toUserFriendlyAddress(),
    answer: 'The share screen did not say the other person needs the Nimiq Pay app.',
    deviceHash: device(1),
  });
  assert.equal(claim.ok, true, JSON.stringify(claim));
  assert.equal(rpc.broadcasts.length, 1, 'exactly one payment was broadcast');

  const after = await repo.get(target.id);
  assert.ok(after?.payeeSignature, 'the tester countersigned');
  assert.equal(after?.answer, 'The share screen did not say the other person needs the Nimiq Pay app.');
  assert.equal(after?.payoutTx, '0xfake1');
  const events = (await repo.events(target.id)).map((e) => e.event);
  assert.deepEqual(events, ['created', 'bounty-posted', 'countersigned', 'bounty-claimed', 'bounty-paid']);

  // The list refills on the next read: never empty on judge day.
  assert.equal((await bounty.ensureOpen()).length, 2);
});

test('limits: one per wallet per day, one per device per day, and a daily cap', async () => {
  const repo = new SqliteRepository(':memory:');
  const rpc = new FakeRpc();
  const bounty = new BountyService(repo, rpc, undefined, { privateKeyHex: poolHex, chain: 'test', openSlots: 4, dailyCapLuna: 500_000n });
  const open = await bounty.ensureOpen(); // each pays 200 000 Luna in tests

  const a = KeyPair.generate();
  const ok = await bounty.claim({ stored: open[0]!, signature: signAs(a, open[0]!.canonical), workerAddress: a.toAddress().toUserFriendlyAddress(), answer: 'The word countersign meant nothing to me on the first screen.', deviceHash: device(1) });
  assert.equal(ok.ok, true);

  const sameWallet = await bounty.claim({ stored: open[1]!, signature: signAs(a, open[1]!.canonical), workerAddress: a.toAddress().toUserFriendlyAddress(), answer: 'The QR code was not obviously something to scan with a phone.', deviceHash: device(2) });
  assert.equal((sameWallet as { code: string }).code, 'wallet-limit');

  const b = KeyPair.generate();
  const sameDevice = await bounty.claim({ stored: open[1]!, signature: signAs(b, open[1]!.canonical), workerAddress: b.toAddress().toUserFriendlyAddress(), answer: 'The QR code was not obviously something to scan with a phone.', deviceHash: device(1) });
  assert.equal((sameDevice as { code: string }).code, 'device-limit');

  const fine = await bounty.claim({ stored: open[1]!, signature: signAs(b, open[1]!.canonical), workerAddress: b.toAddress().toUserFriendlyAddress(), answer: 'The QR code was not obviously something to scan with a phone.', deviceHash: device(2) });
  assert.equal(fine.ok, true);

  const c = KeyPair.generate();
  const capped = await bounty.claim({ stored: open[2]!, signature: signAs(c, open[2]!.canonical), workerAddress: c.toAddress().toUserFriendlyAddress(), answer: 'I could not tell whether signing would move money out of my wallet.', deviceHash: device(3) });
  assert.equal((capped as { code: string }).code, 'daily-cap', '400 000 paid + 200 000 would exceed the 500 000 cap');
  assert.equal(rpc.broadcasts.length, 2);
});

test('a failed broadcast keeps the work and says so — it never pretends to have paid', async () => {
  const repo = new SqliteRepository(':memory:');
  const rpc = new FakeRpc();
  const bounty = new BountyService(repo, rpc, undefined, { privateKeyHex: poolHex, chain: 'test', openSlots: 1 });
  const [target] = await bounty.ensureOpen();
  rpc.failNext = true;
  const w = KeyPair.generate();
  const result = await bounty.claim({ stored: target!, signature: signAs(w, target!.canonical), workerAddress: w.toAddress().toUserFriendlyAddress(), answer: 'Nothing told me the deal must already have been agreed somewhere else first.', deviceHash: device(9) });
  assert.equal((result as { code: string }).code, 'payout-failed');
  const after = await repo.get(target!.id);
  assert.ok(after?.payeeSignature, 'the countersignature stands');
  assert.equal(after?.payoutTx, undefined, 'no payout was recorded');
  assert.ok((await repo.events(target!.id)).some((e) => e.event === 'bounty-payout-failed'));
});

test('status is public and honest: address, balance, every payout, the rules', async () => {
  const repo = new SqliteRepository(':memory:');
  const rpc = new FakeRpc();
  const bounty = new BountyService(repo, rpc, undefined, { privateKeyHex: poolHex, chain: 'test', openSlots: 1 });
  const [target] = await bounty.ensureOpen();
  const w = KeyPair.generate();
  await bounty.claim({ stored: target!, signature: signAs(w, target!.canonical), workerAddress: w.toAddress().toUserFriendlyAddress(), answer: 'It was unclear who pays the network fee, if there is one at all.', deviceHash: device(4) });
  const s = await bounty.status();
  assert.equal(s.address, bounty.address);
  assert.equal(s.balanceLuna, 10_000_00000n);
  assert.equal(s.paid.length, 1);
  assert.equal(s.paid[0]!.tx, '0xfake1');
  assert.equal(s.paidToday, 1);
  assert.ok(s.rules.some((r) => /never holds anyone/i.test(r)));
  assert.equal(s.open.length, 1, 'refilled');
});

test('the demo worker countersigns with a real signature that verifies', async () => {
  const demo = new DemoWorker(KeyPair.generate().privateKey.toHex());
  const sig = demo.countersign('chit/1\ntest\nrace\nabc');
  assert.equal(sig.publicKeyHex.length, 64);
  assert.equal(sig.signatureHex.length, 128);
  assert.ok(demo.address.startsWith('NQ'));
});

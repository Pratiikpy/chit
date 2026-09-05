/**
 * The ledger is the only reputation chit has, and it must be exactly as trustworthy as the
 * events it is computed from. These fixtures are the three shapes that matter: nothing,
 * one clean settlement, and the one negative the data can carry — signed by both and left
 * unpaid past the deadline.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StoredChit } from '../src/repository.ts';
import { ledger, sameAddress } from '../src/reputation.ts';

const PAYER = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const WORKER = 'NQ12 1111 1111 1111 1111 1111 1111 1111 1111';
const OTHER = 'NQ34 2222 2222 2222 2222 2222 2222 2222 2222';

function chit(overrides: Partial<StoredChit> & { luna?: bigint; deadlineBlock?: number; payer?: string } = {}): StoredChit {
  const { luna = 1_000_000n, deadlineBlock = 5_000_000, payer = PAYER, ...rest } = overrides;
  return {
    id: `chit1:${Math.random().toString(36).slice(2)}`,
    canonical: '',
    chit: {
      chain: 'test',
      kind: 'race',
      nonce: 'x',
      text: 'a job',
      amountMinor: 100n,
      currency: 'USD',
      luna,
      rateBlock: 4_000_000,
      deadlineBlock,
      payer,
      payee: '',
      deliverables: 1,
    },
    payerSignature: { publicKeyHex: 'aa', signatureHex: 'bb' },
    createdAt: 1_000,
    ...rest,
  };
}

test('an address with no history has an honest, empty ledger', () => {
  const l = ledger(PAYER, [], 4_500_000);
  assert.deepEqual(l.asPayer, { settled: 0, medianPaySeconds: null, leftUnpaid: 0, awaiting: 0 });
  assert.deepEqual(l.asWorker, { settled: 0, settledLuna: 0n, distinctPayers: 0, keptLuna: 0n });
});

test('one settled chit: the payer paid, the worker was paid, and kept is exactly 20%', () => {
  const settled = chit({
    countersigner: WORKER,
    countersignedAt: 10_000,
    settledTx: '0xabc',
    settledAt: 10_000 + 3 * 3600 * 1000, // paid three hours after the countersignature
    luna: 5_000_000n,
  });

  const payer = ledger(PAYER, [settled], 4_500_000);
  assert.equal(payer.asPayer.settled, 1);
  assert.equal(payer.asPayer.medianPaySeconds, 3 * 3600, 'pay-speed is countersign → settle');
  assert.equal(payer.asPayer.leftUnpaid, 0);
  assert.equal(payer.asWorker.settled, 0, 'the payer was not the worker');

  const worker = ledger(WORKER, [settled], 4_500_000);
  assert.equal(worker.asWorker.settled, 1);
  assert.equal(worker.asWorker.settledLuna, 5_000_000n);
  assert.equal(worker.asWorker.keptLuna, 1_000_000n, '20% of what settled — a counterfactual, never earnings');
  assert.equal(worker.asWorker.distinctPayers, 1);
  assert.equal(worker.asPayer.settled, 0);
});

test('⭐ signed by both and unpaid past the deadline counts against the payer — before the deadline it is only awaiting', () => {
  const stale = chit({ countersigner: WORKER, countersignedAt: 10_000, deadlineBlock: 4_000_100 });
  const pending = chit({ countersigner: WORKER, countersignedAt: 10_000, deadlineBlock: 4_999_999 });
  const neverCountersigned = chit({ deadlineBlock: 4_000_100 });

  const l = ledger(PAYER, [stale, pending, neverCountersigned], 4_500_000);
  assert.equal(l.asPayer.leftUnpaid, 1, 'only the one both signed and let expire');
  assert.equal(l.asPayer.awaiting, 1, 'the one still inside its deadline');
  assert.equal(l.asPayer.settled, 0);
});

test('an unknown chain height must not manufacture a bad mark', () => {
  const stale = chit({ countersigner: WORKER, countersignedAt: 10_000, deadlineBlock: 4_000_100 });
  const l = ledger(PAYER, [stale], 0);
  assert.equal(l.asPayer.leftUnpaid, 0);
  assert.equal(l.asPayer.awaiting, 1);
});

test('median pay-speed is the middle value, not the mean', () => {
  const fast = chit({ countersigner: WORKER, countersignedAt: 0, settledTx: '0x1', settledAt: 60_000 });
  const mid = chit({ countersigner: WORKER, countersignedAt: 0, settledTx: '0x2', settledAt: 600_000 });
  const slow = chit({ countersigner: WORKER, countersignedAt: 0, settledTx: '0x3', settledAt: 86_400_000 });
  assert.equal(ledger(PAYER, [fast, mid, slow], 4_500_000).asPayer.medianPaySeconds, 600);
});

test('the Sybil tell: paying yourself inflates value but shows one payer', () => {
  const selfPaid = chit({ payer: WORKER, countersigner: WORKER, countersignedAt: 0, settledTx: '0x1', settledAt: 1, luna: 9_000_000n });
  const real = chit({ payer: OTHER, countersigner: WORKER, countersignedAt: 0, settledTx: '0x2', settledAt: 1, luna: 1_000_000n });
  const l = ledger(WORKER, [selfPaid, real], 4_500_000);
  assert.equal(l.asWorker.settledLuna, 10_000_000n);
  assert.equal(l.asWorker.distinctPayers, 2);
  assert.equal(ledger(WORKER, [selfPaid], 4_500_000).asWorker.distinctPayers, 1);
});

test('addresses compare without spaces and case', () => {
  assert.ok(sameAddress('NQ07 0000 0000', 'nq070000 0000'));
  assert.ok(!sameAddress('NQ07 0000', undefined));
});

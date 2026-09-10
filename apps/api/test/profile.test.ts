/**
 * `profile()` and `weightedRating()` — the public record's other half, and the number that
 * had no test at all before this file. The ledger's own tests prove the plumbing; these prove
 * the arithmetic, because a reputation score that merely "does not throw" is not a reputation
 * score anybody should trust.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StoredChit, StoredReview } from '../src/repository.ts';
import { profile, weightedRating, type ProfileReview } from '../src/reputation.ts';

const PAYER = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const WORKER = 'NQ12 1111 1111 1111 1111 1111 1111 1111 1111';
const SIG = { publicKeyHex: 'aa', signatureHex: 'bb' };

function review(overrides: Partial<StoredReview> = {}): StoredReview {
  return { from: 'payer', by: PAYER, about: WORKER, rating: 5, text: '', txHash: '0xabc', at: 0, signature: SIG, ...overrides };
}

function settledChit(overrides: Partial<StoredChit> & { luna?: bigint } = {}): StoredChit {
  const { luna = 1_000_000n, ...rest } = overrides;
  return {
    id: `chit1:${Math.random().toString(36).slice(2)}`,
    canonical: '',
    chit: { chain: 'test', kind: 'race', nonce: 'x', text: 'a job', amountMinor: 100n, currency: 'USD', luna, rateBlock: 1, deadlineBlock: 1, payer: PAYER, payee: WORKER, deliverables: 1 },
    payerSignature: SIG,
    countersigner: WORKER,
    countersignedAt: 0,
    settledTx: '0xabc',
    settledAt: 0,
    createdAt: 0,
    reviews: [],
    ...rest,
  };
}

/** The formula, restated independently of the source file — so a bug in one is not hidden by the same bug in the other. */
function expectedWeight(atMs: number, luna: bigint, nowMs: number): number {
  const days = Math.max(0, (nowMs - atMs) / 86_400_000);
  const timeW = 2 ** (-days / 180);
  const valueW = Math.log1p(Number(luna));
  return timeW * valueW;
}

test('no reviews: null, not zero — zero would read as "bad", the truth is "unrated"', () => {
  assert.equal(profile(WORKER, [], 0).weightedRating, null);
  assert.equal(weightedRating([]), null);
});

test('one review: the weighted score equals that review\'s own rating exactly, whatever its weight', () => {
  for (const luna of [1n, 1_000n, 50_000_000_000n]) {
    const chit = settledChit({ luna, reviews: [review({ rating: 4 })] });
    assert.equal(profile(WORKER, [chit], 0).weightedRating, 4);
  }
});

test('two reviews of equal age and equal value collapse to the plain mean', () => {
  const chits = [
    settledChit({ id: 'chit1:a', luna: 2_000_000n, reviews: [review({ rating: 5, at: 1_000 })] }),
    settledChit({ id: 'chit1:b', luna: 2_000_000n, reviews: [review({ rating: 3, at: 1_000 })] }),
  ];
  const p = profile(WORKER, chits, 0);
  assert.equal(p.averageRating, 4);
  assert.ok(Math.abs((p.weightedRating ?? NaN) - 4) < 1e-12, `expected 4, got ${p.weightedRating}`);
});

test('⭐ a recent review outweighs an old one of the same size — the plain mean cannot tell them apart, the weighted score does', () => {
  const now = 400 * 86_400_000; // 400 days after the epoch this test measures from
  const chits = [
    // Ancient: more than two half-lives old, rated badly.
    settledChit({ id: 'chit1:old', luna: 2_000_000n, reviews: [review({ rating: 1, at: 0 })] }),
    // Fresh: from today, rated perfectly.
    settledChit({ id: 'chit1:new', luna: 2_000_000n, reviews: [review({ rating: 5, at: now })] }),
  ];
  const p = profile(WORKER, chits, 0);
  const weighted = weightedRating(p.reviews, now);
  assert.equal(p.averageRating, 3, '(1 + 5) / 2, blind to age');
  // Both reviews are bound to the same Luna amount, so only the age difference should move
  // the result — hand-verified against `expectedWeight` rather than an eyeballed threshold,
  // since a log/exponential formula is exactly the kind of thing eyeballing gets wrong.
  const wOld = expectedWeight(0, 2_000_000n, now);
  const wNew = expectedWeight(now, 2_000_000n, now);
  const expected = (1 * wOld + 5 * wNew) / (wOld + wNew);
  assert.ok(weighted !== null && Math.abs(weighted - expected) < 1e-9, `expected ${expected}, got ${weighted}`);
  assert.ok(weighted! > p.averageRating!, 'recency should still pull it above the age-blind mean');
});

test('⭐ a review on a larger payment outweighs one on a token payment of the same age', () => {
  const chits = [
    settledChit({ id: 'chit1:tiny', luna: 1_00000n /* ~1 NIM */, reviews: [review({ rating: 1, at: 0 })] }),
    settledChit({ id: 'chit1:big', luna: 500_000_00000n /* ~500,000 NIM */, reviews: [review({ rating: 5, at: 0 })] }),
  ];
  const p = profile(WORKER, chits, 0);
  assert.equal(p.averageRating, 3, 'the plain mean cannot see the size difference at all');
  // Both reviews are the same age, so only the value weighting should move the result. The
  // log scale is deliberately gentle — see `valueWeight`'s own comment — so a 500,000x
  // difference in Luna moves the score meaningfully, not all the way to the big payment's 5.
  const wTiny = Math.log1p(100_000);
  const wBig = Math.log1p(500_000_00000);
  const expected = (1 * wTiny + 5 * wBig) / (wTiny + wBig);
  assert.ok(p.weightedRating !== null && Math.abs(p.weightedRating - expected) < 1e-6, `expected ${expected}, got ${p.weightedRating}`);
  assert.ok(p.weightedRating! > p.averageRating!, 'the larger payment should still pull it above the size-blind mean');
});

test('the weighted formula matches an independent restatement of it, to the last bit that matters', () => {
  const now = 90 * 86_400_000;
  const raw: ProfileReview[] = [
    { chitId: 'a', chitText: '', from: 'payer', by: PAYER, rating: 5, text: '', txHash: '0x1', at: 0, signature: SIG, luna: '4000000' },
    { chitId: 'b', chitText: '', from: 'payee', by: WORKER, rating: 2, text: '', txHash: '0x2', at: 45 * 86_400_000, signature: SIG, luna: '17000000' },
  ];
  const w1 = expectedWeight(raw[0]!.at, BigInt(raw[0]!.luna), now);
  const w2 = expectedWeight(raw[1]!.at, BigInt(raw[1]!.luna), now);
  const expected = (5 * w1 + 2 * w2) / (w1 + w2);
  const actual = weightedRating(raw, now);
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);
});

test('averageRating and weightedRating are reported side by side, never one hiding the other', () => {
  const chits = [
    settledChit({ id: 'chit1:a', luna: 1_000_000n, reviews: [review({ rating: 5, at: 0 })] }),
    settledChit({ id: 'chit1:b', luna: 999_000_000n, reviews: [review({ rating: 1, at: 0 })] }),
  ];
  const p = profile(WORKER, chits, 0);
  assert.equal(p.averageRating, 3);
  assert.notEqual(p.weightedRating, p.averageRating, 'a real size gap should visibly move the weighted number away from the plain one');
});

test('every review carries the Luna the chit actually settled for, not just the agreed figure', () => {
  const chit = settledChit({ luna: 1_000_000n, settledLuna: 1_100_000n, reviews: [review()] });
  const p = profile(WORKER, [chit], 0);
  assert.equal(p.reviews[0]?.luna, '1100000', 'the settled amount, since that is what was actually received');
});

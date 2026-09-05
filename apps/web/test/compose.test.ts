import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalise, parseCanonical, parseTerms } from '@chit/core';
import {
  BLOCKS_PER_DAY,
  DEFAULT_DEADLINE_DAYS,
  buildDraft,
  daysUntilBlock,
  fieldsFromTerms,
  isReady,
  quoteExpired,
  type Quote,
} from '../src/compose.ts';

const WEDNESDAY = new Date('2026-09-09T12:00:00Z');
const PAYER = 'NQ56M67GT26X3N9VXDGEQ3BNHSVUE13YQNGV';

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    amountMinor: '4000',
    currency: 'USD',
    luna: '10436234607',
    rate: 0.00038328,
    rateBlock: 4_102_887,
    quotedAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000,
    stale: false,
    ...overrides,
  };
}

test('a draft is built from the quoted figures, never from a client-side price', () => {
  const draft = buildDraft({
    text: '$40 for 3 thumbnails by Friday',
    amountMinor: 4000n,
    currency: 'USD',
    deadlineDays: 2,
    deliverables: 3,
    direction: 'paying', signer: PAYER,
    chain: 'test',
    quote: quote(),
  });

  assert.equal(draft.chit.luna, 10_436_234_607n, 'the server\'s figure, unchanged');
  assert.equal(draft.chit.rateBlock, 4_102_887);
  assert.equal(draft.chit.amountMinor, 4000n);
  assert.equal(draft.chit.currency, 'USD');
});

test('the deadline is a block height, checkable against the chain', () => {
  const draft = buildDraft({
    text: 'x', amountMinor: 4000n, currency: 'USD', deadlineDays: 2,
    deliverables: 1, direction: 'paying', signer: PAYER, chain: 'test', quote: quote(),
  });
  assert.equal(draft.chit.deadlineBlock, 4_102_887 + 2 * BLOCKS_PER_DAY);
});

test('a same-day deadline still lands in the future', () => {
  // Zero days must not mean "already expired at the block it was signed in".
  const draft = buildDraft({
    text: 'x', amountMinor: 4000n, currency: 'USD', deadlineDays: 0,
    deliverables: 1, direction: 'paying', signer: PAYER, chain: 'test', quote: quote(),
  });
  assert.ok(draft.chit.deadlineBlock > draft.chit.rateBlock);
});

test('⭐ the draft is open — the payee arrives with the countersignature', () => {
  // The payer signs before knowing the other side's Nimiq address. Countersigning
  // supplies it, derived from the key that signed rather than typed by anyone.
  const draft = buildDraft({
    text: 'x', amountMinor: 4000n, currency: 'USD', deadlineDays: 3,
    deliverables: 1, direction: 'paying', signer: PAYER, chain: 'test', quote: quote(),
  });
  assert.equal(draft.chit.payee, '');
  assert.equal(draft.chit.kind, 'race');
});

test('⭐ the chain is inside the signed bytes', () => {
  const base = {
    text: 'x', amountMinor: 4000n, currency: 'USD', deadlineDays: 3,
    deliverables: 1, direction: 'paying', signer: PAYER, quote: quote(),
  } as const;
  const onTest = buildDraft({ ...base, chain: 'test' });
  const onMain = buildDraft({ ...base, chain: 'main' });
  assert.notEqual(onTest.canonical, onMain.canonical);
  assert.ok(onTest.canonical.includes('\ntest\n'));
  assert.ok(onMain.canonical.includes('\nmain\n'));
});

test('every draft gets a fresh nonce, so identical deals stay distinct', () => {
  const input = {
    text: 'x', amountMinor: 4000n, currency: 'USD', deadlineDays: 3,
    deliverables: 1, direction: 'paying', signer: PAYER, chain: 'test', quote: quote(),
  } as const;
  const ids = new Set(Array.from({ length: 50 }, () => buildDraft(input).id));
  assert.equal(ids.size, 50);
});

test('the canonical form round-trips — what is signed is what is stored', () => {
  const draft = buildDraft({
    text: 'café €40 🧵', amountMinor: 4000n, currency: 'EUR', deadlineDays: 1,
    deliverables: 1, direction: 'paying', signer: PAYER, chain: 'test', quote: quote({ currency: 'EUR' }),
  });
  assert.deepEqual(parseCanonical(draft.canonical), draft.chit);
  assert.equal(canonicalise(draft.chit), draft.canonical);
});

test('deliverables never drop below one', () => {
  const draft = buildDraft({
    text: 'x', amountMinor: 4000n, currency: 'USD', deadlineDays: 1,
    deliverables: 0, direction: 'paying', signer: PAYER, chain: 'test', quote: quote(),
  });
  assert.equal(draft.chit.deliverables, 1);
});

test('fields seed from the parser, with a stated default deadline', () => {
  const fields = fieldsFromTerms(parseTerms('$40 for 3 thumbnails by Friday', WEDNESDAY));
  assert.equal(fields.amountMinor, 4000n);
  assert.equal(fields.currency, 'USD');
  assert.equal(fields.deadlineDays, 2);
  assert.equal(fields.deliverables, 3);
  assert.equal(fields.edited.size, 0, 'nothing corrected yet');

  const noDeadline = fieldsFromTerms(parseTerms('$40 for a logo', WEDNESDAY));
  assert.equal(noDeadline.deadlineDays, DEFAULT_DEADLINE_DAYS, 'proposed, not invented silently');
});

test('readiness needs a line, an amount and a currency', () => {
  const ok = fieldsFromTerms(parseTerms('$40 for a logo', WEDNESDAY));
  assert.equal(isReady(ok), true);

  assert.equal(isReady({ ...ok, amountMinor: null }), false);
  assert.equal(isReady({ ...ok, currency: null }), false);
  assert.equal(isReady({ ...ok, amountMinor: 0n }), false);
  assert.equal(isReady({ ...ok, text: '   ' }), false);
});

test('a quote expires, and expiry is checked against a supplied clock', () => {
  const fresh = quote({ expiresAt: Date.now() + 60_000 });
  assert.equal(quoteExpired(fresh), false);
  assert.equal(quoteExpired(fresh, Date.now() + 120_000), true, 'later than its expiry');

  const lapsed = quote({ expiresAt: Date.now() - 1 });
  assert.equal(quoteExpired(lapsed), true);
});

test('the days-remaining display never goes negative', () => {
  assert.equal(daysUntilBlock(4_200_000, 4_100_000), 1);
  assert.equal(daysUntilBlock(4_100_000, 4_200_000), 0, 'past deadlines read as zero, not -1');
  assert.equal(daysUntilBlock(4_100_000 + 3 * BLOCKS_PER_DAY, 4_100_000), 3);
});

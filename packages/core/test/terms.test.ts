import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMinor,
  isComplete,
  minorUnitsPer,
  parseMoneyToMinor,
  parseTerms,
} from '../src/terms.ts';

/** A fixed Wednesday, so weekday arithmetic is deterministic. 2026-09-09 is a Wednesday. */
const WEDNESDAY = new Date('2026-09-09T12:00:00Z');

test('money never goes through a float', () => {
  // 40.15 * 100 is 4014.999… in IEEE 754. Integer arithmetic on strings avoids it.
  assert.equal(parseMoneyToMinor('40.15', 'USD'), 4015n);
  assert.equal(parseMoneyToMinor('0.1', 'USD'), 10n);
  assert.equal(parseMoneyToMinor('0.2', 'USD'), 20n);
  // Four digits after the separator cannot be a thousands group, so this is a decimal
  // and the sub-cent part is truncated rather than rounded up.
  assert.equal(parseMoneyToMinor('1.0059', 'USD'), 100n, 'truncates, never rounds up');
  assert.equal(parseMoneyToMinor('40.156', 'USD'), 4015600n, 'three digits is the thousands rule, see below');
});

test('three digits after a single separator is a thousands group, either convention', () => {
  // Genuinely ambiguous — "1.005" is 1005 in German and 1.005 in English. We resolve it
  // the way that is right for money far more often, and consistently across both
  // separators, so "1.200" and "1,200" never disagree.
  assert.equal(parseMoneyToMinor('1.005', 'USD'), 100500n);
  assert.equal(parseMoneyToMinor('1,005', 'USD'), 100500n);
});

test('both decimal conventions are read correctly', () => {
  assert.equal(parseMoneyToMinor('1,200.50', 'USD'), 120050n, 'English');
  assert.equal(parseMoneyToMinor('1.200,50', 'EUR'), 120050n, 'European');
  assert.equal(parseMoneyToMinor('1200', 'USD'), 120000n, 'no separator');
  assert.equal(parseMoneyToMinor('1,200', 'USD'), 120000n, 'thousands group, not 1.2');
  assert.equal(parseMoneyToMinor('1.200', 'EUR'), 120000n, 'European thousands group');
  assert.equal(parseMoneyToMinor('40,50', 'EUR'), 4050n, 'two digits after comma is a decimal');
});

test('zero-decimal currencies are not inflated 100x', () => {
  assert.equal(minorUnitsPer('JPY'), 1n);
  assert.equal(minorUnitsPer('USD'), 100n);
  assert.equal(parseMoneyToMinor('4000', 'JPY'), 4000n);
  assert.equal(parseMoneyToMinor('40.50', 'JPY'), null, 'a fractional yen is refused, not rounded');
});

test('malformed money is refused rather than coerced', () => {
  for (const bad of ['', 'abc', '..', ',', '4a0', '-40']) {
    assert.equal(parseMoneyToMinor(bad, 'USD'), null, `should refuse ${JSON.stringify(bad)}`);
  }
});

test('the canonical example parses completely', () => {
  const terms = parseTerms('$40 for 3 thumbnails by Friday', WEDNESDAY);
  assert.equal(terms.amountMinor?.value, 4000n);
  assert.equal(terms.currency?.value, 'USD');
  assert.equal(terms.deliverables?.value, 3);
  assert.equal(terms.deadlineDays?.value, 2, 'Wednesday to Friday');
  assert.ok(isComplete(terms));
});

test('the pasted line is preserved verbatim — we sign the text, not our reading', () => {
  const original = '  $40   for 3 thumbnails by Friday  ';
  assert.equal(parseTerms(original, WEDNESDAY).text, '$40 for 3 thumbnails by Friday');
});

test('an ambiguous symbol is reported, not silently resolved', () => {
  const terms = parseTerms('$40 for a logo', WEDNESDAY);
  assert.equal(terms.currency?.value, 'USD');
  assert.equal(terms.currency?.confidence, 'likely');
  assert.ok(terms.currency?.alternatives?.includes('CAD'), 'must offer the other dollar currencies');
});

test('an explicit ISO code is certain and beats a symbol', () => {
  const terms = parseTerms('40 EUR for a logo', WEDNESDAY);
  assert.equal(terms.currency?.value, 'EUR');
  assert.equal(terms.currency?.confidence, 'certain');
  assert.equal(terms.currency?.alternatives, undefined);
});

test('unambiguous symbols are certain', () => {
  for (const [line, code] of [['€40 for a logo', 'EUR'], ['£40 for a logo', 'GBP'], ['₹4000 for a logo', 'INR'], ['₡40000 for a logo', 'CRC']] as const) {
    const terms = parseTerms(line, WEDNESDAY);
    assert.equal(terms.currency?.value, code, line);
    assert.equal(terms.currency?.confidence, 'certain', line);
  }
});

test('the amount is found on either side of the currency', () => {
  assert.equal(parseTerms('$40 for a logo', WEDNESDAY).amountMinor?.value, 4000n);
  assert.equal(parseTerms('40 USD for a logo', WEDNESDAY).amountMinor?.value, 4000n);
  assert.equal(parseTerms('logo, 40 EUR', WEDNESDAY).amountMinor?.value, 4000n);
});

test('freelance shorthand for thousands', () => {
  const terms = parseTerms('$2k for a landing page', WEDNESDAY);
  assert.equal(terms.amountMinor?.value, 200000n);
  assert.equal(terms.amountMinor?.confidence, 'likely');
});

test('no currency means no amount — "100 what?" is not a question we answer', () => {
  const terms = parseTerms('100 thumbnails by Friday', WEDNESDAY);
  assert.equal(terms.amountMinor, undefined);
  assert.equal(terms.currency, undefined);
  assert.equal(isComplete(terms), false);
});

test('deadlines in every common phrasing', () => {
  const cases: Array<[string, number]> = [
    ['$40 today', 0],
    ['$40 tonight', 0],
    ['$40 by tomorrow', 1],
    ['$40 in 3 days', 3],
    ['$40 within 2 weeks', 14],
    ['$40 in 12 hours', 1],
    ['$40 next week', 7],
    ['$40 by Friday', 2],       // Wed → Fri
    ['$40 by Monday', 5],       // Wed → next Mon
    ['$40 by Wednesday', 7],    // same day means the next one, never today
    ['$40 end of week', 2],
  ];
  for (const [line, expected] of cases) {
    assert.equal(parseTerms(line, WEDNESDAY).deadlineDays?.value, expected, line);
  }
});

test('no deadline is left undefined rather than invented', () => {
  assert.equal(parseTerms('$40 for a logo', WEDNESDAY).deadlineDays, undefined);
});

test('deliverable counts, digits and words', () => {
  assert.equal(parseTerms('$40 for 3 thumbnails', WEDNESDAY).deliverables?.value, 3);
  assert.equal(parseTerms('$40 for 3x logo', WEDNESDAY).deliverables?.value, 3);
  assert.equal(parseTerms('$40 for three articles', WEDNESDAY).deliverables?.value, 3);
});

test('time and money words are not mistaken for deliverables', () => {
  assert.equal(parseTerms('$40 in 3 days', WEDNESDAY).deliverables, undefined);
  assert.equal(parseTerms('$40 within 2 weeks', WEDNESDAY).deliverables, undefined);
});

test('real freelance lines, end to end', () => {
  const lines: Array<[string, { amount: bigint; currency: string; deliverables?: number; days?: number }]> = [
    ['$60 to cut a 30-second vertical from this footage by Friday', { amount: 6000n, currency: 'USD', deliverables: 30, days: 2 }],
    ['€120 for 2 blog posts, 800 words each, in 5 days', { amount: 12000n, currency: 'EUR', deliverables: 2, days: 5 }],
    ['₹3500 for a logo redraw by tomorrow', { amount: 350000n, currency: 'INR', days: 1 }],
    ['200 USD — fix the CSS layout on our pricing page', { amount: 20000n, currency: 'USD' }],
    ['£45 for a 300-word pt-BR translation today', { amount: 4500n, currency: 'GBP', days: 0 }],
  ];
  for (const [line, expected] of lines) {
    const terms = parseTerms(line, WEDNESDAY);
    assert.equal(terms.amountMinor?.value, expected.amount, line);
    assert.equal(terms.currency?.value, expected.currency, line);
    if (expected.days !== undefined) assert.equal(terms.deadlineDays?.value, expected.days, line);
    assert.ok(isComplete(terms), line);
  }
});

test('what we did not understand is surfaced, never dropped', () => {
  const terms = parseTerms('$40 for a bespoke isometric illustration', WEDNESDAY);
  assert.ok(terms.unparsed.length > 0);
  assert.ok(terms.unparsed.some((w) => /illustration|isometric|bespoke/.test(w)));
});

test('parsing is pure — the same input and clock give the same output', () => {
  const a = parseTerms('$40 for 3 thumbnails by Friday', WEDNESDAY);
  const b = parseTerms('$40 for 3 thumbnails by Friday', WEDNESDAY);
  assert.deepEqual(a, b);
});

test('nothing throws on hostile input', () => {
  for (const input of ['', '   ', '$', '€€€', '\n\n', '𝕏'.repeat(200), '$'.repeat(500), '0x00 ']) {
    assert.doesNotThrow(() => parseTerms(input, WEDNESDAY), `threw on ${JSON.stringify(input.slice(0, 20))}`);
  }
});

test('display formatting', () => {
  assert.equal(formatMinor(4000n, 'USD'), '40.00');
  assert.equal(formatMinor(4015n, 'USD'), '40.15');
  assert.equal(formatMinor(5n, 'USD'), '0.05');
  assert.equal(formatMinor(4000n, 'JPY'), '4000', 'no decimals for zero-decimal currencies');
});

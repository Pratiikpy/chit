/**
 * A review is only worth anything if a stranger can re-check it years later with a plain
 * Ed25519 library. That requires one canonical form and no tolerance at all: two byte
 * sequences that mean the same thing to a human must not both verify, or the signature
 * stops proving which one was signed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChitCanonicalError, MAX_REVIEW_BYTES, canonicaliseReview, parseReview } from '../src/index.ts';

const ID = 'chit1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const TX = 'a'.repeat(64);

test('a review round-trips exactly', () => {
  const review = { chitId: ID, txHash: TX, rating: 5, text: 'Fast, and the file was right first time.' };
  const text = canonicaliseReview(review);
  assert.equal(text, `chit/1 review\n${ID}\n${TX}\n5\nFast, and the file was right first time.\n`);
  assert.deepEqual(parseReview(text), review);
});

test('a rating with no words is a review', () => {
  const review = { chitId: ID, txHash: TX, rating: 4, text: '' };
  assert.deepEqual(parseReview(canonicaliseReview(review)), review);
});

test('the transaction hash is required and must be a hash', () => {
  for (const bad of ['', 'not-a-hash', TX.toUpperCase(), TX.slice(0, 63), `${TX}0`]) {
    assert.throws(() => canonicaliseReview({ chitId: ID, txHash: bad, rating: 5, text: '' }), ChitCanonicalError, bad);
  }
});

test('the rating is a whole number from one to five', () => {
  for (const bad of [0, 6, -1, 4.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => canonicaliseReview({ chitId: ID, txHash: TX, rating: bad, text: '' }), ChitCanonicalError, String(bad));
  }
});

test('"05" and "5" are not the same review — a leading zero is refused, not accepted', () => {
  // Number('05') is 5, so a parser that only checked the number would accept both forms and
  // two different byte strings would carry the same meaning. Re-serialising catches it.
  assert.throws(() => parseReview(`chit/1 review\n${ID}\n${TX}\n05\n\n`), ChitCanonicalError);
});

test('a line break in the text is refused — it would forge the field boundary', () => {
  assert.throws(() => canonicaliseReview({ chitId: ID, txHash: TX, rating: 5, text: 'good\nwork' }), ChitCanonicalError);
  // And the same thing arriving as a serialised string is refused rather than silently split.
  assert.throws(() => parseReview(`chit/1 review\n${ID}\n${TX}\n5\ngood\nwork\n`), ChitCanonicalError);
});

test('surrounding space is refused, so " ok" and "ok" cannot both be signed', () => {
  assert.throws(() => canonicaliseReview({ chitId: ID, txHash: TX, rating: 3, text: ' ok' }), ChitCanonicalError);
  assert.throws(() => canonicaliseReview({ chitId: ID, txHash: TX, rating: 3, text: 'ok ' }), ChitCanonicalError);
});

test('the length limit counts bytes, not characters', () => {
  // A limit measured in characters would let a review of emoji be four times the bytes anyone
  // agreed to store or sign. Two hundred of these are 800 bytes and must be refused.
  const emoji = '🙂'.repeat(200);
  assert.equal(emoji.length, 400, 'JavaScript counts this as 400 units');
  assert.throws(() => canonicaliseReview({ chitId: ID, txHash: TX, rating: 5, text: emoji }), ChitCanonicalError);
  assert.doesNotThrow(() => canonicaliseReview({ chitId: ID, txHash: TX, rating: 5, text: 'a'.repeat(MAX_REVIEW_BYTES) }));
});

test('text is normalised to NFC before signing, so the two spellings of "é" agree', () => {
  const composed = canonicaliseReview({ chitId: ID, txHash: TX, rating: 5, text: 'café' });
  const decomposed = canonicaliseReview({ chitId: ID, txHash: TX, rating: 5, text: 'café' });
  assert.equal(composed, decomposed);
});

test('an unknown version is refused rather than guessed at', () => {
  assert.throws(() => parseReview(`chit/2 review\n${ID}\n${TX}\n5\n\n`), ChitCanonicalError);
});

test('a review missing its trailing newline is not canonical', () => {
  assert.throws(() => parseReview(`chit/1 review\n${ID}\n${TX}\n5\nfine`), ChitCanonicalError);
});

/**
 * A question is a signed object, so it is held to the same bar as every other signed object here:
 * one canonical form, no two byte sequences meaning the same thing, and a parse that re-serialises
 * and compares rather than accepting anything close enough.
 *
 * The case worth stating is the nonce. Two people asking "does this include source files?" about the
 * same chit is not a contrived scenario — it is the most likely thing that will ever happen to this
 * object — and without a nonce the second question would canonicalise to the same bytes as the first
 * and be indistinguishable from a replay of it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ChitCanonicalError } from '../src/canonical.ts';
import { newNonce } from '../src/hash.ts';
import {
  ANSWER_CANONICAL_VERSION,
  MAX_ANSWER_BYTES,
  MAX_QUESTION_BYTES,
  QUESTION_CANONICAL_VERSION,
  canonicaliseAnswer,
  canonicaliseQuestion,
  parseAnswer,
  parseQuestion,
  type Answer,
  type Question,
} from '../src/question.ts';

const CHIT_ID = 'chit1:AbCdEf0123456789_-';

function question(overrides: Partial<Question> = {}): Question {
  return { chitId: CHIT_ID, nonce: newNonce(), text: 'Does this include the source files?', ...overrides };
}

function answer(overrides: Partial<Answer> = {}): Answer {
  return { chitId: CHIT_ID, questionId: 'q1:0123456789', text: 'Yes — layered file included.', ...overrides };
}

/* ------------------------------------------------------------------ the question */

test('a question canonicalises to four lines and a trailing newline', () => {
  const lines = canonicaliseQuestion(question()).split('\n');
  assert.equal(lines.length, 5);
  assert.equal(lines[4], '');
  assert.equal(lines[0], QUESTION_CANONICAL_VERSION);
});

test('and round-trips through the parser unchanged', () => {
  const text = canonicaliseQuestion(question());
  assert.equal(canonicaliseQuestion(parseQuestion(text)), text);
});

test('⭐ two people asking the same thing produce different bytes', () => {
  // Without the nonce these would be identical, and the second would look like a replay of the first.
  const first = canonicaliseQuestion(question({ text: 'Does this include the source files?' }));
  const second = canonicaliseQuestion(question({ text: 'Does this include the source files?' }));
  assert.notEqual(first, second);
});

test('a question with a newline in it is refused, not escaped', () => {
  assert.throws(() => canonicaliseQuestion(question({ text: 'line one\nline two' })), ChitCanonicalError);
  assert.throws(() => canonicaliseQuestion(question({ text: 'line one\r\nline two' })), ChitCanonicalError);
});

test('an empty question is refused', () => {
  assert.throws(() => canonicaliseQuestion(question({ text: '' })), ChitCanonicalError);
});

test('a question padded with space is refused rather than trimmed', () => {
  // Trimming would mean the bytes stored differ from the bytes the wallet showed the signer.
  assert.throws(() => canonicaliseQuestion(question({ text: ' padded ' })), ChitCanonicalError);
});

test('a question is capped in bytes, not characters', () => {
  const ascii = 'a'.repeat(MAX_QUESTION_BYTES);
  assert.ok(canonicaliseQuestion(question({ text: ascii })));

  // Emoji are four bytes each: a limit measured in characters would let this through and then the
  // stored value would not fit wherever the byte limit was real.
  const emoji = '🙂'.repeat(Math.ceil(MAX_QUESTION_BYTES / 4) + 1);
  assert.throws(() => canonicaliseQuestion(question({ text: emoji })), ChitCanonicalError);
});

test('a question is normalised to NFC, so two spellings of the same word are one', () => {
  // Composed U+00E1 against decomposed a + U+0301. They look identical on screen, they are
  // different bytes, and a signature over one must not fail to verify against the other.
  const composed = canonicaliseQuestion(question({ nonce: 'a'.repeat(22), text: 'á listo?' }));
  const decomposed = canonicaliseQuestion(question({ nonce: 'a'.repeat(22), text: 'á listo?' }));
  assert.equal(composed, decomposed);
  assert.ok(composed.includes('á'), 'the stored form is the composed one');
});

test('a question about something that is not a chit id is refused', () => {
  for (const bad of ['', 'chit1:', 'nope', 'chit2:abc', '../../etc/passwd']) {
    assert.throws(() => canonicaliseQuestion(question({ chitId: bad })), ChitCanonicalError, bad);
  }
});

test('a nonce of the wrong shape is refused', () => {
  for (const bad of ['', 'short', 'a'.repeat(23), 'a'.repeat(21), '='.repeat(22)]) {
    assert.throws(() => canonicaliseQuestion(question({ nonce: bad })), ChitCanonicalError, bad);
  }
});

test('a non-canonical question is refused rather than parsed into something else', () => {
  const text = canonicaliseQuestion(question());
  assert.throws(() => parseQuestion(`${text}extra\n`), ChitCanonicalError);
  assert.throws(() => parseQuestion(text.replace(QUESTION_CANONICAL_VERSION, 'chit/2 question')), ChitCanonicalError);
  assert.throws(() => parseQuestion(text.trimEnd()), ChitCanonicalError);
});

/* ------------------------------------------------------------------ the answer */

test('an answer canonicalises and round-trips', () => {
  const text = canonicaliseAnswer(answer());
  assert.equal(text.split('\n')[0], ANSWER_CANONICAL_VERSION);
  assert.equal(canonicaliseAnswer(parseAnswer(text)), text);
});

test('⭐ an answer names the question it answers, so it cannot be moved to another', () => {
  const one = canonicaliseAnswer(answer({ questionId: 'q1:aaa' }));
  const two = canonicaliseAnswer(answer({ questionId: 'q1:bbb' }));
  assert.notEqual(one, two);
  assert.equal(parseAnswer(one).questionId, 'q1:aaa');
});

test('an answer may be longer than a question, because "it depends" needs room', () => {
  assert.ok(MAX_ANSWER_BYTES > MAX_QUESTION_BYTES);
  assert.ok(canonicaliseAnswer(answer({ text: 'a'.repeat(MAX_ANSWER_BYTES) })));
  assert.throws(() => canonicaliseAnswer(answer({ text: 'a'.repeat(MAX_ANSWER_BYTES + 1) })), ChitCanonicalError);
});

test('an empty or multi-line answer is refused', () => {
  assert.throws(() => canonicaliseAnswer(answer({ text: '' })), ChitCanonicalError);
  assert.throws(() => canonicaliseAnswer(answer({ text: 'yes\nand no' })), ChitCanonicalError);
});

test('an answer to something that is not a question id is refused', () => {
  for (const bad of ['', 'has space', 'has/slash', 'has\nnewline']) {
    assert.throws(() => canonicaliseAnswer(answer({ questionId: bad })), ChitCanonicalError, JSON.stringify(bad));
  }
});

test('a non-canonical answer is refused', () => {
  const text = canonicaliseAnswer(answer());
  assert.throws(() => parseAnswer(`${text}extra\n`), ChitCanonicalError);
  assert.throws(() => parseAnswer(text.replace(ANSWER_CANONICAL_VERSION, 'chit/2 answer')), ChitCanonicalError);
});

test('a question and an answer with the same fields do not share bytes', () => {
  // The version marker is the first line for exactly this reason: one signature can never be
  // presented as the other kind of object.
  const q = canonicaliseQuestion({ chitId: CHIT_ID, nonce: 'a'.repeat(22), text: 'same words' });
  const a = canonicaliseAnswer({ chitId: CHIT_ID, questionId: `q1:${'a'.repeat(22)}`, text: 'same words' });
  assert.notEqual(q, a);
});

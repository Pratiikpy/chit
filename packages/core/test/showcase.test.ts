/**
 * A showcase is the only object here that publishes something — a link somebody put real work
 * behind, shown to strangers. So the tests are mostly about what it refuses:
 *
 *  - a piece with no payment behind it, which is what makes every other portfolio worthless
 *  - a link that is not a link a stranger can safely be shown
 *  - a piece with nothing to show
 *  - two byte sequences that mean the same thing, which would let one signer see one and the other
 *    confirm a different one
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ChitCanonicalError } from '../src/canonical.ts';
import {
  MAX_CAPTION_BYTES,
  SHOWCASE_CANONICAL_VERSION,
  canonicaliseShowcase,
  parseShowcase,
  type Showcase,
} from '../src/showcase.ts';

const CHIT_ID = 'chit1:AbCdEf0123456789_-';
const TX = 'a'.repeat(64);

function showcase(overrides: Partial<Showcase> = {}): Showcase {
  return {
    chitId: CHIT_ID,
    txHash: TX,
    link: 'https://example.com/work/logo.png',
    caption: 'Rebrand in two days.',
    ...overrides,
  };
}

test('a showcase canonicalises to five lines and a trailing newline', () => {
  const lines = canonicaliseShowcase(showcase()).split('\n');
  assert.equal(lines.length, 6);
  assert.equal(lines[5], '');
  assert.equal(lines[0], SHOWCASE_CANONICAL_VERSION);
});

test('and round-trips through the parser unchanged', () => {
  const text = canonicaliseShowcase(showcase());
  assert.equal(canonicaliseShowcase(parseShowcase(text)), text);
});

test('⭐ no payment, no portfolio piece', () => {
  // The transaction hash is what makes this evidence rather than an upload.
  for (const bad of ['', 'nope', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)]) {
    assert.throws(() => canonicaliseShowcase(showcase({ txHash: bad })), ChitCanonicalError, bad.slice(0, 10));
  }
});

test('⭐ a piece with nothing to show is refused', () => {
  // A delivery may have an empty link — work is often handed over another way. A showcase may not:
  // the link is the object, and an empty one would be a portfolio entry nobody can look at.
  assert.throws(() => canonicaliseShowcase(showcase({ link: '' })), ChitCanonicalError);
});

test('⭐ a link that is not safe to show a stranger is refused', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', 'mailto:a@b.c', 'ftp://x/y', 'not a url']) {
    assert.throws(() => canonicaliseShowcase(showcase({ link: bad })), ChitCanonicalError, bad);
  }
});

test('http and https are both allowed, because real links are both', () => {
  assert.ok(canonicaliseShowcase(showcase({ link: 'http://example.com/a' })));
  assert.ok(canonicaliseShowcase(showcase({ link: 'https://example.com/a' })));
});

test('a caption is optional', () => {
  assert.ok(canonicaliseShowcase(showcase({ caption: '' })));
});

test('a caption is one line, capped in bytes, and not padded', () => {
  assert.throws(() => canonicaliseShowcase(showcase({ caption: 'two\nlines' })), ChitCanonicalError);
  assert.throws(() => canonicaliseShowcase(showcase({ caption: ' padded ' })), ChitCanonicalError);
  assert.ok(canonicaliseShowcase(showcase({ caption: 'a'.repeat(MAX_CAPTION_BYTES) })));
  assert.throws(
    () => canonicaliseShowcase(showcase({ caption: '🙂'.repeat(Math.ceil(MAX_CAPTION_BYTES / 4) + 1) })),
    ChitCanonicalError,
  );
});

test('a showcase about something that is not a chit is refused', () => {
  for (const bad of ['', 'chit1:', 'nope', 'chit2:abc']) {
    assert.throws(() => canonicaliseShowcase(showcase({ chitId: bad })), ChitCanonicalError, bad);
  }
});

test('⭐ a non-canonical showcase is refused, so both signers saw the same bytes', () => {
  const text = canonicaliseShowcase(showcase());
  assert.throws(() => parseShowcase(`${text}extra\n`), ChitCanonicalError);
  assert.throws(() => parseShowcase(text.replace(SHOWCASE_CANONICAL_VERSION, 'chit/2 showcase')), ChitCanonicalError);
  assert.throws(() => parseShowcase(text.trimEnd()), ChitCanonicalError);
});

test('the caption is normalised, so two spellings of a word are one piece', () => {
  const composed = canonicaliseShowcase(showcase({ caption: 'Diseño' }));
  const decomposed = canonicaliseShowcase(showcase({ caption: 'Diseño' }));
  assert.equal(composed, decomposed);
});

test('a showcase and a review over the same chit do not share bytes', () => {
  // The version marker is the first line precisely so one signature can never be presented as a
  // different kind of statement about the same payment.
  const text = canonicaliseShowcase(showcase());
  assert.ok(text.startsWith(SHOWCASE_CANONICAL_VERSION));
  assert.ok(!text.startsWith('chit/1 review'));
});

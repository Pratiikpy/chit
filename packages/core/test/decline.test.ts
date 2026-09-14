/**
 * A decline is a signed statement now, not a bare API call — the same discipline as delivery,
 * review and showcase: one canonical form, refused if it is not exactly that.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChitCanonicalError, canonicaliseDecline, parseDecline } from '../src/index.ts';

const ID = 'chit1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

test('a decline round-trips exactly', () => {
  const decline = { chitId: ID };
  const text = canonicaliseDecline(decline);
  assert.equal(text, `chit/1 decline\n${ID}\n`);
  assert.deepEqual(parseDecline(text), decline);
});

test('the chit id must be a chit id', () => {
  assert.throws(() => canonicaliseDecline({ chitId: 'not-an-id' }), ChitCanonicalError);
  assert.throws(() => canonicaliseDecline({ chitId: '' }), ChitCanonicalError);
});

test('anything not exactly canonical is refused, not silently accepted', () => {
  assert.throws(() => parseDecline(`chit/1 decline\n${ID}\n\n`), ChitCanonicalError, 'extra line');
  assert.throws(() => parseDecline(`chit/1 decline\n${ID}`), ChitCanonicalError, 'missing trailing newline');
  assert.throws(() => parseDecline(`chit/2 decline\n${ID}\n`), ChitCanonicalError, 'wrong version');
});

test('⭐ a decline of one chit does not verify as a decline of another', () => {
  const other = 'chit1:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
  assert.notEqual(canonicaliseDecline({ chitId: ID }), canonicaliseDecline({ chitId: other }));
});

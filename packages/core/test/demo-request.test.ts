/**
 * A demo request is a signed statement now, not a bare API call — the same discipline as
 * decline, delivery, review and showcase: one canonical form, refused if it is not exactly that.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChitCanonicalError, canonicaliseDecline, canonicaliseDemoRequest, parseDemoRequest } from '../src/index.ts';

const ID = 'chit1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

test('a demo request round-trips exactly', () => {
  const request = { chitId: ID };
  const text = canonicaliseDemoRequest(request);
  assert.equal(text, `chit/1 demo-countersign-request\n${ID}\n`);
  assert.deepEqual(parseDemoRequest(text), request);
});

test('the chit id must be a chit id', () => {
  assert.throws(() => canonicaliseDemoRequest({ chitId: 'not-an-id' }), ChitCanonicalError);
  assert.throws(() => canonicaliseDemoRequest({ chitId: '' }), ChitCanonicalError);
});

test('anything not exactly canonical is refused, not silently accepted', () => {
  assert.throws(() => parseDemoRequest(`chit/1 demo-countersign-request\n${ID}\n\n`), ChitCanonicalError, 'extra line');
  assert.throws(() => parseDemoRequest(`chit/1 demo-countersign-request\n${ID}`), ChitCanonicalError, 'missing trailing newline');
  assert.throws(() => parseDemoRequest(`chit/2 demo-countersign-request\n${ID}\n`), ChitCanonicalError, 'wrong version');
});

test('⭐ a request for one chit does not verify as a request for another', () => {
  const other = 'chit1:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
  assert.notEqual(canonicaliseDemoRequest({ chitId: ID }), canonicaliseDemoRequest({ chitId: other }));
});

test('⭐ a demo request never collides with a decline of the same chit', () => {
  assert.notEqual(canonicaliseDemoRequest({ chitId: ID }), canonicaliseDecline({ chitId: ID }));
});

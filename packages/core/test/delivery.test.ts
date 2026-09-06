/**
 * The delivered mark is a second signed statement, so it needs the same discipline as the
 * chit itself: one canonical form, refused if it is not exactly that, and a link field that
 * cannot become an attack on whoever is shown it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChitCanonicalError, canonicaliseDelivery, checkDeliveryLink, parseDelivery } from '../src/index.ts';

const ID = 'chit1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

test('a delivery round-trips exactly', () => {
  const delivery = { chitId: ID, link: 'https://drive.example/x?y=1', note: 'final cut, 30s' };
  const text = canonicaliseDelivery(delivery);
  assert.equal(text, `chit/1 delivered\n${ID}\nhttps://drive.example/x?y=1\nfinal cut, 30s\n`);
  assert.deepEqual(parseDelivery(text), delivery);
});

test('a delivery with no link and no note is legal — work is often handed over elsewhere', () => {
  const text = canonicaliseDelivery({ chitId: ID, link: '', note: '' });
  assert.equal(text, `chit/1 delivered\n${ID}\n\n\n`);
  assert.deepEqual(parseDelivery(text), { chitId: ID, link: '', note: '' });
});

test('⭐ a link can never be a script or a data URL', () => {
  for (const bad of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'mailto:someone@example.com',
  ]) {
    assert.throws(() => checkDeliveryLink(bad), ChitCanonicalError, `accepted: ${bad}`);
  }
  checkDeliveryLink('https://example.com/a');
  checkDeliveryLink('http://example.com/a');
});

test('a link must be a whole URL, on one line, within the cap', () => {
  assert.throws(() => checkDeliveryLink('drive.example/x'), ChitCanonicalError, 'a bare host is not a URL');
  assert.throws(() => checkDeliveryLink('https://a.example/x\nhttps://b.example'), ChitCanonicalError);
  assert.throws(() => checkDeliveryLink(' https://a.example/x '), ChitCanonicalError);
  assert.throws(() => checkDeliveryLink(`https://a.example/${'x'.repeat(700)}`), ChitCanonicalError);
});

test('a note is one line and bounded', () => {
  assert.throws(() => canonicaliseDelivery({ chitId: ID, link: '', note: 'two\nlines' }), ChitCanonicalError);
  assert.throws(() => canonicaliseDelivery({ chitId: ID, link: '', note: 'x'.repeat(281) }), ChitCanonicalError);
});

test('the chit id must be a chit id', () => {
  assert.throws(() => canonicaliseDelivery({ chitId: 'not-an-id', link: '', note: '' }), ChitCanonicalError);
  assert.throws(() => canonicaliseDelivery({ chitId: '', link: '', note: '' }), ChitCanonicalError);
});

test('anything not exactly canonical is refused, not silently accepted', () => {
  assert.throws(() => parseDelivery(`chit/1 delivered\n${ID}\n\n\n\n`), ChitCanonicalError, 'extra line');
  assert.throws(() => parseDelivery(`chit/1 delivered\n${ID}\n\n`), ChitCanonicalError, 'missing line');
  assert.throws(() => parseDelivery(`chit/2 delivered\n${ID}\n\n\n`), ChitCanonicalError, 'wrong version');
  // A note that is not NFC would serialise differently than it arrived.
  assert.throws(() => parseDelivery(`chit/1 delivered\n${ID}\n\né\n`), ChitCanonicalError);
});

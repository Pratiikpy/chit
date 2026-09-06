/**
 * The one assumption a physical device would otherwise have to settle.
 *
 * Every signature chit verifies is produced by Nimiq Pay's own signer — the Nimiq Keyguard.
 * If chit's idea of what gets hashed differs from theirs by a single byte, nothing verifies
 * and the product is broken in a real user's hands. No amount of local testing would show
 * it, because both sides of a local test use chit's own implementation of the scheme: it
 * would agree with itself perfectly and be wrong.
 *
 * So the vectors below are not chit's. They are the Keyguard's own, taken from
 * `nimiq/keyguard` `tests/lib/Key.spec.js`, which assert what its `signMessage` produces.
 * The construction, read from that repository's `src/lib/Key.js` (cloned and opened, not
 * recalled):
 *
 *     const msgLengthAsString = message.byteLength.toString(10);
 *     data.write(fromUtf8(prefix));
 *     data.write(fromUtf8(msgLengthAsString));
 *     data.write(message);
 *     const hash = Hash.computeSha256(data);
 *
 * with `prefix = '\x16Nimiq Signed Message:\n'` from `src/lib/ClientEnums.js`.
 *
 * SHA-256 here comes from Node's own crypto rather than from `@nimiq/core`, so the two
 * implementations are genuinely independent and this cannot pass by both being wrong in the
 * same way.
 *
 * If Nimiq ever changes the prefix or the framing, this fails here rather than silently in
 * someone's hands.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NIMIQ_SIGN_MESSAGE_PREFIX } from '@chit/core';
import { nimiqSignedMessageDigest } from '../src/index.ts';

const PREFIX = '\x16Nimiq Signed Message:\n';

const sha256 = (bytes: Uint8Array): Uint8Array => new Uint8Array(createHash('sha256').update(bytes).digest());
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

test('⭐ the prefix is exactly the Keyguard constant', () => {
  assert.equal(NIMIQ_SIGN_MESSAGE_PREFIX, PREFIX);
  assert.equal(utf8(PREFIX).byteLength, 23);
  // 0x16 is a control character, not a visible one — easy to lose in a copy-paste.
  assert.equal(PREFIX.charCodeAt(0), 0x16);
  assert.equal(PREFIX.charCodeAt(PREFIX.length - 1), 0x0a);
});

test('⭐ the digest matches the Keyguard LEGACY vector', () => {
  // From Key.spec.js: fromUtf8('\x16Nimiq Signed Message:\n5hello'), then computeSha256.
  assert.deepEqual(nimiqSignedMessageDigest(utf8('hello')), sha256(utf8(`${PREFIX}5hello`)));
});

test('⭐ the digest matches the Keyguard BIP39 vector, over raw bytes', () => {
  // From Key.spec.js: fromUtf8('\x16Nimiq Signed Message:\n6') concatenated with [1..6].
  const raw = new Uint8Array([1, 2, 3, 4, 5, 6]);
  assert.deepEqual(nimiqSignedMessageDigest(raw), sha256(concat(utf8(`${PREFIX}6`), raw)));
});

test('⭐ the length prefix counts bytes, not characters', () => {
  // The case that would break it in the field: a pasted deal line is very often not ASCII,
  // and a character count would differ from a byte count exactly there.
  const text = 'café ☕';
  const bytes = utf8(text);
  assert.equal(text.length, 6, 'six UTF-16 code units');
  assert.equal(bytes.byteLength, 9, 'nine bytes: é is two, ☕ is three');
  assert.notEqual(text.length, bytes.byteLength, 'the two counts must diverge or this proves nothing');
  assert.deepEqual(nimiqSignedMessageDigest(bytes), sha256(concat(utf8(`${PREFIX}9`), bytes)));
  // And explicitly: framing by character count would produce a different digest.
  assert.notDeepEqual(nimiqSignedMessageDigest(bytes), sha256(concat(utf8(`${PREFIX}6`), bytes)));
});

test('an empty message still carries its length', () => {
  assert.deepEqual(nimiqSignedMessageDigest(new Uint8Array(0)), sha256(utf8(`${PREFIX}0`)));
});

test('a real chit canonical text hashes the same way', () => {
  // Nothing special about a chit — but this is the shape that actually gets signed, with
  // newlines inside it, and newlines are the separator the framing itself uses.
  const canonical = 'chit/1\nmain\nrace\nAAAAAAAAAAAAAAAAAAAAAA\n$40 for 3 thumbnails\n4000\nUSD\n120400000\n4100000\n4110000\nNQ07000000000000000000000000000000000\n\n3\n';
  const bytes = utf8(canonical);
  assert.deepEqual(nimiqSignedMessageDigest(bytes), sha256(concat(utf8(`${PREFIX}${bytes.byteLength}`), bytes)));
});

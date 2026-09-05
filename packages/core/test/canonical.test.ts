import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHIT_MEMO_PREFIX,
  NIMIQ_MAX_DATA_BYTES,
  canonicalise,
  ChitCanonicalError,
  chitHash,
  escapeField,
  isChitMemo,
  newNonce,
  normaliseAddress,
  parseCanonical,
  readMemo,
  unescapeField,
  type Chit,
} from '../src/index.ts';

const ALICE = 'NQ56M67GT26X3N9VXDGEQ3BNHSVUE13YQNGV';
const BOB = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';

function chit(overrides: Partial<Chit> = {}): Chit {
  return {
    chain: 'test',
    kind: 'handshake',
    nonce: 'AAAAAAAAAAAAAAAAAAAAAA',
    text: '$40 for 3 thumbnails by Friday',
    amountMinor: 4000n,
    currency: 'USD',
    luna: 120400000n,
    rateBlock: 4102887,
    deadlineBlock: 4110000,
    payer: ALICE,
    payee: BOB,
    deliverables: 3,
    ...overrides,
  };
}

test('canonical form round-trips exactly', () => {
  const original = chit();
  assert.deepEqual(parseCanonical(canonicalise(original)), {
    ...original,
    payee: normaliseAddress(BOB),
  });
});

test('canonical form is 13 LF-delimited fields with a trailing newline', () => {
  const serialised = canonicalise(chit());
  assert.ok(serialised.endsWith('\n'));
  assert.equal(serialised.slice(0, -1).split('\n').length, 13);
  assert.ok(serialised.startsWith('chit/1\n'));
});

test('addresses are normalised — spacing is presentation, not identity', () => {
  const spaced = canonicalise(chit({ payee: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000' }));
  const tight = canonicalise(chit({ payee: 'NQ0700000000000000000000000000000000' }));
  assert.equal(spaced, tight);
  // And a wrong-length address is rejected rather than silently normalised.
  assert.throws(() => canonicalise(chit({ payee: 'NQ070000000000000000000000000000000000' })), /not a Nimiq address/);
});

test('the chain is inside the signed bytes — a testnet signature cannot pass as mainnet', () => {
  // sign() has no domain separation, so this is the only thing preventing replay
  // across networks. If this test ever fails, testnet money can forge mainnet receipts.
  assert.notEqual(chitHash(chit({ chain: 'test' })), chitHash(chit({ chain: 'main' })));
});

test('the nonce makes two identical deals distinct', () => {
  const a = chitHash(chit({ nonce: 'AAAAAAAAAAAAAAAAAAAAAA' }));
  const b = chitHash(chit({ nonce: 'BBBBBBBBBBBBBBBBBBBBBB' }));
  assert.notEqual(a, b);
});

test('every field changes the digest', () => {
  const base = chitHash(chit());
  const mutations: Partial<Chit>[] = [
    { kind: 'race', payee: '' },
    { text: '$40 for 3 thumbnails by Saturday' },
    { amountMinor: 4001n },
    { currency: 'EUR' },
    { luna: 120400001n },
    { rateBlock: 4102888 },
    { deadlineBlock: 4110001 },
    { payer: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000', payee: ALICE },
    { deliverables: 4 },
  ];
  for (const mutation of mutations) {
    assert.notEqual(chitHash(chit(mutation)), base, `mutation did not change the digest: ${JSON.stringify(mutation, (_k, v) => (typeof v === 'bigint' ? String(v) : v))}`);
  }
});

test('text is NFC-normalised — the same word typed on two machines signs identically', () => {
  const composed = 'café logo';        // é as one code point
  const decomposed = 'café logo';     // e + combining acute
  assert.notEqual(composed.length, decomposed.length);
  assert.equal(chitHash(chit({ text: composed })), chitHash(chit({ text: decomposed })));
});

test('escaping is injective — text cannot forge a field boundary', () => {
  // A user pasting something that looks like the canonical form must not be able to
  // change how many fields the verifier sees.
  const attack = 'harmless\nUSD\n999999\nNQ07';
  const serialised = canonicalise(chit({ text: attack }));
  assert.equal(serialised.slice(0, -1).split('\n').length, 13);
  assert.equal(parseCanonical(serialised).text, attack);
});

test('escape round-trips for backslashes, newlines and carriage returns', () => {
  for (const value of ['a\\nb', 'a\nb', 'a\r\nb', '\\', '\\\\', '\\n', 'line1\nline2\\nliteral']) {
    assert.equal(unescapeField(escapeField(value)), value, `failed for ${JSON.stringify(value)}`);
  }
});

test('parseCanonical rejects anything not exactly canonical', () => {
  const serialised = canonicalise(chit());
  assert.throws(() => parseCanonical(serialised.slice(0, -1)), ChitCanonicalError); // no trailing LF
  assert.throws(() => parseCanonical(serialised + 'extra\n'), ChitCanonicalError);  // extra field
  assert.throws(() => parseCanonical(serialised.replace('chit/1', 'chit/2')), ChitCanonicalError);
  assert.throws(() => parseCanonical(serialised.replace('4000', '04000')), ChitCanonicalError); // leading zero
});

test('structural errors are rejected, with a reason', () => {
  assert.throws(() => canonicalise(chit({ text: '' })), /text cannot be empty/);
  assert.throws(() => canonicalise(chit({ kind: 'handshake', payee: '' })), /payee cannot be empty/);
  assert.throws(() => canonicalise(chit({ currency: 'usd' })), /ISO 4217/);
  assert.throws(() => canonicalise(chit({ nonce: 'short' })), /nonce/);
  assert.throws(() => canonicalise(chit({ payer: 'not-an-address' })), /not a Nimiq address/);
  assert.throws(() => canonicalise(chit({ amountMinor: -1n })), /non-negative/);
  assert.throws(() => canonicalise(chit({ rateBlock: 1.5 })), /non-negative integer/);
  assert.throws(() => canonicalise(chit({ chain: 'mainnet' as 'main' })), /chain must be/);
});

test('an open race chit has no payee and is legal', () => {
  const open = chit({ kind: 'race', payee: '' });
  assert.equal(parseCanonical(canonicalise(open)).payee, '');
});

test('the memo fits Nimiq\'s 64-byte data field with headroom', () => {
  const memo = chitHash(chit());
  const bytes = new TextEncoder().encode(memo).length;
  assert.equal(bytes, 49, 'chit1: + 43 base64url chars');
  assert.ok(bytes <= NIMIQ_MAX_DATA_BYTES);
  assert.ok(memo.startsWith(CHIT_MEMO_PREFIX));
  assert.ok(isChitMemo(memo));
});

test('the memo stays 49 bytes for the largest line allowed', () => {
  // The digest is fixed-width, so even a line at the maximum size — and one made entirely
  // of multi-byte characters — cannot overflow the 64-byte transaction data field.
  const maxAscii = chitHash(chit({ text: 'x'.repeat(2000) }));
  assert.equal(new TextEncoder().encode(maxAscii).length, 49);

  const maxEmoji = chitHash(chit({ text: '🧵'.repeat(500) }));
  assert.equal(new TextEncoder().encode(maxEmoji).length, 49);
});

test('isChitMemo rejects near-misses', () => {
  assert.equal(isChitMemo('chit1:short'), false);
  assert.equal(isChitMemo('chit2:' + 'A'.repeat(43)), false);
  assert.equal(isChitMemo(''), false);
});

test('readMemo handles both transaction shapes', () => {
  const memo = chitHash(chit());
  assert.equal(readMemo({ recipientData: memo }), memo, 'JSON-RPC shape');
  assert.equal(readMemo({ data: { raw: memo } }), memo, 'web client shape');
  assert.equal(readMemo({ data: memo }), memo, 'flat data shape');

  const hex = [...new TextEncoder().encode(memo)].map((b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(readMemo({ recipientData: hex }), memo, 'hex-encoded data field');

  assert.equal(readMemo({ recipientData: 'hello world' }), null);
  assert.equal(readMemo({}), null);
  assert.equal(readMemo(null), null);
});

test('newNonce produces distinct, well-formed nonces', () => {
  const nonces = new Set(Array.from({ length: 500 }, () => newNonce()));
  assert.equal(nonces.size, 500);
  for (const nonce of nonces) assert.match(nonce, /^[A-Za-z0-9_-]{22}$/);
});

test('the digest is stable across runs — a golden value', () => {
  // If this changes, every receipt ever issued has been invalidated. That is the point
  // of the test: it should be impossible to change the serializer by accident.
  assert.equal(chitHash(chit()), 'chit1:Gazr5lr3PUhb6ScRK3U89tqTA_fXIHjgdgUiHeI5OLM');
});

test('the line is bounded — text is the only field a user can make enormous', () => {
  // Everything else in the canonical form is fixed-width or validated, so this is the
  // only lever for making a request huge. Bounded in core, not at the HTTP layer, so the
  // rule holds for every caller including our own code.
  const justFits = 'a'.repeat(2000);
  assert.doesNotThrow(() => canonicalise(chit({ text: justFits })));
  assert.throws(() => canonicalise(chit({ text: 'a'.repeat(2001) })), /over the 2000-byte limit/);

  // Measured in UTF-8 bytes, not characters — 700 emoji is 2 800 bytes.
  assert.throws(() => canonicalise(chit({ text: '🧵'.repeat(700) })), /over the 2000-byte limit/);
  assert.doesNotThrow(() => canonicalise(chit({ text: '🧵'.repeat(400) })));
});

test('⭐ a quote is the mirror of a race: worker signs first, payer empty, existing digests untouched', () => {
  const worker = 'NQ12 1111 1111 1111 1111 1111 1111 1111 1111';
  const quote = { ...chit(), kind: 'quote' as const, payer: '', payee: worker };
  const round = parseCanonical(canonicalise(quote));
  assert.equal(round.kind, 'quote');
  assert.equal(round.payer, '');
  assert.equal(round.payee.replace(/\s/g, ''), worker.replace(/\s/g, ''));

  assert.throws(() => canonicalise({ ...chit(), kind: 'quote', payer: '', payee: '' }), /payee cannot be empty/);
  assert.throws(() => canonicalise({ ...chit(), kind: 'race', payer: '' }), /payer cannot be empty on a race/);
  assert.throws(() => canonicalise({ ...chit(), kind: 'handshake', payer: '' }), /payer cannot be empty/);

  // The golden digest from before the third kind existed must not move by a bit.
  assert.equal(chitHash(chit()), 'chit1:Gazr5lr3PUhb6ScRK3U89tqTA_fXIHjgdgUiHeI5OLM');
});

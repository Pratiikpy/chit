import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '@noble/hashes/sha256';
import {
  ED25519_PUBLIC_KEY_BYTES,
  ED25519_SIGNATURE_BYTES,
  SignatureDeclinedError,
  SignatureShapeError,
  coerceSignatureBytes,
  digestForText,
  nimiqSignedMessageDigest,
  normaliseSignature,
} from '../src/index.ts';

/** A real signature pair, from research/verification/01 §1.4 (executed against @nimiq/core). */
const PUBLIC_KEY_HEX = '0e0791599f497e01d655125db71daaf036f7972ccc59ec9b07a259a31cd7fa22';
const SIGNATURE_HEX =
  '13084da79f3d905f9b7d3f7dcb72470081ef6fb6b0658fc8af343560ad9f7258' +
  '13084da79f3d905f9b7d3f7dcb72470081ef6fb6b0658fc8af343560ad9f7258';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function toBase64(bytes: Uint8Array, urlSafe = false, padded = true): string {
  let base64 = Buffer.from(bytes).toString('base64');
  if (urlSafe) base64 = base64.replace(/\+/g, '-').replace(/\//g, '_');
  if (!padded) base64 = base64.replace(/=+$/, '');
  return base64;
}

const PUBLIC_KEY_BYTES = hexToBytes(PUBLIC_KEY_HEX);
const SIGNATURE_BYTES = hexToBytes(SIGNATURE_HEX);

test('byte lengths are what disambiguate the encodings', () => {
  assert.equal(PUBLIC_KEY_BYTES.length, ED25519_PUBLIC_KEY_BYTES);
  assert.equal(SIGNATURE_BYTES.length, ED25519_SIGNATURE_BYTES);
});

test('hex — the documented shape', () => {
  const result = normaliseSignature({ publicKey: PUBLIC_KEY_HEX, signature: SIGNATURE_HEX });
  assert.equal(result.publicKeyHex, PUBLIC_KEY_HEX);
  assert.equal(result.signatureHex, SIGNATURE_HEX);
});

test('uppercase hex normalises to lowercase', () => {
  const result = normaliseSignature({
    publicKey: PUBLIC_KEY_HEX.toUpperCase(),
    signature: SIGNATURE_HEX.toUpperCase(),
  });
  assert.equal(result.publicKeyHex, PUBLIC_KEY_HEX);
  assert.equal(result.signatureHex, SIGNATURE_HEX);
});

test('every plausible host framing produces the identical digest', () => {
  // This is the whole point of the normaliser: two devices, two hosts, one agreement.
  // Reef and Cinima both hit this independently (research/verification/04b §B1).
  const framings: Array<[string, unknown, unknown]> = [
    ['hex', PUBLIC_KEY_HEX, SIGNATURE_HEX],
    ['base64 padded', toBase64(PUBLIC_KEY_BYTES), toBase64(SIGNATURE_BYTES)],
    ['base64 unpadded', toBase64(PUBLIC_KEY_BYTES, false, false), toBase64(SIGNATURE_BYTES, false, false)],
    ['base64url padded', toBase64(PUBLIC_KEY_BYTES, true), toBase64(SIGNATURE_BYTES, true)],
    ['base64url unpadded', toBase64(PUBLIC_KEY_BYTES, true, false), toBase64(SIGNATURE_BYTES, true, false)],
    ['Uint8Array', PUBLIC_KEY_BYTES, SIGNATURE_BYTES],
    ['number[]', Array.from(PUBLIC_KEY_BYTES), Array.from(SIGNATURE_BYTES)],
    ['ArrayBuffer', PUBLIC_KEY_BYTES.buffer.slice(0), SIGNATURE_BYTES.buffer.slice(0)],
    ['numeric-keyed object', { ...PUBLIC_KEY_BYTES }, { ...SIGNATURE_BYTES }],
  ];

  for (const [name, publicKey, signature] of framings) {
    const result = normaliseSignature({ publicKey, signature });
    assert.equal(result.publicKeyHex, PUBLIC_KEY_HEX, `publicKey mismatch for ${name}`);
    assert.equal(result.signatureHex, SIGNATURE_HEX, `signature mismatch for ${name}`);
  }
});

test('alternative field names some hosts use', () => {
  assert.equal(
    normaliseSignature({ public_key: PUBLIC_KEY_HEX, sig: SIGNATURE_HEX }).publicKeyHex,
    PUBLIC_KEY_HEX,
  );
  assert.equal(
    normaliseSignature({ pubKey: PUBLIC_KEY_HEX, signature: SIGNATURE_HEX }).signatureHex,
    SIGNATURE_HEX,
  );
});

test('a declined signature is its own error type, not a failure', () => {
  // The provider resolves with an error object rather than rejecting — verified at
  // NimiqProvider.ts:104 / :93-96 (research/verification/01 §1.5c). Cancelling is a
  // normal outcome and the UI must show a calm screen, never an error state.
  for (const error of [
    'PermissionDeniedError',
    { message: 'PermissionDeniedError' },
    // The real verified shape: NimiqProvider.ts:33-38 is `{ type, message }`, and the
    // decline is carried in `type`, so a normaliser reading only `message` would miss it.
    { type: 'PermissionDeniedError', message: 'The request was not approved' },
    { type: 'PermissionDeniedError', message: '' },
    'User rejected the request',
    { message: 'The user cancelled' },
    'Request was aborted',
  ]) {
    assert.throws(() => normaliseSignature({ error }), SignatureDeclinedError, `for ${JSON.stringify(error)}`);
  }
});

test('a non-decline error is a shape error, and says what it saw', () => {
  assert.throws(
    () => normaliseSignature({ error: 'InvalidTransactionError' }),
    (err: unknown) => err instanceof SignatureShapeError && /InvalidTransactionError/.test((err as Error).message),
  );
});

test('malformed results are rejected rather than silently mis-decoded', () => {
  const bad: unknown[] = [
    null,
    undefined,
    'a string',
    42,
    {},
    { publicKey: PUBLIC_KEY_HEX },                       // no signature
    { signature: SIGNATURE_HEX },                        // no publicKey
    { publicKey: '', signature: SIGNATURE_HEX },         // empty
    { publicKey: PUBLIC_KEY_HEX.slice(0, 60), signature: SIGNATURE_HEX },   // wrong length
    { publicKey: PUBLIC_KEY_HEX, signature: SIGNATURE_HEX.slice(0, 100) },
    { publicKey: 'zz' + PUBLIC_KEY_HEX.slice(2), signature: SIGNATURE_HEX }, // non-hex chars
    { publicKey: Array.from(PUBLIC_KEY_BYTES).concat([999]), signature: SIGNATURE_HEX },
  ];
  for (const value of bad) {
    assert.throws(() => normaliseSignature(value), SignatureShapeError, `should reject ${JSON.stringify(value)?.slice(0, 60)}`);
  }
});

test('a wrong-length byte array is rejected, not truncated', () => {
  assert.throws(
    () => coerceSignatureBytes(new Uint8Array(31), ED25519_PUBLIC_KEY_BYTES, 'publicKey'),
    /expected 32 bytes, got 31/,
  );
});

test('the signed digest matches Nimiq\'s scheme byte for byte', () => {
  // prefix ‖ decimal(byteLength) ‖ message, then SHA-256. Cross-checked against
  // core-rs-albatross wallet_account.rs, the Keyguard, the Hub client and php-utils.
  const digest = digestForText('hello');
  assert.equal(digest.length, 32);
  assert.equal(
    Buffer.from(digest).toString('hex'),
    Buffer.from(
      nimiqSignedMessageDigest(new TextEncoder().encode('hello')),
    ).toString('hex'),
  );
});

test('⭐ the digest uses UTF-8 BYTE length, not JS string length', () => {
  // The Hub's own published snippet uses `message.length` (UTF-16 code units), which is
  // silently correct for ASCII and wrong for anything else (01 §1.5a). A chit that says
  // "café" or "€40" would fail to verify. This test is the guard.
  const text = 'café €40 🧵';
  const bytes = new TextEncoder().encode(text);
  assert.notEqual(text.length, bytes.byteLength, 'fixture must actually be non-ASCII');

  const correct = nimiqSignedMessageDigest(bytes);

  // Rebuild the wrong way the docs describe, and prove it differs.
  const encoder = new TextEncoder();
  const prefix = encoder.encode('\x16Nimiq Signed Message:\n');
  const wrongLength = encoder.encode(String(text.length));
  const wrongBuffer = new Uint8Array(prefix.length + wrongLength.length + bytes.length);
  wrongBuffer.set(prefix, 0);
  wrongBuffer.set(wrongLength, prefix.length);
  wrongBuffer.set(bytes, prefix.length + wrongLength.length);

  assert.notEqual(Buffer.from(correct).toString('hex'), Buffer.from(sha256(wrongBuffer)).toString('hex'));
});

test('ASCII text agrees under both length conventions — which is why the bug hides', () => {
  const text = 'hello world';
  assert.equal(text.length, new TextEncoder().encode(text).byteLength);
});

test('the digest is stable across runs — golden values', () => {
  // Computed once, here, from this implementation. If any of these change, the signing
  // scheme has drifted and every signature we ever collected verifies against nothing.
  const golden: Array<[string, string]> = [
    ['hello', 'fd72a0cd679fd00d472df44647303eadebe81903fe59d5b20e12961b7ea654a1'],
    ['café €40 🧵', '40b6795afac8b396fa08f599be95e81732ae74db526bcbe7e92014855eaee6a7'],
    ['', '47d0ddc0c1569ea553e7e21097fcf28271778546d41326d79113dbf4d2ecedaa'],
  ];
  for (const [text, expected] of golden) {
    assert.equal(Buffer.from(digestForText(text)).toString('hex'), expected, `digest drifted for ${JSON.stringify(text)}`);
  }
});

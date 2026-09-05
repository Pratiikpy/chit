import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KeyPair } from '@nimiq/core';
import { canonicalise, chitHash, type Chit } from '@chit/core';
import {
  addressFromPublicKey,
  nimiqSignedMessageDigest,
  verifyChit,
  verifySignedText,
} from '../src/index.ts';

/**
 * Sign text exactly the way a Nimiq wallet does, with a real Ed25519 key.
 *
 * This is what makes the suite meaningful: the vectors are generated here rather than
 * copied, so a round-trip proves the scheme end to end instead of proving that two
 * copies of the same constant match.
 */
function signAsWallet(keyPair: KeyPair, text: string) {
  const digest = nimiqSignedMessageDigest(new TextEncoder().encode(text));
  return {
    publicKeyHex: keyPair.publicKey.toHex(),
    signatureHex: keyPair.sign(digest).toHex(),
    address: keyPair.toAddress().toUserFriendlyAddress(),
  };
}

const PAYER = KeyPair.generate();
const PAYEE = KeyPair.generate();
const STRANGER = KeyPair.generate();

const PAYER_ADDRESS = PAYER.toAddress().toUserFriendlyAddress();
const PAYEE_ADDRESS = PAYEE.toAddress().toUserFriendlyAddress();

function chit(overrides: Partial<Chit> = {}): Chit {
  return {
    chain: 'test',
    kind: 'handshake',
    nonce: 'AAAAAAAAAAAAAAAAAAAAAA',
    text: '$40 for 3 thumbnails by Friday',
    amountMinor: 4000n,
    currency: 'USD',
    luna: 120_400_000n,
    rateBlock: 4_102_887,
    deadlineBlock: 4_110_000,
    payer: PAYER_ADDRESS,
    payee: PAYEE_ADDRESS,
    deliverables: 3,
    ...overrides,
  };
}

test('a real signature round-trips through the verifier', () => {
  const text = 'hello chit';
  const signed = signAsWallet(PAYER, text);
  const result = verifySignedText({ text, publicKeyHex: signed.publicKeyHex, signatureHex: signed.signatureHex });
  assert.equal(result.ok, true);
  assert.equal(result.derivedAddress, PAYER_ADDRESS);
});

test('the address derived from the public key is the signer\'s address', () => {
  assert.equal(addressFromPublicKey(PAYER.publicKey.toHex()), PAYER_ADDRESS);
});

test('a signature is rejected against different text', () => {
  const signed = signAsWallet(PAYER, 'the agreed line');
  const result = verifySignedText({
    text: 'a different line',
    publicKeyHex: signed.publicKeyHex,
    signatureHex: signed.signatureHex,
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'bad-signature');
});

test('⭐ a valid signature bound to the wrong address is rejected', () => {
  // A valid signature alone proves only that somebody signed. Without this check, anyone
  // could countersign a chit naming someone else and it would verify.
  const signed = signAsWallet(STRANGER, 'the agreed line');
  const result = verifySignedText({
    text: 'the agreed line',
    publicKeyHex: signed.publicKeyHex,
    signatureHex: signed.signatureHex,
    expectedAddress: PAYER_ADDRESS,
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'address-mismatch');
});

test('non-ASCII text verifies — the byte-length trap is avoided', () => {
  // The Hub's published snippet uses UTF-16 length and would fail here.
  for (const text of ['café €40 🧵', '₹3500 för en logotyp', '日本語のテキスト']) {
    const signed = signAsWallet(PAYER, text);
    assert.equal(
      verifySignedText({ text, publicKeyHex: signed.publicKeyHex, signatureHex: signed.signatureHex }).ok,
      true,
      text,
    );
  }
});

test('malformed key material is named, not thrown', () => {
  const signed = signAsWallet(PAYER, 'x');
  assert.equal(verifySignedText({ text: 'x', publicKeyHex: 'zz', signatureHex: signed.signatureHex }).failure, 'malformed-public-key');
  assert.equal(verifySignedText({ text: 'x', publicKeyHex: signed.publicKeyHex, signatureHex: 'zz' }).failure, 'malformed-signature');
});

test('a fully countersigned chit verifies', () => {
  const canonical = canonicalise(chit());
  const result = verifyChit({
    canonical,
    payerSignature: signAsWallet(PAYER, canonical),
    payeeSignature: signAsWallet(PAYEE, canonical),
    expectedChain: 'test',
  });
  assert.equal(result.ok, true);
  assert.equal(result.countersigned, true);
  assert.equal(result.settled, false, 'nothing settled yet');
  assert.equal(result.chit?.text, '$40 for 3 thumbnails by Friday');
});

test('a one-sided chit is valid but not countersigned — an offer, not an agreement', () => {
  const canonical = canonicalise(chit());
  const result = verifyChit({ canonical, payerSignature: signAsWallet(PAYER, canonical) });
  assert.equal(result.ok, true);
  assert.equal(result.countersigned, false);
});

test('a chit whose payment carried the matching memo is settled', () => {
  const subject = chit();
  const canonical = canonicalise(subject);
  const result = verifyChit({
    canonical,
    payerSignature: signAsWallet(PAYER, canonical),
    payeeSignature: signAsWallet(PAYEE, canonical),
    settledMemo: chitHash(subject),
  });
  assert.equal(result.ok, true);
  assert.equal(result.settled, true);
});

test('a payment carrying a different chit does not settle this one', () => {
  const canonical = canonicalise(chit());
  const other = chitHash(chit({ nonce: 'BBBBBBBBBBBBBBBBBBBBBB' }));
  const result = verifyChit({
    canonical,
    payerSignature: signAsWallet(PAYER, canonical),
    settledMemo: other,
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'digest-mismatch');
});

test('⭐ a testnet chit is refused by a mainnet verifier', () => {
  // sign() has no domain separation, so the same bytes verify on both networks. The chain
  // field inside the canonical form plus this check is the entire defence.
  const canonical = canonicalise(chit({ chain: 'test' }));
  const result = verifyChit({
    canonical,
    payerSignature: signAsWallet(PAYER, canonical),
    expectedChain: 'main',
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'chain-mismatch');
  assert.match(result.detail ?? '', /testnet, not mainnet/);
});

test('⭐ a stranger cannot countersign in the payee\'s place', () => {
  const canonical = canonicalise(chit());
  const result = verifyChit({
    canonical,
    payerSignature: signAsWallet(PAYER, canonical),
    payeeSignature: signAsWallet(STRANGER, canonical),
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'address-mismatch');
});

test('⭐ tampering with any field breaks verification', () => {
  // The signature covers the canonical form, so a changed amount, deadline or payee makes
  // the whole thing fail rather than quietly describing a different deal.
  const subject = chit();
  const canonical = canonicalise(subject);
  const payerSignature = signAsWallet(PAYER, canonical);

  const tampered = canonicalise({ ...subject, amountMinor: 400_000n });
  const result = verifyChit({ canonical: tampered, payerSignature });
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'bad-signature');
});

test('a non-canonical string is refused before any crypto runs', () => {
  const result = verifyChit({
    canonical: 'not a chit',
    payerSignature: { publicKeyHex: 'aa'.repeat(32), signatureHex: 'bb'.repeat(64) },
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure, 'malformed-canonical');
});

test('an open race chit accepts a countersignature from whoever took it', () => {
  // No payee is named yet, so the signature must be valid but cannot be bound to an
  // address the chit does not contain.
  const subject = chit({ kind: 'race', payee: '' });
  const canonical = canonicalise(subject);
  const result = verifyChit({
    canonical,
    payerSignature: signAsWallet(PAYER, canonical),
    payeeSignature: signAsWallet(STRANGER, canonical),
  });
  assert.equal(result.ok, true);
  assert.equal(result.countersigned, true);
});

test('verification needs no chain client and no database', () => {
  // Everything arrives as an argument. This is the property that makes the receipt
  // self-verifying with our servers switched off.
  const subject = chit();
  const canonical = canonicalise(subject);
  const started = performance.now();
  const result = verifyChit({
    canonical,
    payerSignature: signAsWallet(PAYER, canonical),
    payeeSignature: signAsWallet(PAYEE, canonical),
    settledMemo: chitHash(subject),
    expectedChain: 'test',
  });
  const elapsed = performance.now() - started;
  assert.equal(result.ok, true);
  assert.ok(elapsed < 250, `verification took ${elapsed.toFixed(1)}ms — too slow for per-request use`);
});

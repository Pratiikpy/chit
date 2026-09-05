/**
 * @chit/verify — server-side proof that a chit is genuine.
 *
 * Separate from `@chit/core` on purpose: this pulls in `@nimiq/core`, a Rust→WASM bundle
 * that has no business in a phone's bundle. Core stays dependency-light and isomorphic;
 * everything that needs real Ed25519 lives here and runs on the server.
 *
 * Measured cost (research/verification/01 §1.4, executed): ~48 ms to load the WASM,
 * ~0.2 ms per verification, ~50 MB resident. Cheap enough to verify on every request, and
 * **no chain client is constructed** — importing the crypto primitives is enough, so the
 * verify page never waits on consensus.
 */

import { Hash, PublicKey, Signature } from '@nimiq/core';
import {
  NIMIQ_SIGN_MESSAGE_PREFIX,
  canonicalise,
  chitHash,
  parseCanonical,
  type Chit,
} from '@chit/core';

/** Why a verification failed. Every failure is named, so the UI can say what is wrong. */
export type VerificationFailure =
  | 'malformed-canonical'
  | 'malformed-public-key'
  | 'malformed-signature'
  | 'bad-signature'
  | 'address-mismatch'
  | 'digest-mismatch'
  | 'chain-mismatch';

export interface VerificationResult {
  ok: boolean;
  failure?: VerificationFailure;
  /** Human-readable, safe to show. Never contains key material. */
  detail?: string;
  /** The address derived from the public key. Present whenever the key parsed. */
  derivedAddress?: string;
}

/**
 * Rebuild the digest the wallet signed.
 *
 * Uses `@nimiq/core`'s own SHA-256 rather than a second implementation, so there is no
 * possibility of the server and the wallet disagreeing about the primitive.
 *
 * The length is the UTF-8 **byte** length. The Hub's published JS snippet uses
 * `message.length` (UTF-16 code units), which is silently correct for ASCII and wrong for
 * any accent, emoji or currency symbol (01 §1.5a). A chit reading "café" or "€40" would
 * fail to verify against that version.
 */
export function nimiqSignedMessageDigest(message: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const prefix = encoder.encode(NIMIQ_SIGN_MESSAGE_PREFIX);
  const length = encoder.encode(String(message.byteLength));
  const buffer = new Uint8Array(prefix.length + length.length + message.length);
  buffer.set(prefix, 0);
  buffer.set(length, prefix.length);
  buffer.set(message, prefix.length + length.length);
  return Hash.computeSha256(buffer);
}

/** Derive the user-friendly Nimiq address a public key belongs to. */
export function addressFromPublicKey(publicKeyHex: string): string {
  return PublicKey.fromHex(publicKeyHex).toAddress().toUserFriendlyAddress();
}

function sameAddress(a: string, b: string): boolean {
  return a.replace(/\s/g, '').toUpperCase() === b.replace(/\s/g, '').toUpperCase();
}

export interface VerifySignedTextOptions {
  /** The exact text that was signed. */
  text: string;
  publicKeyHex: string;
  signatureHex: string;
  /** When given, the key must also belong to this address. */
  expectedAddress?: string;
}

/**
 * Verify one Nimiq signed message.
 *
 * A valid signature on its own proves only that *somebody* signed. Binding it to an
 * expected address is what makes it evidence about a particular party, so
 * `expectedAddress` should be supplied everywhere chit knows who it is expecting.
 */
export function verifySignedText(options: VerifySignedTextOptions): VerificationResult {
  let publicKey: PublicKey;
  try {
    publicKey = PublicKey.fromHex(options.publicKeyHex);
  } catch (error) {
    return { ok: false, failure: 'malformed-public-key', detail: describe(error) };
  }

  let signature: Signature;
  try {
    signature = Signature.fromHex(options.signatureHex);
  } catch (error) {
    return { ok: false, failure: 'malformed-signature', detail: describe(error) };
  }

  const derivedAddress = publicKey.toAddress().toUserFriendlyAddress();
  const digest = nimiqSignedMessageDigest(new TextEncoder().encode(options.text));

  if (!publicKey.verify(signature, digest)) {
    return { ok: false, failure: 'bad-signature', detail: 'the signature does not match this text', derivedAddress };
  }

  if (options.expectedAddress && !sameAddress(derivedAddress, options.expectedAddress)) {
    return {
      ok: false,
      failure: 'address-mismatch',
      detail: 'the signature is valid but belongs to a different address',
      derivedAddress,
    };
  }

  return { ok: true, derivedAddress };
}

export interface VerifyChitOptions {
  /** The canonical text, exactly as it was signed. */
  canonical: string;
  /** Signature from the party who pays. */
  payerSignature: { publicKeyHex: string; signatureHex: string };
  /** Signature from the party who is paid. Absent on an open race chit nobody has taken. */
  payeeSignature?: { publicKeyHex: string; signatureHex: string };
  /** The memo read off the settling transaction, when there is one. */
  settledMemo?: string;
  /** The chain the verifier is running against. Guards cross-network replay. */
  expectedChain?: 'main' | 'test';
}

export interface ChitVerification {
  ok: boolean;
  failure?: VerificationFailure;
  detail?: string;
  chit?: Chit;
  /** True when both parties signed. A one-sided chit is a valid offer, not an agreement. */
  countersigned: boolean;
  /** True when the settling transaction's memo matches this chit's digest. */
  settled: boolean;
}

/**
 * Verify a whole chit: the canonical form, both signatures, the addresses they bind to,
 * and — when supplied — that the settling payment carried this chit's digest.
 *
 * This function is the verify page. Everything it needs arrives as arguments, so it can
 * run with our database switched off; that is the property that makes the receipt
 * self-verifying rather than a claim we make about ourselves.
 */
export function verifyChit(options: VerifyChitOptions): ChitVerification {
  let chit: Chit;
  try {
    chit = parseCanonical(options.canonical);
  } catch (error) {
    return { ok: false, failure: 'malformed-canonical', detail: describe(error), countersigned: false, settled: false };
  }

  // Re-serialising and comparing guards against a canonical string that parses but was
  // not produced by this serializer.
  if (canonicalise(chit) !== options.canonical) {
    return { ok: false, failure: 'malformed-canonical', detail: 'not in canonical form', countersigned: false, settled: false };
  }

  if (options.expectedChain && chit.chain !== options.expectedChain) {
    return {
      ok: false,
      failure: 'chain-mismatch',
      detail: `this chit is bound to ${chit.chain}net, not ${options.expectedChain}net`,
      chit,
      countersigned: false,
      settled: false,
    };
  }

  const payer = verifySignedText({
    text: options.canonical,
    publicKeyHex: options.payerSignature.publicKeyHex,
    signatureHex: options.payerSignature.signatureHex,
    expectedAddress: chit.payer,
  });
  if (!payer.ok) {
    return { ok: false, ...pick(payer), chit, countersigned: false, settled: false };
  }

  let countersigned = false;
  if (options.payeeSignature) {
    const payee = verifySignedText({
      text: options.canonical,
      publicKeyHex: options.payeeSignature.publicKeyHex,
      signatureHex: options.payeeSignature.signatureHex,
      // An open race chit has no payee yet; the signature still has to be valid, but it
      // cannot be bound to an address the chit does not name.
      ...(chit.payee ? { expectedAddress: chit.payee } : {}),
    });
    if (!payee.ok) {
      return { ok: false, ...pick(payee), chit, countersigned: false, settled: false };
    }
    countersigned = true;
  }

  let settled = false;
  if (options.settledMemo !== undefined) {
    if (options.settledMemo !== chitHash(chit)) {
      return {
        ok: false,
        failure: 'digest-mismatch',
        detail: 'the payment carries a different chit',
        chit,
        countersigned,
        settled: false,
      };
    }
    settled = true;
  }

  return { ok: true, chit, countersigned, settled };
}

function pick(result: VerificationResult): { failure?: VerificationFailure; detail?: string } {
  return {
    ...(result.failure ? { failure: result.failure } : {}),
    ...(result.detail ? { detail: result.detail } : {}),
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

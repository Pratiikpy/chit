/**
 * The chit digest and the on-chain memo.
 *
 * FROZEN alongside `canonical.ts`. The digest is what both parties sign and what the
 * settling payment carries, so a change here breaks every receipt ever issued.
 *
 * Why SHA-256: it is what Nimiq's own signed-message scheme hashes with
 * (`\x16Nimiq Signed Message:\n` ‖ len ‖ msg → SHA-256 → Ed25519), verified in
 * research/verification/01 §1.2 against four independent Nimiq implementations. Using the
 * same primitive keeps one hash function in the whole system.
 *
 * Why base64url and not hex: the memo has to fit Nimiq's **64-byte** transaction data
 * field — `MAX_BASIC_TX_RECIPIENT_DATA_SIZE = 64`, verified empirically at 64 OK / 65
 * `Overflow` (01 §3). Hex would be `chit1:` + 64 = 70 bytes and would not fit. base64url
 * is `chit1:` + 43 = **49 bytes**, leaving 15 bytes of headroom for a future scheme tag.
 */

import { sha256 } from '@noble/hashes/sha256';
import { canonicalise, type Chit } from './canonical.ts';

/** Scheme tag on the on-chain memo. Lets a reader identify a chit payment without our API. */
export const CHIT_MEMO_PREFIX = 'chit1:' as const;

/** Nimiq's hard limit on a basic transaction's data field. Verified, not assumed. */
export const NIMIQ_MAX_DATA_BYTES = 64;

const encoder = new TextEncoder();

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Encode bytes as unpadded base64url.
 *
 * Implemented directly rather than via `btoa` or `Buffer`, because this package runs in a
 * phone's WebView, in Node, and in a test runner — and reaching for a platform global
 * would mean one of those three quietly breaking. No dependency, no branch, no surprise.
 */
export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);

    out += BASE64URL_ALPHABET[(triple >> 18) & 63];
    out += BASE64URL_ALPHABET[(triple >> 12) & 63];
    if (b !== undefined) out += BASE64URL_ALPHABET[(triple >> 6) & 63];
    if (c !== undefined) out += BASE64URL_ALPHABET[triple & 63];
  }
  return out;
}

/** Decode unpadded (or padded) base64url back to bytes. */
export function fromBase64Url(value: string): Uint8Array {
  const clean = value.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 6) / 8));

  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (const character of clean) {
    const digit = BASE64URL_ALPHABET.indexOf(character === '+' ? '-' : character === '/' ? '_' : character);
    if (digit < 0) throw new Error(`invalid base64url character ${JSON.stringify(character)}`);
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, index);
}

/** The raw 32-byte digest of a chit's canonical form. */
export function chitDigest(chit: Chit): Uint8Array {
  return sha256(encoder.encode(canonicalise(chit)));
}

/**
 * The chit's identity: `chit1:` followed by the base64url digest.
 *
 * This exact string is what goes in the transaction data field, so the length assertion
 * below is a real guarantee and not a comment.
 */
export function chitHash(chit: Chit): string {
  const memo = CHIT_MEMO_PREFIX + toBase64Url(chitDigest(chit));
  const size = encoder.encode(memo).length;
  if (size > NIMIQ_MAX_DATA_BYTES) {
    // Unreachable for v1 (always 49 bytes) — this fires only if the prefix or digest
    // size is ever changed, which is exactly when we want to be stopped.
    throw new Error(`chit memo is ${size} bytes, over Nimiq's ${NIMIQ_MAX_DATA_BYTES}-byte limit`);
  }
  return memo;
}

/** True if a transaction's data field looks like a chit memo. Cheap pre-filter for the watcher. */
export function isChitMemo(memo: string): boolean {
  return memo.startsWith(CHIT_MEMO_PREFIX) && memo.length === CHIT_MEMO_PREFIX.length + 43;
}

/**
 * Read the memo out of a settled transaction, whichever shape the source hands us.
 *
 * The same field arrives as `recipientData` over JSON-RPC and as `data.raw` via the
 * `@nimiq/core` web client (research/verification/05b). Normalise both here, or key
 * release silently never fires for one of the two sources — a failure that looks like
 * "the payment didn't arrive" and is very hard to trace.
 */
export function readMemo(tx: unknown): string | null {
  if (typeof tx !== 'object' || tx === null) return null;
  const record = tx as Record<string, unknown>;

  const candidates: unknown[] = [
    record['recipientData'],
    (record['data'] as Record<string, unknown> | undefined)?.['raw'],
    record['data'],
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length === 0) continue;
    // A chit memo is ASCII. Sources that hex-encode the data field are decoded first.
    const decoded = /^[0-9a-fA-F]+$/.test(candidate) && candidate.length % 2 === 0
      ? hexToAscii(candidate)
      : candidate;
    if (isChitMemo(decoded)) return decoded;
  }
  return null;
}

function hexToAscii(hex: string): string {
  let out = '';
  for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

/** 16 cryptographically random bytes as unpadded base64url — the `nonce` field. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

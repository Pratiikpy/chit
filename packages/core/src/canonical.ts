/**
 * The canonical serialization of a chit.
 *
 * THIS FILE IS FROZEN. Every receipt, invoice, profile line, verify-page verdict and
 * dispute record ever issued is a claim about the output of `canonicalise()`. Changing
 * the field list, their order, or the escaping silently invalidates all of them.
 *
 * To change it: add a new version constant, keep the old serializer intact, and make
 * `canonicalise()` dispatch on `v`. Never edit v1 in place.
 *
 * Design rules, and why:
 *
 * - **Versioned first line.** A verifier must know which serializer to run before it
 *   parses anything else.
 * - **`chain` is a field, not context.** Nimiq's `sign()` has no domain separation and no
 *   expiry, so a signature made on testnet verifies byte-for-byte on mainnet
 *   (research/verification/01 §1, 05b §4). The chain must be inside the signed bytes.
 * - **`nonce` is a field.** Same reason, for replay: two identical deals between the same
 *   two people for the same amount must not produce the same digest.
 * - **Every field is mandatory**, empty string where not applicable. An optional field
 *   would make two different chits serialise identically.
 * - **NFC normalisation.** "café" typed on a Mac and on Windows are different byte
 *   sequences until normalised, and would otherwise produce different digests for text
 *   that looks identical to both humans who signed it.
 * - **Escaping is injective.** The free-text field is the only one a user controls, so it
 *   is escaped such that no input can forge a field boundary.
 */

/** Serializer version. Appears as the first line of the canonical form. */
export const CHIT_CANONICAL_VERSION = 'chit/1' as const;

/** Which Nimiq network the chit is bound to. Part of the signed bytes — see file header. */
export type ChitChain = 'main' | 'test';

/**
 * What kind of agreement this is.
 * - `handshake` — a deal agreed elsewhere, pasted in. Two named parties from the start.
 * - `race`      — posted to the board. `payee` is empty until someone wins.
 * - `quote`     — the mirror image: a worker signs a scope alone, `payer` is empty, and the
 *                 first payment carrying the digest both accepts the terms and names the
 *                 client. Paying is accepting; there is no countersign step.
 */
export type ChitKind = 'handshake' | 'race' | 'quote';

export interface Chit {
  /** Network binding. Never inferred at verification time — always read from here. */
  chain: ChitChain;
  kind: ChitKind;
  /** 16 random bytes, base64url, unpadded. Anti-replay. See `newNonce()`. */
  nonce: string;
  /** The agreed line, exactly as both parties saw it. NFC-normalised on serialization. */
  text: string;
  /** Amount in the currency's minor unit (cents), as an integer. Never a float. */
  amountMinor: bigint;
  /** ISO 4217, uppercase. The fiat number is the contract; NIM is the settlement. */
  currency: string;
  /** The NIM amount in Luna, integer. 1 NIM = 100_000 Luna. */
  luna: bigint;
  /** Block height at which the fiat→NIM rate was locked. Makes the rate checkable. */
  rateBlock: number;
  /** Block height after which the chit is expired. Chain-verifiable, not our clock. */
  deadlineBlock: number;
  /** Who pays. Nimiq address, normalised (no spaces, uppercase). */
  payer: string;
  /** Who is paid. Empty string for an open race chit. */
  payee: string;
  /** How many things are being delivered. `1` when not otherwise stated. */
  deliverables: number;
}

/** Thrown when a chit cannot be serialised. Never thrown for user text — only for bad structure. */
export class ChitCanonicalError extends Error {
  override readonly name = 'ChitCanonicalError';
}

/**
 * The largest a chit's line may be, in UTF-8 bytes.
 *
 * `text` is the only field a user controls the length of, so it is the only one that can
 * be used to make a request enormous. 2 000 bytes is far more than "one line of text"
 * needs — several sentences of any script — while keeping a canonical form small enough
 * that storing, signing and displaying it are all cheap. Bounded here rather than at the
 * HTTP layer so the rule holds for every caller, including our own code.
 */
export const MAX_TEXT_BYTES = 2000;

const NQ_ADDRESS = /^NQ[0-9A-Z]{34}$/;
const CURRENCY = /^[A-Z]{3}$/;
const NONCE = /^[A-Za-z0-9_-]{22}$/; // 16 bytes, base64url, unpadded

/**
 * Normalise a Nimiq address to its canonical signed form: no whitespace, uppercase.
 * Nimiq renders addresses in space-separated groups for humans; the groups are
 * presentation, never part of the identity.
 */
export function normaliseAddress(address: string): string {
  return address.replace(/\s+/g, '').toUpperCase();
}

/**
 * Escape a free-text field so it cannot forge a field boundary.
 *
 * Injective by construction: backslash is escaped first, so every `\n` in the output
 * came from either a real newline or an escaped backslash followed by `n`, and the two
 * cases are distinguishable by scanning left to right.
 */
export function escapeField(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/** Inverse of `escapeField`. Exported for the verify page, which shows what was signed. */
export function unescapeField(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== '\\') {
      out += value[i];
      continue;
    }
    const next = value[++i];
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === '\\') out += '\\';
    else throw new ChitCanonicalError(`Invalid escape sequence \\${next ?? '<end>'}`);
  }
  return out;
}

function assertUint(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ChitCanonicalError(`${name} must be a non-negative integer, got ${value}`);
  }
}

function assertUintBig(name: string, value: bigint): void {
  if (value < 0n) throw new ChitCanonicalError(`${name} must be non-negative, got ${value}`);
}

/**
 * Serialise a chit to its canonical byte-exact string form.
 *
 * The output is LF-delimited with a trailing newline, so appending is unambiguous and
 * every line is a complete field. Field order is fixed and must never change within a
 * version.
 */
/**
 * An agreement with no payment: an amended scope, or a cancellation both sides signed.
 *
 * Two things a freelancer needs and a payment rail does not naturally give them. The scope
 * changed halfway and there is no record of the new deal, so the argument later is about
 * whose memory is right; or the job is off and the chit sits open forever, which is worse
 * than a "no" because nobody can tell it apart from a client who has not got round to it.
 *
 * Both are the same object as any other chit — same canonical form, same two signatures,
 * same digest — with the amount set to nothing. Recognising one is therefore a question
 * about the value, never a new field: adding a field would change every digest ever
 * computed, and the digest is the product.
 *
 * A chit with no money in it settles when the second signature arrives, and never by
 * payment. Nothing is due, so nothing can be late and nothing can be owed.
 */
export function isRecordOnly(chit: Pick<Chit, 'amountMinor' | 'luna'>): boolean {
  return chit.amountMinor === 0n && chit.luna === 0n;
}

export function canonicalise(chit: Chit): string {
  if (chit.chain !== 'main' && chit.chain !== 'test') {
    throw new ChitCanonicalError(`chain must be "main" or "test", got ${JSON.stringify(chit.chain)}`);
  }
  if (chit.kind !== 'handshake' && chit.kind !== 'race' && chit.kind !== 'quote') {
    throw new ChitCanonicalError(`kind must be "handshake", "race" or "quote", got ${JSON.stringify(chit.kind)}`);
  }
  if (!NONCE.test(chit.nonce)) {
    throw new ChitCanonicalError('nonce must be 16 bytes as unpadded base64url (22 chars)');
  }
  if (!CURRENCY.test(chit.currency)) {
    throw new ChitCanonicalError(`currency must be a 3-letter ISO 4217 code, got ${JSON.stringify(chit.currency)}`);
  }

  // Empty payer is legal for exactly one kind: a quote, which a worker signs before any
  // client exists. For a handshake or a race the payer is the party who signed first.
  const payer = chit.payer === '' ? '' : normaliseAddress(chit.payer);
  if (payer === '' && chit.kind !== 'quote') {
    throw new ChitCanonicalError(`payer cannot be empty on a ${chit.kind}`);
  }
  if (payer !== '' && !NQ_ADDRESS.test(payer)) {
    throw new ChitCanonicalError(`payer is not a Nimiq address: ${JSON.stringify(chit.payer)}`);
  }

  // Empty payee is legal and meaningful: an open race chit nobody has won yet.
  const payee = chit.payee === '' ? '' : normaliseAddress(chit.payee);
  if (payee !== '' && !NQ_ADDRESS.test(payee)) {
    throw new ChitCanonicalError(`payee is not a Nimiq address: ${JSON.stringify(chit.payee)}`);
  }
  if (chit.kind === 'handshake' && payee === '') {
    throw new ChitCanonicalError('a handshake names both parties; payee cannot be empty');
  }
  if (chit.kind === 'quote' && payee === '') {
    throw new ChitCanonicalError('a quote is signed by the worker; payee cannot be empty');
  }

  assertUintBig('amountMinor', chit.amountMinor);
  assertUintBig('luna', chit.luna);
  assertUint('rateBlock', chit.rateBlock);
  assertUint('deadlineBlock', chit.deadlineBlock);
  assertUint('deliverables', chit.deliverables);

  if (chit.text.length === 0) {
    throw new ChitCanonicalError('text cannot be empty — the line is the agreement');
  }

  const textBytes = new TextEncoder().encode(chit.text).length;
  if (textBytes > MAX_TEXT_BYTES) {
    throw new ChitCanonicalError(
      `text is ${textBytes} bytes, over the ${MAX_TEXT_BYTES}-byte limit — a chit is one line`,
    );
  }

  const fields = [
    CHIT_CANONICAL_VERSION,
    chit.chain,
    chit.kind,
    chit.nonce,
    escapeField(chit.text.normalize('NFC')),
    chit.amountMinor.toString(10),
    chit.currency,
    chit.luna.toString(10),
    chit.rateBlock.toString(10),
    chit.deadlineBlock.toString(10),
    payer,
    payee,
    chit.deliverables.toString(10),
  ];

  return fields.join('\n') + '\n';
}

/**
 * Parse a canonical string back into a chit.
 *
 * The verify page needs this: it is handed the signed text and must show the reader what
 * each field says. Round-trips exactly with `canonicalise()`.
 */
export function parseCanonical(serialised: string): Chit {
  if (!serialised.endsWith('\n')) {
    throw new ChitCanonicalError('canonical form must end with a newline');
  }
  const lines = serialised.slice(0, -1).split('\n');
  if (lines.length !== 13) {
    throw new ChitCanonicalError(`expected 13 fields, got ${lines.length}`);
  }
  const [version, chain, kind, nonce, text, amountMinor, currency, luna, rateBlock, deadlineBlock, payer, payee, deliverables] =
    lines as [string, string, string, string, string, string, string, string, string, string, string, string, string];

  if (version !== CHIT_CANONICAL_VERSION) {
    throw new ChitCanonicalError(`unknown canonical version ${JSON.stringify(version)}`);
  }

  const chit: Chit = {
    chain: chain as ChitChain,
    kind: kind as ChitKind,
    nonce,
    text: unescapeField(text),
    amountMinor: BigInt(amountMinor),
    currency,
    luna: BigInt(luna),
    rateBlock: Number(rateBlock),
    deadlineBlock: Number(deadlineBlock),
    payer,
    payee,
    deliverables: Number(deliverables),
  };

  // Re-serialise and compare. This rejects any input that is not exactly canonical —
  // a non-NFC text, a lowercase address, a leading zero on a number — instead of
  // silently accepting it and producing a different digest than the signer saw.
  if (canonicalise(chit) !== serialised) {
    throw new ChitCanonicalError('input is not in canonical form');
  }
  return chit;
}

/**
 * A review nobody can buy, delete, or move.
 *
 * Every marketplace's rating is a row in that marketplace's database. It is why leaving one
 * costs a freelancer years of work, why a suspended account takes the reputation with it, and
 * why the reviews are worth buying — the seller of a five-star account is selling somebody
 * else's rows. The research corpus is full of all three complaints and they are the same
 * complaint: the record belongs to the platform.
 *
 * Here a review is a signed statement about a payment that provably happened.
 *
 * Three properties fall out of binding it to the settling transaction hash:
 *
 * 1. **No payment, no review.** The hash must be the one the chain recorded for that chit.
 *    A review cannot exist before money moved, so there is nothing to farm and nothing to
 *    write in bulk. Every review has a real payment behind it, and the amount is public.
 * 2. **Only the two parties may write one.** The signature must verify against the payer's
 *    or the worker's key. Nobody else can leave one, at any price.
 * 3. **It survives chit.** Signature, public key and canonical text are enough for anyone to
 *    re-check the claim with an off-the-shelf Ed25519 library. If this service disappears,
 *    a freelancer who kept their reviews still holds something a stranger can verify.
 *
 * What it deliberately is not: moderated, appealable, or editable. One review per party per
 * chit, and the first one stands. A service that could delete a review would be back to
 * owning the record, and every argument above would collapse.
 */

import { ChitCanonicalError } from './canonical.ts';

/** The version marker. Bumping it is a new format, never a silent change to this one. */
export const REVIEW_CANONICAL_VERSION = 'chit/1 review';

/** A review may be this long. About a paragraph — long enough to be useful, short enough to read. */
export const MAX_REVIEW_BYTES = 400;

/** The scale. Five points, because everyone already knows how to read five points. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

export interface Review {
  /** The chit this is about — its digest, exactly as the id is written. */
  chitId: string;
  /** The settling transaction's hash, lowercase hex. The proof that there was a payment. */
  txHash: string;
  /** 1 to 5. */
  rating: number;
  /** What they said. Empty is allowed: a rating with no words is still a review. */
  text: string;
}

const encoder = new TextEncoder();

/**
 * The exact bytes a reviewer signs.
 *
 * Line-per-field, same discipline as the chit's own canonical form. The chit id is base64url
 * and the hash is hex, so neither can carry a newline; the rating is a single digit; the text
 * is the only free field and is rejected outright if it contains one. Nothing is escaped,
 * because nothing may need escaping.
 */
export function canonicaliseReview(review: Review): string {
  if (!/^chit1:[A-Za-z0-9_-]+$/.test(review.chitId)) {
    throw new ChitCanonicalError(`not a chit id: ${JSON.stringify(review.chitId)}`);
  }
  if (!/^[0-9a-f]{64}$/.test(review.txHash)) {
    throw new ChitCanonicalError('txHash must be 64 lowercase hex characters');
  }
  if (!Number.isInteger(review.rating) || review.rating < MIN_RATING || review.rating > MAX_RATING) {
    throw new ChitCanonicalError(`rating must be a whole number ${MIN_RATING}–${MAX_RATING}`);
  }

  const text = review.text.normalize('NFC');
  if (/[\r\n]/.test(text)) throw new ChitCanonicalError('a review is a single paragraph, with no line breaks');
  if (text !== text.trim()) throw new ChitCanonicalError('a review must not begin or end with space');
  if (encoder.encode(text).length > MAX_REVIEW_BYTES) {
    throw new ChitCanonicalError(`a review is longer than ${MAX_REVIEW_BYTES} bytes`);
  }

  return [REVIEW_CANONICAL_VERSION, review.chitId, review.txHash, String(review.rating), text, ''].join('\n');
}

/** Read a canonical review back, refusing anything not exactly in that form. */
export function parseReview(serialised: string): Review {
  const lines = serialised.split('\n');
  if (lines.length !== 6 || lines[5] !== '') {
    throw new ChitCanonicalError('a review is five lines and a trailing newline');
  }
  if (lines[0] !== REVIEW_CANONICAL_VERSION) {
    throw new ChitCanonicalError(`unknown review version: ${JSON.stringify(lines[0])}`);
  }
  const rating = Number(lines[3]);
  const review: Review = { chitId: lines[1] ?? '', txHash: lines[2] ?? '', rating, text: lines[4] ?? '' };
  // Re-serialise and compare, so a non-canonical input is refused rather than accepted with a
  // different digest than the signer saw. This is what stops "5" and "05" being the same review.
  if (canonicaliseReview(review) !== serialised) {
    throw new ChitCanonicalError('input is not in canonical form');
  }
  return review;
}

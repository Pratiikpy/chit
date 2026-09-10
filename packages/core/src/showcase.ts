/**
 * A portfolio piece nobody can fake — and nobody can publish alone.
 *
 * ## What is wrong with every portfolio that exists
 *
 * A Fiverr or Upwork portfolio is a folder of images the seller uploaded. Nothing in it is evidence:
 * the work may be somebody else's, it may never have been commissioned, and it certainly does not
 * show that anyone ever paid for it. Stolen portfolios are a standing complaint in the research
 * corpus, and they are unfixable by design — a self-asserted claim cannot be checked.
 *
 * Here a portfolio piece is **a settled chit with the work attached**. The payment is on chain, the
 * agreement is signed by both parties, and the link is the thing that was delivered against it. A
 * stranger can check every part of that without asking us.
 *
 * ## Why it takes two signatures
 *
 * Because the deliverable is not only the worker's to publish. It may contain a client's unreleased
 * brand, their private document, their unannounced product. A worker who could publish it alone
 * would be one bad judgement away from doing real harm to somebody who trusted them, and "they
 * should have known better" is not a design.
 *
 * So a showcase is proposed by the worker and confirmed by the payer, over the same bytes — which is
 * exactly the mechanic the chit itself uses. Nothing new had to be invented, and the rule reads the
 * same as the rest of the product: **if both did not sign it, it is not real.**
 *
 * ## What it deliberately is not
 *
 * File storage. chit holds the link and never the file, for the same reason `delivery.ts` gives:
 * storage is a different product with a different liability. What is added here is not a place to
 * put work — it is proof that the work was paid for and that both people agreed to show it.
 *
 * And it is not editable or deletable by us. A showcase either has its two signatures or it does not
 * exist; there is no state in between for anyone to adjust.
 */

import { ChitCanonicalError } from './canonical.ts';
import { checkDeliveryLink } from './delivery.ts';

/** The version marker. Bumping it is a new format, never a silent change to this one. */
export const SHOWCASE_CANONICAL_VERSION = 'chit/1 showcase';

/**
 * A caption may be this long.
 *
 * One line, because the chit's own words are already on the piece and are the honest description of
 * what the job was. The caption is for the part the agreement does not say — "the brief was a
 * rebrand in two days" — not for a second, prettier version of the same thing.
 */
export const MAX_CAPTION_BYTES = 200;

export interface Showcase {
  /** The chit this piece is — its digest, exactly as the id is written. */
  chitId: string;
  /**
   * The settling transaction's hash, lowercase hex.
   *
   * Carried for the same reason a review carries it: **no payment, no portfolio.** A piece cannot
   * exist before money moved, so nothing here can be manufactured in bulk, and the amount somebody
   * was paid for the work is public beside it.
   */
  txHash: string;
  /** Where the work is. The same kind of link a delivery carries, checked the same way. */
  link: string;
  /** One line from the worker. Empty is normal and fine. */
  caption: string;
}

const encoder = new TextEncoder();
const CHIT_ID = /^chit1:[A-Za-z0-9_-]+$/;

/** The exact bytes both the worker and the payer sign. */
export function canonicaliseShowcase(showcase: Showcase): string {
  if (!CHIT_ID.test(showcase.chitId)) {
    throw new ChitCanonicalError(`not a chit id: ${JSON.stringify(showcase.chitId)}`);
  }
  if (!/^[0-9a-f]{64}$/.test(showcase.txHash)) {
    throw new ChitCanonicalError('txHash must be 64 lowercase hex characters');
  }

  /*
   * A showcase without a link is not a portfolio piece.
   *
   * The delivery allows an empty link, because work is often handed over some other way and the
   * claim there is only "I delivered". Here the link *is* the object — there is nothing to show
   * without it — so an empty one is refused rather than stored as a piece nobody can look at.
   */
  if (showcase.link === '') {
    throw new ChitCanonicalError('a showcase needs a link to the work');
  }
  // Same scheme and length rules as a delivery link: this is shown by one stranger to another.
  checkDeliveryLink(showcase.link);

  const caption = showcase.caption.normalize('NFC');
  if (/[\r\n]/.test(caption)) {
    throw new ChitCanonicalError('a caption is a single line, with no line breaks');
  }
  if (caption !== caption.trim()) {
    throw new ChitCanonicalError('a caption must not begin or end with space');
  }
  if (encoder.encode(caption).length > MAX_CAPTION_BYTES) {
    throw new ChitCanonicalError(`a caption is longer than ${MAX_CAPTION_BYTES} bytes`);
  }

  return [SHOWCASE_CANONICAL_VERSION, showcase.chitId, showcase.txHash, showcase.link, caption, ''].join('\n');
}

/** Read a canonical showcase back, refusing anything not exactly in that form. */
export function parseShowcase(serialised: string): Showcase {
  const lines = serialised.split('\n');
  if (lines.length !== 6 || lines[5] !== '') {
    throw new ChitCanonicalError('a showcase is five lines and a trailing newline');
  }
  if (lines[0] !== SHOWCASE_CANONICAL_VERSION) {
    throw new ChitCanonicalError(`unknown showcase version: ${JSON.stringify(lines[0])}`);
  }
  const showcase: Showcase = {
    chitId: lines[1] ?? '',
    txHash: lines[2] ?? '',
    link: lines[3] ?? '',
    caption: lines[4] ?? '',
  };
  // Re-serialise and compare, so a nearly-canonical input is refused rather than stored with a
  // different digest than the two signers saw.
  if (canonicaliseShowcase(showcase) !== serialised) {
    throw new ChitCanonicalError('input is not in canonical form');
  }
  return showcase;
}

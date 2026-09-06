/**
 * "Here it is." — the state between signing and being paid.
 *
 * A chit had two verbs: agree, and pay. Fiverr's whole order flow has a third between them,
 * and so does Upwork's, and its absence is the largest functional gap in the audit: the
 * worker finishes, hands the file over somewhere else, and has no way to say so. The payer
 * has nothing to react to and the worker's screen still reads "waiting".
 *
 * So this is a second signed statement, made by the party who will be paid, over a canonical
 * form of its own. It is deliberately **not** part of the chit: the agreement's digest is the
 * product, and putting a delivery into it would change every digest ever computed and would
 * also let one party alter what both had signed. A delivery is an event *about* a chit,
 * signed by one side, and it is evidence exactly to that extent.
 *
 * What it claims and what it does not:
 * - It proves *that wallet* said "delivered" at a time chit recorded, over *that* chit id.
 * - It says nothing about whether the work is any good, or whether the link still resolves,
 *   or whether the payer agrees. Nothing here obliges anyone to pay.
 *
 * The link is a URL to wherever the work actually lives — Drive, Figma, Dropbox, a repo.
 * chit stores the string and never the file: storage is a different product with a different
 * liability, and a link is the whole feature.
 */

import { ChitCanonicalError } from './canonical.ts';

/** The version marker. Bumping it is a new format, never a silent change to this one. */
export const DELIVERY_CANONICAL_VERSION = 'chit/1 delivered';

/** A link may be this long. Long enough for a signed cloud URL, short enough to sign and read. */
export const MAX_DELIVERY_LINK_BYTES = 600;

/**
 * Only these schemes. A `javascript:` or `data:` URL in a field one stranger shows another is
 * an attack surface, and `mailto:` is not a place work can live.
 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

export interface Delivery {
  /** The chit this is about — its digest, exactly as the id is written. */
  chitId: string;
  /** Where the work is. Empty when the work was handed over some other way. */
  link: string;
  /** A sentence the worker may add. Empty is normal. */
  note: string;
}

const encoder = new TextEncoder();

/** Reject anything that cannot be a link a person can safely be shown. */
export function checkDeliveryLink(link: string): void {
  if (link === '') return;
  if (encoder.encode(link).length > MAX_DELIVERY_LINK_BYTES) {
    throw new ChitCanonicalError(`link is longer than ${MAX_DELIVERY_LINK_BYTES} bytes`);
  }
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new ChitCanonicalError('link must be a full URL, starting http:// or https://');
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new ChitCanonicalError(`link must be http or https, got ${url.protocol}`);
  }
  if (link !== link.trim() || /[\r\n]/.test(link)) {
    throw new ChitCanonicalError('link must not contain line breaks or surrounding space');
  }
}

/**
 * The exact bytes a worker signs.
 *
 * Line-per-field, same discipline as the chit's own canonical form: a newline is the
 * separator, so no field may contain one. The chit id cannot (it is base64url) and the link
 * is checked above; the note is the only free text, and it is escaped the same way.
 */
export function canonicaliseDelivery(delivery: Delivery): string {
  if (!/^chit1:[A-Za-z0-9_-]+$/.test(delivery.chitId)) {
    throw new ChitCanonicalError(`not a chit id: ${JSON.stringify(delivery.chitId)}`);
  }
  checkDeliveryLink(delivery.link);
  const note = delivery.note.normalize('NFC');
  if (/[\r\n]/.test(note)) throw new ChitCanonicalError('note must be a single line');
  if (encoder.encode(note).length > 280) throw new ChitCanonicalError('note is longer than 280 bytes');

  return [DELIVERY_CANONICAL_VERSION, delivery.chitId, delivery.link, note, ''].join('\n');
}

/** Read a canonical delivery back, refusing anything not exactly in that form. */
export function parseDelivery(serialised: string): Delivery {
  const lines = serialised.split('\n');
  if (lines.length !== 5 || lines[4] !== '') {
    throw new ChitCanonicalError('a delivery is four lines and a trailing newline');
  }
  if (lines[0] !== DELIVERY_CANONICAL_VERSION) {
    throw new ChitCanonicalError(`unknown delivery version: ${JSON.stringify(lines[0])}`);
  }
  const delivery: Delivery = { chitId: lines[1] ?? '', link: lines[2] ?? '', note: lines[3] ?? '' };
  // Re-serialise and compare, so a non-canonical input is refused rather than accepted with
  // a different digest than the signer saw.
  if (canonicaliseDelivery(delivery) !== serialised) {
    throw new ChitCanonicalError('input is not in canonical form');
  }
  return delivery;
}

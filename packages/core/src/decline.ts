/**
 * "No, thanks." — the third answer to an offer, alongside sign and counter.
 *
 * A decline used to need no signature at all: the route just marked the row and trusted
 * whoever called it. That was fine for a handshake answered only by the one wallet it was
 * ever sent to — until the same route was asked to also cover a chit with nobody named on it
 * yet. An open race chit sitting on the public board has no "them" to decline as, and the
 * chit id that identifies it is, by construction, the same id anyone browsing the board can
 * read — so an unsigned decline is not a worker answering an offer, it is any stranger able
 * to knock any open listing off the board for everyone else, permanently, for free.
 *
 * So decline gets the same treatment as delivery, review and showcase: a small canonical form
 * of its own, signed by the one wallet a decline can mean anything from — the chit's already
 * named payee. A chit with nobody named yet cannot be declined at all; there is no one to
 * decline as, and the payer's own way to withdraw an open listing is a different action.
 */

import { ChitCanonicalError } from './canonical.ts';

/** The version marker. Bumping it is a new format, never a silent change to this one. */
export const DECLINE_CANONICAL_VERSION = 'chit/1 decline';

export interface Decline {
  /** The chit this is about — its digest, exactly as the id is written. */
  chitId: string;
}

/** The exact bytes the named payee signs to decline. */
export function canonicaliseDecline(decline: Decline): string {
  if (!/^chit1:[A-Za-z0-9_-]+$/.test(decline.chitId)) {
    throw new ChitCanonicalError(`not a chit id: ${JSON.stringify(decline.chitId)}`);
  }
  return [DECLINE_CANONICAL_VERSION, decline.chitId, ''].join('\n');
}

/** Read a canonical decline back, refusing anything not exactly in that form. */
export function parseDecline(serialised: string): Decline {
  const lines = serialised.split('\n');
  if (lines.length !== 3 || lines[2] !== '') {
    throw new ChitCanonicalError('a decline is two lines and a trailing newline');
  }
  if (lines[0] !== DECLINE_CANONICAL_VERSION) {
    throw new ChitCanonicalError(`unknown decline version: ${JSON.stringify(lines[0])}`);
  }
  const decline: Decline = { chitId: lines[1] ?? '' };
  if (canonicaliseDecline(decline) !== serialised) {
    throw new ChitCanonicalError('input is not in canonical form');
  }
  return decline;
}

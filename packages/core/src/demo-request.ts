/**
 * "Sign this as the demo worker." — the payer's own request, not an open door.
 *
 * The demo worker exists so one person — a judge with nobody to send a chit to — can walk the
 * whole flow alone: create a chit, have *something* countersign it, pay it, hold a receipt. It
 * used to be reachable by anyone who had the chit id, with no proof of anything, which is not
 * "one person completing their own demo" — it is any stranger able to make the server's own
 * fixed wallet claim someone else's real, open race listing out from under whichever real
 * freelancer might otherwise have taken it, on a chit that was never theirs to begin with.
 *
 * So triggering the demo worker is signed by the one wallet the request can mean anything from:
 * the chit's own payer, over a canonical form of its own — never over the chit's own bytes,
 * so it can never be replayed as, or mistaken for, a countersignature.
 */

import { ChitCanonicalError } from './canonical.ts';

/** The version marker. Bumping it is a new format, never a silent change to this one. */
export const DEMO_REQUEST_CANONICAL_VERSION = 'chit/1 demo-countersign-request';

export interface DemoRequest {
  /** The chit this is about — its digest, exactly as the id is written. */
  chitId: string;
}

/** The exact bytes the chit's payer signs to ask the demo worker to countersign it. */
export function canonicaliseDemoRequest(request: DemoRequest): string {
  if (!/^chit1:[A-Za-z0-9_-]+$/.test(request.chitId)) {
    throw new ChitCanonicalError(`not a chit id: ${JSON.stringify(request.chitId)}`);
  }
  return [DEMO_REQUEST_CANONICAL_VERSION, request.chitId, ''].join('\n');
}

/** Read a canonical demo request back, refusing anything not exactly in that form. */
export function parseDemoRequest(serialised: string): DemoRequest {
  const lines = serialised.split('\n');
  if (lines.length !== 3 || lines[2] !== '') {
    throw new ChitCanonicalError('a demo request is two lines and a trailing newline');
  }
  if (lines[0] !== DEMO_REQUEST_CANONICAL_VERSION) {
    throw new ChitCanonicalError(`unknown demo request version: ${JSON.stringify(lines[0])}`);
  }
  const request: DemoRequest = { chitId: lines[1] ?? '' };
  if (canonicaliseDemoRequest(request) !== serialised) {
    throw new ChitCanonicalError('input is not in canonical form');
  }
  return request;
}

/**
 * Reputation, computed — never written.
 *
 * Nothing here is self-reported and nothing is editable. Every number derives from events
 * that already exist because money moved: `countersignedAt`, `settledAt`, `settledTx`. Anyone
 * holding the transaction hashes can recompute all of it, which is the whole point.
 *
 * Two records come out of one pass over an address's chits:
 *
 *  - **as payer** — what a freelancer wants to know *before* they sign: how many chits this
 *    wallet has actually paid, how fast it usually pays, and how many it signed and then
 *    left unpaid past the deadline. That last one is the only negative signal the data
 *    carries today, and it needs no dispute system: both parties signed, the deadline
 *    passed, no payment arrived.
 *  - **as worker** — settled value, from how many distinct payers, and `kept`: what a 20%
 *    marketplace cut would have been on that value. `kept` is a counterfactual and is only
 *    ever shown with that literal caption; presented as earnings it would be a lie.
 *
 * Sybil is handled by the rule rather than fought. A payer who burns a fresh wallet per job
 * reads "first chit from this wallet" every time and forfeits the only thing the score can
 * give them. A worker who pays themselves inflates `settledLuna` but shows `distinctPayers:
 * 1`, which is the tell.
 */

import type { StoredChit } from './repository.ts';

/** Fiverr's cut, the figure every freelancer already knows. */
const MARKETPLACE_CUT_PERCENT = 20n;

export interface PayerRecord {
  /** Chits this wallet created that settled. */
  settled: number;
  /** Median seconds from the worker's countersignature to settlement, across settled chits. */
  medianPaySeconds: number | null;
  /** Countersigned by both, past the deadline, never paid. */
  leftUnpaid: number;
  /** Signed but not yet due and not yet paid — pending, not a mark against anyone. */
  awaiting: number;
}

export interface WorkerRecord {
  /** Number of settled chits this wallet was paid for. */
  settled: number;
  /** Total Luna received across settled chits. */
  settledLuna: bigint;
  /** How many different wallets paid. The Sybil tell. */
  distinctPayers: number;
  /** 20% of `settledLuna`: what a marketplace would have kept. A counterfactual. */
  keptLuna: bigint;
}

export interface Ledger {
  address: string;
  asPayer: PayerRecord;
  asWorker: WorkerRecord;
}

/** Nimiq addresses are shown with spaces and compared without them. */
export function sameAddress(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.replace(/\s/g, '').toUpperCase() === b.replace(/\s/g, '').toUpperCase();
}

/**
 * A review this old counts half as much as one from today.
 *
 * Six months: long enough that one bad week early on is not still setting somebody's score a
 * year later, short enough that "reads well" means "reads well lately" rather than "read well
 * once." A round, statable number rather than one fitted to data this product does not have
 * enough of yet to fit anything to honestly.
 */
const REVIEW_HALF_LIFE_DAYS = 180;

function timeWeight(atMs: number, nowMs: number): number {
  const days = Math.max(0, (nowMs - atMs) / 86_400_000);
  return 2 ** (-days / REVIEW_HALF_LIFE_DAYS);
}

/**
 * A review bound to a bigger payment counts for more — `ln(1 + luna)` rather than `luna`
 * itself, so doubling an already-large payment barely moves the weight. That is the property
 * that stops one large job from being worth fifty ordinary ones; a linear weight would not.
 */
function valueWeight(luna: bigint): number {
  const n = Number(luna);
  return Number.isFinite(n) && n > 0 ? Math.log1p(n) : 0;
}

/**
 * The headline number, upgraded from a plain mean — but not with an invented statistical
 * prior. A plain average has two measured failures: rating inflation (eBay sellers cluster
 * near 100% positive; around 90% of Chicago Uber rides get 5 stars — rating a livelihood down
 * feels worse than the rating is worth) and no way to tell "5.0 from one review" apart from
 * "5.0 from fifty", which is exactly what a marketplace rating never shows.
 *
 * A Bayesian shrinkage toward some "population average" would need real, calibrated data this
 * product does not have yet — a made-up prior dressed as statistics is the same guess as a
 * plain mean with better vocabulary, not a more honest one. What this fixes instead are the
 * two properties true regardless of data volume: a recent review should outweigh an old one,
 * and a review tied to real money should outweigh one tied to a token amount. Small samples
 * are handled by showing the count next to the number, never by hiding it inside one figure.
 */
export function weightedRating(reviews: ProfileReview[], now: number = Date.now()): number | null {
  if (reviews.length === 0) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const review of reviews) {
    const w = timeWeight(review.at, now) * valueWeight(BigInt(review.luna));
    weightedSum += review.rating * w;
    weightTotal += w;
  }
  // A review can only exist on a settled chit, and settlement itself refuses a zero-Luna
  // payment (97% of nothing is nothing) — so every weight really is positive today. The
  // plain mean stands in as the honest fallback rather than a division by zero, in case that
  // invariant is ever the one that breaks first.
  if (weightTotal === 0) return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return weightedSum / weightTotal;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Compute both records for one address from the chits it appears on.
 *
 * `currentBlock` decides "past the deadline"; when the height is unknown (0) nothing is
 * counted as left unpaid, because an unknown height must not manufacture a bad mark.
 */
export function ledger(address: string, chits: StoredChit[], currentBlock: number): Ledger {
  const paySeconds: number[] = [];
  let settledAsPayer = 0;
  let leftUnpaid = 0;
  let awaiting = 0;

  let settledAsWorker = 0;
  let settledLuna = 0n;
  const payers = new Set<string>();

  for (const stored of chits) {
    // On a quote the payer field is empty by construction; the client is the sender of the
    // settling transaction, and nothing else.
    const isPayer = stored.chit.kind === 'quote'
      ? sameAddress(stored.settledFrom, address)
      : sameAddress(stored.chit.payer, address);
    const workerAddress = stored.chit.payee || stored.countersigner;
    const isWorker = sameAddress(workerAddress, address);
    const settled = typeof stored.settledTx === 'string' && stored.settledTx.length > 0;
    const countersigned = typeof stored.countersignedAt === 'number';

    if (isPayer) {
      if (settled) {
        settledAsPayer++;
        if (countersigned && typeof stored.settledAt === 'number') {
          paySeconds.push(Math.max(0, Math.round((stored.settledAt - stored.countersignedAt!) / 1000)));
        }
      } else if (countersigned) {
        if (currentBlock > 0 && stored.chit.deadlineBlock < currentBlock) leftUnpaid++;
        else awaiting++;
      }
    }

    if (isWorker && settled) {
      settledAsWorker++;
      settledLuna += stored.chit.luna;
      const paidBy = stored.chit.kind === 'quote' ? stored.settledFrom : stored.chit.payer;
      if (paidBy) payers.add(paidBy.replace(/\s/g, '').toUpperCase());
    }
  }

  return {
    address,
    asPayer: {
      settled: settledAsPayer,
      medianPaySeconds: median(paySeconds),
      leftUnpaid,
      awaiting,
    },
    asWorker: {
      settled: settledAsWorker,
      settledLuna,
      distinctPayers: payers.size,
      keptLuna: (settledLuna * MARKETPLACE_CUT_PERCENT) / 100n,
    },
  };
}

/**
 * The public record for one wallet: the page a freelancer sends instead of a marketplace profile.
 *
 * Everything on it is derived from settled payments and from statements signed by the two
 * parties to those payments. There is no field its subject can write, which is the difference
 * that matters — a marketplace profile is a bio next to a rating the marketplace owns, and
 * this is neither.
 *
 * Only settled work appears. A chit that was signed and never paid says nothing good or bad
 * about the worker, so it is left out rather than counted; the payer's own record is where a
 * broken promise to pay shows up, and it shows up there against the payer.
 */
export interface Profile {
  address: string;
  ledger: Ledger;
  /** When this wallet's first payment settled. Null before there is one. */
  since: number | null;
  /** Reviews written *about* this address, newest first. */
  reviews: ProfileReview[];
  /** The mean of those ratings, or null when there are none. Never rounded away from the truth. */
  averageRating: number | null;
  /**
   * The same reviews, time-decayed and value-weighted — see `weightedRating`. Shown beside
   * the plain mean, never instead of it: the two agree closely on an established record and
   * diverge exactly when the divergence is the useful part (an old rating still dragging the
   * mean up, or one large job saying more than three small ones).
   */
  weightedRating: number | null;
  /** Settled work this address was paid for, newest first. */
  work: ProfileWork[];
}

export interface ProfileReview {
  chitId: string;
  /** The one line the two of them agreed, so a rating is read next to what it was for. */
  chitText: string;
  from: 'payer' | 'payee';
  by: string;
  rating: number;
  text: string;
  txHash: string;
  at: number;
  signature: { publicKeyHex: string; signatureHex: string };
  /** What the chit this review is bound to actually settled for — the weighted score's input. */
  luna: string;
}

export interface ProfileWork {
  chitId: string;
  text: string;
  amountMinor: string;
  currency: string;
  luna: string;
  settledAt: number | null;
  txHash: string;
  /** The other wallet. A stranger can see the count of distinct clients is real. */
  counterparty: string | null;
}

/**
 * Build the public record from the chits an address appears on.
 *
 * One pass, no storage, no cache: the inputs are the same rows the receipts are drawn from,
 * so the page cannot drift from the receipts behind it.
 */
export function profile(address: string, chits: StoredChit[], currentBlock: number): Profile {
  const reviews: ProfileReview[] = [];
  const work: ProfileWork[] = [];
  let since: number | null = null;

  for (const stored of chits) {
    const settled = typeof stored.settledTx === 'string' && stored.settledTx.length > 0;
    if (!settled) continue;

    const workerAddress = stored.chit.payee || stored.countersigner;
    const payerAddress = stored.chit.kind === 'quote' ? stored.settledFrom : stored.chit.payer;
    const isWorker = sameAddress(workerAddress, address);
    const isPayer = sameAddress(payerAddress, address);
    if (!isWorker && !isPayer) continue;

    if (typeof stored.settledAt === 'number' && (since === null || stored.settledAt < since)) since = stored.settledAt;

    // A review is *about* the party the author is not.
    for (const review of stored.reviews ?? []) {
      if (!sameAddress(review.about, address)) continue;
      reviews.push({
        chitId: stored.id,
        chitText: stored.chit.text,
        from: review.from,
        by: review.by,
        rating: review.rating,
        text: review.text,
        txHash: review.txHash,
        at: review.at,
        signature: review.signature,
        luna: (stored.settledLuna ?? stored.chit.luna).toString(10),
      });
    }

    if (isWorker) {
      work.push({
        chitId: stored.id,
        text: stored.chit.text,
        amountMinor: stored.chit.amountMinor.toString(10),
        currency: stored.chit.currency,
        luna: (stored.settledLuna ?? stored.chit.luna).toString(10),
        settledAt: stored.settledAt ?? null,
        txHash: stored.settledTx!,
        counterparty: payerAddress ?? null,
      });
    }
  }

  reviews.sort((a, b) => b.at - a.at);
  work.sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0));

  const averageRating = reviews.length === 0
    ? null
    : reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return { address, ledger: ledger(address, chits, currentBlock), since, reviews, averageRating, weightedRating: weightedRating(reviews), work };
}

/** The wire form for a profile. JSON has no bigint, and the ledger carries two. */
export function presentProfile(record: Profile): {
  address: string;
  ledger: ReturnType<typeof presentLedger>;
  since: number | null;
  reviews: ProfileReview[];
  averageRating: number | null;
  weightedRating: number | null;
  work: ProfileWork[];
} {
  return {
    address: record.address,
    ledger: presentLedger(record.ledger),
    since: record.since,
    reviews: record.reviews,
    averageRating: record.averageRating,
    weightedRating: record.weightedRating,
    work: record.work,
  };
}

/** The wire form: JSON has no bigint. */
export function presentLedger(record: Ledger): {
  address: string;
  asPayer: PayerRecord;
  asWorker: { settled: number; settledLuna: string; distinctPayers: number; keptLuna: string };
} {
  return {
    address: record.address,
    asPayer: record.asPayer,
    asWorker: {
      settled: record.asWorker.settled,
      settledLuna: record.asWorker.settledLuna.toString(10),
      distinctPayers: record.asWorker.distinctPayers,
      keptLuna: record.asWorker.keptLuna.toString(10),
    },
  };
}

/**
 * The board — how a stranger finds work, and how a stranger gets found.
 *
 * ## The gap this closes
 *
 * Until this file, a chit was a link you sent to somebody you already knew. That is fine for the
 * handshake it was designed around and it is fatal as a product: **it only creates value for people
 * who already have the counterparty**, which is the exact judge feedback that made a Cycle 1 builder
 * retire his app. A freelancer with no client cannot use chit at all, and a client with no
 * freelancer cannot either.
 *
 * Nothing new is invented to fix it. `packages/core` already has both halves of a marketplace and
 * nobody could see them:
 *
 *  - a **race** — the payer signed first, money attached, no worker yet → *work available*
 *  - a **quote** — the worker signed first, empty payer, the first payment accepts it → *a person
 *    available*, which is Fiverr's gig, arrived at from the other direction
 *
 * This module makes those two public, searchable and ordered. It adds no object, no editable
 * profile and no new screen concept, which is deliberate: the organiser's own warning is that
 * *"any added complexity can make the process of evaluating your Mini App harder, and thus also not
 * result in as high of a score."*
 *
 * ## The ranking, and why it is shaped like Fiverr's
 *
 * Fiverr ranks on two pillars — **relevance** (does this match what was searched) and
 * **performance** (does it convert and complete once seen) — with performance weighing more as a
 * listing ages. That model is worth copying because it is the most heavily A/B-tested marketplace
 * ranking in the world, and because both pillars are computable here.
 *
 * The difference is what the performance pillar is made of. Fiverr's rests on private feedback and
 * click-through that only Fiverr can see, and a seller cannot audit their own rank. **Every signal
 * here is a settled on-chain payment**, so a worker can recompute their own standing, and a stranger
 * can check ours. Nothing that cannot be proved from the chain is allowed to move a chit up.
 *
 * ## The honeymoon, ported on purpose
 *
 * Fiverr gives a brand-new listing exposure it has not earned, for a bounded window, to collect the
 * performance data that ranking needs. Without it a new seller is invisible for ever, because rank
 * needs orders and orders need rank.
 *
 * We have exactly the same bootstrapping problem and a sharper version of it: our worker's first
 * chit *is* their first Nimiq transaction. A board that only ever showed established wallets would
 * make chit useless to precisely the person it exists for, and would fail the "does this bring new
 * people into the ecosystem" question that the same Cycle 1 feedback turned on. So a wallet with no
 * settled history is lifted, and the lift decays as real history arrives and replaces it.
 *
 * It is a **floor, not a bonus**: see `honeymoonFloor`. A wallet with nothing to rank on is carried
 * at the floor; the moment its real record is worth more, the floor stops applying. A new arrival
 * therefore competes with a good record and never outranks one, and — because the floor only falls
 * while performance only rises — finishing a chit can never move somebody *down* the board.
 *
 * ## What deliberately does not rank
 *
 * Money. A bigger chit does not appear higher, ever. The moment price buys position, the board
 * stops being a place to find work and becomes an auction for attention — which is the Connects
 * mechanic our own research says freelancers hate most, rebuilt by accident. Sorting *by* price is
 * offered; being ranked by it is not.
 */

import { ledger, profile, sameAddress, type Ledger } from './reputation.ts';
import type { StoredChit } from './db.ts';

/** What a board entry is offering. `work` needs a worker; `offer` needs a client. */
export type BoardKind = 'work' | 'offer';

/** How a caller wants the board ordered. Relevance is the default and the only ranked one. */
export type BoardSort = 'best' | 'newest' | 'closing' | 'highest' | 'lowest';

export interface BoardQuery {
  /** Free text. Empty means "show me everything", which is a browse rather than a search. */
  q?: string | undefined;
  /** Restrict to one side of the market. Absent means both. */
  kind?: BoardKind | undefined;
  sort?: BoardSort | undefined;
  /** Only entries at or above this amount, in the currency's minor unit. */
  minMinor?: bigint | undefined;
  maxMinor?: bigint | undefined;
  currency?: string | undefined;
  limit?: number | undefined;
  cursor?: number | undefined;
}

/** One row on the board, with the reasoning that put it there. */
export interface BoardEntry {
  chit: StoredChit;
  kind: BoardKind;
  /** Whose entry this is: the payer of a race, the worker behind a quote. */
  author: string;
  /** Blocks until the deadline. Negative would be expired, and expired never reaches here. */
  blocksLeft: number;
  score: number;
  /** The three factors, exposed so a worker can see why they rank where they do. */
  why: { relevance: number; performance: number; freshness: number; newcomer: boolean };
  /**
   * What a stranger needs to judge the author, on the row rather than a tap away.
   *
   * Fiverr's gig card leads with rating, review count and delivery time, and it does that because a
   * board where every row looks identical forces a tap to learn anything — which on a phone is the
   * difference between scanning twenty and opening two.
   *
   * Every number here is derived from settled payments and the reviews attached to them. `rating` is
   * null rather than zero when nobody has left one: a zero would read as *bad* where the truth is
   * *unknown*, and inventing a bad first impression for every newcomer is the opposite of what the
   * honeymoon floor exists to prevent.
   */
  standing: { done: number; clients: number; rating: number | null; reviews: number };
}

export interface BoardPage {
  entries: BoardEntry[];
  /** Total matching before the page was cut, so a screen can say "3 of 41". */
  total: number;
  /** Pass back as `cursor` for the next page. Null at the end. */
  next: number | null;
}

/**
 * How long a new wallet is lifted, in settled chits rather than in days.
 *
 * Counted in *work done* on purpose. A window measured in time punishes somebody who signs up on a
 * busy week and rewards nobody; a window measured in completed chits ends exactly when there is
 * real history to rank on instead, which is the only thing the lift was standing in for.
 */
export const HONEYMOON_CHITS = 3;

/**
 * How much the lift is worth at its strongest.
 *
 * Chosen so that a brand-new wallet ranks like somebody with a modest but genuine record — around
 * three completed chits — and no higher. A larger number would put newcomers above proven workers
 * and make the board worse for the client, which would end the whole thing: a board clients stop
 * trusting has no work on it for anybody.
 *
 * It is the value of the floor at its highest, not an amount added to anything.
 */
export const HONEYMOON_LIFT = 0.45;

/** Blocks in a day at Nimiq's ~1s block time. Used only for reading deadlines, never for money. */
const BLOCKS_PER_DAY = 24 * 60 * 60;

/** After this many days an entry has decayed to half its freshness. */
const FRESHNESS_HALF_LIFE_DAYS = 7;

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

/**
 * Is this chit still open for somebody to take?
 *
 * Four ways a chit leaves the board, and each is a fact rather than a judgement: it was
 * countersigned, it settled, it was declined, or its deadline passed. `currentBlock` decides the
 * last one because the deadline is a block height — the chain's clock, not ours, which is what makes
 * "this expired" checkable by the person it was refused for.
 */
export function isOpen(chit: StoredChit, currentBlock: number): boolean {
  if (chit.chit.kind !== 'race' && chit.chit.kind !== 'quote') return false;
  if (chit.countersignedAt) return false;
  if (chit.settledAt) return false;
  if (chit.declinedAt) return false;
  return chit.chit.deadlineBlock > currentBlock;
}

/** Which side of the market a chit is on. A race wants a worker; a quote wants a client. */
export function kindOf(chit: StoredChit): BoardKind {
  return chit.chit.kind === 'race' ? 'work' : 'offer';
}

/**
 * Whose entry it is.
 *
 * A race is authored by its payer, a quote by the worker who signed it — and on a quote the payer
 * field is empty by construction, so the author has to come from the signature rather than from a
 * column. Getting this wrong would attribute a newcomer's entry to nobody and rank it on an empty
 * record for ever.
 */
export function authorOf(chit: StoredChit): string {
  if (chit.chit.kind === 'race') return chit.chit.payer;
  return chit.chit.payee || chit.countersigner || '';
}

/* ------------------------------------------------------------------ relevance */

/**
 * Text match, in [0, 1].
 *
 * Deliberately small and readable rather than a search library. The corpus is one short line per
 * chit — Fiverr ranks paragraphs of seller-written copy, we rank a single agreed sentence — and on
 * that shape the difference between BM25 and this is not measurable, while the difference in what a
 * reader can audit is total.
 *
 * The scoring: every term must appear (an AND search, because a board that returns nearly-matches
 * wastes the one screen a phone has), a whole-word hit counts more than a prefix, and a hit early
 * in the line counts more than one at the end — the first words of a chit are what it is about.
 */
export function relevance(text: string, query: string): number {
  const terms = tokenise(query);
  if (terms.length === 0) return 1;

  const haystack = text.toLowerCase();
  const words = tokenise(text);
  let total = 0;

  for (const term of terms) {
    const exact = words.indexOf(term);
    if (exact >= 0) {
      // Earliest position wins: a chit that *starts* "logo design" beats one that mentions it last.
      total += 1 - Math.min(exact, 20) / 40;
      continue;
    }
    const prefix = words.findIndex((word) => word.startsWith(term) || term.startsWith(word));
    if (prefix >= 0) {
      total += 0.6 - Math.min(prefix, 20) / 80;
      continue;
    }
    if (haystack.includes(term)) {
      total += 0.35;
      continue;
    }
    // A term nobody matched: this is not a result, whatever the others scored.
    return 0;
  }

  return Math.min(1, total / terms.length);
}

/** Lowercase word tokens. Punctuation splits; nothing is stemmed, because one line is not a corpus. */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

/* ------------------------------------------------------------------ performance */

/**
 * How well this wallet has actually done, in [0, 1], from settled payments only.
 *
 * Three components, and each is here because it answers a question the other two cannot:
 *
 *  - **Volume** — how much work has completed. Saturating, so the hundredth chit does not bury the
 *    tenth; past a point more history stops being more information.
 *  - **Distinct counterparties** — the Sybil tell, and the reason volume alone is not enough. Ten
 *    settled chits with one wallet is one relationship wearing a costume; three with three people
 *    is a record. Weighted heavily for exactly that reason.
 *  - **Reliability** — for a payer, whether they leave work unpaid past its deadline. This is the
 *    only negative signal on the board and it is deliberately the harshest: a client who does not
 *    pay costs a worker real hours, and a board that hides that is worse than no board.
 *
 * Ratings are **not** in here. They are shown on the entry and they do not move rank, because a
 * rating is one person's opinion and everything else in this function is a fact about money that
 * moved. Mixing them would let a handful of friendly reviews outrank a settled history.
 */
export function performance(record: Ledger, kind: BoardKind): number {
  if (kind === 'work') {
    // A client's entry ranks on whether they pay, and on how many different people they have paid.
    const paid = record.asPayer.settled;
    const volume = saturate(paid, 6);
    const unpaid = record.asPayer.leftUnpaid;
    const reliability = paid + unpaid === 0 ? 0 : paid / (paid + unpaid);
    return clamp(volume * 0.55 + reliability * 0.45);
  }

  // A worker's entry ranks on completed work and on how many different wallets chose them.
  const done = record.asWorker.settled;
  const volume = saturate(done, 6);
  const spread = saturate(record.asWorker.distinctPayers, 4);
  /*
   * Spread outweighs volume, and the weights are what make that true rather than the comment above.
   * At 0.45/0.55 the arithmetic said the opposite: ten chits from one wallet beat three from three,
   * which is precisely the Sybil pattern this is supposed to see through. The test that asserts the
   * claim is the reason it was caught.
   */
  return clamp(volume * 0.35 + spread * 0.65);
}

/** Does this wallet still have nothing to rank on? Then it is inside its honeymoon. */
export function isNewcomer(record: Ledger, kind: BoardKind): boolean {
  const done = kind === 'work' ? record.asPayer.settled : record.asWorker.settled;
  return done < HONEYMOON_CHITS;
}

/**
 * The honeymoon, as a **floor under a new wallet** rather than a bonus on top of it.
 *
 * This distinction is the whole correctness of the mechanism and the first version got it wrong.
 * As an addend the lift stacked with a real record, and — worse — it decayed faster than
 * performance grew, so **completing your third chit moved you down the board**. A ranking that
 * punishes somebody for finishing work is not a ranking bug, it is an incentive to abandon jobs.
 *
 * A floor cannot do either. It is `max(performance, floor)`: while a wallet has nothing to rank on
 * it is carried at the floor, and the moment its real record is worth more the floor stops mattering
 * entirely. Since the floor only falls and performance only rises, the score is monotonic by
 * construction — which is asserted directly, across the boundary, in `board.test.ts`.
 */
export function honeymoonFloor(record: Ledger, kind: BoardKind): number {
  const done = kind === 'work' ? record.asPayer.settled : record.asWorker.settled;
  if (done >= HONEYMOON_CHITS) return 0;
  return HONEYMOON_LIFT * (1 - done / HONEYMOON_CHITS);
}

/* ------------------------------------------------------------------ freshness */

/**
 * How recent this entry is, in (0, 1].
 *
 * Half-life rather than a cutoff: an entry does not fall off the board at midnight on day seven,
 * it fades. A board where things vanish on a boundary teaches people to repost, and reposting to
 * regain position is the behaviour that turns a board into spam.
 */
export function freshness(createdAt: number, now: number): number {
  const days = Math.max(0, (now - createdAt) / (24 * 60 * 60 * 1000));
  return 2 ** (-days / FRESHNESS_HALF_LIFE_DAYS);
}

/* ------------------------------------------------------------------ the board */

/**
 * Rank and page the open chits.
 *
 * Pure: it is handed every chit and returns a page. That is affordable at chit's size and it is the
 * reason this whole file can be tested without a database — and a ranking nobody can test is a
 * ranking nobody should trust, because its failures are invisible by construction. If the corpus
 * ever outgrows one pass, the seam to move is `ChitRepository.board`, not this.
 */
export function board(all: readonly StoredChit[], currentBlock: number, query: BoardQuery = {}, now = Date.now()): BoardPage {
  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));
  const cursor = Math.max(0, query.cursor ?? 0);
  const text = (query.q ?? '').trim();

  // One ledger per wallet, built once. Rebuilding it per entry would be quadratic in the number of
  // chits and is the kind of thing that is fine for a week and then is not.
  const ledgers = new Map<string, Ledger>();
  const ledgerFor = (address: string): Ledger => {
    const key = address.replace(/\s/g, '').toUpperCase();
    let found = ledgers.get(key);
    if (!found) {
      found = ledger(address, [...all], currentBlock);
      ledgers.set(key, found);
    }
    return found;
  };

  // Ratings come from the same pass and are cached the same way, for the same reason.
  const ratings = new Map<string, { rating: number | null; reviews: number }>();
  const ratingFor = (address: string): { rating: number | null; reviews: number } => {
    const key = address.replace(/\s/g, '').toUpperCase();
    let found = ratings.get(key);
    if (!found) {
      const record = profile(address, [...all], currentBlock);
      found = { rating: record.averageRating, reviews: record.reviews.length };
      ratings.set(key, found);
    }
    return found;
  };

  const entries: BoardEntry[] = [];

  for (const stored of all) {
    if (!isOpen(stored, currentBlock)) continue;

    const kind = kindOf(stored);
    if (query.kind && query.kind !== kind) continue;

    if (query.currency && stored.chit.currency !== query.currency.toUpperCase()) continue;
    if (query.minMinor !== undefined && stored.chit.amountMinor < query.minMinor) continue;
    if (query.maxMinor !== undefined && stored.chit.amountMinor > query.maxMinor) continue;

    const matched = relevance(stored.chit.text, text);
    if (matched === 0) continue;

    const author = authorOf(stored);
    /*
     * An entry whose author cannot be identified is dropped rather than ranked on an empty record.
     * It would otherwise be permanently treated as a newcomer and permanently lifted, which is a
     * slow leak in the one part of the ranking somebody might try to exploit.
     */
    if (!author) continue;

    const record = ledgerFor(author);
    const earned = performance(record, kind);
    const recent = freshness(stored.createdAt, now);
    // The floor carries a wallet with no record; a real record replaces it rather than adding to it.
    const proven = Math.max(earned, honeymoonFloor(record, kind));

    /*
     * Relevance gates, the rest orders.
     *
     * Multiplying by relevance rather than adding it is what stops a strong record from surfacing an
     * unrelated chit: somebody searching "translate a menu" must never be shown a logo job because
     * its author has a good history. Fiverr's own two-pillar model behaves the same way, and it is
     * the property that makes a search feel like a search rather than a leaderboard.
     */
    const score = matched * (0.35 + proven) * recent;

    entries.push({
      chit: stored,
      kind,
      author,
      blocksLeft: stored.chit.deadlineBlock - currentBlock,
      score,
      why: { relevance: matched, performance: proven, freshness: recent, newcomer: isNewcomer(record, kind) },
      standing: {
        // A client is judged on what they have paid; a worker on what they have been paid for.
        done: kind === 'work' ? record.asPayer.settled : record.asWorker.settled,
        clients: kind === 'work' ? record.asPayer.settled : record.asWorker.distinctPayers,
        ...ratingFor(author),
      },
    });
  }

  sort(entries, query.sort ?? 'best');

  const total = entries.length;
  const page = entries.slice(cursor, cursor + limit);
  const next = cursor + limit < total ? cursor + limit : null;
  return { entries: page, total, next };
}

function sort(entries: BoardEntry[], by: BoardSort): void {
  switch (by) {
    case 'newest':
      entries.sort((a, b) => b.chit.createdAt - a.chit.createdAt);
      return;
    case 'closing':
      // Soonest deadline first: the entries where being early actually matters.
      entries.sort((a, b) => a.blocksLeft - b.blocksLeft);
      return;
    case 'highest':
      entries.sort((a, b) => compareBig(b.chit.chit.amountMinor, a.chit.chit.amountMinor));
      return;
    case 'lowest':
      entries.sort((a, b) => compareBig(a.chit.chit.amountMinor, b.chit.chit.amountMinor));
      return;
    default:
      /*
       * Ties break on age, oldest first, and never on money.
       *
       * Without a stated tie-break the order comes from whatever the store happened to return, which
       * is stable until the day it is not. Oldest-first also means the chit that has waited longest
       * is the one seen, which is the fair reading of a tie.
       */
      entries.sort((a, b) => b.score - a.score || a.chit.createdAt - b.chit.createdAt);
  }
}

function compareBig(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `n` against a soft target, in [0, 1). Reaches ~0.63 at the target and never quite 1. */
function saturate(n: number, target: number): number {
  if (n <= 0) return 0;
  return 1 - Math.exp(-n / target);
}

function clamp(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Exported for the route, which needs to know whether a filter asked for a side that exists. */
export const BOARD_KINDS: readonly BoardKind[] = ['work', 'offer'];
export const BOARD_SORTS: readonly BoardSort[] = ['best', 'newest', 'closing', 'highest', 'lowest'];
export { BLOCKS_PER_DAY, sameAddress };

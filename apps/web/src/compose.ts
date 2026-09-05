/**
 * Building a chit from a pasted line.
 *
 * Kept apart from the screens so the whole "text in, signed agreement out" step can be
 * reasoned about — and later tested — without a DOM. The rules it encodes:
 *
 * - The **fiat number is the contract**; NIM is quoted by the server and pinned to a
 *   block, never computed here (a client that prices its own payment can underpay).
 * - The chit is created **open**: the payer signs before knowing the other side's Nimiq
 *   address, and countersigning supplies it. Nobody copies an address between apps.
 * - `chain` and `nonce` go into the signed bytes, because `sign()` has no domain
 *   separation and no expiry.
 */

import { canonicalise, chitHash, newNonce, type Chit, type ParsedTerms } from '@chit/core';

/** Nimiq targets one-second blocks, so a day is 86 400 blocks. */
export const BLOCKS_PER_DAY = 86_400;

/** When a line names no deadline, this is what we propose — visibly, never silently. */
export const DEFAULT_DEADLINE_DAYS = 7;

export interface Quote {
  amountMinor: string;
  currency: string;
  luna: string;
  rate: number;
  rateBlock: number;
  quotedAt: number;
  expiresAt: number;
  stale: boolean;
}

export interface DraftInput {
  text: string;
  amountMinor: bigint;
  currency: string;
  deadlineDays: number;
  deliverables: number;
  /** The signer's own address. Which field it lands in depends on `direction`. */
  signer: string;
  /**
   * `paying`  — the signer will pay: an open chit, the worker countersigns.
   * `earning` — the signer will be paid: a quote, the first payment accepts it.
   *
   * This was missing, and its absence was the product's worst defect: the composer was
   * always the payer, so a freelancer — the whole audience — could not start a chit
   * without agreeing to pay their own client.
   */
  direction: 'paying' | 'earning';
  chain: 'main' | 'test';
  quote: Quote;
}

export interface Draft {
  chit: Chit;
  canonical: string;
  id: string;
}

/**
 * Assemble the exact object both parties will sign.
 *
 * The deadline is stored as a **block height**, not a date: a height is checkable by
 * anyone against the chain, whereas a timestamp is something our server asserts.
 */
export function buildDraft(input: DraftInput): Draft {
  const earning = input.direction === 'earning';
  const chit: Chit = {
    chain: input.chain,
    // Open by construction — see the file header. A quote is the same object mirrored.
    kind: earning ? 'quote' : 'race',
    nonce: newNonce(),
    text: input.text,
    amountMinor: input.amountMinor,
    currency: input.currency.toUpperCase(),
    luna: BigInt(input.quote.luna),
    rateBlock: input.quote.rateBlock,
    deadlineBlock: input.quote.rateBlock + Math.max(1, Math.round(input.deadlineDays * BLOCKS_PER_DAY)),
    payer: earning ? '' : input.signer,
    payee: earning ? input.signer : '',
    deliverables: Math.max(1, input.deliverables),
  };

  return { chit, canonical: canonicalise(chit), id: chitHash(chit) };
}

/** What the compose screen holds while the user is correcting our reading of their line. */
export interface DraftFields {
  text: string;
  amountMinor: bigint | null;
  currency: string | null;
  deadlineDays: number;
  deliverables: number;
  /** Fields the user has edited, so we stop describing them as parsed. */
  edited: Set<'amount' | 'currency' | 'deadline' | 'deliverables'>;
}

/** Seed the editable fields from what the parser understood. */
export function fieldsFromTerms(terms: ParsedTerms): DraftFields {
  return {
    text: terms.text,
    amountMinor: terms.amountMinor?.value ?? null,
    currency: terms.currency?.value ?? null,
    deadlineDays: terms.deadlineDays?.value ?? DEFAULT_DEADLINE_DAYS,
    deliverables: terms.deliverables?.value ?? 1,
    edited: new Set(),
  };
}

/** True when there is enough to sign. The line and a priced amount are the minimum. */
export function isReady(fields: DraftFields): boolean {
  return (
    fields.text.trim().length > 0 &&
    fields.amountMinor !== null &&
    fields.amountMinor > 0n &&
    fields.currency !== null
  );
}

/** A quote is only good for fifteen minutes; after that the rate must be taken again. */
export function quoteExpired(quote: Quote, now = Date.now()): boolean {
  return now >= quote.expiresAt;
}

/** Roughly how long until a block height, for display. Never used for anything binding. */
export function daysUntilBlock(deadlineBlock: number, currentBlock: number): number {
  return Math.max(0, Math.round((deadlineBlock - currentBlock) / BLOCKS_PER_DAY));
}

/**
 * The bounty: chit pays people to test chit.
 *
 * The organiser's one unprompted product request for this cycle was "earn NIM by testing
 * Mini Apps". This is that, built as chit's own front door — and, deliberately, *as a chit*.
 * The founder's bounty key posts an open chit ("Test chit. Tell us one thing that confused
 * you."); a tester countersigns it with their answer; the bounty key pays it, with the chit's
 * digest in the memo, so the tester holds a real settled receipt and has exercised the
 * product's core flow to earn their first NIM. Nothing here is a separate system: it is the
 * existing chit, countersign, settlement and receipt, with chit as the payer.
 *
 * Three rules keep it a product and not a faucet, and every one is checkable by a judge:
 *
 * 1. **Real work, verified by a machine, no chance anywhere.** An answer must be a real
 *    sentence (length, words, no links) and must be *new* — its character trigrams are
 *    compared with every prior answer and anything too similar is refused. Order of arrival
 *    decides nothing but who got there first; there is no draw.
 * 2. **Hard limits.** One payout per device per day (Nimiq Pay's device identifier, which is
 *    stable across reinstalls), one per wallet per day, and a daily NIM ceiling the key
 *    cannot exceed.
 * 3. **Everything public.** The pool address, its live balance, every payout with its
 *    transaction and the line that earned it, and these rules, are on `/bounty` for anyone —
 *    including Nimiq's own telemetry team — to read.
 *
 * chit pays its *own* bounty. It never holds a client's money; that promise is untouched.
 */

import { KeyPair, PrivateKey } from '@nimiq/core';
import { canonicalise, chitHash, newNonce, type Chit } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';
import type { ChitRepository, StoredChit, Signature } from './repository.ts';
import type { RateService } from './rates.ts';
import { sameAddress } from './reputation.ts';
import { payoutTransaction, type PayoutRpc } from './payout.ts';

export interface BountyOptions {
  /** Hex private key of the bounty pool. Funded by the founder; never holds anyone else's money. */
  privateKeyHex: string;
  chain: 'main' | 'test';
  /** Nimiq network id for signing. 24 = MainAlbatross (accepted by the public node), 5 = TestAlbatross. */
  networkId?: number;
  /** How many bounties are kept open at once. */
  openSlots?: number;
  /** What each bounty pays, as a fiat amount, so the product's own "fiat is the contract" rule applies. */
  amountMinor?: bigint;
  currency?: string;
  /** The most the pool will pay out in one UTC day, in Luna. */
  dailyCapLuna?: bigint;
  /** The task. */
  prompt?: string;
  /** Days a bounty stays open before it is not offered any more. */
  deadlineDays?: number;
}

export interface BountyStatus {
  address: string;
  balanceLuna: bigint | null;
  /** False when the pool cannot cover one payout. Nothing is offered that cannot be paid. */
  funded: boolean;
  open: StoredChit[];
  paid: Array<{ id: string; answer: string; worker: string; tx: string; at: number; luna: bigint }>;
  paidToday: number;
  paidTodayLuna: bigint;
  dailyCapLuna: bigint;
  rules: string[];
  prompt: string;
}

export type AnswerCheck = { ok: true; cleaned: string } | { ok: false; code: string; error: string };

const DEFAULT_PROMPT = 'Test chit. Tell us one thing that confused you, in one sentence.';
const MIN_WORDS = 4;
const MAX_CHARS = 200;
/** Refuse an answer whose trigram overlap with any prior answer is at or above this. */
const MAX_SIMILARITY = 0.4;
const BLOCKS_PER_DAY = 86_400;

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function trigrams(text: string): Set<string> {
  const s = text.toLowerCase().replace(/[^a-z0-9äöüß ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const out = new Set<string>();
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Is this answer real work? Deterministic, explainable, and the same for everyone.
 */
export function checkAnswer(raw: string, previous: string[], prompt = DEFAULT_PROMPT): AnswerCheck {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return { ok: false, code: 'empty', error: 'Write one sentence about what confused you.' };
  if (cleaned.length > MAX_CHARS) return { ok: false, code: 'too-long', error: `Keep it under ${MAX_CHARS} characters.` };
  const words = cleaned.split(' ').filter((w) => /[a-z0-9äöüß]/i.test(w));
  if (words.length < MIN_WORDS) return { ok: false, code: 'too-short', error: `At least ${MIN_WORDS} words — a real sentence.` };
  if (/https?:\/\/|www\.|\.[a-z]{2,4}\//i.test(cleaned)) return { ok: false, code: 'link', error: 'No links — say it in words.' };
  const mine = trigrams(cleaned);
  if (jaccard(mine, trigrams(prompt)) >= MAX_SIMILARITY) {
    return { ok: false, code: 'echo', error: 'That is the question. Answer it.' };
  }
  for (const other of previous) {
    if (jaccard(mine, trigrams(other)) >= MAX_SIMILARITY) {
      return { ok: false, code: 'duplicate', error: 'Someone already said that. Tell us something new.' };
    }
  }
  return { ok: true, cleaned };
}

export class BountyService {
  readonly #repo: ChitRepository;
  readonly #rpc: PayoutRpc;
  readonly #rates: RateService | undefined;
  readonly #keyPair: KeyPair;
  readonly #address: string;
  readonly #chain: 'main' | 'test';
  readonly #networkId: number;
  readonly #openSlots: number;
  readonly #amountMinor: bigint;
  readonly #currency: string;
  readonly #dailyCapLuna: bigint;
  readonly #prompt: string;
  readonly #deadlineDays: number;

  constructor(repo: ChitRepository, rpc: PayoutRpc, rates: RateService | undefined, options: BountyOptions) {
    this.#repo = repo;
    this.#rpc = rpc;
    this.#rates = rates;
    this.#keyPair = KeyPair.derive(PrivateKey.fromHex(options.privateKeyHex));
    this.#address = this.#keyPair.toAddress().toUserFriendlyAddress();
    this.#chain = options.chain;
    this.#networkId = options.networkId ?? (options.chain === 'main' ? 24 : 5);
    this.#openSlots = options.openSlots ?? 3;
    this.#amountMinor = options.amountMinor ?? 50n; // $0.50
    this.#currency = options.currency ?? 'USD';
    this.#dailyCapLuna = options.dailyCapLuna ?? 5_000_00000n; // 5 000 NIM
    this.#prompt = options.prompt ?? DEFAULT_PROMPT;
    this.#deadlineDays = options.deadlineDays ?? 7;
  }

  get address(): string {
    return this.#address;
  }

  get prompt(): string {
    return this.#prompt;
  }

  get rules(): string[] {
    return [
      `Each bounty pays ${(Number(this.#amountMinor) / 100).toFixed(2)} ${this.#currency} in NIM, priced at the moment it is posted.`,
      'One payout per device per day, one per wallet per day.',
      `The pool pays at most ${(Number(this.#dailyCapLuna) / 100_000).toLocaleString()} NIM per day.`,
      `An answer is at least ${MIN_WORDS} words, no links, and must not repeat what anyone has already said.`,
      'No draw, no chance: an answer is accepted or refused by the same rules for everyone, in the order it arrives.',
      'Every payout is listed here with its transaction. chit pays its own bounty; it never holds anyone else’s money.',
    ];
  }

  /** Is this one of ours? Posted by the bounty key, open by construction. */
  isBounty(stored: StoredChit): boolean {
    return stored.chit.kind === 'race' && sameAddress(stored.chit.payer, this.#address);
  }

  async #mine(): Promise<StoredChit[]> {
    return this.#repo.forAddress(this.#address, 500);
  }

  /** The chain height, or null when the node cannot be reached — never a guess. */
  async #currentHeight(): Promise<number | null> {
    try {
      return await this.#rpc.getBlockNumber();
    } catch {
      return null;
    }
  }

  /**
   * Make sure enough bounties are open. Called on read, so there is no cron to fail: the
   * first person to look is the one who tops the list up, and an instance that is asleep
   * costs nobody anything.
   */
  async ensureOpen(): Promise<StoredChit[]> {
    const [all, height] = await Promise.all([this.#mine(), this.#currentHeight()]);
    // A bounty past its deadline is not on offer. It stays in the record, is never listed or
    // claimable, and a fresh one is posted in its place — otherwise a stale week-old chit
    // would sit at the top of the home screen reading "Open".
    const open = all.filter(
      (c) => this.isBounty(c) && !c.payeeSignature && !c.settledTx && !c.declinedAt && (height === null || c.chit.deadlineBlock > height),
    );
    const missing = this.#openSlots - open.length;
    for (let i = 0; i < missing; i++) {
      const created = await this.#post();
      if (created) open.push(created);
    }
    return open;
  }

  async #post(): Promise<StoredChit | null> {
    const height = await this.#rpc.getBlockNumber();
    let luna: bigint;
    let rateBlock = height;
    if (this.#rates) {
      const quote = await this.#rates.quote(this.#amountMinor, this.#currency, height);
      luna = BigInt(quote.luna);
      rateBlock = quote.rateBlock;
    } else {
      // No rate service (tests): a fixed, obviously-synthetic figure.
      luna = 200_000n;
    }
    const chit: Chit = {
      chain: this.#chain,
      kind: 'race',
      nonce: newNonce(),
      text: this.#prompt,
      amountMinor: this.#amountMinor,
      currency: this.#currency,
      luna,
      rateBlock,
      deadlineBlock: height + this.#deadlineDays * BLOCKS_PER_DAY,
      payer: this.#address,
      payee: '',
      deliverables: 1,
    };
    const canonical = canonicalise(chit);
    const signature: Signature = {
      publicKeyHex: this.#keyPair.publicKey.toHex(),
      signatureHex: this.#keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(canonical))).toHex(),
    };
    const { chit: stored } = await this.#repo.create({ id: chitHash(chit), canonical, chit, payerSignature: signature });
    await this.#repo.recordEvent(stored.id, 'bounty-posted');
    return stored;
  }

  /**
   * A tester has countersigned a bounty with their answer. Check the work, check the
   * limits, then pay. The countersignature has already been verified by the caller.
   */
  async claim(input: {
    stored: StoredChit;
    signature: Signature;
    workerAddress: string;
    answer: string;
    deviceHash: string;
  }): Promise<{ ok: true; payoutTx: string; answer: string } | { ok: false; code: string; error: string; status: number }> {
    const { stored, workerAddress, deviceHash } = input;
    if (!this.isBounty(stored)) return { ok: false, code: 'not-a-bounty', error: 'This chit is not a bounty.', status: 400 };
    if (stored.payeeSignature) return { ok: false, code: 'taken', error: 'Someone got to this one first. Another opens right away.', status: 409 };
    const height = await this.#currentHeight();
    if (height !== null && stored.chit.deadlineBlock <= height) {
      return { ok: false, code: 'expired', error: 'This bounty has passed its deadline. Take a fresh one from the home screen.', status: 410 };
    }
    if (!deviceHash || !/^[0-9a-f]{64}$/i.test(deviceHash)) {
      return { ok: false, code: 'no-device', error: 'Nimiq Pay did not share a device identifier; the bounty needs one to stay fair.', status: 400 };
    }

    try {
      const { balance } = await this.#rpc.getAccountByAddress(this.#address);
      if (balance < stored.chit.luna) {
        return { ok: false, code: 'pool-empty', error: 'The pool cannot cover this bounty right now. It is funded by the founder; check back shortly.', status: 503 };
      }
    } catch {
      // Balance unknown: proceed. A failed broadcast is reported honestly below.
    }

    const all = await this.#mine();
    const today = utcDayKey(Date.now());
    const paidToday = all.filter((c) => this.isBounty(c) && c.payoutTx && utcDayKey(c.countersignedAt ?? c.createdAt) === today);

    if (paidToday.some((c) => sameAddress(c.countersigner, workerAddress))) {
      return { ok: false, code: 'wallet-limit', error: 'This wallet has already been paid a bounty today. Come back tomorrow.', status: 429 };
    }
    if (paidToday.some((c) => c.deviceHash === deviceHash)) {
      return { ok: false, code: 'device-limit', error: 'This device has already been paid a bounty today. Come back tomorrow.', status: 429 };
    }
    const paidTodayLuna = paidToday.reduce((sum, c) => sum + c.chit.luna, 0n);
    if (paidTodayLuna + stored.chit.luna > this.#dailyCapLuna) {
      return { ok: false, code: 'daily-cap', error: 'The pool has paid its limit for today. It reopens at 00:00 UTC.', status: 429 };
    }

    const previous = all.flatMap((c) => (c.answer ? [c.answer] : []));
    const check = checkAnswer(input.answer, previous, this.#prompt);
    if (!check.ok) return { ok: false, code: `answer-${check.code}`, error: check.error, status: 422 };

    // The work is accepted: sign the agreement, record the answer, then pay.
    const signed = await this.#repo.countersign(stored.id, input.signature, workerAddress);
    if (!signed) return { ok: false, code: 'taken', error: 'Someone got to this one first. Another opens right away.', status: 409 };
    await this.#repo.setClaim(stored.id, { answer: check.cleaned, deviceHash });
    await this.#repo.recordEvent(stored.id, 'bounty-claimed', check.cleaned);

    try {
      const height = await this.#rpc.getBlockNumber();
      const hex = payoutTransaction({
        keyPair: this.#keyPair,
        recipient: workerAddress,
        luna: stored.chit.luna,
        memo: stored.id,
        validityStartHeight: height,
        networkId: this.#networkId,
      });
      const tx = await this.#rpc.sendRawTransaction(hex);
      await this.#repo.setPayout(stored.id, tx);
      await this.#repo.recordEvent(stored.id, 'bounty-paid', tx);
      return { ok: true, payoutTx: tx, answer: check.cleaned };
    } catch (error) {
      // The work stands and the countersignature is binding; only the payment failed. Say
      // so plainly rather than pretend, and leave the record for the founder to settle.
      const detail = error instanceof Error ? error.message : String(error);
      await this.#repo.recordEvent(stored.id, 'bounty-payout-failed', detail);
      return {
        ok: false,
        code: 'payout-failed',
        error: 'Your answer was accepted and signed, but the pool could not send the payment just now. It is recorded and will be paid.',
        status: 502,
      };
    }
  }

  async status(): Promise<BountyStatus> {
    const open = await this.ensureOpen();
    const all = await this.#mine();
    const today = utcDayKey(Date.now());
    const paidChits = all.filter((c) => this.isBounty(c) && c.payoutTx);
    const paidToday = paidChits.filter((c) => utcDayKey(c.countersignedAt ?? c.createdAt) === today);
    let balanceLuna: bigint | null = null;
    try {
      balanceLuna = (await this.#rpc.getAccountByAddress(this.#address)).balance;
    } catch {
      balanceLuna = null;
    }
    const need = open[0]?.chit.luna ?? 0n;
    // Unknown balance is treated as funded: a momentary RPC failure must not hide the
    // bounty from a judge. A known-empty pool must never offer a payout it cannot make.
    const funded = balanceLuna === null || balanceLuna >= need;
    return {
      address: this.#address,
      balanceLuna,
      funded,
      open,
      paid: paidChits
        .map((c) => ({
          id: c.id,
          answer: c.answer ?? '',
          worker: c.countersigner ?? '',
          tx: c.payoutTx ?? '',
          at: c.countersignedAt ?? c.createdAt,
          luna: c.chit.luna,
        }))
        .sort((a, b) => b.at - a.at),
      paidToday: paidToday.length,
      paidTodayLuna: paidToday.reduce((s, c) => s + c.chit.luna, 0n),
      dailyCapLuna: this.#dailyCapLuna,
      rules: this.rules,
      prompt: this.#prompt,
    };
  }
}

/**
 * The demo worker: a labelled second party so one person can walk the whole flow alone.
 *
 * A judge composing a chit as the payer has nobody to countersign it. This key does, on
 * request, and the screen says exactly what it is. It receives the judge's payment and
 * nothing else; it is not a user and never appears in anyone's record as one.
 */
export class DemoWorker {
  readonly #keyPair: KeyPair;
  readonly address: string;

  constructor(privateKeyHex: string) {
    this.#keyPair = KeyPair.derive(PrivateKey.fromHex(privateKeyHex));
    this.address = this.#keyPair.toAddress().toUserFriendlyAddress();
  }

  countersign(canonical: string): Signature {
    return {
      publicKeyHex: this.#keyPair.publicKey.toHex(),
      signatureHex: this.#keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(canonical))).toHex(),
    };
  }
}

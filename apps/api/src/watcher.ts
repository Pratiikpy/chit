/**
 * The settlement watcher.
 *
 * It answers one question, repeatedly: has a payment carrying this chit's digest landed
 * on chain? Everything downstream — the receipt, the "paid" screen, and later the key
 * release for a sealed file — is triggered from here rather than from the client, because
 * the client is the party with an interest in claiming a payment happened.
 *
 * Failure policy: a poll that throws is logged and the loop continues. A watcher that
 * dies on one bad RPC response is worse than one that misses a cycle, since nobody is
 * watching the watcher at 3am (research/verification/05b §6).
 */

import { matchSettlements, type ChainClient } from './chain.ts';
import type { ChitRepository } from './repository.ts';

export interface WatcherOptions {
  store: ChitRepository;
  chain: ChainClient;
  /** How often to poll. Sockets are unavailable on the public RPC, so this is the knob. */
  intervalMs?: number;
  /** Called on every settlement, for logging and later key release. */
  onSettled?: (chitId: string, txHash: string) => void;
  onError?: (error: unknown) => void;
}

export class SettlementWatcher {
  readonly #store: ChitRepository;
  readonly #chain: ChainClient;
  readonly #intervalMs: number;
  readonly #onSettled: ((chitId: string, txHash: string) => void) | undefined;
  readonly #onError: ((error: unknown) => void) | undefined;

  #timer: ReturnType<typeof setInterval> | undefined;
  #running = false;

  /** Counters, exposed on /health so a silent stall is visible rather than invisible. */
  readonly stats = { polls: 0, errors: 0, settled: 0, lastPollAt: 0, lastErrorAt: 0, lastHeight: 0 };

  constructor(options: WatcherOptions) {
    this.#store = options.store;
    this.#chain = options.chain;
    this.#intervalMs = options.intervalMs ?? 15_000;
    this.#onSettled = options.onSettled;
    this.#onError = options.onError;
  }

  start(): void {
    if (this.#timer) return;
    void this.poll();
    this.#timer = setInterval(() => void this.poll(), this.#intervalMs);
    // Never hold the process open on the watcher alone.
    this.#timer.unref?.();
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  /**
   * One poll cycle. Safe to call directly, which is what the tests do — a watcher whose
   * only trigger is a timer cannot be tested deterministically.
   */
  async poll(): Promise<number> {
    // Overlapping polls would double-process a settlement on a slow RPC.
    if (this.#running) return 0;
    this.#running = true;

    try {
      // The height is read on *every* poll, including one with nothing to settle.
      // Reading it only when open chits exist meant a freshly started service reported a
      // height of zero, and the first chit anyone created showed "Deadline: block
      // 60935479" with no human-readable due date — the exact thing this value exists for.
      const height = await this.#chain.getBlockNumber();
      this.stats.lastHeight = height;

      const open = await this.#store.awaitingSettlement();
      if (open.length === 0) {
        this.stats.polls++;
        this.stats.lastPollAt = Date.now();
        return 0;
      }

      // Poll each distinct payee address once, not each chit — several chits often share
      // a recipient, and the RPC call is the expensive part.
      // The address to watch is whoever will actually be paid: the payee the chit names
      // if it names one, otherwise the address derived from the countersignature. An
      // open chit nobody has countersigned yet has no destination and nothing to watch.
      const effective = open
        .map((stored) => ({
          id: stored.id,
          payee: stored.chit.payee || stored.countersigner || '',
          luna: stored.chit.luna,
        }))
        .filter((candidate) => candidate.payee !== '');

      const addresses = [...new Set(effective.map((candidate) => candidate.payee))];
      const candidates = effective;

      let settled = 0;
      for (const address of addresses) {
        const transactions = await this.#chain.getTransactionsByAddress(address, 100);
        const mismatches: Array<{ chitId: string; hash: string; to: string }> = [];
        const matches = matchSettlements(transactions, candidates, (chitId, tx) =>
          mismatches.push({ chitId, hash: tx.hash, to: tx.to }),
        );
        for (const bad of mismatches) {
          await this.#store.recordEvent(bad.chitId, 'settlement-mismatch', `${bad.hash} paid ${bad.to}`);
        }
        for (const match of matches) {
          if (await this.#store.markSettled(match.chitId, match.transaction)) {
            settled++;
            this.stats.settled++;
            this.#onSettled?.(match.chitId, match.transaction.hash);
          }
        }
        await this.#store.noteWatchProgress(address, height);
      }

      this.stats.polls++;
      this.stats.lastPollAt = Date.now();
      return settled;
    } catch (error) {
      this.stats.errors++;
      this.stats.lastErrorAt = Date.now();
      this.#onError?.(error);
      return 0;
    } finally {
      this.#running = false;
    }
  }
}

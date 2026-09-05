/**
 * Reading the chain, and noticing when a chit settles.
 *
 * Two decisions, both from research/verification/01 §6 and 05b §3:
 *
 * - **Polling, not sockets.** `rpc.nimiqwatch.com` is the only documented public mainnet
 *   endpoint and it is history-indexed, but a WebSocket connection failed on all three of
 *   its URLs. So the watcher polls, and the interval is a config value rather than a
 *   constant, because that is the knob we will actually want to turn under load.
 * - **The memo is the identifier, not the transaction hash.** What
 *   `sendBasicTransactionWithData` returns is undocumented, so the client is never trusted
 *   to tell us what settled. A payment counts when a transaction to the expected address
 *   carries the chit's own digest in its data field — which the payer cannot forge,
 *   because the digest commits to the amount, both parties and the chain.
 */

import { isChitMemo, readMemo } from '@chit/core';

export interface ChainTransaction {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  /** Value in Luna. */
  value: bigint;
  /** The chit memo, already normalised out of whichever field carried it. */
  memo: string | null;
}

export interface ChainClient {
  getBlockNumber(): Promise<number>;
  getTransactionsByAddress(address: string, max?: number): Promise<ChainTransaction[]>;
}

/** The RPC returned something we cannot use. Always carries the method that failed. */
export class ChainError extends Error {
  override readonly name = 'ChainError';
  readonly method: string;
  constructor(method: string, message: string) {
    super(`${method}: ${message}`);
    this.method = method;
  }
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return 0;
}

/** Normalise one RPC transaction, tolerating the field-name variation between sources. */
export function normaliseTransaction(raw: unknown): ChainTransaction | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const hash = record['hash'] ?? record['transactionHash'];
  if (typeof hash !== 'string' || hash.length === 0) return null;

  return {
    hash,
    blockNumber: toNumber(record['blockNumber'] ?? record['blockHeight']),
    timestamp: toNumber(record['timestamp']),
    from: String(record['from'] ?? record['fromAddress'] ?? ''),
    to: String(record['to'] ?? record['toAddress'] ?? ''),
    value: toBigInt(record['value']),
    memo: readMemo(record),
  };
}

/**
 * A Nimiq JSON-RPC client.
 *
 * Deliberately tiny: two methods, no dependency, an explicit timeout on every call. A
 * chain client that can hang is a watcher that stops watching, and nobody would notice
 * until a worker asked why they had not been paid.
 */
export class NimiqRpcClient implements ChainClient {
  readonly #url: string;
  readonly #timeoutMs: number;
  #nextId = 1;

  constructor(url: string, timeoutMs = 10_000) {
    this.#url = url;
    this.#timeoutMs = timeoutMs;
  }

  async #call<T>(method: string, params: unknown[]): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await fetch(this.#url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: this.#nextId++, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new ChainError(method, `HTTP ${response.status}`);

      const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
      if (body.error) throw new ChainError(method, body.error.message ?? 'rpc error');

      // Nimiq's RPC wraps results as `{ data, metadata }` on some endpoints and returns
      // the value directly on others. Unwrap once, here.
      const result = body.result;
      if (typeof result === 'object' && result !== null && 'data' in result) {
        return (result as { data: T }).data;
      }
      return result as T;
    } catch (error) {
      if (error instanceof ChainError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ChainError(method, `timed out after ${this.#timeoutMs}ms`);
      }
      throw new ChainError(method, error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  }

  async getBlockNumber(): Promise<number> {
    const height = await this.#call<number>('getBlockNumber', []);
    if (typeof height !== 'number' || !Number.isFinite(height)) {
      throw new ChainError('getBlockNumber', `expected a number, got ${typeof height}`);
    }
    return height;
  }

  /** Broadcast a signed transaction. Resolves with the hash the node reports. */
  async sendRawTransaction(hex: string): Promise<string> {
    const hash = await this.#call<unknown>('sendRawTransaction', [hex]);
    if (typeof hash !== 'string' || hash.length === 0) {
      throw new ChainError('sendRawTransaction', `expected a hash, got ${typeof hash}`);
    }
    return hash;
  }

  /** Balance in Luna. `getAccountByAddress` returns `{ address, balance, type }` on this node. */
  async getAccountByAddress(address: string): Promise<{ balance: bigint }> {
    const account = await this.#call<{ balance?: unknown }>('getAccountByAddress', [address]);
    return { balance: toBigInt(account?.balance) };
  }

  async getTransactionsByAddress(address: string, max = 100): Promise<ChainTransaction[]> {
    const raw = await this.#call<unknown[]>('getTransactionsByAddress', [address, max]);
    if (!Array.isArray(raw)) return [];
    return raw.map(normaliseTransaction).filter((tx): tx is ChainTransaction => tx !== null);
  }
}

export interface SettlementMatch {
  chitId: string;
  transaction: ChainTransaction;
}

/**
 * Find which of the open chits a batch of transactions settles.
 *
 * A transaction settles a chit when it carries that chit's digest **and** pays the
 * address the chit names. The memo alone is not enough: anyone can copy a public digest
 * into their own payment, and without the recipient check a stranger's 1-Luna transaction
 * would mark someone else's chit paid.
 *
 * The amount must reach a floor. An overpayment settles the agreement — refusing it would
 * strand real money over rounding — but until this floor existed the amount was not checked
 * at all, so a 1-Luna transaction carrying the digest would have marked a $60 chit paid.
 * Ninety-seven percent of the signed Luna leaves room for a wallet's own rounding and for
 * the fiat drift a payer re-quotes against, and nothing more.
 */
export const SETTLEMENT_FLOOR_PERCENT = 97n;

export function matchSettlements(
  transactions: ChainTransaction[],
  open: Array<{ id: string; payee: string; luna: bigint }>,
  /**
   * Called when a transaction carries a chit's digest but pays the wrong address.
   *
   * This is the one on-chain event that means either a bug or an attempted redirect, and
   * until it was recorded it left no trace at all — the watcher simply skipped it. It is
   * reported, never acted on: the chit stays open and the real payee is still owed.
   */
  onMismatch?: (chitId: string, transaction: ChainTransaction) => void,
): SettlementMatch[] {
  const byMemo = new Map(open.map((chit) => [chit.id, chit]));
  const matches: SettlementMatch[] = [];

  for (const transaction of transactions) {
    if (!transaction.memo || !isChitMemo(transaction.memo)) continue;

    const chit = byMemo.get(transaction.memo);
    if (!chit) continue;
    if (chit.payee && transaction.to.replace(/\s/g, '').toUpperCase() !== chit.payee.replace(/\s/g, '').toUpperCase()) {
      onMismatch?.(chit.id, transaction);
      continue;
    }
    if (chit.luna > 0n && transaction.value < (chit.luna * SETTLEMENT_FLOOR_PERCENT) / 100n) {
      onMismatch?.(chit.id, transaction);
      continue;
    }
    matches.push({ chitId: chit.id, transaction });
  }

  return matches;
}

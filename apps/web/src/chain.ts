/**
 * Reading the chain from the browser.
 *
 * The public Nimiq RPC answers browsers (`Access-Control-Allow-Origin: *`, checked with a
 * preflight), so a receipt can be verified against the chain without asking chit's server
 * for anything. This is the one call the verify page makes on its own: fetch a transaction
 * by hash and normalise the two names the memo travels under, exactly as the server does.
 */

import { readMemo } from '@chit/core';

const RPC_URL = 'https://rpc.nimiqwatch.com';

export interface BrowserTransaction {
  hash: string;
  blockNumber: number;
  from: string;
  to: string;
  /** Luna. */
  value: bigint;
  memo: string | null;
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}

export async function readChainTransaction(hash: string, rpcUrl = RPC_URL): Promise<BrowserTransaction | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransactionByHash', params: [hash] }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const body = (await response.json()) as { result?: { data?: Record<string, unknown> } | Record<string, unknown>; error?: unknown };
    if (body.error || !body.result) return null;
    const raw = ((body.result as { data?: Record<string, unknown> }).data ?? body.result) as Record<string, unknown>;
    if (typeof raw['hash'] !== 'string') return null;
    return {
      hash: raw['hash'],
      blockNumber: Number(raw['blockNumber'] ?? 0),
      from: String(raw['from'] ?? ''),
      to: String(raw['to'] ?? ''),
      value: toBigInt(raw['value']),
      memo: readMemo(raw),
    };
  } catch {
    return null;
  }
}

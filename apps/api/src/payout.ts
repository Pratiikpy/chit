/**
 * Sending NIM from a key the server holds.
 *
 * Proven before it was built (`scripts/payout-probe.mjs`): a basic transaction with a
 * 49-byte memo, built and signed in Node with `@nimiq/core` and no consensus, was accepted
 * by the public RPC's `sendRawTransaction`. That is the whole path; this file is that probe
 * as a function, with the two RPC methods it needs named in one interface so a test can
 * stand in for the chain.
 *
 * Network id 24 is MainAlbatross and was accepted by the node. 5 for TestAlbatross is from
 * the same enum and is NOT VERIFIED against a public testnet node.
 */

import { Address, TransactionBuilder, type KeyPair } from '@nimiq/core';
import { NIMIQ_MAX_DATA_BYTES } from '@chit/core';

export interface PayoutRpc {
  getBlockNumber(): Promise<number>;
  /** Broadcast a signed transaction; resolves with its hash. */
  sendRawTransaction(hex: string): Promise<string>;
  getAccountByAddress(address: string): Promise<{ balance: bigint }>;
}

export interface PayoutInput {
  keyPair: KeyPair;
  recipient: string;
  luna: bigint;
  /** The chit id. Fits the 64-byte memo by construction (49 bytes). */
  memo: string;
  validityStartHeight: number;
  networkId: number;
}

/** Build and sign; returns the serialised transaction as hex, ready to broadcast. */
export function payoutTransaction(input: PayoutInput): string {
  const data = new TextEncoder().encode(input.memo);
  if (data.byteLength > NIMIQ_MAX_DATA_BYTES) {
    throw new Error(`memo is ${data.byteLength} bytes; the chain allows ${NIMIQ_MAX_DATA_BYTES}`);
  }
  if (input.luna <= 0n) throw new Error('a payout must be a positive amount');

  const tx = TransactionBuilder.newBasicWithData(
    input.keyPair.toAddress(),
    Address.fromUserFriendlyAddress(input.recipient),
    data,
    input.luna,
    0n,
    input.validityStartHeight,
    input.networkId,
  );
  tx.sign(input.keyPair, undefined);
  return tx.toHex();
}

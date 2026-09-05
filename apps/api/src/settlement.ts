/**
 * Confirming a single chit's payment, on demand.
 *
 * The self-hosted deployment runs `SettlementWatcher`, a loop that sweeps every open chit.
 * A serverless one cannot: there is no process between requests to run the loop in, and a
 * once-a-day cron is useless for telling someone their money arrived.
 *
 * So the check moves to where the interest is. Whenever anybody loads a chit that is
 * countersigned but unpaid, the server asks the chain about *that one chit* before
 * answering. During the moment that actually matters — the payer has just paid and both
 * screens are polling — this runs every couple of seconds, which is far tighter than any
 * sweep. When nobody is looking, nothing needs to be known.
 *
 * The rule that makes it trustworthy is unchanged from the watcher's: a payment settles a
 * chit only when it carries that chit's digest **and** reaches the address the chit names.
 * The client is never asked whether it paid.
 */

import { matchSettlements, type ChainClient } from './chain.ts';
import type { ChitRepository, StoredChit } from './repository.ts';

/** How many recent transactions to inspect for the payee. */
const LOOKBACK = 100;

/**
 * Ask the chain whether this chit has been paid, and record it if so.
 *
 * Returns true when this call is what marked it settled, so the caller knows to re-read.
 * Never throws: a chain that is briefly unreachable must degrade to "not settled yet", not
 * to an error page over an agreement that is perfectly fine.
 */
export async function confirmSettlement(
  repository: ChitRepository,
  chain: ChainClient,
  stored: StoredChit,
  onError?: (error: unknown) => void,
): Promise<boolean> {
  if (stored.settledTx) return false;

  // Whoever countersigned is who the money must reach. On an open chit the payer signed
  // before knowing that address, so it exists only on the countersignature.
  const payee = stored.chit.payee || stored.countersigner;
  if (!payee) return false;

  try {
    const transactions = await chain.getTransactionsByAddress(payee, LOOKBACK);
    const mismatches: Array<{ hash: string; to: string }> = [];
    const matches = matchSettlements(
      transactions,
      [{ id: stored.id, payee, luna: stored.chit.luna }],
      (_chitId, tx) => mismatches.push({ hash: tx.hash, to: tx.to }),
    );
    for (const bad of mismatches) {
      await repository.recordEvent(stored.id, 'settlement-mismatch', `${bad.hash} paid ${bad.to}`);
    }
    const match = matches[0];
    if (!match) return false;
    return await repository.markSettled(match.chitId, match.transaction);
  } catch (error) {
    onError?.(error);
    return false;
  }
}

/**
 * A year of settled work, as a file an accountant can open.
 *
 * Every freelancer meets this once a year and every platform makes it worse than it needs to
 * be: the numbers live in a dashboard, the export is behind a plan, or it arrives as a PDF
 * that has to be retyped. The whole of chit's data is already public and already derived, so
 * there is nothing to gate — this is the same rows the receipts are drawn from, in the
 * format a spreadsheet reads.
 *
 * Only settled chits appear. An agreement that was never paid is not income, and putting it
 * in a tax export would be worse than leaving it out.
 *
 * The CSV is written by hand rather than by a library for one reason: the escaping rules are
 * four lines and the failure mode of getting them wrong is somebody's tax return. RFC 4180 —
 * a field containing a comma, a quote or a newline is wrapped in quotes, and a quote inside
 * it is doubled.
 */

import { formatMinor } from '@chit/core';
import type { StoredChit } from './repository.ts';
import { sameAddress } from './reputation.ts';

/** One field, escaped so a spreadsheet reads back exactly what was written. */
function field(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const COLUMNS = [
  'date',
  'chit_id',
  'description',
  'role',
  'amount',
  'currency',
  'nim_received',
  'counterparty',
  'transaction',
  'receipt_url',
] as const;

/**
 * Turn an address's chits into CSV.
 *
 * `role` is the column that makes the file usable without a second thought: a freelancer's
 * export contains both money earned and money paid out to collaborators, and a total that
 * mixes them is worse than no total. Amounts are written as plain decimals with a separate
 * currency column, never as "$40", so nothing has to be un-formatted before it can be summed.
 */
export function toCsv(address: string, chits: StoredChit[], baseUrl: string): string {
  const rows: string[] = [COLUMNS.join(',')];

  const settled = chits
    .filter((c) => typeof c.settledTx === 'string' && c.settledTx.length > 0)
    .sort((a, b) => (a.settledAt ?? 0) - (b.settledAt ?? 0));

  for (const stored of settled) {
    const workerAddress = stored.chit.payee || stored.countersigner || '';
    const payerAddress = (stored.chit.kind === 'quote' ? stored.settledFrom : stored.chit.payer) ?? '';
    const isWorker = sameAddress(workerAddress, address);
    const isPayer = sameAddress(payerAddress, address);
    if (!isWorker && !isPayer) continue;

    // The Luna that actually landed where it differs from the Luna agreed — settlement
    // accepts anything from 97% upwards, and the received figure is the one that is income.
    const luna = stored.settledLuna ?? stored.chit.luna;
    const nim = nimFromLuna(luna);
    // `formatMinor` is the same function the receipt uses, so the export and the receipt
    // can never disagree about what a number means — including for the zero-decimal
    // currencies where dividing by a hundred would be a hundredfold error.
    const amount = formatMinor(stored.chit.amountMinor, stored.chit.currency);

    rows.push(
      [
        field(stored.settledAt ? new Date(stored.settledAt).toISOString() : ''),
        field(stored.id),
        field(stored.chit.text),
        field(isWorker ? 'earned' : 'paid'),
        field(amount),
        field(stored.chit.currency),
        field(isWorker ? nim : `-${nim}`),
        field(isWorker ? payerAddress : workerAddress),
        field(stored.settledTx ?? ''),
        field(`${baseUrl}/c/${encodeURIComponent(stored.id)}`),
      ].join(','),
    );
  }

  // A trailing newline, so appending the file to another one does not join two rows.
  return `${rows.join('\r\n')}\r\n`;
}

/**
 * Luna as NIM, to five places, without ever touching a float.
 *
 * A double can hold every realistic Luna figure, which is exactly why converting through one
 * here would look correct for years and then not. Money never goes through a float in this
 * codebase, and an export somebody files a tax return from is the last place to start.
 */
function nimFromLuna(luna: bigint): string {
  const negative = luna < 0n;
  const absolute = negative ? -luna : luna;
  const whole = absolute / 100_000n;
  const fraction = (absolute % 100_000n).toString(10).padStart(5, '0');
  return `${negative ? '-' : ''}${whole.toString(10)}.${fraction}`;
}

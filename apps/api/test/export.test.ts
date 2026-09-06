/**
 * The tax export.
 *
 * Somebody files a return from this file, so the things that matter are unglamorous: the
 * escaping cannot break a row, the money cannot go through a float, "earned" and "paid" have
 * to be distinguishable or a total is meaningless, and an agreement that was never paid must
 * not appear as income.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/export.ts';
import type { StoredChit } from '../src/repository.ts';

const WORKER = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const CLIENT = 'NQ11 1111 1111 1111 1111 1111 1111 1111 1111';

function chit(overrides: Partial<StoredChit> & { chit?: Partial<StoredChit['chit']> } = {}): StoredChit {
  const { chit: chitOverrides, ...rest } = overrides;
  return {
    id: 'chit1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    canonical: 'ignored',
    chit: {
      chain: 'test',
      kind: 'handshake',
      nonce: 'n',
      text: '$40 for 3 thumbnails by Friday',
      amountMinor: 4000n,
      currency: 'USD',
      luna: 120_400_000n,
      rateBlock: 4_100_000,
      deadlineBlock: 4_110_000,
      payer: CLIENT,
      payee: WORKER,
      deliverables: 3,
      ...chitOverrides,
    },
    payerSignature: { publicKeyHex: 'a', signatureHex: 'b' },
    settledTx: 'f'.repeat(64),
    settledAt: Date.UTC(2026, 8, 6, 12, 0, 0),
    createdAt: Date.UTC(2026, 8, 6, 11, 0, 0),
    ...rest,
  } as StoredChit;
}

test('the header names every column, so nobody has to guess what a number is', () => {
  const csv = toCsv(WORKER, [], 'https://chit.test');
  const header = csv.split('\r\n')[0]!;
  assert.equal(header, 'date,chit_id,description,role,amount,currency,nim_received,counterparty,transaction,receipt_url');
});

test('an unpaid chit is not income, so it is not in the file', () => {
  const unpaid = chit();
  delete (unpaid as { settledTx?: string }).settledTx;
  const csv = toCsv(WORKER, [unpaid], 'https://chit.test');
  assert.equal(csv.trimEnd().split('\r\n').length, 1, 'header only');
});

test('money earned and money paid out are told apart, and signed accordingly', () => {
  const earned = toCsv(WORKER, [chit()], 'https://chit.test').split('\r\n')[1]!;
  assert.match(earned, /,earned,/);
  assert.match(earned, /,1204\.00000,/, 'NIM received, to five places');

  const paid = toCsv(CLIENT, [chit()], 'https://chit.test').split('\r\n')[1]!;
  assert.match(paid, /,paid,/);
  assert.match(paid, /,-1204\.00000,/, 'money out is negative, so a column can simply be summed');
});

test('the amount is a plain decimal a spreadsheet can add up, with the currency beside it', () => {
  const line = toCsv(WORKER, [chit()], 'https://chit.test').split('\r\n')[1]!;
  assert.match(line, /,40\.00,USD,/, 'never "$40" — a formatted amount cannot be summed');
});

test('a zero-decimal currency is not divided by a hundred', () => {
  // ¥4000 is four thousand yen, not forty. Getting this wrong is a hundredfold error in
  // somebody's accounts, in the direction that gets noticed by a tax office.
  const line = toCsv(WORKER, [chit({ chit: { amountMinor: 4000n, currency: 'JPY' } })], 'https://chit.test').split('\r\n')[1]!;
  assert.match(line, /,4000,JPY,/);
});

test('⭐ a comma, a quote or a newline in the description cannot break a row', () => {
  const nasty = 'Logo, "final", v2\nplus a newline';
  const csv = toCsv(WORKER, [chit({ chit: { text: nasty } })], 'https://chit.test');
  // The embedded newline lives inside quotes, so the file is still two records.
  const line = csv.split('\r\n').slice(1).join('\r\n');
  assert.ok(line.includes('"Logo, ""final"", v2\nplus a newline"'), line);
  // And the row still has its ten fields when a parser splits on unquoted commas.
  const unquoted = line.replace(/"([^"]|"")*"/g, 'X');
  assert.equal(unquoted.split(',').length, 10, unquoted);
});

test('the received figure is what landed, not what was agreed, when they differ', () => {
  // Settlement accepts anything from 97% of the signed Luna upwards. Income is the figure
  // that arrived; the agreed figure is the contract and stays in its own column.
  const short = chit({ settledLuna: 118_000_000n });
  const line = toCsv(WORKER, [short], 'https://chit.test').split('\r\n')[1]!;
  assert.match(line, /,1180\.00000,/);
  assert.match(line, /,40\.00,USD,/, 'and the amount agreed is untouched');
});

test('every row carries the transaction and a link back to the receipt', () => {
  const line = toCsv(WORKER, [chit()], 'https://chit.test').split('\r\n')[1]!;
  assert.match(line, new RegExp(`,${'f'.repeat(64)},`));
  assert.match(line, /https:\/\/chit\.test\/c\/chit1%3A/);
});

test('rows are oldest first, which is the order an accountant reads a year in', () => {
  const older = chit({ id: 'chit1:older', settledAt: Date.UTC(2026, 0, 1) });
  const newer = chit({ id: 'chit1:newer', settledAt: Date.UTC(2026, 11, 1) });
  const csv = toCsv(WORKER, [newer, older], 'https://chit.test');
  const lines = csv.split('\r\n');
  assert.match(lines[1]!, /2026-01-01/);
  assert.match(lines[2]!, /2026-12-01/);
});

test('a chit this wallet was not part of never reaches its export', () => {
  const stranger = 'NQ22 2222 2222 2222 2222 2222 2222 2222 2222';
  const csv = toCsv(stranger, [chit()], 'https://chit.test');
  assert.equal(csv.trimEnd().split('\r\n').length, 1);
});

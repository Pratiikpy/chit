/**
 * One suite, both backends.
 *
 * The routes were moved behind a storage interface so chit can run on a server with a disk
 * *and* on a serverless platform with an object store. An interface only buys that if both
 * implementations actually behave the same, so this file runs identical assertions against
 * each — and against the **real** Vercel Blob store, over the network, not a fake of it.
 * A fake would only prove that the fake matches the fake.
 *
 * The Blob half needs `BLOB_READ_WRITE_TOKEN`. When it is absent the suite says so loudly
 * and skips rather than passing quietly, because a silent skip in CI is how an untested
 * backend reaches production believing it is covered.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalise, chitHash, newNonce, type Chit } from '@chit/core';
import { SqliteRepository, type ChitRepository } from '../src/repository.ts';
import { BlobRepository } from '../src/blob-repository.ts';
import { del } from '@vercel/blob';

const PAYER = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const WORKER = 'NQ12 1111 1111 1111 1111 1111 1111 1111 1111';

function makeChit(): Chit {
  return {
    chain: 'test',
    kind: 'race',
    nonce: newNonce(),
    text: 'cut a 30-second vertical from this footage',
    amountMinor: 6000n,
    currency: 'USD',
    luna: 15_673_981_192n,
    rateBlock: 4_100_000,
    deadlineBlock: 4_618_400,
    payer: PAYER,
    payee: '',
    deliverables: 1,
  };
}

/**
 * Retry an assertion that depends on a *listing*.
 *
 * Object-store listings are eventually consistent and lag further behind a write than a
 * keyed read does. This is not papering over a defect: the two views below are the only
 * listing-derived ones, neither is on chit's critical path, and the serverless deployment
 * deliberately confirms settlement per-chit rather than by sweeping a list. On SQLite
 * these pass on the first attempt.
 */
async function eventually(check: () => Promise<boolean>, what: string, attempts = 8): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }
  assert.fail(`${what} (still false after ${attempts} attempts)`);
}

const sig = (tag: string) => ({ publicKeyHex: tag.repeat(64).slice(0, 64), signatureHex: tag.repeat(128).slice(0, 128) });

/** The behaviour every backend owes the routes, expressed once. */
async function conformsToTheContract(repo: ChitRepository, label: string): Promise<{ id: string; txHash: string }> {
  const chit = makeChit();
  const canonical = canonicalise(chit);
  const id = chitHash(chit);

  // --- create -------------------------------------------------------------
  const first = await repo.create({ id, canonical, chit, payerSignature: sig('a') });
  assert.equal(first.created, true, `${label}: a new chit is created`);
  assert.equal(first.chit.id, id, `${label}: keyed by its own digest`);

  // What must hold is that a retry never produces a *second agreement*. On SQLite the
  // insert conflicts and `created` is false. On an object store a retry inside the
  // consistency window can re-write the same key with byte-identical content, so
  // `created` is not the invariant — the single record under the digest is.
  const again = await repo.create({ id, canonical, chit, payerSignature: sig('a') });
  assert.equal(again.chit.id, id, `${label}: a retry resolves to the same agreement`);
  assert.equal(again.chit.canonical, canonical, `${label}: with the same signed bytes`);

  const loaded = await repo.get(id);
  assert.ok(loaded, `${label}: it reads back`);
  assert.equal(loaded.canonical, canonical, `${label}: the signed bytes survive verbatim`);
  assert.equal(loaded.chit.amountMinor, 6000n, `${label}: money round-trips as bigint`);
  assert.equal(loaded.chit.luna, 15_673_981_192n, `${label}: large Luna keeps full precision`);
  assert.equal(loaded.settledTx, undefined, `${label}: nothing is settled yet`);

  // --- countersign --------------------------------------------------------
  assert.equal(await repo.countersign(id, sig('b'), WORKER), true, `${label}: the first countersignature binds`);
  assert.equal(await repo.countersign(id, sig('c'), PAYER), false, `${label}: a second is refused, not an overwrite`);

  const countersigned = await repo.get(id);
  assert.equal(countersigned?.countersigner, WORKER, `${label}: the payee comes from the signature`);
  assert.equal(countersigned?.payeeSignature?.publicKeyHex, sig('b').publicKeyHex, `${label}: it kept the first one`);

  // --- awaiting settlement ------------------------------------------------
  await eventually(
    async () => (await repo.awaitingSettlement()).some((c) => c.id === id),
    `${label}: an unpaid chit is awaiting settlement`,
  );
  await eventually(
    async () => (await repo.watchedAddresses()).includes(WORKER),
    `${label}: its payee is watched`,
  );

  // --- settle -------------------------------------------------------------
  const tx = { hash: `0xtest${chit.nonce}`, blockNumber: 4_100_042 };
  assert.equal(await repo.markSettled(id, tx), true, `${label}: it settles`);
  assert.equal(await repo.markSettled(id, tx), false, `${label}: settling twice is a no-op`);

  const settled = await repo.get(id);
  assert.equal(settled?.settledTx, tx.hash, `${label}: the settling transaction is recorded`);
  assert.equal(settled?.settledBlock, tx.blockNumber, `${label}: with its block`);

  assert.equal((await repo.byTransaction(tx.hash))?.id, id, `${label}: findable by transaction, for /v/<hash>`);
  await eventually(
    async () => !(await repo.awaitingSettlement()).some((c) => c.id === id),
    `${label}: a settled chit leaves the awaiting set`,
  );

  // --- history ------------------------------------------------------------
  const events = await repo.events(id);
  assert.deepEqual(
    events.map((e) => e.event),
    ['created', 'countersigned', 'settled'],
    `${label}: the history is complete and in order`,
  );

  // --- activity -----------------------------------------------------------
  await eventually(async () => (await repo.forAddress(PAYER)).some((c) => c.id === id), `${label}: the payer sees it`);
  await eventually(async () => (await repo.forAddress(WORKER)).some((c) => c.id === id), `${label}: the worker sees it`);

  // --- absent things ------------------------------------------------------
  assert.equal(await repo.get('chit1:nope'), undefined, `${label}: an unknown id is undefined, not a throw`);
  assert.equal(await repo.byTransaction('0xnope'), undefined, `${label}: an unknown transaction likewise`);
  assert.deepEqual(await repo.events('chit1:nope'), [], `${label}: history of nothing is empty`);
  return { id, txHash: tx.hash };
}

test('SQLite satisfies the storage contract', async () => {
  const repo = new SqliteRepository(':memory:');
  await conformsToTheContract(repo, 'sqlite');
  repo.close();
});

const blobToken = process.env['BLOB_READ_WRITE_TOKEN'];

test('Vercel Blob satisfies the same storage contract', { skip: blobToken ? false : 'BLOB_READ_WRITE_TOKEN not set — the serverless backend was NOT exercised' }, async () => {
  // Deliberately the real store over the network. A mock here would only prove the mock.
  const { id, txHash } = await conformsToTheContract(new BlobRepository(blobToken), 'blob');

  // The real store is the production store. Leave it exactly as it was found: a synthetic
  // address with ten "settled" chits is what a ledger read returned before this existed.
  const key = id.replace(/^chit1:/, '');
  const addr = (a: string) => a.replace(/\s+/g, '').toUpperCase();
  await del(
    [
      `chits/${key}.json`,
      `open/${key}.json`,
      `tx/${txHash}.json`,
      `addr/${addr(PAYER)}/${key}.json`,
      `addr/${addr(WORKER)}/${key}.json`,
    ],
    { token: blobToken as string },
  ).catch(() => {
    /* a path that was never written is fine */
  });
});

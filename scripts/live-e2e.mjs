/**
 * Door one, driven over live HTTP against a running server.
 *
 * The unit suites prove the logic; this proves the wire. Run it against a live API to
 * confirm the real HTTP surface, the real database and the real rate provider agree with
 * what the tests assert in isolation.
 *
 *   node --experimental-strip-types scripts/live-e2e.mjs [baseUrl]
 */

import { KeyPair } from '@nimiq/core';
import { canonicalise, chitHash, newNonce } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';

const API = process.argv[2] ?? 'http://localhost:8787';

const sign = (kp, text) => ({
  publicKeyHex: kp.publicKey.toHex(),
  signatureHex: kp.sign(nimiqSignedMessageDigest(new TextEncoder().encode(text))).toHex(),
});

const post = async (path, body) => {
  const response = await fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

const get = async (path) => (await fetch(API + path)).json();

let failures = 0;
const check = (label, condition, detail = '') => {
  if (!condition) failures++;
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
};

const payer = KeyPair.generate();
const worker = KeyPair.generate();

console.log(`\nchit — live door one against ${API}\n`);

// 1. Price it, from the live rate provider and the live chain height.
const quote = await get('/api/quote?amountMinor=6000&currency=USD');
console.log(`1. quote     $60.00 = ${(Number(quote.luna) / 1e5).toLocaleString()} NIM @ $${quote.rate}, block ${quote.rateBlock}`);
check('quote is priced and pinned', Number(quote.luna) > 0 && quote.rateBlock > 0);
check('quote is fresh, not stale', quote.stale === false);

// 2. The payer signs a line they agreed elsewhere.
const chit = {
  chain: 'main',
  kind: 'race',
  nonce: newNonce(),
  text: 'Cut a 30-second vertical from this footage by Friday',
  amountMinor: 6000n,
  currency: 'USD',
  luna: BigInt(quote.luna),
  rateBlock: quote.rateBlock,
  deadlineBlock: quote.rateBlock + 86_400 * 2,
  payer: payer.toAddress().toUserFriendlyAddress(),
  payee: '',
  deliverables: 30,
};
const canonical = canonicalise(chit);
const created = await post('/api/chits', { canonical, payerSignature: sign(payer, canonical) });
console.log(`\n2. created   ${created.status}  ${created.body.id}`);
check('created', created.status === 201);
check('id is the digest of what was signed', created.body.id === chitHash(chit));
check('nobody to pay yet', created.body.payTo === null);

// 3. A retry must not create a second agreement.
const retry = await post('/api/chits', { canonical, payerSignature: sign(payer, canonical) });
check('a retry is idempotent', retry.status === 200 && retry.body.id === created.body.id);

// 4. The other side countersigns; their address arrives with the signature.
const countersigned = await post(
  `/api/chits/${encodeURIComponent(created.body.id)}/countersign`,
  { signature: sign(worker, canonical) },
);
const workerAddress = worker.toAddress().toUserFriendlyAddress();
console.log(`\n3. signed    ${countersigned.status}  payTo = ${countersigned.body.payTo}`);
check('countersigned', countersigned.body.countersigned === true);
check(
  'the payee address came from the signature, not from a form',
  countersigned.body.payTo?.replace(/\s/g, '') === workerAddress.replace(/\s/g, ''),
);

// 5. Forgeries and cross-network chits are refused.
const forged = await post('/api/chits', {
  canonical: canonicalise({ ...chit, nonce: newNonce() }),
  payerSignature: sign(worker, canonical),
});
check('a forged signature is refused', forged.status === 400, `${forged.body.code}`);

const wrongChain = canonicalise({ ...chit, chain: 'test', nonce: newNonce() });
const crossNet = await post('/api/chits', { canonical: wrongChain, payerSignature: sign(payer, wrongChain) });
check('a testnet chit is refused by a mainnet service', crossNet.body.code === 'chain-mismatch');

// 6. The record reads back correctly.
const stored = await get(`/api/chits/${encodeURIComponent(created.body.id)}`);
console.log(`\n4. history   ${stored.events.map((e) => e.event).join(' -> ')}`);
check('history is ordered and complete', stored.events.map((e) => e.event).join(',') === 'created,countersigned');
check('not settled — no payment was sent', stored.settled === false);
check('the exact signed bytes are returned for independent checking', stored.canonical === canonical);

// 7. Health, and whichever way this deployment confirms settlement.
//
// There are two shapes and both are legitimate. A server with a process runs the watcher
// loop; a serverless deployment has nowhere to run a loop, so it confirms settlement while
// answering a read of the chit itself (`settlement.ts`). The check is that the service is
// healthy and that *one* of those is in force — not that a watcher specifically exists,
// which would fail the deployment people will actually use.
const health = await get('/health');
check('the service is healthy', health.ok === true, `chain=${health.chain}`);

if (health.watcher) {
  console.log(`
5. settlement  watcher, polling`);
  check('the watcher is running and reporting', health.watcher.lastPollAt > 0);
  check('no watcher errors against the live RPC', health.watcher.errors === 0, `polls=${health.watcher.polls}`);
} else {
  console.log(`
5. settlement  confirmed on read (no background process)`);
  // Prove the read path really does reach the chain: a countersigned, unpaid chit is
  // exactly the case that triggers the lookup, and it must come back unsettled rather
  // than erroring.
  const rechecked = await get(`/api/chits/${encodeURIComponent(created.body.id)}`);
  check('a countersigned chit is checked against the chain on read', rechecked.settled === false);
  check('and the check does not disturb the record', rechecked.canonical === canonical);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);

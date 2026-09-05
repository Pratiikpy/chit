/**
 * Can chit's own server pay someone?
 *
 * Every idea that has chit *send* NIM — the hour-chit, race payouts, one-tap returns — rests
 * on one unproven step: building and signing a basic transaction with a memo in Node and
 * broadcasting it through the public RPC. This script settles it in stages, and each stage
 * reports plainly so the answer is evidence, not belief.
 *
 *   1. Does the RPC expose sendRawTransaction at all?   (a bogus payload distinguishes
 *      "Method not allowed" from "cannot deserialise" — already observed: it deserialises)
 *   2. Can @nimiq/core in Node build + sign a memo-carrying transaction?
 *   3. Does the node ACCEPT those bytes?  Unfunded, the honest answer is a *balance* error —
 *      which proves serialisation, signature and broadcast path, and leaves only funding.
 *   4. Funded (PAYOUT_KEY + PAYOUT_TO set): broadcast, then confirm the memo is readable
 *      through the exact code the settlement matcher uses.
 *
 *   node --experimental-strip-types scripts/payout-probe.mjs
 *   PAYOUT_KEY=<hex private key> PAYOUT_TO="NQ.." node --experimental-strip-types scripts/payout-probe.mjs
 */

import * as core from '@nimiq/core';
import { normaliseTransaction } from '../apps/api/src/chain.ts';

const RPC = process.env['CHIT_RPC_URL'] ?? 'https://rpc.nimiqwatch.com';
const say = (k, v) => console.log(`  ${k.padEnd(22)} ${v}`);

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) {
    const e = typeof body.error === 'string' ? body.error : `${body.error.message}${body.error.data ? ` — ${body.error.data}` : ''}`;
    throw new Error(e);
  }
  return body.result?.data ?? body.result;
}

console.log(`\nchit — payout probe against ${RPC}\n`);

/* ---------- 1. the method exists ---------------------------------------- */
try {
  await rpc('sendRawTransaction', ['00']);
} catch (e) {
  const refused = /not allowed|not found|unknown method/i.test(e.message);
  say('sendRawTransaction', refused ? `REFUSED — ${e.message}` : `exposed (rejects bogus bytes: "${e.message}")`);
  if (refused) process.exit(1);
}

/* ---------- 2. build + sign in Node -------------------------------------- */
const height = Number(await rpc('getBlockNumber'));
say('chain height', height);

let networkId;
try {
  networkId = Number(await rpc('getNetworkId'));
  say('network id (RPC)', networkId);
} catch (e) {
  say('network id (RPC)', `unavailable — ${e.message}`);
}

const Builder = core.TransactionBuilder ?? core.Transaction;
say('builder', core.TransactionBuilder ? 'TransactionBuilder' : 'Transaction (static)');
say('newBasicWithData', typeof Builder?.newBasicWithData === 'function' ? 'present' : 'MISSING');

const keyPair = process.env['PAYOUT_KEY'] ? core.KeyPair.fromHex(process.env['PAYOUT_KEY']) : core.KeyPair.generate();
const sender = keyPair.toAddress();
const recipient = process.env['PAYOUT_TO']
  ? core.Address.fromUserFriendlyAddress(process.env['PAYOUT_TO'])
  : sender;
say('sender', sender.toUserFriendlyAddress());
say('recipient', recipient.toUserFriendlyAddress());

// A real-shaped memo: 'chit1:' + 43 base64url chars = 49 bytes, well inside the 64-byte cap.
const memo = new TextEncoder().encode('chit1:' + 'p'.repeat(43));
say('memo bytes', memo.byteLength);

if (networkId === undefined) {
  // Documented in core-rs-albatross NetworkId: MainAlbatross = 24, TestAlbatross = 5.
  // NOT VERIFIED through this RPC; the node will reject a wrong id, which is itself a signal.
  networkId = /test/i.test(RPC) ? 5 : 24;
  say('network id (assumed)', `${networkId} — NOT VERIFIED`);
}

let tx;
try {
  tx = Builder.newBasicWithData(sender, recipient, memo, 10_000n /* 0.0001 NIM */, 0n, height, networkId);
  tx.sign(keyPair, undefined);
  say('build + sign', 'ok');
} catch (e) {
  say('build + sign', `FAILED — ${e.message}`);
  process.exit(1);
}

const hex = typeof tx.toHex === 'function' ? tx.toHex() : Buffer.from(tx.serialize()).toString('hex');
say('serialised bytes', hex.length / 2);

/* ---------- 3. does the node accept the bytes? --------------------------- */
let hash;
try {
  hash = await rpc('sendRawTransaction', [hex]);
  say('broadcast', `ACCEPTED — ${hash}`);
} catch (e) {
  const balance = /insufficient|balance|funds|does not exist|not found|account/i.test(e.message);
  say('broadcast', balance
    ? `rejected for BALANCE only — "${e.message}"\n  ${''.padEnd(22)} → serialisation, signature and broadcast path are all accepted; only funding is missing`
    : `rejected — "${e.message}"`);
  if (!balance) process.exit(1);
  console.log('\nVERDICT: the payout path works from Node without consensus; fund PAYOUT_KEY to complete stage 4.\n');
  process.exit(0);
}

/* ---------- 4. funded: confirm through the matcher's own reader ---------- */
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const txs = await rpc('getTransactionsByAddress', [recipient.toUserFriendlyAddress(), 20]);
    const seen = (Array.isArray(txs) ? txs : []).map(normaliseTransaction).find((t) => t && t.hash === hash);
    if (seen) {
      say('confirmed', `block ${seen.blockNumber}, memo read back as "${seen.memo}"`);
      console.log('\nVERDICT: end-to-end payout PROVEN — build, sign, broadcast, and the settlement matcher reads the memo.\n');
      process.exit(0);
    }
  } catch { /* keep polling */ }
}
console.log('\nVERDICT: broadcast accepted but not seen at the recipient within 30 s — check the explorer for the hash above.\n');
process.exit(2);

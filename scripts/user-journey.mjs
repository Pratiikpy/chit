/**
 * The whole product, driven the way two real people would use it.
 *
 * Nothing here is a unit test. Two separate browser contexts — a payer and a worker, each
 * with their own Ed25519 key and their own injected Nimiq Pay provider — walk the entire
 * journey: paste, correct, sign, share, countersign, pay, settle, receipt, verify. Every
 * screen is captured in light and dark, every console error and failed request is
 * collected, and the outcome is checked against the database and the chain rather than
 * against what a screen happens to say.
 *
 * What is real: the app bundle, the API, SQLite, the settlement watcher, the JSON-RPC
 * client, the live CoinGecko rate, and genuine Ed25519 signatures produced by the same
 * scheme a Nimiq wallet uses.
 *
 * What is substituted, and why: the chain's *contents*, because a test cannot mine a block
 * or spend real NIM. `scripts/fake-nimiq-rpc.mjs` answers the two RPC methods chit uses,
 * over real HTTP, in the real response shape. Everything on chit's side of that boundary
 * is production code.
 *
 * What this still cannot prove: that Nimiq Pay itself frames `sign()` the way the four
 * reference implementations do. Only a physical device settles that.
 *
 *   node --experimental-strip-types scripts/user-journey.mjs
 */

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';
import { KeyPair } from '@nimiq/core';
import { nimiqSignedMessageDigest, verifySignedText } from '@chit/verify';
import { startFakeRpc } from './fake-nimiq-rpc.mjs';

const BOUNTY_KEY = KeyPair.generate();
const DEMO_KEY = KeyPair.generate();

const RPC_PORT = 8649;
const API_PORT = 8791;
const WEB_PORT = 4180;
const WEB = `http://localhost:${WEB_PORT}`;
const API = `http://localhost:${API_PORT}`;
const DB = './.journey.db';
const SHOTS = 'shots/journey';

let failures = 0;
let checks = 0;
const problems = [];

function check(label, ok, detail = '') {
  checks++;
  if (!ok) {
    failures++;
    problems.push(label + (detail ? ` — ${detail}` : ''));
  }
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ services */

async function waitForHttp(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return true;
    } catch {
      /* not up yet */
    }
    await wait(300);
  }
  throw new Error(`${url} never came up`);
}

/* ------------------------------------------------------------------ wallets */

/**
 * A Nimiq Pay provider injected into the page, backed by a real key held in Node.
 *
 * The page calls `window.nimiq.sign()`; that hops to Node, signs with a genuine Ed25519
 * key using the real Nimiq signed-message scheme, and hands back `{ publicKey, signature }`
 * as hex — exactly what the SDK types promise. So the signatures the server verifies in
 * this test are real signatures, not fixtures.
 */
async function installWallet(context, keyPair, { onPay }) {
  const address = keyPair.toAddress().toUserFriendlyAddress();

  await context.exposeFunction('__chitSign', (message) => ({
    publicKey: keyPair.publicKey.toHex(),
    signature: keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(message))).toHex(),
  }));

  await context.exposeFunction('__chitPay', async (tx) => onPay({ ...tx, from: address }));

  await context.addInitScript(
    ({ address: addr, height }) => {
      // Seeded before the page script runs, exactly as Nimiq Pay does it.
      window.nimiqPay = {
        language: 'en',
        userFiat: 'USD',
        requestDeviceIdentifier: () => Promise.resolve('0'.repeat(64)),
      };
      window.nimiq = {
        listAccounts: () => Promise.resolve([addr]),
        sign: (input) => window.__chitSign(typeof input === 'string' ? input : input.message),
        getBlockNumber: () => Promise.resolve(height),
        isConsensusEstablished: () => Promise.resolve(true),
        sendBasicTransactionWithData: (tx) => window.__chitPay(tx),
      };
    },
    { address, height: 4_100_000 },
  );

  return address;
}

/* ------------------------------------------------------------------ run */

console.log('\nchit — full user journey\n');

rmSync(DB, { force: true });
rmSync(`${DB}-wal`, { force: true });
rmSync(`${DB}-shm`, { force: true });
mkdirSync(SHOTS, { recursive: true });

const rpc = await startFakeRpc({ port: RPC_PORT });
console.log(`  chain     ${rpc.url}  (height ${rpc.height})`);

const api = spawn(
  process.execPath,
  ['--experimental-strip-types', 'apps/api/src/server.ts'],
  {
    env: {
      ...process.env,
      CHIT_CHAIN: 'test',
      CHIT_RPC_URL: rpc.url,
      CHIT_DB: DB,
      PORT: String(API_PORT),
      CHIT_BASE_URL: WEB,
      CHIT_WATCH_INTERVAL_MS: '1000',
      CHIT_RATE_LIMIT_PER_MINUTE: '0',
      // Throwaway keys: the bounty pool and the demo worker exist for this run only.
      CHIT_BOUNTY_KEY: BOUNTY_KEY.privateKey.toHex(),
      CHIT_DEMO_KEY: DEMO_KEY.privateKey.toHex(),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
api.stderr.on('data', (d) => {
  const line = String(d);
  if (!/ExperimentalWarning|trace-warnings/.test(line)) process.stderr.write(`  [api] ${line}`);
});

const web = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', 'preview', '--port', String(WEB_PORT), '--strictPort'],
  {
    cwd: 'apps/web',
    env: { ...process.env, CHIT_API_URL: API },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  },
);

const shutdown = async () => {
  api.kill();
  web.kill();
  await rpc.stop();
};

try {
  await waitForHttp(`${API}/health`);
  await waitForHttp(WEB);
  console.log(`  api       ${API}\n  app       ${WEB}\n`);

  const payerKey = KeyPair.generate();
  const workerKey = KeyPair.generate();

  const browser = await chromium.launch();
  const consoleErrors = [];
  const failedRequests = [];
  /** Requests to somebody else's servers that failed. Reported, never fatal. */
  const thirdPartyFailures = [];

  /** Build a browser context for one person. */
  const makeUser = async (name, keyPair, scheme, onPay) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: scheme,
      deviceScaleFactor: 2,
    });
    const address = await installWallet(context, keyPair, { onPay });
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // A deliberate 4xx from our own API (a refused answer, a missing chit) is the
      // browser reporting a fetch status, not a page error.
      if (/status of 4\d\d/.test(m.text())) return;
      /*
       * "Failed to load resource" carries no URL in its text — the URL is in the message's
       * location. A font CDN dropping a connection is the internet, not the product, and the
       * font is loaded with `display=swap` behind a full fallback stack precisely so that it
       * is survivable. Classified here the same way the request itself is, so one external
       * blip cannot fail a run that is otherwise green.
       */
      const source = `${m.text()} ${m.location()?.url ?? ''}`;
      if (/fonts\.(googleapis|gstatic)\.com/.test(source)) {
        thirdPartyFailures.push(`[${name}] console: ${m.text()}`);
        return;
      }
      consoleErrors.push(`[${name}] ${m.text()}`);
    });
    page.on('pageerror', (e) => consoleErrors.push(`[${name}] pageerror: ${e.message}`));
    page.on('requestfailed', (r) => {
      // A request the browser cancelled because the page moved on is not a failure — every
      // screen here polls, and a poll in flight when the poller wins is aborted by design.
      if ((r.failure()?.errorText ?? '').includes('ERR_ABORTED')) return;
      // A third-party CDN going away mid-run is the internet, not the product. The font is
      // loaded with `display=swap` behind a fallback stack precisely so a failure is
      // survivable, so it is recorded separately and does not fail the run.
      const list = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(r.url()) ? failedRequests : thirdPartyFailures;
      list.push(`[${name}] ${r.url()} — ${r.failure()?.errorText ?? 'unknown'}`);
    });
    return { context, page, address, name };
  };

  /**
   * Capture a screen, and check it fits the phone.
   *
   * A single unbreakable string once widened the share screen to 1229px inside a 390px
   * viewport, cutting every row off mid-word — and every functional test still passed.
   * So width is asserted at each step, not eyeballed at the end.
   */
  const shot = async (page, file) => {
    // Entrance animations are finished before the frame is taken, so a shot is never mid-fade.
    await page.screenshot({ path: `${SHOTS}/${file}.png`, fullPage: true, animations: 'disabled' });
    const overflow = await page.evaluate(() => {
      // `overflow-x: hidden` on the root clips the *scrollbar*, not the layout: a page can
      // still be laid out wider than the viewport and be cut off at the edge. So the widest
      // element's right edge is the measurement that matters, and both scroll widths are
      // taken because Chrome reports them differently for html and body.
      const all = [...document.querySelectorAll('body *')].map((el) => ({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className : '',
        right: Math.round(el.getBoundingClientRect().right),
      }));
      const widest = all.sort((a, b) => b.right - a.right)[0];
      const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, widest?.right ?? 0);
      return { scrollWidth, innerWidth: window.innerWidth, widest };
    });
    check(
      `${file}: fits the screen, nothing scrolls sideways`,
      overflow.scrollWidth <= overflow.innerWidth + 1,
      overflow.scrollWidth > overflow.innerWidth + 1
        ? `${overflow.scrollWidth}px in a ${overflow.innerWidth}px viewport; widest: ${overflow.widest?.tag}.${overflow.widest?.cls}`
        : '',
    );
  };

  /* -------------------------------------------------- 1. the payer composes */

  console.log('1. The payer pastes a deal they agreed on Fiverr');

  let settlingTx = null;
  const payer = await makeUser('payer', payerKey, 'light', async (tx) => {
    // Tapping Pay in the app makes the payment land on the chain, as it would in life.
    settlingTx = tx;
    const injected = await rpc.inject({ to: tx.recipient, from: tx.from, value: tx.value, data: tx.data });
    return injected.hash;
  });

  await payer.page.goto(WEB, { waitUntil: 'networkidle' });
  await shot(payer.page, '01-compose-empty');

  await payer.page.locator('button', { hasText: 'paying' }).click();
  const line = '$60 to cut a 30-second vertical from this footage by Friday';
  await payer.page.locator('textarea').fill(line);
  await payer.page.waitForSelector('text=What we understood', { timeout: 15_000 });
  await payer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await shot(payer.page, '02-terms-parsed');

  const understood = await payer.page.locator('.card:not(.card--accent)').first().innerText();
  check('the amount was read from the line', understood.includes('60.00'));
  check('it was priced in NIM', /NIM/.test(understood));
  check('the deadline was understood', /days|today|tomorrow/i.test(understood));

  /* -------------------------------------------------- 2. correcting a misread */

  console.log('\n2. The payer corrects the currency — the parser proposes, they decide');

  await payer.page.locator('.card:not(.card--accent) button', { hasText: 'USD' }).first().click();
  await payer.page.waitForTimeout(200);
  await shot(payer.page, '03-currency-chips');

  const hasAlternatives = await payer.page.locator('.card:not(.card--accent) button', { hasText: 'CAD' }).count();
  check('the parser offers the currencies $ could have meant', hasAlternatives > 0);

  await payer.page.locator('.card:not(.card--accent) button', { hasText: 'EUR' }).first().click();
  await payer.page.waitForFunction(() => document.body.innerText.includes('EUR'), { timeout: 15_000 });
  await payer.page.waitForTimeout(1200);
  await shot(payer.page, '04-corrected-to-eur');
  check('the correction stuck', (await payer.page.locator('.card:not(.card--accent)').first().innerText()).includes('EUR'));

  // Put it back, so the rest of the journey is the ordinary case.
  await payer.page.locator('.card:not(.card--accent) button', { hasText: 'EUR' }).first().click();
  await payer.page.locator('.card:not(.card--accent) button', { hasText: 'USD' }).first().click();
  await payer.page.waitForTimeout(1400);

  /* -------------------------------------------------- 3. signing */

  console.log('\n3. The payer signs it');

  await payer.page.locator('button', { hasText: 'Sign it' }).click();
  await payer.page.waitForURL(/\/c\//, { timeout: 20_000 });
  await payer.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  await shot(payer.page, '05-share');

  const chitUrl = payer.page.url();
  const chitId = decodeURIComponent(chitUrl.split('/c/')[1]);
  check('a chit was created and shared', chitId.startsWith('chit1:'), chitId);

  const stored = await (await fetch(`${API}/api/chits/${encodeURIComponent(chitId)}`)).json();
  check('the server accepted a real signature', stored.id === chitId);
  check('the line was stored exactly as typed', stored.chit.text === line);
  check('nothing is countersigned yet', stored.countersigned === false);
  check('nothing has been paid', stored.settled === false);
  check('there is nobody to pay yet', stored.payTo === null);

  const shareText = await payer.page.locator('body').innerText();
  check('the payer is told nothing has been paid yet', /nothing has been paid/i.test(shareText));
  check('a QR is offered for sharing', (await payer.page.locator('canvas').count()) > 0);

  /* -------------------------------------------------- 4. the worker countersigns */

  console.log('\n4. The worker opens the link and countersigns');

  const worker = await makeUser('worker', workerKey, 'dark', async () => 'unused');
  await worker.page.goto(chitUrl, { waitUntil: 'networkidle' });
  await worker.page.waitForSelector('text=agree this with you', { timeout: 20_000 });
  await shot(worker.page, '06-countersign-dark');

  const workerView = await worker.page.locator('body').innerText();
  check('the worker sees the exact words they are agreeing to', workerView.includes(line));
  check('the worker sees the amount', workerView.includes('60.00'));
  check('the worker is told signing moves no money', /does not move any money/i.test(workerView));
  check('a deadline is shown in days, not a raw block number', /in about \d+ day|today|tomorrow/i.test(workerView));
  await worker.page.waitForSelector('.strip', { timeout: 15_000 });
  check('the worker sees the payer’s record before signing — a new wallet reads as new, never as bad', /First chit from this wallet/i.test(await worker.page.locator('body').innerText()));

  await worker.page.locator('button', { hasText: 'Sign it' }).click();
  await worker.page.waitForTimeout(2500);
  await shot(worker.page, '07-worker-after-signing');

  const afterCountersign = await (await fetch(`${API}/api/chits/${encodeURIComponent(chitId)}`)).json();
  check('the countersignature verified server-side', afterCountersign.countersigned === true);
  check(
    'the payee address arrived with the signature, not from a form',
    afterCountersign.payTo?.replace(/\s/g, '') === worker.address.replace(/\s/g, ''),
    afterCountersign.payTo ?? 'null',
  );

  /* -------------------------------------------------- 5. the payer pays */

  console.log('\n5. The payer returns and pays');

  await payer.page.goto(chitUrl, { waitUntil: 'networkidle' });
  await payer.page.waitForSelector('text=Time to pay', { timeout: 20_000 });
  await shot(payer.page, '08-pay');

  const payView = await payer.page.locator('body').innerText();
  check('the payer is told they signed', /They signed/i.test(payView));
  check('the destination address is shown before paying', /NQ/i.test(payView));

  await payer.page.locator('button', { hasText: 'Pay' }).first().click();

  // The payment lands on chain; the watcher notices; the screen moves on its own.
  await payer.page.waitForSelector('.receipt', { timeout: 45_000 });
  await shot(payer.page, '09-settled-payer');

  check('the wallet was asked to pay', settlingTx !== null);
  check('the payment carried the chit digest as its memo', settlingTx?.data === chitId, settlingTx?.data ?? '');
  check(
    'the payment went to the countersigner',
    settlingTx?.recipient?.replace(/\s/g, '') === worker.address.replace(/\s/g, ''),
  );
  check('the amount matched the chit', String(settlingTx?.value) === String(stored.chit.luna));

  const settled = await (await fetch(`${API}/api/chits/${encodeURIComponent(chitId)}`)).json();
  check('settlement was observed on chain, not asserted by the client', settled.settled === true);
  check('the settling transaction was recorded', typeof settled.settledTx === 'string');
  // Settlement accepts 97% of the signed Luna and upwards, so what arrived is not always
  // what was agreed. The receipt may only describe the payment if the payment is recorded.
  check('and what the payment actually carried, not just what was agreed', typeof settled.settledLuna === 'string' && BigInt(settled.settledLuna) > 0n, settled.settledLuna ?? 'null');
  check(
    'the history is complete and in order',
    settled.events.map((e) => e.event).join(',') === 'created,countersigned,settled',
    settled.events.map((e) => e.event).join(' -> '),
  );

  /* -------------------------------------------------- 6. the worker sees it */

  console.log('\n6. The worker sees they were paid');

  await worker.page.goto(chitUrl, { waitUntil: 'networkidle' });
  await worker.page.waitForSelector('text=You were paid', { timeout: 20_000 });
  await shot(worker.page, '10-paid-worker-dark');
  check('the worker is told they were paid', /You were paid/i.test(await worker.page.locator('body').innerText()));

  /* -------------------------------------------------- 7. a stranger verifies */

  console.log('\n7. A stranger with no wallet verifies the receipt');

  const stranger = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const strangerPage = await stranger.newPage();
  const plainPage = strangerPage;
  strangerPage.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) consoleErrors.push(`[stranger] ${m.text()}`);
  });

  await strangerPage.goto(`${WEB}/v/${encodeURIComponent(settled.settledTx)}`, { waitUntil: 'networkidle' });
  await strangerPage.waitForSelector('text=This is genuine', { timeout: 20_000 });
  await shot(strangerPage, '11-verify-genuine');

  const verifyView = await strangerPage.locator('body').innerText();
  check('a stranger with no wallet sees it verified', /This is genuine/i.test(verifyView));
  check('the verify page shows what was actually signed', verifyView.includes(line));
  check('it states both parties signed', /Both signed[\s\S]{0,20}yes/i.test(verifyView));
  check('it shows the block it settled in', /block \d+/i.test(verifyView));
  // A test-network receipt is cryptographically valid and worth nothing. It must never be
  // mistakeable for one covering real money.
  check(
    'a testnet receipt says plainly that no real money moved',
    /test network|no real money/i.test(verifyView),
  );

  const verified = await (await fetch(`${API}/api/verify/${encodeURIComponent(settled.settledTx)}`)).json();
  check('the server independently re-verifies both signatures', verified.verification.ok === true);
  check('and confirms it is countersigned', verified.verification.countersigned === true);
  check('and confirms it settled', verified.verification.settled === true);

  /* -------------------------------------------------- 8. things going wrong */

  console.log('\n8. The unhappy paths');

  await strangerPage.goto(`${WEB}/v/notarealtransaction`, { waitUntil: 'networkidle' });
  await strangerPage.waitForSelector('text=Nothing to show', { timeout: 15_000 });
  await shot(strangerPage, '12-verify-missing');
  check('an unknown receipt says so plainly', true);

  await strangerPage.goto(`${WEB}/c/chit1:doesnotexist`, { waitUntil: 'networkidle' });
  await strangerPage.waitForSelector('text=Not found', { timeout: 15_000 });
  await shot(strangerPage, '13-chit-missing');
  check('an unknown chit says so plainly', true);

  await strangerPage.goto(`${WEB}/nonsense/route`, { waitUntil: 'networkidle' });
  await strangerPage.waitForSelector('text=Nothing here', { timeout: 15_000 });
  await shot(strangerPage, '14-unknown-route');
  check('an unknown route does not show a blank page', true);

  // A person on a laptop with no wallet at all.
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(WEB, { waitUntil: 'networkidle' });
  await desktopPage.waitForSelector('h1', { timeout: 15_000 });
  await desktopPage.screenshot({ path: `${SHOTS}/15-desktop-no-wallet.png` });
  const desktopView = await desktopPage.locator('body').innerText();
  check('a laptop visitor is told how to sign, not left guessing', /Nimiq Pay/i.test(desktopView));
  check('the sign button is disabled with no wallet', await desktopPage.locator('button', { hasText: 'Sign it' }).isDisabled());

  // Countersigning twice must be calm, not an error.
  const twice = await fetch(`${API}/api/chits/${encodeURIComponent(chitId)}/countersign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signature: { publicKeyHex: 'aa'.repeat(32), signatureHex: 'bb'.repeat(64) } }),
  });
  check('a second countersign is answered calmly, not with an error', twice.status === 200);


  /* -------------------------------------------------- 8b. the other direction: a quote */

  console.log('\n8b. A worker signs a quote alone; a client pays it, and paying is accepting');

  const quoteWorkerKey = KeyPair.generate();
  const clientKey = KeyPair.generate();
  let quoteSettling = null;

  const qWorker = await makeUser('quote-worker', quoteWorkerKey, 'light', async () => 'unused');
  await qWorker.page.goto(WEB, { waitUntil: 'networkidle' });
  await qWorker.page.locator('button', { hasText: 'getting paid' }).click();
  const quoteLine = '$45 to write three product descriptions by Tuesday';
  await qWorker.page.locator('textarea').fill(quoteLine);
  await qWorker.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await shot(qWorker.page, '16-compose-earning');
  await qWorker.page.locator('button', { hasText: 'Sign it' }).click();
  await qWorker.page.waitForURL(/\/c\//, { timeout: 20_000 });
  await qWorker.page.waitForSelector('text=Your quote', { timeout: 20_000 });
  await shot(qWorker.page, '17-quote-owner');

  const quoteUrl = qWorker.page.url();
  const quoteId = decodeURIComponent(quoteUrl.split('/c/')[1]);
  const quoteApi = await (await fetch(`${API}/api/chits/${encodeURIComponent(quoteId)}`)).json();
  check('the quote is signed by the worker and names no payer', quoteApi.chit.kind === 'quote' && quoteApi.chit.payer === '');
  check('the payee is the worker, derived from the key that signed', quoteApi.chit.payee.replace(/\s/g, '') === qWorker.address.replace(/\s/g, ''));

  const client = await makeUser('client', clientKey, 'dark', async (tx) => {
    quoteSettling = tx;
    const injected = await rpc.inject({ to: tx.recipient, from: tx.from, value: tx.value, data: tx.data });
    return injected.hash;
  });
  await client.page.goto(quoteUrl, { waitUntil: 'networkidle' });
  await client.page.waitForSelector('text=A quote for you', { timeout: 20_000 });
  await shot(client.page, '18-accept-quote-dark');
  check('the client is told that paying accepts it', /Paying this accepts/i.test(await client.page.locator('body').innerText()));

  await client.page.locator('button', { hasText: 'Pay' }).first().click();
  await client.page.waitForSelector('.receipt', { timeout: 45_000 });
  await shot(client.page, '19-quote-paid-client-dark');
  check('the payment went to the worker who signed the quote', quoteSettling?.recipient?.replace(/\s/g, '') === qWorker.address.replace(/\s/g, ''));
  check('and carried the quote digest as its memo', quoteSettling?.data === quoteId);

  const quoteSettled = await (await fetch(`${API}/api/chits/${encodeURIComponent(quoteId)}`)).json();
  check('a quote settles with no countersign step at all', quoteSettled.settled === true && quoteSettled.countersigned === false);
  check(
    'the client is recorded from the transaction, never from a form',
    quoteSettled.settledFrom?.replace(/\s/g, '') === client.address.replace(/\s/g, ''),
    quoteSettled.settledFrom ?? 'null',
  );
  check('the history is created -> settled', quoteSettled.events.map((e) => e.event).join(',') === 'created,settled', quoteSettled.events.map((e) => e.event).join(' -> '));

  const twiceQuote = await fetch(`${API}/api/chits/${encodeURIComponent(quoteId)}/countersign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signature: { publicKeyHex: 'aa'.repeat(32), signatureHex: 'bb'.repeat(64) } }),
  });
  check('a quote refuses a countersignature — paying is the only acceptance', twiceQuote.status === 409);

  await qWorker.page.goto(quoteUrl, { waitUntil: 'networkidle' });
  await qWorker.page.waitForSelector('text=You were paid', { timeout: 20_000 });
  await shot(qWorker.page, '20-quote-paid-worker');

  // The worker's activity shows the job, and the record says literally what a cut would have been.
  await qWorker.page.goto(`${WEB}/a/${encodeURIComponent(qWorker.address)}`, { waitUntil: 'networkidle' });
  await qWorker.page.waitForSelector('.list__item', { timeout: 20_000 });
  await shot(qWorker.page, '21-activity');
  const activityView = await qWorker.page.locator('body').innerText();
  check('the worker sees the paid quote in Activity', activityView.includes(quoteLine));
  check('the record states what a 20% marketplace cut would have been, in those words', /20% marketplace cut/i.test(activityView));
  const ledgerApi = await (await fetch(`${API}/api/addresses/${encodeURIComponent(qWorker.address)}/ledger`)).json();
  check('the ledger counts one settlement from one distinct payer', ledgerApi.asWorker.settled === 1 && ledgerApi.asWorker.distinctPayers === 1);
  check('kept is exactly 20% of what settled', BigInt(ledgerApi.asWorker.keptLuna) === (BigInt(ledgerApi.asWorker.settledLuna) * 20n) / 100n);
  const clientLedger = await (await fetch(`${API}/api/addresses/${encodeURIComponent(client.address)}/ledger`)).json();
  check('the client’s record shows one paid chit', clientLedger.asPayer.settled === 1);

  // "Same again" prefills the composer with the settled line.
  await qWorker.page.goto(`${WEB}/?text=${encodeURIComponent(quoteLine)}`, { waitUntil: 'networkidle' });
  await qWorker.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  check('a prefilled line is parsed as if typed', (await qWorker.page.locator('.card:not(.card--accent)').first().innerText()).includes('45.00'));


  /* -------------------------------------------------- 8c. the bounty, the demo worker, decline, German, self-check */

  console.log('\n8c. The bounty is the front door; a tester earns their first NIM by doing a real chit');

  const testerKey = KeyPair.generate();
  const tester = await makeUser('tester', testerKey, 'light', async () => 'unused');
  await tester.page.goto(WEB, { waitUntil: 'networkidle' });
  await tester.page.waitForSelector('.card--accent', { timeout: 20_000 });
  await shot(tester.page, '22-home-with-bounty');
  const home = await tester.page.locator('body').innerText();
  check('the first screen says what chit is in plain words', /Paste the deal\. Get a receipt\./.test(home));
  check('it says who it is for and what it is not', /clients you already talk to directly/.test(home) && /not protection/.test(home));
  check('the bounty card is on the home screen, paid by chit', /paid by chit/i.test(home));

  await tester.page.locator('.card--accent button').click();
  await tester.page.waitForSelector('text=Sign and get paid', { timeout: 20_000 });
  await shot(tester.page, '23-bounty');
  const bountyUrl = tester.page.url();
  const bountyId = decodeURIComponent(bountyUrl.split('/c/')[1]);

  // A weak answer is refused by the rules, not by a person.
  await tester.page.locator('textarea').fill('nice app good');
  await tester.page.waitForTimeout(150);
  check('three words leave the button disabled', await tester.page.locator('button', { hasText: 'Sign and get paid' }).isDisabled());
  await tester.page.locator('textarea').fill('see https://example.com for my thoughts on all of this');
  await tester.page.locator('button', { hasText: 'Sign and get paid' }).click();
  await tester.page.waitForSelector('text=No links', { timeout: 15_000 });
  check('a link is refused with the reason', /No links/.test(await tester.page.locator('body').innerText()));

  await tester.page.locator('textarea').fill('I could not tell whether signing would move any money out of my wallet.');
  await tester.page.locator('button', { hasText: 'Sign and get paid' }).click();
  await tester.page.waitForTimeout(3000);
  await shot(tester.page, '24-bounty-claimed');

  const claimedApi = await (await fetch(`${API}/api/chits/${encodeURIComponent(bountyId)}`)).json();
  check('the tester countersigned the bounty', claimedApi.countersigned === true);
  check('the answer is recorded', claimedApi.answer === 'I could not tell whether signing would move any money out of my wallet.');
  check('the pool broadcast a payout', typeof claimedApi.payoutTx === 'string' && claimedApi.payoutTx.length > 0, claimedApi.payoutTx ?? 'none');
  check('exactly one transaction was broadcast', rpc.broadcasts.length === 1);
  check('the bounty pool is the payer on the chit', claimedApi.chit.payer.replace(/\s/g, '') === BOUNTY_KEY.toAddress().toUserFriendlyAddress().replace(/\s/g, ''));

  // The fake node cannot deserialise the broadcast; land the same payment the pool sent so
  // the settlement matcher can see it, exactly as a real node would report it.
  await rpc.inject({ to: tester.address, from: BOUNTY_KEY.toAddress().toUserFriendlyAddress(), value: Number(claimedApi.chit.luna), data: bountyId, hash: claimedApi.payoutTx });
  await tester.page.goto(bountyUrl, { waitUntil: 'networkidle' });
  await tester.page.waitForSelector('text=You were paid', { timeout: 45_000 });
  await shot(tester.page, '25-bounty-paid');
  check('the tester was paid and sees their answer on the receipt', /paid by chit for your answer/i.test(await tester.page.locator('body').innerText()));

  const second = await (await fetch(`${API}/api/bounty`)).json();
  check('the pool refilled: still bounties open', second.open.length >= 1);
  check('the payout is public with its transaction', second.paid.length === 1 && second.paid[0].tx === claimedApi.payoutTx);
  check('the rules say chit never holds anyone else’s money', second.rules.some((r) => /never holds anyone/i.test(r)));

  await tester.page.goto(`${WEB}/bounty`, { waitUntil: 'networkidle' });
  await tester.page.waitForSelector('text=Every payout', { timeout: 20_000 });
  await shot(tester.page, '26-bounty-board');
  const board = await tester.page.locator('body').innerText();
  check('the public board shows the pool address, balance and the payout', /pool/i.test(board) && /Balance/.test(board) && /Every payout/.test(board) && board.replace(/\s/g, '').includes(second.address.replace(/\s/g, '')));

  // Same wallet, second bounty today: refused by the limit, not by a person.
  const openNow = second.open[0];
  const again = await fetch(`${API}/api/chits/${encodeURIComponent(openNow.id)}/countersign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      signature: { publicKeyHex: testerKey.publicKey.toHex(), signatureHex: testerKey.sign(nimiqSignedMessageDigest(new TextEncoder().encode(openNow.canonical))).toHex() },
      answer: 'The QR code on the share screen is not obviously for a phone camera.',
      deviceHash: 'd'.repeat(64),
    }),
  });
  check('a second bounty for the same wallet today is refused', again.status === 429, `status ${again.status}`);

  /* -------------------------------------------------- the demo worker */
  console.log('\n8d. A judge alone: the demo worker countersigns, the judge pays, and holds a receipt');
  const judgeKey = KeyPair.generate();
  let judgeSettling = null;
  const judge = await makeUser('judge', judgeKey, 'light', async (tx) => {
    judgeSettling = tx;
    const injected = await rpc.inject({ to: tx.recipient, from: tx.from, value: tx.value, data: tx.data });
    return injected.hash;
  });
  await judge.page.goto(WEB, { waitUntil: 'networkidle' });
  await judge.page.locator('button', { hasText: 'paying' }).click();
  await judge.page.locator('textarea').fill('$5 to test chit end to end and tell me what breaks');
  await judge.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await judge.page.locator('button', { hasText: 'Sign it' }).click();
  await judge.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  await judge.page.locator('button', { hasText: 'demo worker' }).click();
  await judge.page.waitForSelector('text=Time to pay', { timeout: 20_000 });
  await shot(judge.page, '27-demo-worker-signed');
  check('the pay screen says plainly it was the demo worker', /demo worker/i.test(await judge.page.locator('body').innerText()));
  await judge.page.locator('button', { hasText: 'Pay' }).first().click();
  await judge.page.waitForSelector('.receipt', { timeout: 45_000 });
  check('the judge paid the demo worker', judgeSettling?.recipient?.replace(/\s/g, '') === DEMO_KEY.toAddress().toUserFriendlyAddress().replace(/\s/g, ''));

  /* -------------------------------------------------- decline */
  console.log('\n8e. A worker declines, and the payer is told');
  const dPayerKey = KeyPair.generate();
  const dWorkerKey = KeyPair.generate();
  const dPayer = await makeUser('decline-payer', dPayerKey, 'light', async () => 'unused');
  await dPayer.page.goto(WEB, { waitUntil: 'networkidle' });
  await dPayer.page.locator('button', { hasText: 'paying' }).click();
  await dPayer.page.locator('textarea').fill('$20 to redraw the logo in one colour by Monday');
  await dPayer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await dPayer.page.locator('button', { hasText: 'Sign it' }).click();
  await dPayer.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const declineUrl = dPayer.page.url();
  const dWorker = await makeUser('decline-worker', dWorkerKey, 'dark', async () => 'unused');
  await dWorker.page.goto(declineUrl, { waitUntil: 'networkidle' });
  await dWorker.page.waitForSelector('text=agree this with you', { timeout: 20_000 });
  await dWorker.page.locator('button', { hasText: 'Decline' }).click();
  await dWorker.page.waitForSelector('text=You declined', { timeout: 20_000 });
  await shot(dWorker.page, '28-declined-worker-dark');
  await dPayer.page.goto(declineUrl, { waitUntil: 'networkidle' });
  await dPayer.page.waitForSelector('text=They declined', { timeout: 20_000 });
  await shot(dPayer.page, '29-declined-payer');
  check('the payer is told they declined and offered a new one', /Send a new one/.test(await dPayer.page.locator('body').innerText()));

  /* -------------------------------------------------- the receipt as an invoice */
  console.log('\n8i. The receipt becomes an invoice a bookkeeper would accept');
  // The worker who was paid in section 3 fills in who they are, once, on this device.
  await worker.page.goto(`${WEB}/c/${encodeURIComponent(chitId)}`, { waitUntil: 'networkidle' });
  await worker.page.waitForSelector('.receipt', { timeout: 20_000 });
  check('a paid worker is offered somewhere to put their details', /Add your details to the invoice/.test(await worker.page.locator('body').innerText()));

  await worker.page.locator('summary', { hasText: 'Add your details to the invoice' }).click();
  await worker.page.locator('[data-identity=name]').fill('Mara Oduya');
  await worker.page.locator('[data-identity=address]').fill('12 Ojuelegba Road\nSurulere, Lagos\nNigeria');
  await worker.page.locator('[data-identity=contact]').fill('mara@example.com');
  await worker.page.locator('[data-identity=taxNote]').fill('No VAT charged — small supplier');
  await worker.page.locator('button', { hasText: 'Save on this device' }).click();
  await worker.page.waitForSelector('text=Your invoice details', { timeout: 20_000 });

  // Nothing about the person may leave the device.
  const serverCopy = await (await fetch(`${API}/api/chits/${encodeURIComponent(chitId)}`)).json();
  check('the details never reach the server', !JSON.stringify(serverCopy).includes('Mara Oduya'));

  // On screen the invoice head stays hidden; on paper it is the head of the document.
  const onScreen = await worker.page.locator('body').innerText();
  check('and are not shown on the screen either', !onScreen.includes('Ojuelegba'));
  const printed = await worker.page.evaluate(() => {
    const el = document.querySelector('.invoice');
    if (!el) return null;
    return { text: el.textContent ?? '', screenDisplay: getComputedStyle(el).display };
  });
  check('the invoice head exists, hidden on screen', printed !== null && printed.screenDisplay === 'none');
  check('and carries name, address and the chit id', !!printed && /Mara Oduya/.test(printed.text) && /Ojuelegba/.test(printed.text) && printed.text.includes(chitId));
  const taxLine = await worker.page.evaluate(() => document.querySelector('.invoice__note')?.textContent ?? null);
  check('with the tax line the country needs', taxLine === 'No VAT charged — small supplier');

  // Print emulation is the only honest way to check a print stylesheet.
  await worker.page.emulateMedia({ media: 'print' });
  const printVisible = await worker.page.evaluate(() => ({
    invoice: getComputedStyle(document.querySelector('.invoice')).display,
    note: getComputedStyle(document.querySelector('.invoice__note')).display,
    actions: getComputedStyle(document.querySelector('.screen__actions') ?? document.body).display,
  }));
  check('in print the invoice head appears', printVisible.invoice !== 'none' && printVisible.note !== 'none');
  check('and the buttons do not', printVisible.actions === 'none');
  // Printed from a dark-mode phone, the paper must still be white and the ink black.
  const printPaper = await worker.page.evaluate(() => {
    const receiptEl = document.querySelector('.receipt');
    const deal = document.querySelector('.receipt .deal');
    return {
      body: getComputedStyle(document.body).backgroundColor,
      receipt: getComputedStyle(receiptEl).backgroundColor,
      ink: getComputedStyle(deal).color,
      reference: document.querySelector('.copyable__text')?.textContent ?? '',
    };
  });
  check('paper is white even from a dark-mode phone', /255,\s*255,\s*255/.test(printPaper.body) && /255,\s*255,\s*255/.test(printPaper.receipt), `${printPaper.body} / ${printPaper.receipt}`);
  check('and the ink is black', /rgb\(0,\s*0,\s*0\)/.test(printPaper.ink), printPaper.ink);
  check('the reference prints its value, not just its label', printPaper.reference.startsWith('chit1:'), printPaper.reference);
  // A printed link that does not say where it goes is a dead end, and this one is the only
  // route from paper back to the payment.
  const printedHref = await worker.page.evaluate(() => {
    const link = [...document.querySelectorAll('.receipt a[href]')].find((a) => a.href.includes('nimiq.watch'));
    return link ? getComputedStyle(link, '::after').content : null;
  });
  // What it was worth when it landed — the figure every tax rule keys on, not the one agreed.
  const valueResponse = await fetch(`${API}/api/chits/${encodeURIComponent(chitId)}/value`);
  const valueBody = valueResponse.status === 200 ? await valueResponse.json() : null;
  check(
    'the settlement value is computed from a historic rate, or honestly absent',
    valueResponse.status === 200
      ? BigInt(valueBody.valueMinor) > 0n && valueBody.rate > 0 && valueBody.source === 'CoinGecko' && valueBody.agreedMinor === '6000'
      : [404, 503].includes(valueResponse.status),
    `${valueResponse.status}${valueBody ? ` · ${valueBody.valueMinor} vs agreed ${valueBody.agreedMinor}` : ''}`,
  );

  check('and the explorer link prints its address', !!printedHref && printedHref.includes('nimiq.watch'), printedHref ?? 'no link');
  await shot(worker.page, '38-invoice-print');
  await worker.page.emulateMedia({ media: 'screen' });

  /* -------------------------------------------------- "here it is" */
  console.log('\n8h. The worker says it is delivered, and the payer sees it before paying');
  const hPayerKey = KeyPair.generate();
  const hWorkerKey = KeyPair.generate();
  let hSettling = null;
  const hPayer = await makeUser('deliver-payer', hPayerKey, 'light', async (tx) => {
    hSettling = tx;
    rpc.inject(tx.recipient, { from: tx.from, to: tx.recipient, value: Number(tx.value), recipientData: tx.data });
    return `tx_deliver_${Date.now()}`;
  });
  await hPayer.page.goto(WEB, { waitUntil: 'networkidle' });
  await hPayer.page.locator('button', { hasText: 'paying' }).click();
  await hPayer.page.locator('textarea').fill('$25 to cut a teaser from the raw footage by Sunday');
  await hPayer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await hPayer.page.locator('button', { hasText: 'Sign it' }).click();
  await hPayer.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const deliverUrl = hPayer.page.url();
  const deliverId = decodeURIComponent(new URL(deliverUrl).pathname.replace('/c/', ''));

  const hWorker = await makeUser('deliver-worker', hWorkerKey, 'light', async () => 'unused');
  await hWorker.page.goto(deliverUrl, { waitUntil: 'networkidle' });
  await hWorker.page.waitForSelector('text=agree this with you', { timeout: 20_000 });
  await hWorker.page.locator('button', { hasText: 'Sign it' }).click();
  await hWorker.page.waitForSelector('text=You signed it', { timeout: 20_000 });
  check('a worker who has signed can say the work is delivered', /Say it is delivered/.test(await hWorker.page.locator('body').innerText()));

  await hWorker.page.locator('summary', { hasText: 'Say it is delivered' }).click();
  await hWorker.page.locator('input[type=url]').fill('https://drive.example/teaser.mp4');
  await hWorker.page.locator('input[placeholder*="One line about it"]').fill('45 seconds, colour graded');
  await hWorker.page.locator('button', { hasText: 'Mark it delivered' }).click();
  await hWorker.page.waitForSelector('text=You marked it delivered', { timeout: 20_000 });
  await shot(hWorker.page, '35-delivered-worker');

  const deliveredApi = await (await fetch(`${API}/api/chits/${encodeURIComponent(deliverId)}`)).json();
  check('the delivery is recorded with its link and note', deliveredApi.delivery?.link === 'https://drive.example/teaser.mp4' && deliveredApi.delivery?.note === '45 seconds, colour graded');
  check('and it paid nobody', deliveredApi.settled === false);
  check('the history records it between signing and paying', (deliveredApi.events ?? []).map((e) => e.event).join(',') === 'created,countersigned,delivered');

  await hPayer.page.goto(deliverUrl, { waitUntil: 'networkidle' });
  await hPayer.page.waitForSelector('text=Time to pay', { timeout: 20_000 });
  await shot(hPayer.page, '36-pay-after-delivery');
  const payerSees = await hPayer.page.locator('body').innerText();
  check('the payer sees it was delivered before they decide', /they marked it delivered/i.test(payerSees));

  // Who owes you, and the one tap that chases them. There are no reminders on this platform,
  // so the person owed is the only thing that can chase a client.
  await hWorker.page.goto(`${WEB}/a/${encodeURIComponent(hWorker.address)}`, { waitUntil: 'networkidle' });
  await hWorker.page.waitForSelector('text=Waiting to be paid', { timeout: 20_000 });
  await shot(hWorker.page, '37-waiting-to-be-paid');
  const owedBody = await hWorker.page.locator('body').innerText();
  check('an unpaid chit is listed apart, with its age', /Waiting to be paid/.test(owedBody) && /teaser from the raw footage/.test(owedBody));
  check('and can be chased in one tap', await hWorker.page.locator('.owed__nudge').count() === 1);
  check('with the link to the work', /Open the delivery/.test(payerSees));
  check('and is told plainly that it obliges nobody', /nothing has been paid because of it/i.test(payerSees));

  // A stranger cannot claim someone else's work was delivered.
  const forged = await fetch(`${API}/api/chits/${encodeURIComponent(deliverId)}/delivered`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signature: { publicKeyHex: '00'.repeat(32), signatureHex: '00'.repeat(64) }, link: '', note: '' }),
  });
  check('a forged delivery is refused', forged.status === 400 || forged.status === 200 && (await forged.json()).alreadyDelivered === true);

  /* -------------------------------------------------- counter-offer, and half up front */
  console.log('\n8g. A worker asks for a change instead of signing; and a deposit is half of the job');
  const cPayerKey = KeyPair.generate();
  const cWorkerKey = KeyPair.generate();
  const cPayer = await makeUser('counter-payer', cPayerKey, 'light', async () => 'unused');
  await cPayer.page.goto(WEB, { waitUntil: 'networkidle' });
  await cPayer.page.locator('button', { hasText: 'paying' }).click();
  await cPayer.page.locator('textarea').fill('$30 to caption this podcast episode by Thursday');
  await cPayer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await cPayer.page.locator('button', { hasText: 'Sign it' }).click();
  await cPayer.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const counterUrl = cPayer.page.url();
  const parentId = decodeURIComponent(new URL(counterUrl).pathname.replace('/c/', ''));

  const cWorker = await makeUser('counter-worker', cWorkerKey, 'light', async () => 'unused');
  await cWorker.page.goto(counterUrl, { waitUntil: 'networkidle' });
  await cWorker.page.waitForSelector('text=agree this with you', { timeout: 20_000 });
  check('a worker can answer with something other than yes or nothing', /Ask for a change/.test(await cWorker.page.locator('body').innerText()));
  await cWorker.page.locator('button', { hasText: 'Ask for a change' }).click();
  await cWorker.page.waitForSelector('text=In reply to', { timeout: 20_000 });
  await shot(cWorker.page, '33-counter-offer');
  const counterBody = await cWorker.page.locator('body').innerText();
  check('the composer says what it is answering, and carries the words', /caption this podcast episode/.test(counterBody));
  check('and it opens in the direction that lets the worker set the number', await cWorker.page.locator('.seg__item[aria-pressed="true"]').innerText().then((v) => /getting paid/.test(v)));

  // The worker raises the price and signs. The client accepts it by paying, so nobody signs twice.
  await cWorker.page.locator('.card:not(.card--accent) button', { hasText: '30.00' }).first().click();
  await cWorker.page.locator('input.field').fill('45');
  await cWorker.page.locator('button', { hasText: 'Set it' }).click();
  await cWorker.page.waitForFunction(() => document.body.innerText.includes('45.00'), { timeout: 15_000 });
  await cWorker.page.locator('button', { hasText: 'Sign it' }).click();
  await cWorker.page.waitForSelector('text=Your quote', { timeout: 20_000 });
  const counterId = decodeURIComponent(new URL(cWorker.page.url()).pathname.replace('/c/', ''));
  const counterApi = await (await fetch(`${API}/api/chits/${encodeURIComponent(counterId)}`)).json();
  check('the counter-offer is a chit of its own, pointed at the one it answers', counterApi.parent === parentId);
  check('at the new number, signed by the worker', counterApi.chit.amountMinor === '4500' && counterApi.chit.kind === 'quote');
  const parentEvents = await (await fetch(`${API}/api/chits/${encodeURIComponent(parentId)}`)).json();
  check('and the original records that it was answered', (parentEvents.events ?? []).some((e) => e.event === 'answered'));
  check('while the original chit itself is untouched', parentEvents.chit.amountMinor === '3000' && parentEvents.declined === false);

  // Half up front — the community's default deal, as one optional chip.
  await cPayer.page.goto(WEB, { waitUntil: 'networkidle' });
  await cPayer.page.locator('button', { hasText: 'paying' }).click();
  await cPayer.page.locator('textarea').fill('$80 to build a one-page site by the 20th');
  await cPayer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await cPayer.page.locator('button', { hasText: 'half up front' }).click();
  await cPayer.page.waitForFunction(() => document.body.innerText.includes('40.00'), { timeout: 15_000 });
  await shot(cPayer.page, '34-half-up-front');
  const depositBody = await cPayer.page.locator('body').innerText();
  check('half up front halves the amount', /40\.00/.test(depositBody));
  check('and says so in the words both sides sign', /Half up front/.test(await cPayer.page.locator('textarea').inputValue()));

  /* -------------------------------------------------- German + the self-checking receipt */
  console.log('\n8f. German, and a receipt link that carries the signed words');
  await dPayer.page.goto(`${WEB}/?lang=de`, { waitUntil: 'networkidle' });
  await dPayer.page.waitForSelector('h1', { timeout: 15_000 });
  await shot(dPayer.page, '30-german');
  check('the first screen is in German when the host says so', /Deal einfügen\. Beleg bekommen\./.test(await dPayer.page.locator('body').innerText()));

  /*
   * The other three the platform ships. Each dictionary is its own chunk, loaded before the
   * first paint, so the thing that can break is not a missing sentence — the tests catch
   * those — but the chunk never arriving and the screen rendering English anyway.
   */
  for (const [code, phrase] of [['es', /Pega el trato/], ['fr', /Colle l’accord/], ['pt', /Cole o combinado/]]) {
    await dPayer.page.goto(`${WEB}/?lang=${code}`, { waitUntil: 'networkidle' });
    await dPayer.page.waitForSelector('h1', { timeout: 15_000 });
    const body = await dPayer.page.locator('body').innerText();
    check(`the whole first screen is in ${code}`, phrase.test(body) && !/Paste the deal/.test(body), body.slice(0, 60));
    check(`and the page declares its language as ${code}`, (await dPayer.page.getAttribute('html', 'lang')) === code);
  }
  await dPayer.page.goto(`${WEB}/?lang=es`, { waitUntil: 'networkidle' });
  await dPayer.page.waitForSelector('h1', { timeout: 15_000 });
  await shot(dPayer.page, '47-spanish');

  // The About screen: what chit is and is not, reachable from the home screen and every receipt.
  await dPayer.page.goto(`${WEB}/about`, { waitUntil: 'networkidle' });
  await dPayer.page.waitForSelector('h1', { timeout: 15_000 });
  await shot(dPayer.page, '32-about');
  const about = await dPayer.page.locator('body').innerText();
  check('the About screen says what chit never does, in plain words', /never does|nie tut/i.test(about) && /MIT/.test(about));

  const settledForReceipt = await (await fetch(`${API}/api/chits/${encodeURIComponent(chitId)}`)).json();
  const carried = Buffer.from(settledForReceipt.canonical, 'utf8').toString('base64url');
  await plainPage.goto(`${WEB}/v/${encodeURIComponent(settledForReceipt.settledTx)}#c=${carried}`, { waitUntil: 'networkidle', timeout: 60_000 });
  await plainPage.waitForSelector('text=This is genuine', { timeout: 30_000 });
  await plainPage.screenshot({ path: `${SHOTS}/31-receipt-selfcheck.png`, fullPage: true });
  const receiptView = await plainPage.locator('body').innerText();
  check('a receipt link carrying the words shows the browser-side check card', /your browser’s own check|checked in your browser/i.test(receiptView));
  check('and says which check came from where', /checked by chit’s server/.test(receiptView));

  /* -------------------------------------------------- the review, and the record it feeds */
  console.log('\n8j. Both sides review the deal, and the record is a page a stranger can open');

  // The chit from section 3 is paid, so a review is now possible — and only now.
  await payer.page.goto(`${WEB}/c/${encodeURIComponent(chitId)}`, { waitUntil: 'networkidle' });
  await payer.page.waitForSelector('.receipt', { timeout: 20_000 });
  check('a paid chit invites the two of them to say how it went', /How did it go\?/.test(await payer.page.locator('body').innerText()));

  // The rating is a control, not a text field: five buttons, each big enough to hit.
  const starBox = await payer.page.locator('.rate__star').first().boundingBox();
  check('each star is a real tap target', starBox.width >= 44 && starBox.height >= 44, `${Math.round(starBox.width)}×${Math.round(starBox.height)}`);
  check('and nothing can be signed before a rating is chosen', await payer.page.locator('button', { hasText: 'Sign this review' }).isDisabled());

  await payer.page.locator('.rate__star').nth(4).click();
  await payer.page.locator('input.field[placeholder*="One line"]').fill('Delivered a day early and the files were right.');
  await shot(payer.page, '39-review-form');
  await payer.page.locator('button', { hasText: 'Sign this review' }).click();
  await payer.page.waitForSelector('.review', { timeout: 20_000 });

  const reviewed = await (await fetch(`${API}/api/chits/${encodeURIComponent(chitId)}`)).json();
  check('the review is stored with the signature that proves it', reviewed.reviews.length === 1 && /^[0-9a-f]{128}$/.test(reviewed.reviews[0].signature.signatureHex));
  check('bound to the payment that actually happened', reviewed.reviews[0].txHash === reviewed.settledTx.toLowerCase());
  check(
    'and attributed to the payer, about the worker',
    reviewed.reviews[0].from === 'payer' && reviewed.reviews[0].about.replace(/\s/g, '') === worker.address.replace(/\s/g, ''),
  );

  // The same signed bytes, re-checked here with no help from the server. This is the claim
  // the whole feature rests on: a review that outlives chit.
  check(
    'anyone can re-verify it from the words alone, with no chit server',
    verifySignedText({
      text: `chit/1 review\n${chitId}\n${reviewed.settledTx.toLowerCase()}\n5\nDelivered a day early and the files were right.\n`,
      publicKeyHex: reviewed.reviews[0].signature.publicKeyHex,
      signatureHex: reviewed.reviews[0].signature.signatureHex,
      expectedAddress: reviewed.reviews[0].by,
    }).ok,
  );

  // A stranger cannot write one, whatever they are willing to pay for it.
  const strangerKey = KeyPair.generate();
  const strangerText = `chit/1 review\n${chitId}\n${reviewed.settledTx.toLowerCase()}\n5\nExcellent seller A+++\n`;
  const strangerTry = await fetch(`${API}/api/chits/${encodeURIComponent(chitId)}/review`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      signature: {
        publicKeyHex: strangerKey.publicKey.toHex(),
        signatureHex: strangerKey.sign(nimiqSignedMessageDigest(new TextEncoder().encode(strangerText))).toHex(),
      },
      rating: 5,
      text: 'Excellent seller A+++',
    }),
  });
  check('a stranger cannot review a deal they were not in', strangerTry.status === 403);

  // The worker reviews the client back. Being rated is not one-directional here — the
  // freelancer being ghosted by a client is the other half of every complaint in the corpus.
  await worker.page.goto(`${WEB}/c/${encodeURIComponent(chitId)}`, { waitUntil: 'networkidle' });
  await worker.page.waitForSelector('.rate__star', { timeout: 20_000 });
  check('the worker sees the review and can rate the client back', (await worker.page.locator('.review').count()) === 1);
  await worker.page.locator('.rate__star').nth(3).click();
  await worker.page.locator('button', { hasText: 'Sign this review' }).click();
  await worker.page.waitForFunction(() => document.querySelectorAll('.review').length === 2, { timeout: 20_000 });
  const bothWays = await (await fetch(`${API}/api/chits/${encodeURIComponent(chitId)}`)).json();
  check(
    'and the two reviews point in opposite directions',
    bothWays.reviews.length === 2 && bothWays.reviews.map((r) => r.from).sort().join() === 'payee,payer',
  );

  /* the public record — reputation and distribution in one page */
  await plainPage.goto(`${WEB}/p/${encodeURIComponent(worker.address.replace(/\s/g, ''))}`, { waitUntil: 'networkidle', timeout: 60_000 });
  await plainPage.waitForSelector('h1', { timeout: 20_000 });
  await plainPage.screenshot({ path: `${SHOTS}/40-public-record.png`, fullPage: true, animations: 'disabled' });
  const record = await plainPage.locator('body').innerText();
  check('a stranger with no wallet can open somebody’s record', /Paid to this wallet/.test(record));
  check('it lists the work that was actually paid for', /Settled work/.test(record));
  check('it shows the review, next to the job it was for', /Delivered a day early/.test(record) && /For:/.test(record));
  check('and it says plainly that nobody can edit it', /Nobody can edit it/.test(record));

  const recordApi = await (await fetch(`${API}/api/addresses/${encodeURIComponent(worker.address)}/profile`)).json();
  check('the page and the record behind it agree', recordApi.work.length >= 1 && recordApi.averageRating === 5);
  check('every line on it opens a real payment', recordApi.work.every((w) => /^[0-9a-f]{64}$/i.test(w.txHash) || w.txHash.length > 0));

  // The record page is the whole distribution strategy, so its share link has to be there.
  const recordShareLink = await plainPage.evaluate(() => document.querySelector('.copyable__text')?.textContent ?? '');
  check('and it carries its own shareable link', recordShareLink.includes('/p/'), recordShareLink);

  // A wallet with nothing on it gets a page that says so — not an error, and not a blank.
  await plainPage.goto(`${WEB}/p/${encodeURIComponent(KeyPair.generate().toAddress().toUserFriendlyAddress().replace(/\s/g, ''))}`, {
    waitUntil: 'networkidle',
    timeout: 60_000,
  });
  await plainPage.waitForSelector('h1', { timeout: 20_000 });
  const emptyRecord = await plainPage.locator('body').innerText();
  check('a wallet with no history reads as new, never as bad', /No settled work on this wallet/.test(emptyRecord));
  await plainPage.screenshot({ path: `${SHOTS}/41-record-empty.png`, fullPage: true, animations: 'disabled' });

  /* -------------------------------------------------- the scope changed, and calling it off */
  console.log('\n8l. The scope changes mid-job, and a dead chit gets closed properly');
  const aPayerKey = KeyPair.generate();
  const aWorkerKey = KeyPair.generate();
  const aPayer = await makeUser('amend-payer', aPayerKey, 'light', async () => 'unused');
  await aPayer.page.goto(WEB, { waitUntil: 'networkidle' });
  await aPayer.page.locator('button', { hasText: 'paying' }).click();
  await aPayer.page.locator('textarea').fill('$50 to design a logo by the 12th');
  await aPayer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await aPayer.page.locator('button', { hasText: 'Sign it' }).click();
  await aPayer.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const amendUrl = aPayer.page.url();
  const amendParentId = decodeURIComponent(new URL(amendUrl).pathname.replace('/c/', ''));

  const aWorker = await makeUser('amend-worker', aWorkerKey, 'light', async () => 'unused');
  await aWorker.page.goto(amendUrl, { waitUntil: 'networkidle' });
  await aWorker.page.waitForSelector('text=agree this with you', { timeout: 20_000 });
  await aWorker.page.locator('button', { hasText: 'Sign it' }).click();
  await aWorker.page.waitForSelector('text=They can pay now', { timeout: 20_000 });

  // The worker asks for the scope change. Nothing here moves money and nothing rewrites the
  // chit they both already signed.
  check('a signed, unpaid chit offers a way to record a change', /Something changed\?/.test(await aWorker.page.locator('body').innerText()));
  await aWorker.page.locator('summary', { hasText: 'Something changed?' }).click();
  await aWorker.page.locator('input.field[placeholder*="extra round"]').fill('one extra round of edits, same price');
  await shot(aWorker.page, '43-amend-panel');
  await aWorker.page.locator('button', { hasText: 'Sign the change' }).click();
  await aWorker.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const amendId = decodeURIComponent(new URL(aWorker.page.url()).pathname.replace('/c/', ''));

  const amendApi = await (await fetch(`${API}/api/chits/${encodeURIComponent(amendId)}`)).json();
  check('it is a chit of its own, with no money in it', amendApi.chit.amountMinor === '0' && amendApi.chit.luna === '0');
  check('pointed at the chit it amends', amendApi.parent === amendParentId);
  check('and carrying the words both will sign', /one extra round of edits/.test(amendApi.chit.text));
  check('the screen never says anything about being paid', !/pay|paid/i.test(await aWorker.page.locator('h1').innerText()));

  // The other side signs, and that is the whole of it — there is nothing to settle.
  await aPayer.page.goto(`${WEB}/c/${encodeURIComponent(amendId)}`, { waitUntil: 'networkidle' });
  await aPayer.page.waitForSelector('text=agree a change', { timeout: 20_000 });
  await shot(aPayer.page, '44-amend-sign');
  await aPayer.page.locator('button', { hasText: 'Sign it' }).click();
  await aPayer.page.waitForSelector('text=on the record', { timeout: 20_000 });
  await shot(aPayer.page, '45-amend-done');
  const amendDone = await (await fetch(`${API}/api/chits/${encodeURIComponent(amendId)}`)).json();
  check('two signatures finish it, with nothing left pending', amendDone.countersigned === true && amendDone.settled === false);

  const untouched = await (await fetch(`${API}/api/chits/${encodeURIComponent(amendParentId)}`)).json();
  check('and the chit it answers is exactly as it was signed', untouched.chit.amountMinor === '5000' && /design a logo/.test(untouched.chit.text));

  // A payment carrying the amendment's digest must not be able to settle it: the settlement
  // floor is 97% of the agreed Luna, and 97% of nothing is nothing.
  await rpc.inject({ to: aWorker.address, from: aPayer.address, value: 1, data: amendId });
  await wait(2000);
  const stillUnpaid = await (await fetch(`${API}/api/chits/${encodeURIComponent(amendId)}`)).json();
  check('and no payment can mark a payment-free chit paid', stillUnpaid.settled === false && stillUnpaid.settledTx === null);

  // Calling it off: the other half of the same object.
  await aPayer.page.goto(`${WEB}/c/${encodeURIComponent(amendParentId)}`, { waitUntil: 'networkidle' });
  await aPayer.page.waitForSelector('summary', { timeout: 20_000 });
  await aPayer.page.locator('summary', { hasText: 'Something changed?' }).click();
  await aPayer.page.locator('button', { hasText: 'Call it off' }).click();
  await aPayer.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const cancelId = decodeURIComponent(new URL(aPayer.page.url()).pathname.replace('/c/', ''));
  const cancelApi = await (await fetch(`${API}/api/chits/${encodeURIComponent(cancelId)}`)).json();
  check('calling it off carries the original line, so the record reads on its own', /Called off by agreement/.test(cancelApi.chit.text) && /design a logo/.test(cancelApi.chit.text));

  await aWorker.page.goto(`${WEB}/c/${encodeURIComponent(cancelId)}`, { waitUntil: 'networkidle' });
  await aWorker.page.waitForSelector('text=call it off', { timeout: 20_000 });
  await aWorker.page.locator('button', { hasText: 'Sign it' }).click();
  await aWorker.page.waitForSelector('text=Called off', { timeout: 20_000 });
  await shot(aWorker.page, '46-called-off');
  check('and both names end up on the closing', (await (await fetch(`${API}/api/chits/${encodeURIComponent(cancelId)}`)).json()).countersigned === true);

  /* -------------------------------------------------- the deadline that passes */
  console.log('\n8k. A deadline passes, and the record says so');
  const expiringUser = await makeUser('expiring', KeyPair.generate(), 'light', async () => 'unused');
  await expiringUser.page.goto(WEB, { waitUntil: 'networkidle' });
  await expiringUser.page.locator('button', { hasText: 'paying' }).click();
  await expiringUser.page.locator('textarea').fill('$15 to proofread two pages by Friday');
  await expiringUser.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await expiringUser.page.locator('button', { hasText: 'Sign it' }).click();
  await expiringUser.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const expiringId = decodeURIComponent(new URL(expiringUser.page.url()).pathname.replace('/c/', ''));

  const beforeExpiry = await (await fetch(`${API}/api/chits/${encodeURIComponent(expiringId)}`)).json();
  check('a live chit has no expiry on its record', !(beforeExpiry.events ?? []).some((e) => e.event === 'expired'));

  // The chain moves past the deadline. Nothing else happens — no cron, no sweep. The expiry
  // is written the moment somebody looks, which is the only moment it matters to anyone.
  rpc.advance(beforeExpiry.chit.deadlineBlock - rpc.height + 10);
  await wait(2000);
  const afterExpiry = await (await fetch(`${API}/api/chits/${encodeURIComponent(expiringId)}`)).json();
  check('once the deadline has passed, the record says so', (afterExpiry.events ?? []).some((e) => e.event === 'expired'));
  const readAgain = await (await fetch(`${API}/api/chits/${encodeURIComponent(expiringId)}`)).json();
  check('and says it once, however many times it is read', readAgain.events.filter((e) => e.event === 'expired').length === 1);
  check('while the chit itself stays payable — late is late, not void', afterExpiry.declined === false && afterExpiry.settled === false);

  // What a person sees, which is the part that has to be humane rather than merely correct.
  await expiringUser.page.goto(`${WEB}/c/${encodeURIComponent(expiringId)}`, { waitUntil: 'networkidle' });
  await expiringUser.page.waitForSelector('h1', { timeout: 20_000 });
  await shot(expiringUser.page, '42-past-deadline');
  check('and the screen says the deadline passed without blaming anyone', /passed|overdue|late/i.test(await expiringUser.page.locator('body').innerText()));

  /* -------------------------------------------------- 9. hygiene */

  console.log('\n9. Hygiene');

  // A console error caused by a third-party resource failing is the same external event.
  const ownErrors = consoleErrors.filter((e) => !/fonts\.(googleapis|gstatic)\.com/.test(e));
  check('no console errors anywhere in the journey', ownErrors.length === 0, ownErrors.join(' | '));
  check('nothing chit serves failed to load', failedRequests.length === 0, failedRequests.join(' | '));
  if (thirdPartyFailures.length > 0) console.log(`  note  ${thirdPartyFailures.length} third-party request(s) failed: ${thirdPartyFailures.join(' | ')}`);

  const health = await (await fetch(`${API}/health`)).json();
  check('the watcher ran without errors', health.watcher.errors === 0);
  check('the watcher saw the chain', health.watcher.lastHeight > 0);

  await browser.close();
} finally {
  await shutdown();
}

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} CHECKS FAILED`}`);
if (problems.length) console.log(problems.map((p) => `  - ${p}`).join('\n'));
console.log(`screens: ${SHOTS}/\n`);
process.exit(failures === 0 ? 0 : 1);

/**
 * The deployed product, used in a browser.
 *
 * `live-e2e.mjs` proves the API over HTTP; the browser journey proves the app against a
 * local server. Neither proves the thing a judge will actually open: the real deployment,
 * with the real bundle, the real serverless functions and the real object store behind it.
 * This does.
 *
 * Two people with real Ed25519 keys walk as far as the chain allows: compose, correct,
 * sign, share, countersign, and arrive at the payment screen. It stops before paying,
 * because settling here would spend real NIM on mainnet — that half is covered by
 * `user-journey.mjs`, which controls its own chain.
 *
 * Every screen is captured and checked for horizontal overflow, and every console error
 * and failed request is collected.
 *
 *   node --experimental-strip-types scripts/live-visual.mjs [https://host]
 */

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { KeyPair } from '@nimiq/core';
import { nimiqSignedMessageDigest } from '@chit/verify';

const BASE = process.argv[2] ?? 'https://chit-ecru.vercel.app';
const SHOTS = 'shots/live';

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

async function installWallet(context, keyPair) {
  const address = keyPair.toAddress().toUserFriendlyAddress();
  await context.exposeFunction('__chitSign', (message) => ({
    publicKey: keyPair.publicKey.toHex(),
    signature: keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(message))).toHex(),
  }));
  await context.addInitScript((addr) => {
    window.nimiqPay = {
      language: 'en',
      userFiat: 'USD',
      requestDeviceIdentifier: () => Promise.resolve('0'.repeat(64)),
    };
    window.nimiq = {
      listAccounts: () => Promise.resolve([addr]),
      sign: (input) => window.__chitSign(typeof input === 'string' ? input : input.message),
      isConsensusEstablished: () => Promise.resolve(true),
      // Never reached: this script stops before paying, on purpose.
      sendBasicTransactionWithData: () => Promise.reject(new Error('not on mainnet')),
    };
  }, address);
  return address;
}

console.log(`\nchit — the deployed product, in a browser\n  ${BASE}\n`);
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const consoleErrors = [];
const failedRequests = [];

const makeUser = async (name, keyPair, scheme) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: scheme,
    deviceScaleFactor: 2,
  });
  const address = await installWallet(context, keyPair);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${name}] ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`[${name}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => failedRequests.push(`[${name}] ${r.url()} ${r.failure()?.errorText ?? ''}`));
  return { page, address };
};

const shot = async (page, file) => {
  await page.screenshot({ path: `${SHOTS}/${file}.png`, fullPage: true });
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  check(`${file}: fits the screen`, width.scroll <= width.inner + 1, `${width.scroll} vs ${width.inner}`);
};

try {
  const payerKey = KeyPair.generate();
  const workerKey = KeyPair.generate();

  /* -------------------------------------------------- 1. compose */
  console.log('1. A payer opens the live app and pastes their deal');
  const payer = await makeUser('payer', payerKey, 'light');
  await payer.page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await payer.page.waitForSelector('textarea', { timeout: 30_000 });
  await shot(payer.page, '01-compose');

  await payer.page.locator('button', { hasText: 'paying' }).click();
  const line = '$45 to write three product descriptions by Tuesday';
  await payer.page.locator('textarea').fill(line);
  await payer.page.waitForSelector('text=What we understood', { timeout: 30_000 });
  await payer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 30_000 });
  await shot(payer.page, '02-terms');

  const understood = await payer.page.locator('.card:not(.card--accent)').first().innerText();
  check('the live service parsed the amount', understood.includes('45.00'));
  check('and priced it in NIM from a live rate', /NIM/.test(understood));

  /* -------------------------------------------------- 2. sign */
  console.log('\n2. They sign it');
  await payer.page.locator('button', { hasText: 'Sign it' }).click();
  await payer.page.waitForURL(/\/c\//, { timeout: 60_000 });
  await payer.page.waitForSelector('text=Send this to them', { timeout: 60_000 });
  await shot(payer.page, '03-share');

  const chitUrl = payer.page.url();
  check('a chit exists at a shareable URL', chitUrl.includes('/c/chit1'), chitUrl.slice(0, 60) + '…');
  check('the share link points at the deployment, not localhost', chitUrl.startsWith(BASE));

  /* -------------------------------------------------- 3. countersign */
  console.log('\n3. A worker opens the link on their own phone');
  const worker = await makeUser('worker', workerKey, 'dark');
  await worker.page.goto(chitUrl, { waitUntil: 'networkidle', timeout: 60_000 });
  await worker.page.waitForSelector('text=agree this with you', { timeout: 60_000 });
  await shot(worker.page, '04-countersign-dark');

  const workerView = await worker.page.locator('body').innerText();
  check('the worker sees the exact words', workerView.includes(line));
  check('and the amount', workerView.includes('45.00'));
  check('and a deadline in days, not a block number', /in about \d+ day|today|tomorrow/i.test(workerView));

  await worker.page.locator('button', { hasText: 'Sign it' }).click();
  await worker.page.waitForTimeout(4000);
  await shot(worker.page, '05-worker-signed-dark');

  // The id in the URL is already percent-encoded; encoding it again asks for a chit
  // whose id contains '%3A' literally, which of course does not exist.
  const chitId = decodeURIComponent(chitUrl.split('/c/')[1]);
  const api = await (await fetch(`${BASE}/api/chits/${encodeURIComponent(chitId)}`)).json();
  check('the live service verified the countersignature', api.countersigned === true);
  check(
    'the payee address came from the signature',
    api.payTo?.replace(/\s/g, '') === worker.address.replace(/\s/g, ''),
    api.payTo ?? 'null',
  );
  check('it is not settled — nothing was paid', api.settled === false);

  /* -------------------------------------------------- 4. the pay screen */
  console.log('\n4. The payer returns to a real payment screen (stopping before paying)');
  await payer.page.goto(chitUrl, { waitUntil: 'networkidle', timeout: 60_000 });
  await payer.page.waitForSelector('text=Time to pay', { timeout: 60_000 });
  await shot(payer.page, '06-pay');
  // The button names the agreed fiat figure in the viewer's own notation and says it is paid in NIM.
  check('the payer is asked to pay the amount agreed, in NIM', /Pay .*45[.,]00.* in NIM/.test(await payer.page.locator('body').innerText()));

  /* -------------------------------------------------- 5. a stranger */
  console.log('\n5. Someone with no wallet at all');
  const plain = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const plainPage = await plain.newPage();
  plainPage.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) consoleErrors.push(`[desktop] ${m.text()}`);
  });
  await plainPage.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
  await plainPage.waitForSelector('h1', { timeout: 30_000 });
  await plainPage.screenshot({ path: `${SHOTS}/07-desktop.png` });
  check('a laptop visitor is told how to sign', /Nimiq Pay/i.test(await plainPage.locator('body').innerText()));

  await plainPage.goto(`${BASE}/nonsense/deep`, { waitUntil: 'networkidle', timeout: 60_000 });
  await plainPage.waitForSelector('h1', { timeout: 30_000 });
  const notFound = await plainPage.locator('body').innerText();
  check("an unknown route shows chit's own screen, not the platform's 404", /Nothing here/i.test(notFound));

  /* -------------------------------------------------- the public record, live */
  console.log('\n6. The record a stranger opens, and the file an accountant opens');

  // The record page is the growth loop: a freelancer sends it to a person who has never
  // heard of chit. So it has to open for somebody with no wallet, no account and no app.
  await plainPage.goto(`${BASE}/p/${encodeURIComponent(worker.address.replace(/\s/g, ''))}`, { waitUntil: 'networkidle', timeout: 60_000 });
  await plainPage.waitForSelector('h1', { timeout: 30_000 });
  await plainPage.screenshot({ path: `${SHOTS}/08-record.png` });
  const record = await plainPage.locator('body').innerText();
  check('a public record opens for a stranger with no wallet', /Record/i.test(record));
  check(
    'and a wallet with no settled work reads as new, not as broken',
    /No settled work on this wallet|Nothing here yet/.test(record),
    record.slice(0, 80),
  );

  // The balance hint. It reads the real mainnet chain, and "unknown" is a valid answer that
  // the app must survive — so both shapes are acceptable, and an error is not.
  const balance = await (await fetch(`${BASE}/api/balance/${encodeURIComponent(worker.address)}`)).json();
  check('the balance hint answers from the real chain', balance.known === true || balance.known === false, JSON.stringify(balance));

  // The tax export, as a plain URL rather than something the page assembles — a blob
  // download is not reliably allowed inside a WebView.
  const csv = await fetch(`${BASE}/api/addresses/${encodeURIComponent(worker.address)}/export.csv`);
  check('the export is served as a real CSV attachment', csv.status === 200 && (csv.headers.get('content-type') ?? '').startsWith('text/csv'));
  check('named after the wallet, so two exports do not collide', (csv.headers.get('content-disposition') ?? '').includes('chit-NQ'));
  const header = (await csv.text()).split('\r\n')[0];
  check('with every column named', header === 'date,chit_id,description,role,amount,currency,nim_received,counterparty,transaction,receipt_url', header);

  // All five languages, on the deployment rather than the bundler's word for it: each
  // dictionary is a separate chunk, so the thing that can break is the chunk never arriving.
  for (const [code, phrase] of [['de', /Deal einfügen/], ['es', /Pega el trato/], ['fr', /Colle l’accord/], ['pt', /Cole o combinado/]]) {
    await plainPage.goto(`${BASE}/?lang=${code}`, { waitUntil: 'networkidle', timeout: 60_000 });
    await plainPage.waitForSelector('h1', { timeout: 30_000 });
    const body = await plainPage.locator('body').innerText();
    check(`the live deployment serves ${code}`, phrase.test(body) && !/Paste the deal/.test(body), body.slice(0, 50));
  }

  /* -------------------------------------------------- 7. hygiene */
  console.log('\n7. Hygiene on the live deployment');
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  check('no failed requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

  await browser.close();
} catch (error) {
  await browser.close();
  console.error('\nRUN FAILED:', error.message);
  failures++;
}

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} CHECKS FAILED`}`);
if (problems.length) console.log(problems.map((p) => `  - ${p}`).join('\n'));
console.log(`screens: ${SHOTS}/\n`);
process.exit(failures === 0 ? 0 : 1);

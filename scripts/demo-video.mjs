/**
 * A real, scripted demo video — not a screen recording of a human, a Playwright run of the
 * actual product, so every frame is provably the real app rather than a take that happened
 * to go well. Same principle the rest of this repo's proof already follows: script the parts
 * that are the evidence.
 *
 * One browser context, one persona, using the labelled demo worker so a single continuous
 * recording can show the whole loop — paste, sign, pay, receipt — without needing to cut
 * between two people's screens. What is real: the app bundle, the API, SQLite, the
 * settlement watcher, a genuine Ed25519 signature, and a real (if synthetic) settlement.
 * What is substituted: the chain's contents, exactly as in scripts/user-journey.mjs, and the
 * second signature, which is chit's own documented stand-in for a solo walkthrough.
 *
 *   node --experimental-strip-types scripts/demo-video.mjs
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { KeyPair } from '@nimiq/core';
import { canonicalise, newNonce } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';
import { startFakeRpc } from './fake-nimiq-rpc.mjs';

const DEMO_KEY = KeyPair.generate();
const RPC_PORT = 8669;
const API_PORT = 8793;
const WEB_PORT = 4182;
const WEB = `http://localhost:${WEB_PORT}`;
const API = `http://localhost:${API_PORT}`;
const DB = './.demo-video.db';
const OUT_DIR = 'shots/demo-video';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function installWallet(context, keyPair, onPay) {
  const address = keyPair.toAddress().toUserFriendlyAddress();
  await context.exposeFunction('__chitSign', (message) => ({
    publicKey: keyPair.publicKey.toHex(),
    signature: keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(message))).toHex(),
  }));
  await context.exposeFunction('__chitPay', async (tx) => onPay({ ...tx, from: address }));
  await context.addInitScript(
    ({ address: addr, height }) => {
      window.nimiqPay = { language: 'en', userFiat: 'USD', requestDeviceIdentifier: () => Promise.resolve('0'.repeat(64)) };
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

rmSync(DB, { force: true });
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const rpc = await startFakeRpc({ port: RPC_PORT });
const api = spawn(process.execPath, ['--experimental-strip-types', 'apps/api/src/server.ts'], {
  env: {
    ...process.env,
    CHIT_CHAIN: 'test',
    CHIT_RPC_URL: rpc.url,
    CHIT_DB: DB,
    PORT: String(API_PORT),
    CHIT_BASE_URL: WEB,
    CHIT_WATCH_INTERVAL_MS: '500',
    CHIT_RATE_LIMIT_PER_MINUTE: '0',
    CHIT_DEMO_KEY: DEMO_KEY.privateKey.toHex(),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
api.stderr.on('data', (d) => {
  const line = String(d);
  if (!/ExperimentalWarning|trace-warnings/.test(line)) process.stderr.write(`  [api] ${line}`);
});

const web = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(WEB_PORT), '--strictPort'], {
  cwd: 'apps/web',
  env: { ...process.env, CHIT_API_URL: API },
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});

const shutdown = async () => {
  api.kill();
  web.kill();
  await rpc.stop();
};

function sign(keyPair, text) {
  return { publicKeyHex: keyPair.publicKey.toHex(), signatureHex: keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(text))).toHex() };
}

/** A few other people's open work, so the board is not empty the first time it is shown. */
async function seedBoard() {
  const listings = [
    { kind: 'race', text: '$120 to design a five-page landing page, source files included', amountMinor: 12000n },
    { kind: 'race', text: '€45 to translate a 900-word product page into German', amountMinor: 4500n },
    { kind: 'quote', text: '$35 for a 60-second logo animation, two revisions included', amountMinor: 3500n },
  ];
  for (const listing of listings) {
    const key = KeyPair.generate();
    const address = key.toAddress().toUserFriendlyAddress();
    const chit = {
      chain: 'test',
      kind: listing.kind,
      nonce: newNonce(),
      text: listing.text,
      amountMinor: listing.amountMinor,
      currency: listing.text.startsWith('€') ? 'EUR' : 'USD',
      luna: 100_000_000n,
      rateBlock: 4_100_000,
      deadlineBlock: 4_100_000 + 3 * 86_400,
      payer: listing.kind === 'race' ? address : '',
      payee: listing.kind === 'quote' ? address : '',
      deliverables: 1,
    };
    const canonical = canonicalise(chit);
    await fetch(`${API}/api/chits`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ canonical, payerSignature: sign(key, canonical) }),
    });
  }
}

try {
  await waitForHttp(`${API}/health`);
  await waitForHttp(WEB);
  console.log(`api ${API}\napp ${WEB}\n`);
  await seedBoard();

  const payerKey = KeyPair.generate();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT_DIR, size: { width: 390, height: 844 } },
  });
  await installWallet(context, payerKey, async (tx) => {
    const injected = await rpc.inject({ to: tx.recipient, from: tx.from, value: tx.value, data: tx.data });
    return injected.hash;
  });
  const page = await context.newPage();

  console.log('1. Home');
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await wait(1800);

  console.log('2. Paste the deal already agreed elsewhere');
  await page.locator('button', { hasText: 'paying' }).click();
  await wait(600);
  const line = '$60 to cut a 30-second vertical from this footage by Friday';
  await page.locator('textarea').pressSequentially(line, { delay: 28 });
  await page.waitForSelector('text=What we understood', { timeout: 15_000 });
  await page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await wait(2200);

  console.log('3. Sign it');
  await page.locator('button', { hasText: 'Sign it' }).click();
  await page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  await wait(2000);

  console.log('4. Walk both sides alone, with the labelled demo worker');
  await page.locator('button', { hasText: 'Try the demo worker' }).click();
  await page.waitForURL(/\/c\//, { timeout: 20_000 });
  await page.waitForSelector('text=Time to pay', { timeout: 20_000 });
  await wait(1800);

  console.log('5. Pay');
  await page.locator('button', { hasText: 'Pay' }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Settled on chain'), { timeout: 30_000 });
  await wait(2600);

  console.log('6. The board — how a stranger finds work');
  await page.goto(`${WEB}/board`, { waitUntil: 'networkidle' });
  await wait(2200);

  console.log('7. The public record — computed, never written');
  await page.goto(`${WEB}/p/${encodeURIComponent(payerKey.toAddress().toUserFriendlyAddress().replace(/\s/g, ''))}`, { waitUntil: 'networkidle' });
  await wait(2400);

  await context.close();
  await browser.close();

  const [video] = readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm'));
  if (video) {
    renameSync(join(OUT_DIR, video), join(OUT_DIR, 'chit-demo.webm'));
    console.log(`\nWrote ${OUT_DIR}/chit-demo.webm`);
  } else {
    console.log('\nNo video file was produced — recordVideo may not be supported in this environment.');
  }
} finally {
  await shutdown();
}

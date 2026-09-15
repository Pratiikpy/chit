/**
 * A real, scripted demo video — not a screen recording of a human, a Playwright run of the
 * actual product, so every frame is provably the real app rather than a take that happened
 * to go well. Same principle the rest of this repo's proof already follows: script the parts
 * that are the evidence.
 *
 * Two passes:
 *
 *  1. **Seeding** (headless, silent, not recorded). Several other wallets drive the real UI —
 *     the same technique `scripts/user-journey.mjs` already proves works — to produce real
 *     history before the camera ever opens: a declined offer, a delivery with a revision
 *     requested against it, and a settled, reviewed, showcased job. Every one of those is a
 *     real signed object the recorded persona can later visit and show, not a mock.
 *  2. **Recording** (one continuous browser context, human-shaped motion). The main persona
 *     lives the whole loop — paste, sign, pay, receipt — and then visits the seeded history to
 *     show the rest of the platform: decline, delivery, revision, counter-offer, reputation,
 *     showcase, the board, the bounty, and the public verify page. A short second pass adds a
 *     non-English locale glimpse, then the two are concatenated before the 4K composite.
 *
 * What is real: the app bundle, the API, SQLite, the settlement watcher, genuine Ed25519
 * signatures, and real (if synthetic) settlements. What is substituted: the chain's contents,
 * exactly as in scripts/user-journey.mjs, and the second signature on the main persona's own
 * deal, which is chit's own documented stand-in for a solo walkthrough (the demo worker).
 *
 * Records natively at chit's own mobile shape (390×844, deviceScaleFactor 1 — Playwright's
 * recordVideo ignores deviceScaleFactor and CSS zoom, so any other combination either blurs
 * the capture or letterboxes it into a corner of the frame). The raw capture is scaled up to a
 * real 4K canvas separately, from the shell, with `scripts/compose-4k.sh`.
 *
 *   node --experimental-strip-types scripts/demo-video.mjs
 */

import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { KeyPair } from '@nimiq/core';
import { canonicalise, newNonce } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';
import { startFakeRpc } from './fake-nimiq-rpc.mjs';

const RPC_PORT = 8669;
const API_PORT = 8793;
const WEB_PORT = 4182;
const WEB = `http://localhost:${WEB_PORT}`;
const API = `http://localhost:${API_PORT}`;
const DB = './.demo-video.db';
const OUT_DIR = 'shots/demo-video';
const VIEWPORT = { width: 390, height: 844 };
const HEIGHT = 4_100_000;

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

/** Every persona shares one wallet shape: a keypair the app can sign with and, for payers, a
 *  way to settle a payment onto the fake chain. */
async function installWallet(context, keyPair, { onPay, language = 'en' } = {}) {
  const address = keyPair.toAddress().toUserFriendlyAddress();
  await context.exposeFunction('__chitSign', (message) => ({
    publicKey: keyPair.publicKey.toHex(),
    signature: keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(message))).toHex(),
  }));
  if (onPay) await context.exposeFunction('__chitPay', async (tx) => onPay({ ...tx, from: address }));
  await context.addInitScript(
    ({ address: addr, height, language: lang, hasPay }) => {
      window.nimiqPay = { language: lang, userFiat: 'USD', requestDeviceIdentifier: () => Promise.resolve('0'.repeat(64)) };
      window.nimiq = {
        listAccounts: () => Promise.resolve([addr]),
        sign: (input) => window.__chitSign(typeof input === 'string' ? input : input.message),
        getBlockNumber: () => Promise.resolve(height),
        isConsensusEstablished: () => Promise.resolve(true),
        ...(hasPay ? { sendBasicTransactionWithData: (tx) => window.__chitPay(tx) } : {}),
      };
    },
    { address, height: HEIGHT, language, hasPay: Boolean(onPay) },
  );
  return address;
}

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
      rateBlock: HEIGHT,
      deadlineBlock: HEIGHT + 3 * 86_400,
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

/* ------------------------------------------------------------------ human-shaped motion */

/** Headless Chromium has no OS cursor — draw one that tracks real mousemove and ripples on click. */
const CURSOR_INIT = `(() => {
  if (window.__demoCursorInstalled) return; window.__demoCursorInstalled = true;
  const install = () => {
    if (!document.body) return requestAnimationFrame(install);
    if (document.getElementById('__demo_cursor')) return;
    const st = document.createElement('style');
    st.textContent = '@keyframes __demoRipple{from{opacity:.8;transform:translate(-50%,-50%) scale(1)}to{opacity:0;transform:translate(-50%,-50%) scale(3.2)}}';
    document.head.appendChild(st);
    const c = document.createElement('div');
    c.id = '__demo_cursor';
    c.style.cssText = 'position:fixed;left:-40px;top:-40px;width:22px;height:22px;z-index:2147483647;pointer-events:none;opacity:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 2 L5 19.5 L9.6 15.6 L12.4 21.8 L15.2 20.4 L12.4 14.4 L18.5 14 Z" fill="#ffffff" stroke="#1a1714" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    window.addEventListener('mousemove', (e) => { c.style.opacity = '1'; c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, { passive: true, capture: true });
    window.addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;width:9px;height:9px;border-radius:999px;border:2px solid rgba(26,23,20,.65);z-index:2147483646;pointer-events:none;transform:translate(-50%,-50%);animation:__demoRipple .45s ease-out forwards';
      document.body.appendChild(r); setTimeout(() => r.remove(), 550);
    }, { capture: true });
  };
  install();
  document.addEventListener('DOMContentLoaded', install);
})();`;

const pos = { x: 195, y: 420 };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function naturalMove(page, tx, ty, { minMs = 260, maxMs = 700 } = {}) {
  const dx = tx - pos.x, dy = ty - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return;
  const dur = Math.max(minMs, Math.min(maxMs, dist * 0.9));
  const steps = Math.max(10, Math.round(dur / 16));
  const bow = Math.min(16, dist * 0.05) * (Math.random() > 0.5 ? 1 : -1);
  const px = -dy / (dist || 1), py = dx / (dist || 1);
  for (let i = 1; i <= steps; i++) {
    const t = ease(i / steps);
    const arc = Math.sin(t * Math.PI) * bow;
    await page.mouse.move(pos.x + dx * t + px * arc, pos.y + dy * t + py * arc);
    await wait(dur / steps);
  }
  pos.x = tx; pos.y = ty;
}

async function naturalClick(page, target) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('naturalClick: target not visible');
  const x = box.x + box.width / 2 + (Math.random() * 6 - 3);
  const y = box.y + box.height / 2 + (Math.random() * 3 - 1.5);
  await naturalMove(page, x, y);
  await wait(220);
  await page.mouse.down(); await wait(80); await page.mouse.up();
}

/** Focus first, then type character by character at a human pace — not `fill()`. */
async function naturalType(page, locator, text) {
  await naturalClick(page, locator);
  await wait(280);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await wait(24 + Math.random() * 46);
  }
}

async function drift(page, y = 500) {
  await naturalMove(page, 195 + (Math.random() * 30 - 15), y);
}

/* ------------------------------------------------------------------ seeding (silent, headless) */

/** One throwaway, unrecorded context per seeded persona — fast, real, never on camera. */
async function seedPersona(browser, keyPair, onPay) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await installWallet(context, keyPair, { onPay });
  const page = await context.newPage();
  return { context, page, address: keyPair.toAddress().toUserFriendlyAddress() };
}

async function closePersona(persona) {
  await persona.context.close();
}

/**
 * A named worker declines an offer sent directly to them.
 *
 * Seeded with the recorded persona's own key as the payer — not a throwaway one — because an
 * open race's decline is deliberately not shown to just anyone who opens the link (see
 * routes.ts's own comment on why): only the payer who actually sent it is told "they
 * declined". A third party watching later would otherwise just see the ordinary open invite.
 */
async function seedDecline(browser, payerKey) {
  const workerKey = KeyPair.generate();
  const payer = await seedPersona(browser, payerKey);
  const worker = await seedPersona(browser, workerKey);

  await payer.page.goto(WEB, { waitUntil: 'networkidle' });
  await payer.page.locator('button', { hasText: 'paying' }).click();
  await payer.page.locator('textarea').fill('$50 to retouch twelve product photos by Tuesday');
  await payer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await payer.page.locator('button', { hasText: 'Sign it' }).click();
  await payer.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const url = payer.page.url();
  const id = decodeURIComponent(new URL(url).pathname.replace('/c/', ''));

  await worker.page.goto(url, { waitUntil: 'networkidle' });
  await worker.page.waitForSelector('text=agree this with you', { timeout: 20_000 });
  await worker.page.locator('button', { hasText: 'Decline' }).click();
  await worker.page.waitForSelector('text=You declined', { timeout: 20_000 });

  await closePersona(worker);
  await closePersona(payer);
  return { id, url };
}

/** A worker signs, delivers the work, and the client asks for a small change — left unpaid so the
 *  delivery and revision panels are still on screen when the recorded persona visits it. */
async function seedDeliveryAndRevision(browser) {
  const payerKey = KeyPair.generate();
  const workerKey = KeyPair.generate();
  const payer = await seedPersona(browser, payerKey);
  const worker = await seedPersona(browser, workerKey);

  await payer.page.goto(WEB, { waitUntil: 'networkidle' });
  await payer.page.locator('button', { hasText: 'paying' }).click();
  await payer.page.locator('textarea').fill('$25 to cut a teaser from the raw footage by Sunday');
  await payer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await payer.page.locator('button', { hasText: 'Sign it' }).click();
  await payer.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const url = payer.page.url();
  const id = decodeURIComponent(new URL(url).pathname.replace('/c/', ''));

  await worker.page.goto(url, { waitUntil: 'networkidle' });
  await worker.page.waitForSelector('text=agree this with you', { timeout: 20_000 });
  await worker.page.locator('button', { hasText: 'Sign it' }).click();
  await worker.page.waitForSelector('text=You signed it', { timeout: 20_000 });
  await worker.page.locator('summary', { hasText: 'Say it is delivered' }).click();
  await worker.page.locator('input[type=url]').fill('https://drive.example/teaser.mp4');
  await worker.page.locator('input[placeholder*="One line about it"]').fill('45 seconds, colour graded');
  await worker.page.locator('button', { hasText: 'Mark it delivered' }).click();
  await worker.page.waitForSelector('text=You marked it delivered', { timeout: 20_000 });

  await payer.page.goto(url, { waitUntil: 'networkidle' });
  await payer.page.waitForSelector('text=Time to pay', { timeout: 20_000 });
  await payer.page.locator('summary', { hasText: 'Not quite right?' }).click();
  await payer.page.locator('input[aria-label="What needs to change"]').fill('Can you make the logo bigger in the final ten seconds?');
  await payer.page.locator('button', { hasText: 'Ask for changes' }).click();
  await payer.page.waitForSelector('text=Sent — it is signed and on the record', { timeout: 20_000 });

  await closePersona(worker);
  await closePersona(payer);
  return { id, url };
}

/** A worker answers an open offer with their own number instead of taking it or leaving it. */
async function seedCounterOffer(browser) {
  const payerKey = KeyPair.generate();
  const workerKey = KeyPair.generate();
  const payer = await seedPersona(browser, payerKey);
  const worker = await seedPersona(browser, workerKey);

  await payer.page.goto(WEB, { waitUntil: 'networkidle' });
  await payer.page.locator('button', { hasText: 'paying' }).click();
  await payer.page.locator('textarea').fill('$30 to caption this podcast episode by Thursday');
  await payer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await payer.page.locator('button', { hasText: 'Sign it' }).click();
  await payer.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const url = payer.page.url();

  await worker.page.goto(url, { waitUntil: 'networkidle' });
  await worker.page.waitForSelector('text=agree this with you', { timeout: 20_000 });
  await worker.page.locator('button', { hasText: 'Ask for a change' }).click();
  await worker.page.waitForSelector('text=In reply to', { timeout: 20_000 });
  await worker.page.locator('.card:not(.card--accent) button', { hasText: '30.00' }).first().click();
  await worker.page.locator('input.field').fill('45');
  await worker.page.locator('button', { hasText: 'Set it' }).click();
  await worker.page.waitForFunction(() => document.body.innerText.includes('45.00'), { timeout: 15_000 });
  await worker.page.locator('button', { hasText: 'Sign it' }).click();
  await worker.page.waitForSelector('text=Your quote', { timeout: 20_000 });
  const counterUrl = worker.page.url();

  await closePersona(worker);
  await closePersona(payer);
  return { url: counterUrl };
}

/** A fully settled, two-sided-reviewed, showcased job — the richest profile the board can show. */
async function seedReputation(browser, rpc) {
  const payerKey = KeyPair.generate();
  const workerKey = KeyPair.generate();
  let settlingTx = null;
  const payer = await seedPersona(browser, payerKey, async (tx) => {
    settlingTx = tx;
    const injected = await rpc.inject({ to: tx.recipient, from: tx.from, value: tx.value, data: tx.data });
    return injected.hash;
  });
  const worker = await seedPersona(browser, workerKey);

  await payer.page.goto(WEB, { waitUntil: 'networkidle' });
  await payer.page.locator('button', { hasText: 'paying' }).click();
  await payer.page.locator('textarea').fill('$80 to design a five-page landing page, source files included');
  await payer.page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await payer.page.locator('button', { hasText: 'Sign it' }).click();
  await payer.page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  const url = payer.page.url();

  await worker.page.goto(url, { waitUntil: 'networkidle' });
  await worker.page.waitForSelector('text=agree this with you', { timeout: 20_000 });
  await worker.page.locator('button', { hasText: 'Sign it' }).click();
  await worker.page.waitForSelector('text=You signed it', { timeout: 20_000 });

  await payer.page.goto(url, { waitUntil: 'networkidle' });
  await payer.page.waitForSelector('text=Time to pay', { timeout: 20_000 });
  await payer.page.locator('button', { hasText: 'Pay' }).click();
  await payer.page.waitForFunction(() => document.body.innerText.includes('Settled on chain'), { timeout: 30_000 });

  // The worker offers a piece; the payer agrees. Both then leave a review.
  await worker.page.goto(url, { waitUntil: 'networkidle' });
  const offerLink = worker.page.locator('input[placeholder="https://…"]');
  await offerLink.waitFor({ state: 'visible', timeout: 20_000 });
  await offerLink.fill('https://example.com/work/landing-page.png');
  await worker.page.locator('input[aria-label="One line about it"]').fill('Five pages, delivered a day early.');
  await worker.page.locator('button', { hasText: 'Offer it as a piece' }).click();
  await worker.page.waitForSelector('text=not public until they agree', { timeout: 20_000 });

  await payer.page.goto(url, { waitUntil: 'networkidle' });
  await payer.page.waitForSelector('text=would like to show this work', { timeout: 20_000 });
  await payer.page.locator('button', { hasText: 'Agree to show it' }).click();
  await payer.page.waitForSelector('text=Shown as work', { timeout: 20_000 });

  await payer.page.locator('.rate__star').nth(4).click();
  await wait(400);
  await worker.page.goto(url, { waitUntil: 'networkidle' });
  await worker.page.waitForSelector('.rate__star', { timeout: 20_000 });
  await worker.page.locator('.rate__star').nth(3).click();
  await wait(400);

  await closePersona(payer);
  await closePersona(worker);
  return { workerAddress: workerKey.toAddress().toUserFriendlyAddress() };
}

/* ------------------------------------------------------------------ run */

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
    CHIT_DEMO_KEY: KeyPair.generate().privateKey.toHex(),
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

try {
  await waitForHttp(`${API}/health`);
  await waitForHttp(WEB);
  console.log(`api ${API}\napp ${WEB}\n`);
  await seedBoard();

  // Generated before seeding starts: the decline seed needs to be sent from this same wallet
  // so the recorded persona is later told about it as the real payer, not a stranger.
  const payerKey = KeyPair.generate();

  const seedBrowser = await chromium.launch();
  console.log('seed 1/4 — a worker declines an offer sent directly to them');
  const declined = await seedDecline(seedBrowser, payerKey);
  console.log('seed 2/4 — delivered, then a revision requested, left unpaid');
  const delivered = await seedDeliveryAndRevision(seedBrowser);
  console.log('seed 3/4 — a worker answers with their own number');
  const countered = await seedCounterOffer(seedBrowser);
  console.log('seed 4/4 — a settled, reviewed, showcased job');
  const reputable = await seedReputation(seedBrowser, rpc);
  await seedBrowser.close();

  /* ---------------------------------------------------------- main recorded pass */

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: 'light',
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
  });
  await context.addInitScript(CURSOR_INIT);
  await installWallet(context, payerKey, {
    onPay: async (tx) => {
      const injected = await rpc.inject({ to: tx.recipient, from: tx.from, value: tx.value, data: tx.data });
      return injected.hash;
    },
  });
  const page = await context.newPage();

  console.log('\n1. Home — the pitch in one screen');
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await drift(page, 700);
  await wait(3400);

  console.log('2. Paste the deal already agreed elsewhere');
  await naturalClick(page, page.locator('button', { hasText: 'paying' }));
  await wait(600);
  const line = '$60 to cut a 30-second vertical from this footage by Friday';
  await naturalType(page, page.locator('textarea'), line);
  await page.waitForSelector('text=What we understood', { timeout: 15_000 });
  await page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 15_000 });
  await wait(3600);

  console.log('3. Sign it');
  await naturalClick(page, page.locator('button', { hasText: 'Sign it' }));
  await page.waitForSelector('text=Send this to them', { timeout: 20_000 });
  await wait(2400);

  console.log('4. Walk both sides alone, with the labelled demo worker');
  await naturalClick(page, page.locator('button', { hasText: 'Try the demo worker' }));
  await page.waitForURL(/\/c\//, { timeout: 20_000 });
  await page.waitForSelector('text=Time to pay', { timeout: 20_000 });
  await wait(2400);

  console.log('5. Pay — a real signed transaction, watched onto the chain');
  await naturalClick(page, page.locator('button', { hasText: 'Pay' }));
  await page.waitForFunction(() => document.body.innerText.includes('Settled on chain'), { timeout: 30_000 });
  await wait(4200);
  const ownChitUrl = page.url();

  console.log('6. A stranger opens the receipt with no wallet at all');
  const ownId = decodeURIComponent(new URL(ownChitUrl).pathname.replace('/c/', ''));
  const ownChit = await (await fetch(`${API}/api/chits/${encodeURIComponent(ownId)}`)).json();
  if (ownChit.settledTx) {
    await page.goto(`${WEB}/verify/${encodeURIComponent(ownChit.settledTx)}`, { waitUntil: 'networkidle' });
    await drift(page, 500);
    await wait(4200);
  }

  console.log('7. The board — how a stranger finds work, no account needed');
  await page.goto(`${WEB}/board`, { waitUntil: 'networkidle' });
  await drift(page, 500);
  await wait(4200);

  console.log('8. A real profile — reputation, a review, and a piece of work on the record');
  await page.goto(`${WEB}/p/${encodeURIComponent(reputable.workerAddress.replace(/\s/g, ''))}`, { waitUntil: 'networkidle' });
  await drift(page, 500);
  await wait(4800);

  console.log('9. Someone said no — a real decline, signed');
  await page.goto(declined.url, { waitUntil: 'networkidle' });
  await wait(3200);

  console.log('10. Delivered, and a revision asked for — before anyone decides to pay');
  await page.goto(delivered.url, { waitUntil: 'networkidle' });
  await wait(1200);
  await page.locator('summary', { hasText: 'Not quite right?' }).click().catch(() => {});
  await wait(3200);

  console.log('11. A worker answers with their own number, not just yes or nothing');
  await page.goto(countered.url, { waitUntil: 'networkidle' });
  await wait(3400);

  console.log('12. Activity — what is owed, what was kept, next to what a cut would have cost');
  await page.goto(`${WEB}/a/${encodeURIComponent(payerKey.toAddress().toUserFriendlyAddress().replace(/\s/g, ''))}`, { waitUntil: 'networkidle' });
  await drift(page, 500);
  await wait(3600);

  console.log('13. The bounty — earning your first NIM by testing a Mini App');
  await page.goto(`${WEB}/bounty`, { waitUntil: 'networkidle' });
  await drift(page, 500);
  await wait(3400);

  console.log('14. About — the pitch in full, and dark mode');
  await page.goto(`${WEB}/about`, { waitUntil: 'networkidle' });
  await wait(2200);
  await page.emulateMedia({ colorScheme: 'dark' });
  await wait(3200);
  await page.emulateMedia({ colorScheme: 'light' });
  await wait(600);

  console.log('15. Back home — the whole loop closes where it started');
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await wait(2800);

  await context.close();
  await browser.close();

  /* ---------------------------------------------------------- locale pass (short, separate) */

  console.log('\n16. A glimpse in another language');
  const localeBrowser = await chromium.launch();
  const localeContext = await localeBrowser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
  });
  await localeContext.addInitScript(CURSOR_INIT);
  await installWallet(localeContext, KeyPair.generate(), { language: 'es' });
  const localePage = await localeContext.newPage();
  await localePage.goto(WEB, { waitUntil: 'networkidle' });
  await drift(localePage, 600);
  await wait(4200);
  await localePage.goto(`${WEB}/about`, { waitUntil: 'networkidle' });
  await wait(3200);
  await localeContext.close();
  await localeBrowser.close();

  const clips = readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm'));
  if (clips.length >= 1) {
    // Playwright names webm files by an internal id, not by creation order, so pick the larger
    // one as the main clip (it holds far more segments) rather than assume filesystem order.
    const withSizes = clips.map((f) => ({ f, size: statSync(join(OUT_DIR, f)).size }));
    withSizes.sort((a, b) => b.size - a.size);
    renameSync(join(OUT_DIR, withSizes[0].f), join(OUT_DIR, 'chit-demo-main.webm'));
    if (withSizes[1]) renameSync(join(OUT_DIR, withSizes[1].f), join(OUT_DIR, 'chit-demo-locale.webm'));
    console.log(`\nWrote ${OUT_DIR}/chit-demo-main.webm${withSizes[1] ? ` and ${OUT_DIR}/chit-demo-locale.webm` : ''} — now run scripts/compose-4k.sh.`);
  } else {
    console.log('\nNo video file was produced — recordVideo may not be supported in this environment.');
  }
} finally {
  await shutdown();
}

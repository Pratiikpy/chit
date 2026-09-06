/**
 * Objective design measurements — the numbers a design review should start from.
 *
 * Contrast ratios for every text/background pair the palette actually uses (WCAG 2.x), the
 * rendered type scale, every interactive element's hit size, the spacing values in play, and
 * the dead space above the sticky action bar on each screen. Screens are rendered from the
 * built bundle with the API mocked at the network layer, so the numbers are deterministic and
 * need no servers.
 *
 *   node scripts/design-metrics.mjs
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4181;
const WEB = `http://localhost:${PORT}`;

/* ------------------------------------------------------------------ contrast, from tokens */

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)];
  return ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2);
}
/*
 * The tokens are read from the stylesheet, not retyped here — a table copied by hand is
 * exactly how this script once reported the palette it remembered instead of the one
 * shipping. `:root` is the light scheme; the first `prefers-color-scheme: dark` block is dark.
 */
import { readFileSync } from 'node:fs';
const css = readFileSync('apps/web/src/styles.css', 'utf8');
function tokens(block) {
  const out = {};
  for (const [, name, hex] of block.matchAll(/--chit-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) out[name] = hex.toLowerCase();
  return out;
}
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'));
const darkBlock = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf('* { box-sizing'));
const L = tokens(lightBlock);
const D = { ...L, ...tokens(darkBlock) };
const light = { page: L.page, surface: L.surface, subtle: L.subtle, ink: L.ink, secondary: L.secondary, muted: L.muted, accent: L.accent, accentText: L['accent-text'], good: L.good, warn: L.warn, bad: L.bad, primaryInk: L['primary-ink'], primary: L.primary };
const dark = { page: D.page, surface: D.surface, subtle: D.subtle, ink: D.ink, secondary: D.secondary, muted: D.muted, accent: D.accent, accentText: D['accent-text'], good: D.good, warn: D.warn, bad: D.bad, primaryInk: D['primary-ink'], primary: D.primary };

console.log('\n== CONTRAST (WCAG AA: 4.5 body, 3.0 large/UI) ==');
for (const [name, p] of [['light', light], ['dark', dark]]) {
  const pairs = [
    ['ink on page', p.ink, p.page], ['ink on surface', p.ink, p.surface],
    ['secondary on page', p.secondary, p.page], ['secondary on surface', p.secondary, p.surface],
    ['muted on page', p.muted, p.page], ['muted on surface', p.muted, p.surface], ['muted on subtle', p.muted, p.subtle],
    ['accent (UI) on page', p.accent, p.page], ['accent-text on page', p.accentText, p.page], ['accent-text on surface', p.accentText, p.surface],
    ['good on surface', p.good, p.surface], ['warn on surface', p.warn, p.surface], ['bad on surface', p.bad, p.surface],
    ['primary button text', p.primaryInk, p.primary],
  ];
  for (const [label, fg, bg] of pairs) {
    const c = Number(contrast(fg, bg));
    const verdict = c >= 4.5 ? 'AA' : c >= 3 ? 'AA-large only' : 'FAIL';
    console.log(`  ${name.padEnd(6)} ${label.padEnd(22)} ${String(c).padStart(5)}  ${verdict}`);
  }
}

/* ------------------------------------------------------------------ rendered screens */

const web = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: 'apps/web', stdio: 'ignore', shell: process.platform === 'win32',
});
// Wait for the preview to answer rather than for a clock — it takes 1 s or 8 s depending on the day.
for (let i = 0; i < 60; i++) {
  try { await fetch(WEB); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

const chit = {
  id: 'chit1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', canonical: 'chit/1\nmain\nrace\nx\n$60 to cut a 30-second vertical from this footage by Friday\n6000\nUSD\n15680000000\n60800000\n61400000\nNQ07000000000000000000000000000000000\n\n1\n',
  chit: { chain: 'main', kind: 'race', nonce: 'x', text: '$60 to cut a 30-second vertical from this footage by Friday', amountMinor: '6000', currency: 'USD', luna: '15680000000', rateBlock: 60800000, deadlineBlock: 61400000, payer: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000', payee: '', deliverables: 1 },
  payerSignature: { publicKeyHex: 'aa', signatureHex: 'bb' }, payeeSignature: null, countersigned: false, payTo: null, settled: false, settledTx: null, settledBlock: null, settledAt: null, settledFrom: null,
  answer: null, payoutTx: null, declined: false, bounty: false, demoWorker: false, createdAt: Date.now(), currentBlock: 60800100, shareUrl: `${WEB}/c/chit1%3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, verifyUrl: null, events: [],
};

const browser = await chromium.launch();
async function measure(name, path, scheme, mocks = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.route('**/health', (r) => r.fulfill({ json: { ok: true, chain: 'main', watcher: null, bounty: null, demoWorker: null, at: Date.now() } }));
  await page.route('**/api/bounty', (r) => r.fulfill({ status: 404, json: { code: 'no-bounty', error: 'none' } }));
  await page.route('**/api/quote**', (r) => r.fulfill({ json: { amountMinor: '6000', currency: 'USD', luna: '15680000000', rateBlock: 60800000, quotedAt: Date.now(), expiresAt: Date.now() + 900000, stale: false } }));
  await page.route('**/api/addresses/**', (r) => r.fulfill({ json: { address: 'x', asPayer: { settled: 0, medianPaySeconds: null, leftUnpaid: 0, awaiting: 0 }, asWorker: { settled: 0, settledLuna: '0', distinctPayers: 0, keptLuna: '0' } } }));
  for (const [pattern, body] of Object.entries(mocks)) await page.route(pattern, (r) => r.fulfill({ json: body }));
  await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  if (path === '/') {
    await page.locator('textarea').fill(chit.chit.text);
    await page.waitForFunction(() => document.body.innerText.includes('In NIM'), { timeout: 8000 }).catch(() => {});
  }
  const m = await page.evaluate(() => {
    const px = (v) => Math.round(parseFloat(v));
    const type = {};
    for (const sel of ['h1', 'h2', 'p', '.amount', '.amount--huge', '.line__label', '.line__value', '.small', '.btn', '.strip', '.kicker']) {
      const e = document.querySelector(sel);
      if (e) { const s = getComputedStyle(e); type[sel] = `${px(s.fontSize)}/${px(s.lineHeight)} w${s.fontWeight}`; }
    }
    const targets = [...document.querySelectorAll('button, a, [role=button], summary, textarea, input')].map((e) => {
      const r = e.getBoundingClientRect();
      return { tag: e.tagName.toLowerCase(), cls: (e.className || '').toString().split(' ')[0], text: (e.textContent || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter((t) => t.w > 0 && t.h > 0);
    const small = targets.filter((t) => t.h < 44 || t.w < 44);
    const spacings = new Set();
    for (const e of document.querySelectorAll('.screen__body > *, .card > *, .stack > *')) {
      const s = getComputedStyle(e);
      for (const v of [s.marginTop, s.marginBottom, s.paddingTop, s.paddingBottom, s.rowGap]) { const n = px(v); if (n > 0) spacings.add(n); }
    }
    const body = document.querySelector('.screen__body'); const actions = document.querySelector('.screen__actions');
    let dead = null;
    if (body && actions) {
      // The last child that actually takes up space — an empty message slot is display:none.
      const last = [...body.children].reverse().find((c) => c.getBoundingClientRect().height > 0);
      const lb = last ? last.getBoundingClientRect().bottom : body.getBoundingClientRect().bottom;
      dead = Math.round(actions.getBoundingClientRect().top - lb);
    }
    // A status line must show its dot: colour alone is never the signal, but the dot is the mark.
    const dot = document.querySelector('.status .status__dot');
    const dotRect = dot ? dot.getBoundingClientRect() : null;
    const dotInfo = dot ? `${Math.round(dotRect.width)}×${Math.round(dotRect.height)} at x=${Math.round(dotRect.x)} ${getComputedStyle(dot).display} bg=${getComputedStyle(dot).backgroundColor}` : 'none on screen';
    return { type, targets: targets.length, small, spacings: [...spacings].sort((a, b) => a - b), dead, docH: document.documentElement.scrollHeight, dotInfo };
  });
  console.log(`\n== ${name} (${scheme}) ==`);
  console.log('  status dot   :', m.dotInfo);
  console.log('  type scale   :', Object.entries(m.type).map(([k, v]) => `${k} ${v}`).join(' · '));
  console.log('  spacing set  :', m.spacings.join(', '), `(${m.spacings.length} distinct values)`);
  console.log('  hit targets  :', m.targets, 'interactive;', m.small.length ? `UNDER 44px → ${m.small.map((s) => `${s.tag}.${s.cls}"${s.text}" ${s.w}×${s.h}`).join(' | ')}` : 'all ≥ 44px');
  console.log('  dead space above sticky actions:', m.dead === null ? 'n/a' : `${m.dead}px`, `· page height ${m.docH}px`);
  await ctx.close();
}

await measure('compose (typed)', '/', 'light');
await measure('countersign', '/c/chit1%3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'light', { '**/api/chits/chit1*': chit });
await measure('countersign', '/c/chit1%3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'dark', { '**/api/chits/chit1*': chit });
await measure('awaiting payment', '/c/chit1%3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'light', { '**/api/chits/chit1*': { ...chit, countersigned: true, payTo: 'NQ12 1111 1111 1111 1111 1111 1111 1111 1111' } });
await measure('settled (worker)', '/c/chit1%3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'light', { '**/api/chits/chit1*': { ...chit, countersigned: true, payTo: 'NQ12 1111 1111 1111 1111 1111 1111 1111 1111', settled: true, settledTx: 'abc123def456abc123def456', settledBlock: 60800200, settledAt: Date.now(), verifyUrl: `${WEB}/v/abc` } });

await browser.close();
web.kill();
console.log('');

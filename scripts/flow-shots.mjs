import { chromium } from 'playwright';
import { KeyPair } from '@nimiq/core';
import { canonicalise, newNonce } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';

const API = 'http://localhost:8787';
const sign = (kp, text) => ({
  publicKeyHex: kp.publicKey.toHex(),
  signatureHex: kp.sign(nimiqSignedMessageDigest(new TextEncoder().encode(text))).toHex(),
});

// A real chit, signed with a real key, so the screens render real data.
const payer = KeyPair.generate();
const q = await (await fetch(`${API}/api/quote?amountMinor=6000&currency=USD`)).json();
const chit = {
  chain: 'main', kind: 'race', nonce: newNonce(),
  text: 'Cut a 30-second vertical from this footage by Friday',
  amountMinor: 6000n, currency: 'USD', luna: BigInt(q.luna),
  rateBlock: q.rateBlock, deadlineBlock: q.rateBlock + 86400 * 2,
  payer: payer.toAddress().toUserFriendlyAddress(), payee: '', deliverables: 1,
};
const canonical = canonicalise(chit);
const created = await (await fetch(`${API}/api/chits`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ canonical, payerSignature: sign(payer, canonical) }),
})).json();
console.log('chit:', created.id);

const browser = await chromium.launch();
const errors = [];
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${scheme}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${scheme}] pageerror: ${e.message}`));

  // A stranger opening the link: they are not the payer, so this is the countersign screen.
  await page.goto(`http://localhost:4173/c/${encodeURIComponent(created.id)}?demo=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `shots/07-countersign-${scheme}.png`, fullPage: true });

  // A route that does not exist.
  await page.goto('http://localhost:4173/v/nosuchtransaction?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `shots/08-verify-missing-${scheme}.png` });

  await ctx.close();
}
console.log('console errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();

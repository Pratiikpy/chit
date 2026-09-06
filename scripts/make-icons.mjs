/**
 * Rasterise the brand assets the platforms will not take as SVG.
 *
 * iOS ignores an SVG `apple-touch-icon`, Android's install prompt wants a 512px PNG in the
 * manifest, and every chat app that unfurls a link wants a 1200×630 PNG. All three are
 * drawn from the same source — `favicon.svg` and the app's own tokens — so the icon on a
 * home screen, the tab, and a link preview are one mark.
 *
 *   node scripts/make-icons.mjs
 */

import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const svg = await readFile('apps/web/public/favicon.svg', 'utf8');
const browser = await chromium.launch();

async function png(html, width, height, out) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const buffer = await page.screenshot({ type: 'png', omitBackground: false });
  await writeFile(out, buffer);
  await page.close();
  console.log(`${out}  ${width}×${height}  ${(buffer.length / 1024).toFixed(1)} KB`);
}

const iconHtml = (size) => `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
await png(iconHtml(180), 180, 180, 'apps/web/public/apple-touch-icon.png');
await png(iconHtml(512), 512, 512, 'apps/web/public/icon-512.png');

// The link preview: the mark, the wordmark, the one sentence, and a receipt slip.
const og = `<!doctype html>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=block" rel="stylesheet">
<style>
  html,body{margin:0;width:1200px;height:630px;background:#efeeeb;color:#111112;font-family:'Instrument Sans',system-ui,sans-serif;letter-spacing:-0.01em}
  .wrap{position:relative;width:1200px;height:630px;overflow:hidden}
  .left{position:absolute;left:96px;top:96px;width:620px}
  .mark{display:flex;align-items:center;gap:18px}
  .mark svg{width:56px;height:56px}
  .word{font-size:44px;font-weight:700;letter-spacing:-0.04em}
  .word b{color:#e8452c}
  h1{margin:64px 0 22px;font-size:66px;line-height:1.05;font-weight:600;letter-spacing:-0.035em}
  p{margin:0;font-size:26px;line-height:1.4;color:#55555b;max-width:560px}
  .slip{position:absolute;right:96px;top:120px;width:360px;background:#fbfaf8;border:1px solid #e2dfda;border-radius:28px;padding:32px 34px 22px;box-shadow:0 30px 70px -40px rgba(17,17,18,.35)}
  .slip .k{font-size:14px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#c33a24;margin-bottom:12px}
  .slip .amt{font-size:52px;font-weight:600;letter-spacing:-0.035em;line-height:1}
  .slip .nim{font-size:18px;color:#55555b;margin-top:6px}
  .slip .deal{margin:26px 0 22px;padding-left:14px;border-left:2px solid #111112;font-size:20px;line-height:1.4;font-weight:500}
  .slip .cut{border:0;border-top:1px dashed #cfccc6;margin:0 0 16px}
  .slip .row{display:flex;justify-content:space-between;font-size:16px;color:#55555b;padding:8px 0}
  .slip .row b{color:#111112;font-weight:500}
  .check{display:inline-flex;align-items:center;gap:8px;background:#e6f1ea;color:#1f7a46;border-radius:999px;padding:6px 14px;font-size:15px;font-weight:600;margin-top:6px}
</style>
<div class="wrap">
  <div class="left">
    <div class="mark">${svg}<div class="word">chit<b>.</b></div></div>
    <h1>Paste the deal.<br>Get a receipt.</h1>
    <p>One line you already agreed, signed by both wallets with Nimiq Pay. The payment carries the proof. No account, nothing held.</p>
  </div>
  <div class="slip">
    <div class="k">Settled on chain</div>
    <div class="amt">$60.00</div>
    <div class="nim">≈ 158,370 NIM</div>
    <div class="deal">$60 to cut a 30-second vertical from this footage by Friday</div>
    <hr class="cut">
    <div class="row"><span>Paid by</span><b>NQ20 AP18 … C6LX 91E1</b></div>
    <div class="row"><span>Paid to</span><b>NQ25 X2QV … C6U8 UV6K</b></div>
    <div class="check">✓ Anyone can check it</div>
  </div>
</div>`;
await png(og, 1200, 630, 'apps/web/public/og.png');

await browser.close();

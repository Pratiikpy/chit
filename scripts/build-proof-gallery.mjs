/**
 * Builds the visual proof deck: a single self-contained HTML page with every screenshot
 * embedded as a data URI, so it opens for anyone with just the link, no repo access needed.
 *
 *   node scripts/build-proof-gallery.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'shots/journey';
const OUT = 'shots/proof-deck.html';

const sections = [
  {
    title: 'The pitch, in one screen',
    items: [
      ['01-compose-empty.png', 'The first screen. Paste the deal, pick a direction — nothing else is asked before this.'],
      ['22-home-with-bounty.png', 'With the bounty card live: the same first screen becomes how a new wallet earns its first NIM.'],
    ],
  },
  {
    title: 'Paste it — the parsing is live, not a form',
    items: [
      ['02-terms-parsed.png', 'One typed line, and chit already knows the amount, the currency and what to call it.'],
    ],
  },
  {
    title: 'Sign, and send it to them',
    items: [
      ['05-share.png', "The payer's share screen — waiting for the other side to sign, nothing paid yet."],
      ['06-countersign-dark.png', "The worker's own view of the same chit, dark mode: what they're being asked to sign, and who's asking."],
    ],
  },
  {
    title: 'Pay — a real signed transaction',
    items: [
      ['08-pay.png', 'The exact amount, priced in NIM at the moment of paying.'],
      ['09-settled-payer.png', "The payer's receipt the instant settlement lands."],
      ['10-paid-worker-dark.png', "The worker's side of the same settlement, dark mode."],
    ],
  },
  {
    title: 'Verified by a stranger, with no wallet at all',
    items: [
      ['11-verify-genuine.png', 'Anyone with the transaction hash re-derives and checks the whole agreement — chit\'s own server is not in this path.'],
    ],
  },
  {
    title: 'Discovery — the board, and a public profile',
    items: [
      ['50-board.png', 'Real open listings, ranked, no account needed to browse.'],
      ['40-public-record.png', 'A wallet\'s public record: settled work and reputation, computed — never typed in.'],
    ],
  },
  {
    title: 'The bounty — earning a first NIM by testing',
    items: [
      ['24-bounty-claimed.png', 'Answered, signed, and countersigned in one step.'],
      ['25-bounty-paid.png', 'Paid on the spot — the pool broadcasts before the screen changes.'],
    ],
  },
  {
    title: 'Walking both sides alone',
    items: [
      ['27-demo-worker-signed.png', 'The labelled demo worker countersigns on request from the chit\'s own payer, so one person can prove the whole loop.'],
    ],
  },
  {
    title: 'A real decline — signed, not silence',
    items: [
      ['28-declined-worker-dark.png', 'The worker\'s own confirmation after declining.'],
      ['29-declined-payer.png', 'What the payer sees — told plainly, with a one-tap way to send a new offer.'],
    ],
  },
  {
    title: 'Delivery and a revision — the step Fiverr/Upwork are missing',
    items: [
      ['35-delivered-worker.png', "“Here it is” — a second signed statement between agreeing and paying, so the worker isn't left with nothing to show."],
      ['36b-revision-requested.png', 'The payer asking for a small change before deciding to pay — a real, signed, zero-money record.'],
    ],
  },
  {
    title: 'A counter-offer — answer with your own number',
    items: [
      ['33-counter-offer.png', "The composer carries the original words, and opens in the direction that lets the worker set the price."],
    ],
  },
  {
    title: 'A portfolio piece nobody can fake',
    items: [
      ['57-showcase-offered.png', 'Offered by the worker — explicitly not public yet.'],
      ['59-showcase-on-record.png', 'On the public record only once the client has also signed.'],
    ],
  },
  {
    title: 'A signed review, bound to the payment',
    items: [
      ['39-review-form.png', 'Real tap targets, tied to the settled transaction it reviews.'],
    ],
  },
  {
    title: 'Ask before you sign',
    items: [
      ['54-question-asked.png', 'A public question on an open listing — the answer helps the next person too.'],
    ],
  },
  {
    title: 'An invoice a client can actually use',
    items: [
      ['38-invoice-print.png', 'A downloadable PDF receipt — the WebView-safe delivery mechanism, tested against real Chromium failure modes.'],
    ],
  },
  {
    title: 'Five languages, not just English screenshots',
    items: [
      ['30-german.png', 'German.'],
      ['47-spanish.png', 'Spanish.'],
    ],
  },
  {
    title: 'The full pitch',
    items: [
      ['32-about.png', 'What chit is, what it never does, and how a receipt is checked — in its own words.'],
    ],
  },
];

function dataUri(file) {
  const bytes = readFileSync(join(DIR, file));
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

const sectionsHtml = sections
  .map(
    (s) => `
  <section>
    <h2>${s.title}</h2>
    <div class="grid grid--${s.items.length}">
      ${s.items
        .map(
          ([file, caption]) => `
      <figure>
        <img src="${dataUri(file)}" alt="${caption.replace(/"/g, '&quot;')}" loading="lazy">
        <figcaption>${caption}</figcaption>
      </figure>`,
        )
        .join('')}
    </div>
  </section>`,
  )
  .join('\n');

const template = readFileSync('scripts/proof-gallery-template.html', 'utf8');
const html = template.replace('<!--SECTIONS-->', sectionsHtml);
writeFileSync(OUT, html);

const sizeMB = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log(`wrote ${OUT} (${sizeMB} MB)`);

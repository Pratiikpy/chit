/**
 * Builds the visual proof deck: a single self-contained HTML page with every screenshot
 * embedded as a data URI, so it opens for anyone with just the link, no repo access needed.
 *
 * Structured in two tiers on purpose, not one flat scroll of images: a numbered walkthrough
 * of the core loop first (the order a judge actually experiences it), then a categorized,
 * jump-linked reference for everything else the platform does.
 *
 *   node scripts/build-proof-gallery.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'shots/journey';
const OUT = 'shots/proof-deck.html';

const walkthrough = [
  {
    title: 'Paste the deal',
    body: 'The first screen a judge sees. Pick a direction, paste the line already agreed elsewhere — nothing else is asked.',
    items: [
      ['01-compose-empty.png', 'The blank first screen.'],
      ['22-home-with-bounty.png', 'The same screen with the bounty live — how a new wallet earns its first NIM.'],
    ],
  },
  {
    title: 'It reads the line, live',
    body: "No form fields to fill in — the amount, the currency and the deadline come out of one typed sentence as it's typed.",
    items: [['02-terms-parsed.png', 'One line in, and chit already knows what it means.']],
  },
  {
    title: 'Sign it, and send it to them',
    body: 'The payer signs first and shares a link; the other side sees exactly what they are being asked to agree to before they sign anything.',
    items: [
      ['05-share.png', "The payer's screen — waiting for the other side, nothing paid yet."],
      ['06-countersign-dark.png', "The worker's own view of the same chit, dark mode."],
    ],
  },
  {
    title: 'Pay — a real transaction, on chain',
    body: 'Priced in NIM at the moment of paying, watched onto the chain by the settlement service, and shown to both sides the instant it settles.',
    items: [
      ['08-pay.png', 'The amount, in NIM, ready to pay.'],
      ['09-settled-payer.png', "The payer's receipt the instant settlement lands."],
      ['10-paid-worker-dark.png', "The worker's side of the same settlement."],
    ],
  },
  {
    title: 'Verified by a stranger, no wallet needed',
    body: "chit's own server is not in this path: anyone holding the transaction hash re-derives and checks the whole agreement in their own browser.",
    items: [['11-verify-genuine.png', 'An independent check, from outside the app entirely.']],
  },
];

const reference = [
  {
    id: 'discovery',
    title: 'Discovery — the board, and a public profile',
    items: [
      ['50-board.png', 'Real open listings, ranked, no account needed to browse.'],
      ['40-public-record.png', "A wallet's public record — settled work and reputation, computed, never typed in."],
    ],
  },
  {
    id: 'bounty',
    title: 'Earning a first NIM by testing',
    items: [
      ['24-bounty-claimed.png', 'Answered, signed, and countersigned in one step.'],
      ['25-bounty-paid.png', 'Paid on the spot — the pool broadcasts before the screen changes.'],
    ],
  },
  {
    id: 'solo',
    title: 'Walking both sides alone',
    items: [['27-demo-worker-signed.png', "The labelled demo worker signs on the payer's own request, so one person can prove the whole loop."]],
  },
  {
    id: 'decline',
    title: 'A real decline — signed, not silence',
    items: [
      ['28-declined-worker-dark.png', "The worker's own confirmation after declining."],
      ['29-declined-payer.png', 'What the payer sees — told plainly, with a one-tap way to send a new offer.'],
    ],
  },
  {
    id: 'delivery',
    title: "Delivery and a revision — the step Fiverr/Upwork are missing",
    items: [
      ['35-delivered-worker.png', '"Here it is" — a second signed statement between agreeing and paying.'],
      ['36b-revision-requested.png', 'A small change asked for before deciding to pay — signed, zero-money.'],
    ],
  },
  {
    id: 'counter',
    title: 'A counter-offer — answer with your own number',
    items: [['33-counter-offer.png', 'The composer carries the original words, open in the direction that lets the worker set the price.']],
  },
  {
    id: 'showcase',
    title: 'A portfolio piece nobody can fake',
    items: [
      ['57-showcase-offered.png', 'Offered by the worker — explicitly not public yet.'],
      ['59-showcase-on-record.png', 'On the public record only once the client has also signed.'],
    ],
  },
  {
    id: 'review',
    title: 'A signed review, bound to the payment',
    items: [['39-review-form.png', 'Real tap targets, tied to the settled transaction it reviews.']],
  },
  {
    id: 'qa',
    title: 'Ask before you sign',
    items: [['54-question-asked.png', 'A public question on an open listing — the answer helps the next person too.']],
  },
  {
    id: 'invoice',
    title: 'An invoice a client can actually use',
    items: [['38-invoice-print.png', 'A downloadable PDF receipt — the WebView-safe path, tested against real failure modes.']],
  },
  {
    id: 'locales',
    title: 'Five languages, not just English screenshots',
    items: [
      ['30-german.png', 'German.'],
      ['47-spanish.png', 'Spanish.'],
    ],
  },
  {
    id: 'about',
    title: 'The full pitch, in its own words',
    items: [['32-about.png', 'What chit is, what it never does, and how a receipt is checked.']],
  },
];

function dataUri(file) {
  const bytes = readFileSync(join(DIR, file));
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

const figure = ([file, caption]) => `
      <figure>
        <img src="${dataUri(file)}" alt="${caption.replace(/"/g, '&quot;')}" loading="lazy">
        <figcaption>${caption}</figcaption>
      </figure>`;

const walkthroughHtml = walkthrough
  .map(
    (s, i) => `
  <div class="step">
    <div class="step__head">
      <span class="step__num">${i + 1}</span>
      <div>
        <h3>${s.title}</h3>
        <p class="step__body">${s.body}</p>
      </div>
    </div>
    <div class="grid grid--${s.items.length}">${s.items.map(figure).join('')}
    </div>
  </div>`,
  )
  .join('\n');

const tocHtml = reference.map((s) => `<a href="#${s.id}">${s.title}</a>`).join('\n      ');

const referenceHtml = reference
  .map(
    (s) => `
  <section id="${s.id}">
    <h2>${s.title}</h2>
    <div class="grid grid--${s.items.length}">${s.items.map(figure).join('')}
    </div>
  </section>`,
  )
  .join('\n');

const template = readFileSync('scripts/proof-gallery-template.html', 'utf8');
const html = template
  .replace('<!--WALKTHROUGH-->', walkthroughHtml)
  .replace('<!--TOC-->', tocHtml)
  .replace('<!--REFERENCE-->', referenceHtml);
writeFileSync(OUT, html);

const sizeMB = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2);
console.log(`wrote ${OUT} (${sizeMB} MB)`);

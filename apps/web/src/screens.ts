/**
 * Door one, as screens — in both directions, with the bounty as the first paid job.
 *
 * Paste → check what we understood → sign → share → the other side signs or pays → receipt.
 * Each screen holds one idea, because the bar is "a first-time user reaches the point of the
 * app within 60 seconds without instructions" and every extra idea on a screen is time spent
 * deciding which one matters.
 *
 * Every screen about a chit is built from the same template, in the same order — the money,
 * the words, the other party, the state, the actions — so a person who has seen one has seen
 * them all. The values nobody needs in order to decide (block heights, digests, exact Luna)
 * are kept but folded under "Details", never deleted: the receipt must stay checkable.
 *
 * Three habits throughout:
 * - **Nothing asks the wallet for anything until the user taps.** Detection is silent; the
 *   address is requested on Sign or Pay. A stranger opening a link reads first.
 * - **Cancelling is never an error.** The screen stays usable and nothing turns red. A
 *   declined dialog leaves the button exactly as it was.
 * - **Money is the largest thing on any screen that has any**, in the user's own currency
 *   and their own locale's notation, with the NIM figure beside it rather than hidden.
 */

import { canonicaliseDelivery, chitHash, fromBase64Url, parseCanonical, parseTerms, toBase64Url } from '@chit/core';
import QrCreator from 'qr-creator';
import { api, type ApiChit, type LedgerView } from './api.ts';
import { buildDraft, BLOCKS_PER_DAY, fieldsFromTerms, isReady, quoteExpired, type DraftFields, type Quote } from './compose.ts';
import {
  checkNetwork,
  connectWallet,
  detectWallet,
  explain,
  forgetWallet,
  rememberedAddress,
  requestDeviceHash,
  type WalletDetection,
  type WalletSession,
} from './wallet.ts';
import { isPhone, nimiqPayDeepLink, storeLink } from './links.ts';
import { nimRow, termsEditor } from './terms-editor.ts';
import { watchUntil } from './watch.ts';
import { readChainTransaction } from './chain.ts';
import { identicon } from './identicon.ts';
import { labelFor, setLabel } from './labels.ts';
import { hasIdentity, readIdentity, writeIdentity, type Identity } from './identity.ts';
import {
  button,
  copyable,
  deal,
  details,
  el,
  emptyState,
  hero,
  icon,
  loadingSoon,
  money,
  moneyLocal,
  mount,
  nim,
  nimApprox,
  note,
  onLeave,
  prettyAddress,
  row,
  screen,
  setStatus,
  shortAddress,
  skeleton,
  status,
  withBusy,
  type IconName,
} from './ui.ts';
import { t } from './i18n.ts';

type Navigate = (path: string) => void;

const sameAddress = (a: string | null | undefined, b: string | null | undefined): boolean =>
  !!a && !!b && a.replace(/\s/g, '').toUpperCase() === b.replace(/\s/g, '').toUpperCase();

/** Fetch a server-pinned quote. The client never prices its own payment. */
async function fetchQuote(amountMinor: bigint, currency: string): Promise<Quote | { error: string }> {
  const result = await api.quote(amountMinor, currency);
  return result.ok ? result.value : { error: result.error };
}

/**
 * The block explorer. `nimiq.watch` runs the RPC this service reads from; the fragment form
 * of its transaction page is NOT VERIFIED for Albatross hashes and is kept in one place.
 */
function explorerUrl(txHash: string): string {
  return `https://nimiq.watch/#${txHash}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDuration(seconds: number): string {
  if (seconds < 90) return t('a minute');
  if (seconds < 2 * 3600) return `${Math.round(seconds / 60)} ${t('minutes')}`;
  if (seconds < 48 * 3600) return `${Math.round(seconds / 3600)} ${t('hours')}`;
  return `${Math.round(seconds / 86400)} ${t('days')}`;
}

/** One or many, said properly — "1 chit", "3 chits". */
function count(n: number, one: string, many: string): string {
  return n === 1 ? t(one, { n }) : t(many, { n });
}

/** When a block height falls due, for a person. A negative distance has passed. */
function dueLabel(deadlineBlock: number, currentBlock: number): string {
  const blocks = deadlineBlock - currentBlock;
  if (blocks < 0) return t('passed');
  const days = Math.round(blocks / BLOCKS_PER_DAY);
  if (days === 0) return t('today');
  return t('in about {n} days', { n: days });
}

/** A link that carries the signed words, so the receipt can be checked without us. */
function receiptLink(chit: ApiChit): string | null {
  if (!chit.settledTx) return null;
  return `/v/${encodeURIComponent(chit.settledTx)}#c=${toBase64Url(new TextEncoder().encode(chit.canonical))}`;
}

/** The link as a person would read it out: the host and a little of the path. */
function displayLink(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.length > 18 ? `${u.pathname.slice(0, 14)}…` : u.pathname;
    return `${u.host}${tail}`;
  } catch {
    return url;
  }
}

function chitPath(id: string): string {
  return `/c/${encodeURIComponent(id)}`;
}

function fiat(chit: ApiChit): string {
  return moneyLocal(chit.chit.amountMinor, chit.chit.currency);
}

/** NIM the way a glance reads it, without the "≈" — for rows that already say what they are. */
function nimRound(luna: string): string {
  return nimApprox(luna).replace('≈ ', '');
}

/* ------------------------------------------------------------------ shared pieces */

/** The word "chit", and the ways around. Sits above the title. */
function topBar(navigate: Navigate, current?: 'compose' | 'activity' | 'bounty' | 'about'): HTMLElement {
  const me = rememberedAddress();
  const brand = el('button', { class: 'topbar__brand', text: 'chit', attrs: { type: 'button', 'aria-label': t('chit home') } });
  brand.addEventListener('click', () => navigate('/'));
  const nav = el('div', { class: 'topbar__nav' });
  const link = (label: string, glyph: IconName, path: string): void => {
    const b = el('button', { class: 'topbar__link', attrs: { type: 'button' }, children: [icon(glyph), document.createTextNode(label)] });
    b.addEventListener('click', () => navigate(path));
    nav.append(b);
  };
  if (me && current !== 'activity') link(t('Activity'), 'clock', `/a/${encodeURIComponent(me)}`);
  if (current === 'compose') link(t('About'), 'info', '/about');
  else link(t('New chit'), 'pen', '/');
  return el('nav', { class: 'topbar', children: [brand, nav], attrs: { 'aria-label': 'chit' } });
}

/** A standing warning wherever a testnet chit is shown, so it is never mistaken for money. */
function testnetBanner(chit: ApiChit): HTMLElement | null {
  return chit.chit.chain === 'test' ? note(t('Test network — the signatures are real, the money is not.'), 'warn') : null;
}

function qrFor(text: string, size = 200): HTMLElement {
  const holder = el('div', { class: 'qr' });
  const canvas = el('canvas', { attrs: { 'aria-hidden': 'true' } });
  holder.append(canvas);
  queueMicrotask(() => {
    QrCreator.render({ text, radius: 0.4, ecLevel: 'M', fill: '#111112', background: '#ffffff', size }, canvas);
  });
  return holder;
}

/**
 * What a person without a wallet sees, with the way in: the deep link into Nimiq Pay and,
 * for someone who does not have it, the store. On a desktop the code to scan is right
 * there — the sentence used to promise "the code below" and show none.
 */
function walletBanner(detection: WalletDetection, link: string): HTMLElement | null {
  if (detection.tier === 'nimiq-pay') return null;
  if (detection.tier === 'demo') {
    return note(t('Demo mode — signatures here are for show and will not verify. Open in Nimiq Pay to sign for real.'), 'warn');
  }
  // The scheme link opens the installed app; the https "open" route 404s for an unregistered
  // host (see links.ts), so it is not offered. The store link is the device's own store.
  const open = el('a', { class: 'btn', attrs: { href: nimiqPayDeepLink(link) }, children: [icon('wallet', 'icon--sm'), document.createTextNode(t('Open in Nimiq Pay'))] });
  const get = el('a', { class: 'btn btn--quiet', text: t('Get Nimiq Pay'), attrs: { href: storeLink(), target: '_blank', rel: 'noopener' } });
  if (isPhone()) {
    return el('div', {
      class: 'stack stack--tight',
      children: [
        note(t('Signing and paying happen in the Nimiq Pay app. Open this there — Nimiq Pay may ask you to confirm the first time.'), 'calm'),
        el('div', { class: 'row-actions', children: [open, get] }),
      ],
    });
  }
  return el('div', {
    class: 'card card--pad rail',
    children: [
      qrFor(link, 168),
      el('div', {
        class: 'stack stack--tight rail__text',
        children: [
          el('div', { class: 'kicker kicker--quiet', text: t('Continue on your phone') }),
          el('p', { class: 'secondary', text: t('Signing and paying happen in the Nimiq Pay app. Scan this with your phone’s camera, or open the link there.') }),
          el('div', { class: 'row-actions', children: [get] }),
        ],
      }),
    ],
  });
}

/** Connect on a tap. Returns null after explaining, leaving the button exactly as it was. */
async function connectOrExplain(messages: HTMLElement, chain: 'main' | 'test'): Promise<WalletSession | null> {
  try {
    const session = await connectWallet();
    if (session.tier === 'nimiq-pay' && (await checkNetwork(chain)) === 'mismatch') {
      forgetWallet();
      messages.append(
        note(
          chain === 'main'
            ? t('Your wallet is on the Nimiq test network, but this chit is for real NIM. Switch Nimiq Pay to mainnet and try again.')
            : t('Your wallet is on Nimiq mainnet, but this is a test-network chit. Switch Nimiq Pay to testnet and try again.'),
          'warn',
        ),
      );
      return null;
    }
    return session;
  } catch (error) {
    const { message, tone } = explain(error);
    if (tone === 'calm') forgetWallet();
    messages.append(note(message, tone));
    return null;
  }
}

/** The money, fiat first, NIM beside it. The hero of every chit screen, always in one place. */
function amountHero(chit: ApiChit, options: { huge?: boolean; label?: string } = {}): HTMLElement {
  return hero({
    ...(options.label !== undefined ? { label: options.label } : {}),
    amount: fiat(chit),
    sub: nimApprox(chit.chit.luna),
    ...(options.huge ? { huge: true } : {}),
  });
}

/**
 * A wallet as a person: the identicon every Nimiq app draws for it, the name this device
 * gave it (or "You"), and the address underneath. Optionally nameable, right there.
 */
function party(address: string, role: string, options: { me?: string | null; nameable?: boolean; size?: number; full?: boolean } = {}): HTMLElement {
  const isMe = sameAddress(options.me, address);
  const wrap = el('div', { class: 'party' });
  const shown = options.full ? prettyAddress(address) : shortAddress(address);

  const paint = (): void => {
    const name = isMe ? t('You') : labelFor(address);
    const text = el('div', {
      class: 'party__text',
      children: [
        el('div', { class: 'party__role', text: role }),
        el('div', { class: 'party__name', text: name ?? shown }),
        name ? el('div', { class: 'party__addr mono', text: shown }) : null,
      ],
    });
    const children: Array<Node | null> = [identicon(address, options.size ?? 40), text];
    if (options.nameable && !isMe) {
      const label = name ? t('Rename') : t('Name this wallet');
      const pen = el('button', { class: 'btn btn--icon', attrs: { type: 'button', 'aria-label': label, title: label }, children: [icon('pen')] });
      pen.addEventListener('click', () => edit());
      children.push(pen);
    }
    wrap.replaceChildren(...children.filter((c): c is Node => c !== null));
  };

  const edit = (): void => {
    const input = el('input', {
      class: 'field',
      attrs: {
        type: 'text',
        maxlength: 40,
        autocomplete: 'off',
        'aria-label': t('A name for this wallet, kept on this device'),
        placeholder: t('e.g. Acme Studio'),
        value: labelFor(address) ?? '',
      },
    });
    const save = button(t('Save'), () => {
      setLabel(address, input.value);
      paint();
    });
    const cancel = button(t('Cancel'), () => paint(), 'plain');
    input.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter') {
        event.preventDefault();
        save.click();
      }
    });
    wrap.replaceChildren(
      el('div', {
        class: 'stack stack--tight party__edit',
        children: [
          input,
          el('p', { class: 'small muted', text: t('Only on this device. Never sent anywhere, never shown to anyone else.') }),
          el('div', { class: 'row-actions', children: [save, cancel] }),
        ],
      }),
    );
    queueMicrotask(() => input.focus());
  };

  paint();
  return wrap;
}

/** A wallet as a row value: identicon, then the name or the short address. */
function who(address: string, me: string | null): HTMLElement {
  const name = sameAddress(me, address) ? t('You') : labelFor(address);
  return el('span', {
    class: 'who',
    children: [
      identicon(address, 20),
      el('span', {
        class: 'who__text',
        children: [el('span', { class: 'who__name', text: name ?? shortAddress(address) }), name ? el('span', { class: 'who__addr', text: shortAddress(address) }) : null],
      }),
    ],
  });
}

/** The facts a bookkeeper wants and a person does not need in order to decide. Folded, never gone. */
/**
 * The price both sides agreed, recovered from the two numbers they signed.
 *
 * The fiat amount and the Luna amount were quoted together and are both inside the
 * canonical text, so their ratio *is* the rate that was used. It never had to be stored,
 * and because it is derived it cannot disagree with the signature.
 */
function signedRate(chit: ApiChit): string | null {
  const luna = BigInt(chit.chit.luna);
  if (luna <= 0n) return null;
  const minor = Number(BigInt(chit.chit.amountMinor));
  const nimAmount = Number(luna) / 100_000;
  if (!Number.isFinite(minor) || nimAmount <= 0) return null;
  const perNim = minor / 100 / nimAmount;
  return `1 NIM = ${perNim.toPrecision(4)} ${chit.chit.currency}`;
}

function factRows(chit: ApiChit, options: { settled?: boolean } = {}): HTMLElement {
  const rows: HTMLElement[] = [row(t('Amount'), money(chit.chit.amountMinor, chit.chit.currency)), row(t('In NIM'), nim(chit.chit.luna))];
  if (chit.chit.deliverables > 1) rows.push(row(t('Deliverables'), String(chit.chit.deliverables)));
  if (!options.settled) rows.push(row(t('Deadline'), t('block {n}', { n: chit.chit.deadlineBlock })));
  if (chit.settledBlock) rows.push(row(t('Block'), String(chit.settledBlock)));
  const rate = signedRate(chit);
  if (rate) rows.push(row(t('Agreed rate'), rate));
  rows.push(row(t('Rate taken at'), t('block {n}', { n: chit.chit.rateBlock })));
  // What arrived, whenever it is not what was agreed. Settlement accepts 97% and upwards,
  // so the two can differ honestly — and a receipt that shows only the agreed figure is
  // describing the contract while claiming to describe the payment.
  if (chit.settledLuna && chit.settledLuna !== chit.chit.luna) {
    rows.push(row(t('Actually received'), nim(chit.settledLuna)));
  }
  rows.push(row(t('Chit id'), chit.id));
  return details(t('Details'), rows);
}

/** Due, as a sentence, above the details. */
function dueRow(chit: ApiChit): HTMLElement | null {
  const current = chit.currentBlock ?? 0;
  if (current <= 0) return null;
  const label = dueLabel(chit.chit.deadlineBlock, current);
  return row(t('Due'), label, label === t('passed') ? 'bad' : '');
}

function stripLine(text: string, glyph: IconName, warn = false): HTMLElement {
  return el('p', { class: `strip${warn ? ' strip--warn' : ''}`, children: [icon(glyph), document.createTextNode(text)] });
}

/**
 * The payer's record, above the worker's Sign button — the one moment it matters.
 * Computed from settled payments only. A wallet with no history reads as new, never as bad.
 */
async function payerStrip(payer: string, attached: string): Promise<HTMLElement> {
  const result = await api.ledger(payer);
  if (!result.ok) return stripLine(t('Could not load this wallet’s record.'), 'info');
  const p = result.value.asPayer;
  if (p.settled === 0 && p.leftUnpaid === 0) return stripLine(t('First chit from this wallet · {amount} attached', { amount: attached }), 'info');
  const parts = [count(p.settled, 'Paid {n} chit', 'Paid {n} chits')];
  if (p.medianPaySeconds !== null) parts.push(t('usually within {d}', { d: formatDuration(p.medianPaySeconds) }));
  parts.push(p.leftUnpaid === 0 ? t('none left unpaid') : t('{n} left unpaid', { n: p.leftUnpaid }));
  return stripLine(parts.join(' · '), 'shield', p.leftUnpaid > 0);
}

/** The worker's record, for a client about to pay a quote. */
async function workerStrip(worker: string): Promise<HTMLElement | null> {
  const result = await api.ledger(worker);
  if (!result.ok) return null;
  const w = result.value.asWorker;
  if (w.settled === 0) return stripLine(t('This wallet has not been paid through chit before.'), 'info');
  return stripLine(`${count(w.settled, 'Paid {n} time', 'Paid {n} times')} · ${count(w.distinctPayers, 'by {n} client', 'by {n} clients')}`, 'shield');
}

/** "Paid after the deadline" — labelled on the receipt, never enforced. */
function lateBadge(chit: ApiChit): HTMLElement | null {
  if (chit.settledBlock && chit.settledBlock > chit.chit.deadlineBlock) {
    return el('span', { class: 'badge badge--warn', children: [icon('clock'), document.createTextNode(t('Paid after the deadline'))] });
  }
  return null;
}

/** Copy + native share for a link. The one place these two buttons are built. */
function shareActions(link: string, title: string, text: string): HTMLElement[] {
  const canShare = typeof navigator.share === 'function';
  const copy = button(
    t('Copy the link'),
    () => {
      void navigator.clipboard
        .writeText(link)
        .then(() => {
          copy.replaceChildren(icon('check', 'icon--sm'), document.createTextNode(t('Copied')));
          setTimeout(() => copy.replaceChildren(icon('copy', 'icon--sm'), document.createTextNode(t('Copy the link'))), 1600);
        })
        .catch(() => {
          copy.textContent = t('Copy failed — select the link below');
        });
    },
    canShare ? 'quiet' : 'primary',
    'copy',
  );
  if (!canShare) return [copy];
  return [
    button(
      t('Send it'),
      () => {
        void navigator.share({ title, text, url: link }).catch(() => {
          /* the user dismissed the sheet — nothing to say */
        });
      },
      'primary',
      'share',
    ),
    copy,
  ];
}

/** The link, the code, and the way straight into Nimiq Pay — the one block every share screen has. */
function shareBlock(link: string): HTMLElement {
  return el('div', {
    class: 'rail',
    children: [
      qrFor(link, 168),
      el('div', {
        class: 'stack stack--tight rail__text',
        children: [
          copyable(link, displayLink(link), t('Copied'), t('Copy')),
          el('a', { class: 'link-row', attrs: { href: nimiqPayDeepLink(link) }, children: [icon('wallet', 'icon--sm'), document.createTextNode(t('Open in Nimiq Pay'))] }),
        ],
      }),
    ],
  });
}

function explorerRow(txHash: string): HTMLElement {
  const a = el('a', {
    class: 'link-row',
    attrs: { href: explorerUrl(txHash), target: '_blank', rel: 'noopener' },
    children: [document.createTextNode(t('View on nimiq.watch')), icon('external', 'icon--sm')],
  });
  return el('div', { class: 'line line--action', children: [el('span', { class: 'line__label', text: t('Transaction') }), el('span', { class: 'line__value', children: [a] })] });
}

/** A screen that is a message, not a task: centred, calm, actions right under the words. */
function problemScreen(navigate: Navigate, options: { title: string; text: string; tone?: 'calm' | 'bad'; glyph?: IconName; actions: HTMLElement[] }): HTMLElement {
  return screen({
    header: topBar(navigate),
    body: [
      emptyState({
        icon: options.glyph ?? (options.tone === 'bad' ? 'alert' : 'inbox'),
        title: options.title,
        text: options.text,
        action: el('div', { class: 'stack stack--tight problem__actions', children: options.actions }),
        heading: true,
      }),
    ],
  });
}

/** The shape of a chit screen, drawn while the real one loads. */
function skeletonScreen(navigate: Navigate): HTMLElement {
  return screen({ header: topBar(navigate), body: [skeleton('line'), skeleton('card'), skeleton('row'), skeleton('line')] });
}

/* ------------------------------------------------------------------ the bounty banner */

/**
 * The first paid job. A person with an empty wallet sees, under the composer, a real chit
 * they can be paid for right now. It is a chit like any other — chit is simply the payer.
 * Nothing is offered when the pool cannot pay: an IOU is worse than silence.
 */
async function bountyBanner(navigate: Navigate): Promise<HTMLElement | null> {
  const result = await api.bounty();
  if (!result.ok) return null;
  const b = result.value;
  const first = b.open[0];
  if (!b.funded || !first) return null;
  const amount = moneyLocal(first.chit.amountMinor, first.chit.currency);
  return el('div', {
    class: 'card card--accent',
    children: [
      el('div', { class: 'kicker', text: t('Your first NIM · paid by chit') }),
      el('p', { text: b.prompt }),
      el('p', { class: 'small secondary', text: t('Sign it with your answer and the pool pays your wallet in NIM. {n} open now.', { n: b.open.length }) }),
      button(t('Earn {amount} — test chit', { amount }), () => navigate(chitPath(first.id)), 'primary', 'gift'),
    ],
  });
}

/* ------------------------------------------------------------------ compose */

export async function composeScreen(navigate: Navigate): Promise<void> {
  const [detection, info] = await Promise.all([detectWallet(), api.serverInfo()]);

  if (!info.ok) {
    mount(
      problemScreen(navigate, {
        title: t('chit is not reachable'),
        text: info.error,
        tone: info.code === 'offline' ? 'calm' : 'bad',
        actions: [button(t('Try again'), () => void composeScreen(navigate), 'quiet')],
      }),
    );
    return;
  }
  const chain = info.value.chain;
  const params = new URLSearchParams(window.location.search);

  let direction: 'paying' | 'earning' = params.get('dir') === 'paying' ? 'paying' : 'earning';
  /*
   * The chit this one answers. Every conversation around a chit is a new chit pointed back at
   * the old one — a counter-offer, a revision, a milestone, a mutual cancel — so there is one
   * mechanism and no inbox. The link is metadata: it never enters the signed text, because a
   * new field in the canonical form would change every digest ever computed.
   */
  const parentId = params.get('parent');
  let parentChit: ApiChit | null = null;
  const parentSlot = el('div', { class: 'slot' });
  let fields: DraftFields | null = null;
  let parserCurrency: string | null = null;
  let quote: Quote | null = null;
  let currencyAlternatives: string[] = [];
  let feedback: HTMLElement | null = null;

  const input = el('textarea', {
    class: 'field field--hero',
    attrs: {
      rows: 3,
      autocapitalize: 'sentences',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-label': t('The line you already agreed'),
      placeholder: t('$40 for 3 thumbnails by Friday'),
    },
  });

  const understood = el('div', { class: 'stack stack--tight' });
  const messages = el('div', { class: 'stack stack--tight' });
  const signButton = button(t('Sign it'), () => void sign(), 'primary');
  signButton.disabled = true;

  const earning = el('button', { class: 'seg__item', text: t('I’m getting paid'), attrs: { type: 'button' } });
  const paying = el('button', { class: 'seg__item', text: t('I’m paying'), attrs: { type: 'button' } });
  const intro = el('p', { class: 'small secondary' });
  function paintDirection(): void {
    earning.setAttribute('aria-pressed', String(direction === 'earning'));
    paying.setAttribute('aria-pressed', String(direction === 'paying'));
    intro.textContent =
      direction === 'earning'
        ? t('You sign. Whoever pays this link has accepted it, and the NIM lands in your wallet.')
        : t('You sign, they sign, then you pay. The payment carries the proof.');
  }
  earning.addEventListener('click', () => {
    direction = 'earning';
    paintDirection();
  });
  paying.addEventListener('click', () => {
    direction = 'paying';
    paintDirection();
  });
  paintDirection();
  const segmented = el('div', { class: 'seg', children: [earning, paying], attrs: { role: 'group', 'aria-label': t('Which way the money goes') } });

  async function reprice(): Promise<void> {
    if (!fields || fields.amountMinor === null || !fields.currency) {
      quote = null;
      render();
      return;
    }
    quote = null;
    render();
    const result = await fetchQuote(fields.amountMinor, fields.currency);
    if ('error' in result) feedback = note(result.error, 'warn');
    else {
      quote = result;
      feedback = null;
    }
    render();
  }

  function render(): void {
    understood.replaceChildren();
    if (!fields) return;
    const card = termsEditor({ fields, currencyAlternatives, onChange: () => void reprice() });
    if (quote) card.append(nimRow(nim(quote.luna)));
    understood.append(el('h2', { text: t('What we understood') }), card);
    if (fields.amountMinor !== null && fields.amountMinor > 1n && !/^(Half up front|Anzahlung)/i.test(fields.text)) {
      const half = button(
        t('Ask for half up front'),
        () => {
          const whole = fields!.amountMinor!;
          input.value = t('Half up front — {line}', { line: fields!.text });
          void (async () => {
            const parsed = await reparse();
            if (!parsed) return;
            parsed.amountMinor = whole / 2n;
            parsed.edited.add('amount');
            await reprice();
          })();
        },
        'inline',
        'shield',
      );
      understood.append(el('div', { class: 'row-actions', children: [half] }));
    }
    if (fields.amountMinor === null || !fields.currency) {
      understood.append(note(t('Add an amount and a currency — "$40", "€120", "₹3500" — so both sides are agreeing to the same number. You can also tap any line above to set it yourself.'), 'calm'));
    } else if (!quote && !feedback) {
      understood.append(status(t('Pricing it in NIM…'), 'waiting'));
    }
    // The words are what gets signed. If they say "$40" and the amount is now in EUR, the two
    // sides could read the same chit two ways — say so before anyone signs.
    if (fields.currency && parserCurrency && fields.edited.has('currency') && parserCurrency !== fields.currency) {
      understood.append(note(t('The words read as {a}, but the amount is set in {b}. Both sides sign the words — make sure they agree.', { a: parserCurrency, b: fields.currency }), 'warn'));
    }
    if (feedback) understood.append(feedback);
    signButton.disabled = !isReady(fields) || quote === null || detection.tier === 'none';
  }

  async function reparse(): Promise<DraftFields | null> {
    const value = input.value.trim();
    feedback?.remove();
    feedback = null;
    if (value.length === 0) {
      fields = null;
      quote = null;
      render();
      return null;
    }
    const parsed = parseTerms(value);
    const previous = fields;
    fields = fieldsFromTerms(parsed);
    parserCurrency = fields.currency;
    currencyAlternatives = parsed.currency?.alternatives ?? [];
    if (previous) {
      for (const field of previous.edited) {
        fields.edited.add(field);
        if (field === 'amount') fields.amountMinor = previous.amountMinor;
        if (field === 'currency') fields.currency = previous.currency;
        if (field === 'deadline') fields.deadlineDays = previous.deadlineDays;
        if (field === 'deliverables') fields.deliverables = previous.deliverables;
      }
    }
    await reprice();
    return fields;
  }

  async function sign(): Promise<void> {
    if (!fields || !quote) return;
    if (quoteExpired(quote)) {
      const refreshed = await fetchQuote(fields.amountMinor!, fields.currency!);
      if ('error' in refreshed) {
        understood.append(note(refreshed.error, 'warn'));
        return;
      }
      quote = refreshed;
      render();
    }
    await withBusy(signButton, t('Waiting for your wallet…'), async () => {
      const session = await connectOrExplain(messages, chain);
      if (!session) return;
      try {
        const draft = buildDraft({
          text: fields!.text,
          amountMinor: fields!.amountMinor!,
          currency: fields!.currency!,
          deadlineDays: fields!.deadlineDays,
          deliverables: fields!.deliverables,
          signer: session.address,
          direction,
          chain,
          quote: quote!,
        });
        const signature = await session.wallet.signText(draft.canonical);
        const created = await api.createChit(draft.canonical, signature, parentId ?? undefined);
        if (!created.ok) {
          messages.append(note(created.error, 'bad'));
          return;
        }
        navigate(chitPath(created.value.id));
      } catch (error) {
        const { message, tone } = explain(error);
        if (tone === 'calm') forgetWallet();
        messages.append(note(message, tone));
      }
    });
  }

  let debounce: ReturnType<typeof setTimeout>;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void reparse(), 220);
  });

  // The bounty lands when it lands; its slot holds its height so the page never jumps.
  const bounty = el('div', { class: 'slot', children: [skeleton('card')] });
  const about = el('button', { class: 'link-row foot__link', attrs: { type: 'button' }, children: [document.createTextNode(t('How chit works')), icon('arrow-right', 'icon--sm')] });
  about.addEventListener('click', () => navigate('/about'));

  mount(
    screen({
      header: topBar(navigate, 'compose'),
      title: t('Paste the deal. Get a receipt.'),
      body: [
        parentId ? parentSlot : el('p', { class: 'lead', text: t('For the clients you already talk to directly. They pay; you hold a receipt anyone can check. Proof of payment, not protection.') }),
        segmented,
        input,
        intro,
        understood,
        walletBanner(detection, window.location.href),
        messages,
        bounty,
        el('div', { class: 'foot', children: [about] }),
      ],
      actions: [signButton],
    }),
  );

  void bountyBanner(navigate).then((card) => {
    if (card) bounty.replaceChildren(card);
    else bounty.remove();
  });

  if (parentId) {
    void api.getChit(parentId).then((result) => {
      if (!result.ok) return;
      parentChit = result.value;
      parentSlot.replaceChildren(
        el('div', {
          class: 'card card--pad stack stack--tight',
          children: [
            el('div', { class: 'kicker kicker--quiet', text: t('In reply to') }),
            deal(parentChit.chit.text, true),
            el('p', { class: 'small muted', text: t('{amount} · this becomes a separate chit, and both of you sign it. The one above is untouched.', { amount: fiat(parentChit) }) }),
          ],
        }),
      );
    });
  }

  const prefill = params.get('text');
  if (prefill) {
    input.value = prefill;
    void reparse();
  }
  /*
   * An amount carried in the link, in minor units. Used by "the other half" and by "next
   * milestone", where the number is derived from a chit that already settled rather than
   * re-typed. The parser still runs first, so the words remain the source of truth.
   */
  const carriedAmount = params.get('amountMinor');
  if (carriedAmount && /^\d+$/.test(carriedAmount)) {
    void (async () => {
      const parsed = await reparse();
      if (!parsed) return;
      parsed.amountMinor = BigInt(carriedAmount);
      parsed.edited.add('amount');
      await reprice();
    })();
  }
}

/* ------------------------------------------------------------------ the chit */

export async function chitScreen(id: string, navigate: Navigate): Promise<void> {
  const settle = loadingSoon(() => skeletonScreen(navigate));
  const [result, detection] = await Promise.all([api.getChit(id), detectWallet()]);
  settle();

  if (!result.ok) {
    mount(
      problemScreen(navigate, {
        title: t('Not found'),
        text: result.error,
        tone: result.code === 'offline' ? 'calm' : 'bad',
        actions: [button(t('Try again'), () => void chitScreen(id, navigate), 'quiet'), button(t('Start a chit'), () => navigate('/'), 'plain')],
      }),
    );
    return;
  }

  const chit = result.value;
  const me = rememberedAddress();
  const isPayer = chit.chit.kind === 'quote' ? sameAddress(me, chit.settledFrom) : sameAddress(me, chit.chit.payer);
  const isWorker = sameAddress(me, chit.chit.payee) || sameAddress(me, chit.payTo);

  if (chit.settled) return settledScreen(chit, navigate, isPayer, isWorker);
  if (chit.declined) return declinedScreen(chit, navigate, isPayer);
  if (chit.bounty && !chit.countersigned) return bountyScreen(chit, detection, navigate);
  if (chit.chit.kind === 'quote') return isWorker ? quoteOwnerScreen(chit, navigate) : acceptQuoteScreen(chit, detection, navigate);
  if (!chit.countersigned) return isPayer ? shareScreen(chit, detection, navigate) : countersignScreen(chit, detection, navigate);
  return isPayer ? payScreen(chit, detection, navigate) : awaitingPaymentScreen(chit, navigate, isWorker);
}

/* ------------------------------------------------------------------ the bounty */

function bountyScreen(chit: ApiChit, detection: WalletDetection, navigate: Navigate): void {
  const messages = el('div', { class: 'stack stack--tight' });
  const answer = el('textarea', {
    class: 'field field--hero',
    attrs: { rows: 3, 'aria-label': t('Your answer'), placeholder: t('One sentence, in your own words'), autocomplete: 'off', spellcheck: 'true' },
  });
  const rules = t('At least 4 words. No links. Something nobody has said yet.');
  const counter = el('p', { class: 'small muted', text: rules });
  const claim = button(t('Sign and get paid'), () => void go(), 'primary');
  claim.disabled = true;
  answer.addEventListener('input', () => {
    const words = answer.value.trim().split(/\s+/).filter(Boolean).length;
    counter.textContent = words < 4 ? rules : count(words, '{n} word', '{n} words');
    claim.disabled = words < 4 || detection.tier === 'none';
  });

  async function go(): Promise<void> {
    await withBusy(claim, t('Waiting for your wallet…'), async () => {
      const session = await connectOrExplain(messages, chit.chit.chain);
      if (!session) return;
      try {
        // The device identifier keeps the bounty fair — one payout per device per day. Nimiq
        // Pay asks the user once; outside Nimiq Pay (demo) a fixed placeholder is used.
        const deviceHash = await requestDeviceHash(t('chit uses this to pay each device one bounty per day.'));
        const signature = await session.wallet.signText(chit.canonical);
        const result = await api.claimBounty(chit.id, signature, answer.value, deviceHash);
        if (!result.ok) {
          messages.append(note(result.error, result.code.startsWith('answer-') ? 'warn' : 'bad'));
          return;
        }
        navigate(chitPath(chit.id));
      } catch (error) {
        const { message, tone } = explain(error);
        if (tone === 'calm') forgetWallet();
        messages.append(note(message, tone));
      }
    });
  }

  mount(
    screen({
      header: topBar(navigate),
      title: t('Your first NIM'),
      body: [
        amountHero(chit, { label: t('Earn · paid by chit') }),
        deal(chit.chit.text),
        answer,
        counter,
        el('p', { class: 'small secondary', text: t('Signing is your answer. If it passes the rules — the same for everyone, no draw — the pool pays this amount to the wallet you sign with, and you hold a real receipt.') }),
        walletBanner(detection, chit.shareUrl),
        messages,
      ],
      actions: [claim, button(t('The rules and every payout'), () => navigate('/bounty'), 'plain')],
    }),
  );
}

/** The pool, in public: address, balance, rules, open bounties, every payout with its transaction. */
export async function bountyBoardScreen(navigate: Navigate): Promise<void> {
  const settle = loadingSoon(() => skeletonScreen(navigate));
  const result = await api.bounty();
  settle();
  if (!result.ok) {
    mount(
      problemScreen(navigate, {
        title: t('Bounty'),
        text: result.code === 'no-bounty' ? t('This deployment has no bounty pool.') : result.error,
        glyph: 'gift',
        actions: [button(t('New chit'), () => navigate('/'))],
      }),
    );
    return;
  }
  const b = result.value;
  const me = rememberedAddress();
  const first = b.open[0];

  // Every open bounty is the same job at the same price; a list of identical rows says
  // nothing a count does not. One row, the count, one button.
  const openBlock = first
    ? el('div', {
        class: 'list__item list__item--static',
        children: [
          el('div', {
            class: 'list__main',
            children: [
              el('div', { class: 'list__text list__text--wrap', text: first.chit.text }),
              el('div', { class: 'list__meta', text: `${t('{n} open', { n: b.open.length })} · ${t('{amount} each', { amount: moneyLocal(first.chit.amountMinor, first.chit.currency) })}` }),
            ],
          }),
          el('div', { class: 'list__side', children: [button(t('Take one'), () => navigate(chitPath(first.id)), 'inline', 'arrow-right')] }),
        ],
      })
    : emptyState({ icon: 'gift', title: t('Every bounty is taken for now.'), text: t('The next one opens shortly.') });

  const paidRows = b.paid.map((p) =>
    el('div', {
      class: 'list__item list__item--static',
      children: [
        el('div', {
          class: 'list__main',
          children: [
            el('div', { class: 'list__text list__text--wrap', text: `“${p.answer}”` }),
            el('div', { class: 'list__meta', children: [who(p.worker, me), document.createTextNode(` · ${formatDate(p.at)}`)] }),
          ],
        }),
        el('div', {
          class: 'list__side',
          children: [
            el('div', { class: 'list__amount', text: nimRound(p.luna) }),
            el('a', { class: 'link-row small', attrs: { href: explorerUrl(p.tx), target: '_blank', rel: 'noopener' }, children: [document.createTextNode('nimiq.watch'), icon('external', 'icon--sm')] }),
          ],
        }),
      ],
    }),
  );

  mount(
    screen({
      header: topBar(navigate, 'bounty'),
      title: t('Bounty'),
      body: [
        el('p', { class: 'lead', text: t('chit pays real chits for a sentence of feedback. Everything about the pool is public: the address, the balance, the rules, and every payout with its transaction.') }),
        el('div', {
          class: 'card',
          children: [
            party(b.address, t('Pool'), { me, full: true }),
            row(t('Balance'), b.balanceLuna === null ? t('unknown') : nimRound(b.balanceLuna), 'num'),
            row(t('Paid today'), `${count(b.paidToday, '{n} payout', '{n} payouts')} · ${nimRound(b.paidTodayLuna).replace(' NIM', '')} ${t('of')} ${nimRound(b.dailyCapLuna)}`, 'num'),
            b.funded ? null : row(t('Status'), t('Being funded — nothing is offered until it can pay'), 'bad'),
          ].filter((n): n is HTMLElement => n !== null),
        }),
        el('h2', { text: t('Open now') }),
        openBlock,
        details(t('The rules'), [el('ul', { class: 'rules', children: b.rules.map((r) => el('li', { text: r })) })], { cls: 'help' }),
        el('h2', { text: t('Every payout') }),
        paidRows.length ? el('div', { class: 'list', children: paidRows }) : emptyState({ icon: 'receipt', title: t('None yet.'), text: t('The first payout will appear here with its transaction.') }),
        el('p', { class: 'small muted', text: t('chit pays its own bounty from this pool. It never holds anyone else’s money. Funded by the founder; every payout above is on chain.') }),
      ],
      actions: [button(t('New chit'), () => navigate('/'))],
    }),
  );
}

/* ------------------------------------------------------------------ share (payer's open chit) */

function shareScreen(chit: ApiChit, detection: WalletDetection, navigate: Navigate): void {
  const link = chit.shareUrl;
  const me = rememberedAddress();
  const state = status(t('Nothing has been paid yet. You pay once they have signed — this screen will move on by itself.'), 'waiting');
  const messages = el('div', { class: 'stack stack--tight' });

  const poller = watchUntil({
    poll: async () => {
      const latest = await api.getChit(chit.id);
      return latest.ok ? latest.value : null;
    },
    done: (latest) => latest.countersigned || latest.declined === true,
    onDone: () => navigate(chitPath(chit.id)),
    onGiveUp: () => setStatus(state, t('Still waiting for their signature. You can close this — it is in your Activity.'), 'idle'),
  });

  // The demo worker: a labelled second party so one person can walk the whole flow alone.
  const demo = button(t('No one to send it to? Try the demo worker'), () => void tryDemo(), 'inline', 'user');
  async function tryDemo(): Promise<void> {
    await withBusy(demo, t('Signing as the demo worker…'), async () => {
      const result = await api.demoCountersign(chit.id);
      if (!result.ok) {
        messages.append(note(result.error, 'calm'));
        return;
      }
      navigate(chitPath(chit.id));
    });
  }

  mount(
    screen({
      header: topBar(navigate),
      title: t('Send this to them'),
      body: [
        el('p', { class: 'lead', text: t('They open it, read the same words you signed, and sign in Nimiq Pay. No account, no email.') }),
        testnetBanner(chit),
        amountHero(chit),
        deal(chit.chit.text),
        shareBlock(link),
        state,
        el('div', { class: 'card', children: [party(chit.chit.payer, t('From'), { me }), dueRow(chit), factRows(chit)] }),
        walletBanner(detection, link),
        messages,
        el('div', { class: 'foot', children: [demo] }),
      ],
      actions: [...shareActions(link, t('A chit to sign'), chit.chit.text), button(t('Done for now'), () => navigate('/'), 'plain')],
    }),
  );
  onLeave(poller.stop);
}

/* ------------------------------------------------------------------ quote (worker's open chit) */

function quoteOwnerScreen(chit: ApiChit, navigate: Navigate): void {
  const link = chit.shareUrl;
  const me = rememberedAddress();
  const state = status(t('Whoever pays this first is your client. Nothing is held anywhere — the payment lands in your wallet, and this screen moves on when it does.'), 'waiting');
  const poller = watchUntil({
    poll: async () => {
      const latest = await api.getChit(chit.id);
      return latest.ok ? latest.value : null;
    },
    done: (latest) => latest.settled,
    onDone: () => navigate(chitPath(chit.id)),
    onGiveUp: () => setStatus(state, t('No payment yet. Leave the link where clients can see it — it is in your Activity.'), 'idle'),
  });
  mount(
    screen({
      header: topBar(navigate),
      title: t('Your quote'),
      body: [
        el('p', { class: 'lead', text: t('Put this where the client is — the chat, your bio, a message. Paying it is accepting it.') }),
        testnetBanner(chit),
        amountHero(chit),
        deal(chit.chit.text),
        shareBlock(link),
        state,
        el('div', { class: 'card', children: [party(chit.chit.payee, t('Quoted by'), { me }), dueRow(chit), factRows(chit)] }),
      ],
      actions: [...shareActions(link, t('A quote to pay'), chit.chit.text), button(t('Done for now'), () => navigate('/'), 'plain')],
    }),
  );
  onLeave(poller.stop);
}

function acceptQuoteScreen(chit: ApiChit, detection: WalletDetection, navigate: Navigate): void {
  const messages = el('div', { class: 'stack stack--tight' });
  const me = rememberedAddress();
  const payButton = button(t('Pay {amount} in NIM', { amount: fiat(chit) }), () => void payFlow({ chit, recipient: chit.chit.payee, button: payButton, messages, navigate }), 'primary');
  if (detection.tier === 'none') payButton.disabled = true;
  const strip = el('div', { class: 'slot', children: [skeleton('line')] });
  void workerStrip(chit.chit.payee).then((node) => (node ? strip.replaceChildren(node) : strip.remove()));
  mount(
    screen({
      header: topBar(navigate),
      title: t('A quote for you'),
      body: [
        amountHero(chit, { huge: true }),
        testnetBanner(chit),
        deal(chit.chit.text),
        el('div', { class: 'card', children: [party(chit.chit.payee, t('Quoted by'), { me, nameable: true }), dueRow(chit), factRows(chit)] }),
        strip,
        el('p', { class: 'small secondary', text: t('Paying this accepts these exact words. The money goes straight to the wallet that signed the quote — nothing is held on the way.') }),
        walletBanner(detection, chit.shareUrl),
        noNimHelp(),
        messages,
      ],
      actions: [payButton, button(t('Not now'), () => navigate('/'), 'plain')],
    }),
  );
}

/* ------------------------------------------------------------------ countersign */

function countersignScreen(chit: ApiChit, detection: WalletDetection, navigate: Navigate): void {
  const signButton = button(t('Sign it'), () => void go(), 'primary');
  const messages = el('div', { class: 'stack stack--tight' });
  const me = rememberedAddress();
  if (detection.tier === 'none') signButton.disabled = true;

  const strip = el('div', { class: 'slot', children: [skeleton('line')] });
  void payerStrip(chit.chit.payer, fiat(chit)).then((node) => strip.replaceChildren(node));

  async function go(): Promise<void> {
    await withBusy(signButton, t('Waiting for your wallet…'), async () => {
      const session = await connectOrExplain(messages, chit.chit.chain);
      if (!session) return;
      try {
        const signature = await session.wallet.signText(chit.canonical);
        const result = await api.countersign(chit.id, signature);
        if (!result.ok) {
          messages.append(note(result.error, 'bad'));
          return;
        }
        navigate(chitPath(chit.id));
      } catch (error) {
        const { message, tone } = explain(error);
        if (tone === 'calm') forgetWallet();
        messages.append(note(message, tone));
      }
    });
  }

  // Declining is a real answer, recorded, so the payer is not left waiting on a link.
  const decline = button(t('Decline'), () => void doDecline(), 'quiet');
  async function doDecline(): Promise<void> {
    await withBusy(decline, t('Declining…'), async () => {
      const result = await api.decline(chit.id);
      if (!result.ok) {
        messages.append(note(result.error, 'calm'));
        return;
      }
      navigate(chitPath(chit.id));
    });
  }

  /*
   * The third answer. Until now a worker could sign or disappear; Fiverr and Upwork both have
   * a custom offer, and sellers negotiate on nearly every order. This opens the composer with
   * the same words, pointed back at this chit, in the direction that lets the worker set the
   * number — so the client accepts by paying, and nobody has to sign twice.
   */
  const counter = button(
    t('Ask for a change'),
    () => navigate(`/?dir=earning&parent=${encodeURIComponent(chit.id)}&amountMinor=${chit.chit.amountMinor}&text=${encodeURIComponent(chit.chit.text)}`),
    'quiet',
    'pen',
  );

  mount(
    screen({
      header: topBar(navigate),
      title: t('Someone wants to agree this with you'),
      body: [
        amountHero(chit, { huge: true, label: t('You would be paid') }),
        testnetBanner(chit),
        deal(chit.chit.text),
        el('div', { class: 'card', children: [party(chit.chit.payer, t('From'), { me, nameable: true }), dueRow(chit), factRows(chit)] }),
        strip,
        el('p', { class: 'small secondary', text: t('Signing means you agree to these exact words. It does not move any money — they pay after you sign, and the payment goes to the wallet you sign with.') }),
        /*
         * The scam freelancers describe most often is: move the conversation off-platform, then
         * ask for a deposit. chit's flow has the same shape — a stranger, a chat, a link — so the
         * difference has to be said on the screen where it would happen, not in a help page.
         */
        note(t('chit never asks you to deposit, or to pay a fee to be paid. If anyone asks you to send money first, it is a scam — leave.'), 'calm'),
        walletBanner(detection, chit.shareUrl),
        messages,
      ],
      actions: [signButton, counter, decline, button(t('Not now'), () => navigate('/'), 'plain')],
    }),
  );
}

function declinedScreen(chit: ApiChit, navigate: Navigate, isPayer: boolean): void {
  const me = rememberedAddress();
  mount(
    screen({
      header: topBar(navigate),
      title: isPayer ? t('They declined') : t('You declined'),
      body: [
        amountHero(chit),
        deal(chit.chit.text, true),
        el('div', { class: 'card', children: [party(chit.chit.payer, t('From'), { me })] }),
        note(isPayer ? t('They chose not to sign these words. Nothing was paid. Change the line and send a new one.') : t('You chose not to sign. Nothing was paid, and nothing more will happen with this link.'), 'calm'),
      ],
      actions: [
        isPayer
          ? button(t('Send a new one'), () => navigate(`/?dir=paying&text=${encodeURIComponent(chit.chit.text)}`), 'primary', 'pen')
          : button(t('New chit'), () => navigate('/'), 'quiet'),
      ],
    }),
  );
}

/* ------------------------------------------------------------------ pay */

/**
 * Where NIM comes from, for a client who holds none. Only what is verified is stated
 * (research/verification/04 §2a); where it depends on the country, it says so.
 */
function noNimHelp(): HTMLElement {
  return details(
    t('No NIM yet?'),
    [
      el('p', { text: t('NIM is the coin this pays in. Nimiq Pay holds it but does not sell it. The Nimiq Wallet at wallet.nimiq.com sells NIM by card or bank transfer in many countries — fees 1–4%, a few dollars minimum, availability depends on where you are — and you then send it to your Nimiq Pay address.') }),
      el('p', { text: t('Or earn your first NIM here: the bounty on the home screen pays a real chit for one sentence of feedback.') }),
      el('a', { class: 'link-row', attrs: { href: 'https://wallet.nimiq.com', target: '_blank', rel: 'noopener' }, children: [document.createTextNode('wallet.nimiq.com'), icon('external', 'icon--sm')] }),
    ],
    { cls: 'help' },
  );
}

/** Where NIM goes, for a freelancer who has just been paid in it. The question every one of them asks. */
function cashOutHelp(): HTMLElement {
  return details(
    t('Turning NIM into money'),
    [
      el('p', { text: t('The NIM is in your Nimiq Pay wallet now, and it is yours — nothing is held by chit. To turn it into your own currency, send it to an exchange that lists NIM and sell it there, or use the Nimiq Wallet’s swap into USDC or USDT and cash out from that. Which of these is open to you depends on your country; chit does not sell or swap anything itself.') }),
      /*
       * A measured, expensive trap. KuCoin's NIM withdrawal fee is 1,500 NIM against a
       * 3,000 NIM minimum — half the money at the floor — while its USDT withdrawal is
       * 0.80 USDT. Read from KuCoin's own currencies endpoint, 6 Sep 2026. A freelancer who
       * moves NIM the wrong way once loses more than every platform fee chit saves them.
       */
      el('p', { children: [el('strong', { text: t('One rule that saves money: ') }), document.createTextNode(t('send NIM to an exchange, never withdraw NIM from one. Sell it there and withdraw the stablecoin instead — withdrawing NIM itself can cost a large share of a small balance.'))] }),
      el('p', { text: t('Many freelancers simply keep it: the next chit you pay a collaborator, or the next tool you buy, can be paid in NIM directly.') }),
    ],
    { cls: 'help' },
  );
}

/**
 * The one payment path. The fiat number is the contract: the payment is re-quoted now and
 * the larger of the signed and fresh NIM is sent, so the worker is never short of either.
 */
async function payFlow(input: { chit: ApiChit; recipient: string; button: HTMLButtonElement; messages: HTMLElement; navigate: Navigate }): Promise<void> {
  const { chit, recipient, messages, navigate } = input;
  await withBusy(input.button, t('Waiting for your wallet…'), async () => {
    const session = await connectOrExplain(messages, chit.chit.chain);
    if (!session) return;
    try {
      const signed = BigInt(chit.chit.luna);
      let luna = signed;
      const fresh = await fetchQuote(BigInt(chit.chit.amountMinor), chit.chit.currency);
      if (!('error' in fresh) && BigInt(fresh.luna) > signed) {
        luna = BigInt(fresh.luna);
        messages.append(note(t('The rate moved since this was signed. Keeping the agreed {amount} whole is now {nim}.', { amount: fiat(chit), nim: nim(luna.toString(10)) }), 'calm'));
      }
      await session.wallet.pay({ recipient, luna, data: chit.id });
      const waiting = status(t('Sent. Watching the chain…'), 'waiting');
      messages.append(waiting);
      const poller = watchUntil({
        poll: async () => {
          const latest = await api.getChit(chit.id);
          return latest.ok ? latest.value : null;
        },
        done: (latest) => latest.settled,
        onDone: () => navigate(chitPath(chit.id)),
        onGiveUp: () => {
          setStatus(waiting, t('Your payment was sent. It has not appeared on chain yet — that is unusual but not lost. Check again in a moment.'), 'warn');
          messages.append(button(t('Check again'), () => navigate(chitPath(chit.id)), 'quiet'));
        },
      });
      onLeave(poller.stop);
    } catch (error) {
      const { message, tone } = explain(error);
      if (tone === 'calm') forgetWallet();
      messages.append(note(message, tone));
    }
  });
}

function payScreen(chit: ApiChit, detection: WalletDetection, navigate: Navigate): void {
  const payTo = chit.payTo;
  const me = rememberedAddress();
  const payButton = button(t('Pay {amount} in NIM', { amount: fiat(chit) }), () => void pay(), 'primary');
  const messages = el('div', { class: 'stack stack--tight' });
  if (detection.tier === 'none' || !payTo) payButton.disabled = true;
  async function pay(): Promise<void> {
    if (!payTo) return;
    await payFlow({ chit, recipient: payTo, button: payButton, messages, navigate });
  }
  const demoNote = chit.demoWorker ? note(t('Signed by the demo worker — a labelled stand-in so you can see the whole flow. It keeps whatever you pay it.'), 'warn') : null;
  // The worker's record, before money moves. The highest-voted complaint in the review corpus
  // is a freelancer who delivered and never got paid; the mirror of that is a client paying a
  // wallet they know nothing about.
  const strip = el('div', { class: 'slot', children: [skeleton('line')] });
  if (payTo) void workerStrip(payTo).then((node) => (node ? strip.replaceChildren(node) : strip.remove()));
  mount(
    screen({
      header: topBar(navigate),
      title: t('They signed. Time to pay.'),
      body: [
        amountHero(chit, { huge: true }),
        testnetBanner(chit),
        deal(chit.chit.text),
        demoNote,
        deliveredBlock(chit, false),
        el('div', {
          class: 'card',
          children: [
            payTo ? party(payTo, t('Goes to'), { me, nameable: true }) : stripLine(t('Waiting for their signature before there is anywhere to send this.'), 'clock'),
            dueRow(chit),
            factRows(chit),
          ],
        }),
        strip,
        el('p', { class: 'small secondary', text: t('The exact NIM is priced when you tap Pay, so the agreed amount stays whole. It goes straight to their wallet — nothing is held on the way, and a payment cannot be reversed.') }),
        walletBanner(detection, chit.shareUrl),
        noNimHelp(),
        messages,
      ],
      actions: [payButton, button(t('Later'), () => navigate('/'), 'plain')],
    }),
  );
}

/**
 * "Here it is" — what the worker signs, and what the payer then sees.
 *
 * The mark is a second signed statement over its own canonical form, so it is evidence that
 * that wallet said it about that chit at a recorded time. It obliges nobody: the payer still
 * decides, and the copy says so on both sides. The link is stored as a string and the file
 * never touches chit — storage is a different product with a different liability.
 */
function deliveredBlock(chit: ApiChit, viewerIsWorker: boolean): HTMLElement | null {
  const delivered = chit.delivery;
  if (!delivered) return null;
  const children: Array<Node | null> = [
    el('div', { class: 'kicker', text: viewerIsWorker ? t('You marked it delivered') : t('They marked it delivered') }),
    el('p', { class: 'small secondary', text: t('Signed by the wallet being paid, on {when}. It is a record, not a receipt — nothing has been paid because of it.', { when: formatDate(delivered.at) }) }),
  ];
  if (delivered.note) children.push(deal(delivered.note, true));
  if (delivered.link) {
    children.push(
      el('a', {
        class: 'link-row',
        attrs: { href: delivered.link, target: '_blank', rel: 'noopener noreferrer' },
        children: [document.createTextNode(t('Open the delivery')), icon('external', 'icon--sm')],
      }),
      el('p', { class: 'small muted', text: displayLink(delivered.link) }),
    );
  }
  return el('div', { class: 'card card--pad stack stack--tight', children: children.filter((c): c is Node => c !== null) });
}

/**
 * The form the worker fills in to say it. One optional link, one optional sentence — because
 * plenty of work is handed over in the chat it was agreed in, and a mark with no link is
 * still the state change that matters.
 */
function deliverPanel(chit: ApiChit, navigate: Navigate): HTMLElement {
  const messages = el('div', { class: 'stack stack--tight' });
  const link = el('input', {
    class: 'field',
    attrs: { type: 'url', inputmode: 'url', autocomplete: 'off', spellcheck: 'false', 'aria-label': t('A link to the work'), placeholder: t('https://… (optional)') },
  });
  const noteInput = el('input', {
    class: 'field',
    attrs: { type: 'text', maxlength: 200, autocomplete: 'off', 'aria-label': t('One line about it'), placeholder: t('One line about it (optional)') },
  });
  const send = button(t('Mark it delivered'), () => void go(), 'quiet', 'check');

  async function go(): Promise<void> {
    await withBusy(send, t('Waiting for your wallet…'), async () => {
      const session = await connectOrExplain(messages, chit.chit.chain);
      if (!session) return;
      try {
        const canonical = canonicaliseDelivery({ chitId: chit.id, link: link.value.trim(), note: noteInput.value.trim() });
        const signature = await session.wallet.signText(canonical);
        const result = await api.markDelivered(chit.id, signature, link.value.trim(), noteInput.value.trim());
        if (!result.ok) {
          messages.append(note(result.error, 'warn'));
          return;
        }
        navigate(chitPath(chit.id));
      } catch (error) {
        const { message, tone } = explain(error);
        if (tone === 'calm') forgetWallet();
        messages.append(note(message, tone));
      }
    });
  }
  return details(
    t('Say it is delivered'),
    [
      el('p', { class: 'small secondary', text: t('Signs one line with your wallet saying you handed the work over. It moves no money and obliges nobody to pay — it is a record, and the other side can see it.') }),
      link,
      noteInput,
      send,
      messages,
    ],
    { cls: 'help' },
  );
}

function awaitingPaymentScreen(chit: ApiChit, navigate: Navigate, isWorker: boolean): void {
  const me = rememberedAddress();
  const state = status(
    isWorker
      ? t('You signed. They can pay now — when it lands you will have a receipt anyone can check, and this screen will move on by itself.')
      : t('Both parties have signed. Waiting for the payment to land.'),
    'waiting',
  );
  const poller = watchUntil({
    poll: async () => {
      const latest = await api.getChit(chit.id);
      return latest.ok ? latest.value : null;
    },
    done: (latest) => latest.settled,
    onDone: () => navigate(chitPath(chit.id)),
    onGiveUp: () => setStatus(state, t('Still waiting on their payment. Nothing is wrong — it is in your Activity, and you can come back any time.'), 'idle'),
  });
  mount(
    screen({
      header: topBar(navigate),
      title: isWorker ? t('You signed it') : t('Both signed'),
      body: [
        amountHero(chit),
        testnetBanner(chit),
        deal(chit.chit.text),
        state,
        deliveredBlock(chit, isWorker),
        el('div', { class: 'card', children: [party(chit.chit.payer, t('From'), { me, nameable: isWorker }), dueRow(chit), factRows(chit)] }),
        isWorker && !chit.delivery ? deliverPanel(chit, navigate) : null,
      ],
      actions: [button(t('Check now'), () => navigate(chitPath(chit.id)), 'quiet')],
    }),
  );
  onLeave(poller.stop);
}

/* ------------------------------------------------------------------ settled */

/** The receipt: what was agreed, who paid whom, and where on the chain it lives. */
function receipt(chit: ApiChit, me: string | null, isWorker: boolean): HTMLElement {
  const paidBy = chit.chit.kind === 'quote' ? chit.settledFrom : chit.chit.payer;
  const paidTo = chit.payTo;

  // Each party once. The one that is not you is a nameable block — so the third receipt
  // from the same client reads "Acme" — and the one that is you is a row.
  const parties: HTMLElement[] = [];
  if (paidBy) parties.push(sameAddress(me, paidBy) ? row(t('Paid by'), who(paidBy, me)) : party(paidBy, t('Paid by'), { me, nameable: true, size: 32 }));
  if (paidTo) parties.push(sameAddress(me, paidTo) ? row(t('Paid to'), who(paidTo, me)) : party(paidTo, t('Paid to'), { me, nameable: true, size: 32 }));

  /*
   * The reference, the way a bank shows one.
   *
   * Every receipt a freelancer holds today is an assertion by whoever was holding the money,
   * and a screenshot of it is a dead end. A reference is a lookup: this is the string to give
   * anyone who needs to check the payment, and it is one tap to copy.
   */
  const reference = el('div', {
    class: 'reference',
    children: [
      el('div', { class: 'line__label', text: t('Reference') }),
      copyable(chit.id, chit.id, t('Copied'), t('Copy')),
      el('p', { class: 'small muted', text: t('Give this to anyone who needs to check the payment.') }),
    ],
  });
  if (chit.settledTx) parties.push(explorerRow(chit.settledTx));

  return el('div', {
    class: 'receipt',
    children: [
      el('div', {
        class: 'receipt__head',
        children: [
          el('div', { class: 'receipt__check', children: [icon('check')] }),
          el('div', {
            children: [el('div', { class: 'receipt__title', text: t('Settled on chain') }), chit.settledAt ? el('div', { class: 'receipt__when', text: formatDate(chit.settledAt) }) : null],
          }),
        ],
      }),
      /*
       * The words before the number.
       *
       * The reason a Venmo payment is legible in a screenshot is that the note is part of the
       * payment, not a caption under it. A receipt that leads with an amount says how much; a
       * receipt that leads with the sentence says what for — which is the thing in dispute.
       */
      deal(chit.chit.text),
      amountHero(chit, { huge: true }),
      // Every fiat receipt in the field is a promise about a future date. This one is not.
      el('p', { class: 'receipt__final', text: t('Nothing is pending, nothing can be reversed, and nobody is holding it.') }),
      chit.settledLuna && chit.settledLuna !== chit.chit.luna
        ? note(
            BigInt(chit.settledLuna) > BigInt(chit.chit.luna)
              ? t('They sent {actual} — more than the {agreed} agreed. All of it is yours.', { actual: nim(chit.settledLuna), agreed: nim(chit.chit.luna) })
              : t('They sent {actual}, against {agreed} agreed. The rate moved between signing and paying; chit accepts a small difference so a payment is never stranded.', { actual: nim(chit.settledLuna), agreed: nim(chit.chit.luna) }),
            'calm',
          )
        : null,
      el('hr', { class: 'receipt__cut' }),
      el('div', { children: parties }),
      reference,
      /*
       * The most quotable line in the app, on the object a freelancer actually shows people.
       * It lived on the Activity screen, which is the one screen nobody else ever sees.
       * Stated per payment and captioned literally: this is arithmetic, not a claim.
       */
      chit.delivery ? el('p', { class: 'receipt__delivered', text: t('Marked delivered on {when}', { when: formatDate(chit.delivery.at) }) }) : null,
      isWorker ? el('p', { class: 'receipt__kept', text: t('You kept all of it. A 20% marketplace cut would have been {amount}.', { amount: nimRound((BigInt(chit.chit.luna) / 5n).toString(10)) }) }) : null,
      factRows(chit, { settled: true }),
    ],
  });
}

/**
 * The block that turns a receipt into an invoice, and only appears on paper.
 *
 * Most chits sit inside the small-invoice reliefs — Germany's §33 UStDV at €250 and the UK's
 * VAT Notice 700 §16.6.1 at £250 — which ask for the supplier's name and address, the date,
 * what the service was and the total with a rate or an exemption note. Nothing about the
 * customer, no number, no VAT identifier. The deal line is the service, the settlement date
 * is the date, the amount is the total; the only thing chit does not otherwise know is who
 * the freelancer is, and that is typed once and kept on the device.
 *
 * It renders `hidden` on screen and visible in print, so nothing about it is stored, sent or
 * shown to the other party.
 */
function invoiceHead(chit: ApiChit): HTMLElement | null {
  const identity = readIdentity();
  if (!hasIdentity(identity)) return null;
  const lines: Array<Node | null> = [
    el('div', { class: 'invoice__name', text: identity.name }),
    identity.address ? el('div', { class: 'invoice__address', text: identity.address }) : null,
    identity.contact ? el('div', { class: 'invoice__address', text: identity.contact }) : null,
    identity.taxId ? el('div', { class: 'invoice__address', text: identity.taxId }) : null,
  ];
  return el('div', {
    class: 'invoice',
    attrs: { 'aria-hidden': 'true' },
    children: [
      el('div', { class: 'invoice__from', children: lines.filter((n) => n !== null) }),
      el('div', {
        class: 'invoice__meta',
        children: [
          el('div', { class: 'invoice__title', text: t('Invoice') }),
          chit.settledAt ? el('div', { text: formatDate(chit.settledAt) }) : null,
          el('div', { class: 'mono', text: chit.id }),
        ].filter((n) => n !== null),
      }),
    ],
  });
}

/** The tax sentence, printed under the total. Free text, because the wording is local. */
function invoiceTaxNote(): HTMLElement | null {
  const { taxNote } = readIdentity();
  return taxNote ? el('p', { class: 'invoice__note', text: taxNote, attrs: { 'aria-hidden': 'true' } }) : null;
}

/**
 * Where the freelancer types who they are. On the device, once — and the panel says so,
 * because a product whose promise is that it stores nothing about you has to be believed.
 */
function identityPanel(onSaved: () => void): HTMLElement {
  const current = readIdentity();
  const field = (key: keyof Identity, label: string, placeholder: string, multiline = false): HTMLElement =>
    el(multiline ? 'textarea' : 'input', {
      class: 'field',
      attrs: {
        ...(multiline ? { rows: 3 } : { type: 'text' }),
        autocomplete: 'off',
        'aria-label': label,
        placeholder,
        'data-identity': key,
        ...(multiline ? {} : { value: current[key] }),
      },
      ...(multiline ? { text: current[key] } : {}),
    });

  const name = field('name', t('Your name or trading name'), t('Your name or trading name'));
  const address = field('address', t('Address'), t('Address'), true);
  const taxId = field('taxId', t('Tax or VAT number, if you have one'), t('Tax or VAT number, if you have one'));
  const contact = field('contact', t('Email or website'), t('Email or website'));
  const taxNote = field('taxNote', t('Tax line, if your country needs one'), t('e.g. VAT exempt under §19 UStG'), true);

  const save = button(t('Save on this device'), () => {
    writeIdentity({
      name: (name as HTMLInputElement).value,
      address: (address as HTMLTextAreaElement).value,
      taxId: (taxId as HTMLInputElement).value,
      contact: (contact as HTMLInputElement).value,
      taxNote: (taxNote as HTMLTextAreaElement).value,
    });
    onSaved();
  }, 'quiet', 'check');

  return details(
    hasIdentity(current) ? t('Your invoice details') : t('Add your details to the invoice'),
    [
      el('p', { class: 'small secondary', text: t('Printed on the invoice, kept in this browser, and never sent to chit or shown to the other side. Most small invoices need only a name, an address and a line about tax.') }),
      name,
      address,
      contact,
      taxId,
      taxNote,
      save,
    ],
    { cls: 'help' },
  );
}

function settledScreen(chit: ApiChit, navigate: Navigate, isPayer: boolean, isWorker: boolean): void {
  const me = rememberedAddress();
  const dir = isWorker ? 'earning' : 'paying';
  const again = button(t('Same again'), () => navigate(`/?dir=${dir}&text=${encodeURIComponent(chit.chit.text)}`), 'quiet', 'pen');
  const print = button(t('Print / save as PDF'), () => window.print(), 'plain', 'print');
  const link = receiptLink(chit);
  /*
   * What comes after a settled chit. A half-up-front chit gets its other half, at the same
   * number; anything else gets the next step of the same job. Both are ordinary chits with a
   * parent, so the record reads as a series and nothing new had to be signed into the format.
   */
  const wasDeposit = /^(Half up front|Anzahlung)/i.test(chit.chit.text);
  const rest = wasDeposit ? chit.chit.text.replace(/^(Half up front|Anzahlung)\s*[—–-]\s*/i, '') : chit.chit.text;
  const nextStep = button(
    wasDeposit ? t('The other half') : t('Next step of this job'),
    () =>
      navigate(
        `/?dir=${dir}&parent=${encodeURIComponent(chit.id)}&amountMinor=${chit.chit.amountMinor}&text=${encodeURIComponent(
          wasDeposit ? t('On delivery — {line}', { line: rest }) : rest,
        )}`,
      ),
    'quiet',
    'arrow-right',
  );
  const actions: Array<HTMLElement | null> = [
    link ? button(t('Open the receipt'), () => navigate(link), 'primary', 'receipt') : null,
    nextStep,
    again,
    el('div', { class: 'row-actions', children: [print, button(t('Start another'), () => navigate('/'), 'plain')] }),
  ];
  mount(
    screen({
      header: topBar(navigate),
      title: isWorker ? t('You were paid') : t('Paid'),
      body: [
        lateBadge(chit) ? el('div', { class: 'row-actions', children: [lateBadge(chit)] }) : null,
        testnetBanner(chit),
        chit.bounty ? note(t('A bounty, paid by chit for your answer: “{answer}”', { answer: chit.answer ?? '' }), 'good') : null,
        // Printed only: the head a bookkeeper needs, above the receipt a person reads.
        invoiceHead(chit),
        receipt(chit, me, isWorker),
        invoiceTaxNote(),
        note(
          isWorker
            ? t('That is yours. This receipt is the agreement — anyone can check it against the chain, with no account.')
            : t('This receipt is the agreement. Anyone can check it against the chain, with no account.'),
          'good',
        ),
        isWorker ? identityPanel(() => settledScreen(chit, navigate, isPayer, isWorker)) : null,
        isWorker ? cashOutHelp() : null,
      ],
      actions: actions.filter((node): node is HTMLElement => node !== null),
    }),
  );
}

/* ------------------------------------------------------------------ verify */

/**
 * The receipt, checked without us where the link allows it.
 *
 * A receipt link can carry the signed words in its fragment (`#c=…`). When it does, the
 * browser recomputes the digest from those words, reads the transaction straight from a
 * public Nimiq node — the RPC allows browser calls — and checks that the memo *is* that
 * digest and the money went to the wallet the words name. None of that touches chit's
 * server, so a receipt outlives it. The signatures are still checked by the server, and
 * the page says which check came from where — the badge never claims more than was done.
 */
export async function verifyScreen(txHash: string, navigate: Navigate): Promise<void> {
  const settle = loadingSoon(() => skeletonScreen(navigate));
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('c');
  let carried: { canonical: string; digest: string; payee: string } | null = null;
  if (fragment) {
    try {
      const canonical = new TextDecoder().decode(fromBase64Url(fragment));
      const parsed = parseCanonical(canonical);
      carried = { canonical, digest: chitHash(parsed), payee: parsed.payee };
    } catch {
      carried = null;
    }
  }

  const [result, onChain] = await Promise.all([api.verify(txHash), carried ? readChainTransaction(txHash) : Promise.resolve(null)]);
  settle();

  if (!result.ok && !carried) {
    mount(
      problemScreen(navigate, {
        title: t('Nothing to show'),
        text: result.code === 'not-found' ? t('No chit has settled with that transaction. Check the link, or the payment may not have landed yet.') : result.error,
        tone: result.code === 'offline' ? 'calm' : 'bad',
        glyph: 'receipt',
        actions: [button(t('Try again'), () => void verifyScreen(txHash, navigate), 'quiet'), button(t('What is chit?'), () => navigate('/about'), 'plain')],
      }),
    );
    return;
  }

  const me = rememberedAddress();

  // What the browser established on its own, if the link carried the words.
  const browserRows: HTMLElement[] = [];
  let browserOk: boolean | null = null;
  if (carried) {
    if (onChain) {
      const memoMatch = onChain.memo === carried.digest;
      const payeeMatch = !carried.payee || sameAddress(onChain.to, carried.payee);
      browserOk = memoMatch && payeeMatch;
      browserRows.push(
        row(t('Digest in the payment'), memoMatch ? t('matches these words') : t('does NOT match'), memoMatch ? 'good' : 'bad'),
        row(t('Paid to'), payeeMatch ? who(onChain.to, me) : `${shortAddress(onChain.to)} — ${t('not the wallet the words name')}`, payeeMatch ? '' : 'bad'),
        row(t('Amount on chain'), nim(onChain.value.toString(10)), 'num'),
        row(t('Block'), String(onChain.blockNumber), 'num'),
      );
    } else {
      browserRows.push(row(t('Chain'), t('could not be read from your browser just now')));
    }
  }

  const chit = result.ok ? result.value : null;
  const serverOk = chit?.verification?.ok === true;
  const good = browserOk === true || (browserOk === null && serverOk);
  const canonical = chit?.canonical ?? carried?.canonical ?? '';
  const text = chit?.chit.text ?? (carried ? parseCanonical(carried.canonical).text : '');
  const paidBy = chit ? (chit.chit.kind === 'quote' ? chit.settledFrom : chit.chit.payer) : null;

  const checkedBy = browserOk === true ? t('Checked in your browser, against the chain') : browserOk === false ? t('The chain disagrees with these words') : t('Checked by chit’s server');

  mount(
    screen({
      header: topBar(navigate),
      title: good ? t('This is genuine') : t('This does not check out'),
      body: [
        el('div', {
          class: 'row-actions',
          children: [el('span', { class: `badge ${good ? 'badge--good' : 'badge--bad'}`, children: [icon(good ? 'shield' : 'alert'), document.createTextNode(good ? checkedBy : (chit?.verification?.detail ?? t('Verification failed')))] })],
        }),
        chit?.chit.chain === 'test' ? note(t('This is a test-network chit. The signatures are real, but no real money moved — the amount below is not spendable.'), 'warn') : null,
        // The sentence first, then the number: what the payment was for is the thing in dispute.
        deal(text),
        chit ? amountHero(chit, { huge: true }) : null,
        el('div', {
          class: 'card',
          children: [
            chit ? row(t('Both signed'), chit.chit.kind === 'quote' ? t('quote — paying accepted it') : chit.verification?.countersigned ? t('yes') : t('no')) : null,
            chit ? row(t('On chain'), chit.settledTx ? t('block {n}', { n: chit.settledBlock ?? 0 }) : t('not yet'), 'num') : null,
            chit?.settledAt ? row(t('Paid on'), formatDate(chit.settledAt)) : null,
            paidBy ? row(t('Paid by'), who(paidBy, me)) : null,
            chit?.payTo ? row(t('Paid to'), who(chit.payTo, me)) : null,
            chit?.settledTx ? explorerRow(chit.settledTx) : null,
          ].filter((n): n is HTMLElement => n !== null),
        }),
        browserRows.length
          ? el('div', { class: 'card card--pad', children: [el('div', { class: 'kicker', text: browserOk === null ? t('Your browser’s own check') : checkedBy }), ...browserRows] })
          : el('p', { class: 'small muted', text: t('This link does not carry the signed words, so the payment was checked by chit’s server. A link from the receipt screen carries them and is checked in your browser.') }),
        chit ? el('p', { class: 'small muted', text: t('Signatures checked by chit’s server.') }) : null,
        details(
          t('Show exactly what was signed'),
          [
            el('pre', { class: 'card mono small signed', text: canonical }),
            el('p', { class: 'small muted', text: t('Every line above was signed by the wallets involved and anchored to the payment. Nothing here was typed by chit.') }),
          ],
          { cls: 'help' },
        ),
      ],
      actions: [button(t('What is chit?'), () => navigate('/about'), 'quiet')],
    }),
  );
}

/* ------------------------------------------------------------------ activity */

function statusOf(chit: ApiChit): { label: string; cls: string } {
  if (chit.settled) return { label: t('Paid'), cls: 'pill pill--good' };
  if (chit.declined) return { label: t('Declined'), cls: 'pill' };
  if (chit.bounty) return { label: t('Bounty'), cls: 'pill pill--open' };
  if (chit.chit.kind === 'quote') return { label: t('Quote'), cls: 'pill pill--open' };
  if (chit.countersigned) return { label: t('Signed — unpaid'), cls: 'pill pill--warn' };
  return { label: t('Waiting for signature'), cls: 'pill' };
}

/** How long ago, in the words a person uses about a debt. */
function ageOf(createdAt: number): string {
  const days = Math.floor((Date.now() - createdAt) / 86_400_000);
  if (days <= 0) return t('today');
  if (days === 1) return t('since yesterday');
  return t('for {n} days', { n: days });
}

/**
 * One unpaid chit, with a nudge.
 *
 * There are no reminders on this platform and there never will be, so the only thing that
 * can chase a client is the person owed. This makes that one tap: the same link, with a line
 * already written, handed to whichever share sheet the phone has.
 */
function owedRow(chit: ApiChit, me: string | null, navigate: Navigate): HTMLElement {
  const other = chit.chit.kind === 'quote' ? null : chit.chit.payer;
  const message = t('Still open: “{line}” — {amount}. Here is the chit: {link}', {
    line: chit.chit.text,
    amount: fiat(chit),
    link: chit.shareUrl,
  });
  // Icon only: the row's job is to show the debt, and a labelled button ate a third of the
  // width and truncated the deal to four words.
  const nudge = el('button', {
    class: 'btn btn--inline owed__nudge',
    attrs: { type: 'button', 'aria-label': t('Nudge'), title: t('Nudge') },
    children: [icon('share')],
  });
  nudge.addEventListener('click', () => {
    if (typeof navigator.share === 'function') {
      void navigator.share({ title: t('A chit to sign'), text: message }).catch(() => {
        /* the sheet was dismissed — nothing to say */
      });
      return;
    }
    void navigator.clipboard.writeText(message).then(() => {
      nudge.replaceChildren(icon('check'));
      setTimeout(() => nudge.replaceChildren(icon('share')), 1600);
    });
  });
  const open = el('button', {
    class: 'list__item owed',
    attrs: { type: 'button' },
    children: [
      el('div', {
        class: 'list__main',
        children: [
          el('div', { class: 'list__text', text: chit.chit.text }),
          el('div', { class: 'list__meta', children: other ? [who(other, me)] : [] }),
        ],
      }),
      el('div', {
        class: 'list__side',
        children: [el('div', { class: 'list__amount', text: fiat(chit) }), el('span', { class: 'pill pill--warn', text: ageOf(chit.createdAt) })],
      }),
    ],
  });
  open.addEventListener('click', () => navigate(chitPath(chit.id)));
  return el('div', { class: 'owed__wrap', children: [open, nudge] });
}

export async function activityScreen(address: string, navigate: Navigate): Promise<void> {
  const settle = loadingSoon(() => skeletonScreen(navigate));
  const [list, led] = await Promise.all([api.forAddress(address), api.ledger(address)]);
  settle();
  if (!list.ok) {
    mount(
      problemScreen(navigate, {
        title: t('Activity'),
        text: list.error,
        tone: list.code === 'offline' ? 'calm' : 'bad',
        actions: [button(t('Try again'), () => void activityScreen(address, navigate), 'quiet')],
      }),
    );
    return;
  }
  const chits = list.value.chits;
  const me = rememberedAddress();

  /*
   * Who owes you, and for how long.
   *
   * Non-payment is the loudest complaint in the whole research corpus, and until now the
   * only way to find an unpaid chit was to scroll the same list as everything else. These
   * are the chits where this wallet is the one waiting: signed by both, not paid, not
   * declined — oldest first, because age is the thing that matters about them.
   */
  const owedToMe = chits
    .filter((c) => !c.settled && !c.declined && !c.bounty && sameAddress(address, c.chit.kind === 'quote' ? c.chit.payee : c.payTo))
    .sort((a, b) => a.createdAt - b.createdAt);

  const header: HTMLElement[] = [party(address, t('Wallet'), { me })];
  if (led.ok) header.push(...ledgerRows(led.value));
  const owedIds = new Set(owedToMe.map((c) => c.id));
  const rows = chits.filter((c) => !owedIds.has(c.id)).map((chit) => {
    const state = statusOf(chit);
    const other = chit.chit.kind === 'quote' ? chit.settledFrom : sameAddress(address, chit.chit.payer) ? (chit.payTo ?? null) : chit.chit.payer;
    const item = el('button', {
      class: 'list__item',
      attrs: { type: 'button' },
      children: [
        el('div', {
          class: 'list__main',
          children: [
            el('div', { class: 'list__text', text: chit.chit.text }),
            el('div', { class: 'list__meta', children: other ? [who(other, me), document.createTextNode(` · ${formatDate(chit.createdAt)}`)] : [document.createTextNode(formatDate(chit.createdAt))] }),
          ],
        }),
        el('div', { class: 'list__side', children: [el('div', { class: 'list__amount', text: fiat(chit) }), el('span', { class: state.cls, text: state.label })] }),
        icon('chevron-right', 'list__chevron'),
      ],
    });
    item.addEventListener('click', () => navigate(chitPath(chit.id)));
    return item;
  });
  mount(
    screen({
      header: topBar(navigate, 'activity'),
      title: t('Activity'),
      body: [
        el('div', { class: 'card', children: header }),
        owedToMe.length > 0
          ? el('div', {
              class: 'stack stack--tight',
              children: [
                el('h2', { text: t('Waiting to be paid') }),
                el('div', { class: 'list', children: owedToMe.map((c) => owedRow(c, me, navigate)) }),
              ],
            })
          : null,
        chits.length === 0
          ? emptyState({
              icon: 'receipt',
              title: t('Nothing yet'),
              text: t('Your first chit will appear here the moment it is signed.'),
              action: button(t('Start a chit'), () => navigate('/'), 'quiet', 'pen'),
            })
          : el('div', { class: 'list', children: rows }),
      ],
      actions: [button(t('New chit'), () => navigate('/'), 'primary', 'pen')],
    }),
  );
}

function ledgerRows(led: LedgerView): HTMLElement[] {
  const out: HTMLElement[] = [];
  const w = led.asWorker;
  if (w.settled > 0) {
    out.push(row(t('Paid to you'), `${nimRound(w.settledLuna)} · ${count(w.settled, '{n} chit', '{n} chits')} · ${count(w.distinctPayers, 'from {n} payer', 'from {n} payers')}`, 'num'));
    out.push(row(t('Kept'), `${nimRound(w.keptLuna)} — ${t('a 20% marketplace cut')}`, 'num'));
  }
  const p = led.asPayer;
  if (p.settled > 0 || p.leftUnpaid > 0 || p.awaiting > 0) {
    const parts = [t('paid {n}', { n: p.settled })];
    if (p.medianPaySeconds !== null) parts.push(t('usually within {d}', { d: formatDuration(p.medianPaySeconds) }));
    if (p.awaiting > 0) parts.push(t('{n} awaiting', { n: p.awaiting }));
    parts.push(p.leftUnpaid === 0 ? t('none left unpaid') : t('{n} left unpaid', { n: p.leftUnpaid }));
    out.push(row(t('As a payer'), parts.join(' · ')));
  }
  return out;
}

/* ------------------------------------------------------------------ about */

/** What chit is and is not, for the stranger who followed a receipt link and wants to know. */
export function aboutScreen(navigate: Navigate): void {
  const me = rememberedAddress();
  mount(
    screen({
      header: topBar(navigate, 'about'),
      title: t('What chit is'),
      body: [
        el('p', { class: 'lead', text: t('A receipt for a deal you already made. You paste the one line you agreed in a chat, both wallets sign it with Nimiq Pay, and the payment carries the agreement’s digest. The receipt is the contract, and anyone can check it against the chain.') }),
        el('div', {
          class: 'card card--pad stack stack--tight',
          children: [
            el('h2', { text: t('What it never does') }),
            el('ul', {
              class: 'rules',
              children: [
                el('li', { text: t('Hold your money. Every payment goes straight from one wallet to the other; there is no balance and no withdrawal.') }),
                el('li', { text: t('Take a cut. There is no fee. A NIM transaction is free and lands in about a second.') }),
                el('li', { text: t('Ask for an account. There is no password, no code sent to your phone, no identity check — and so there is nothing to be locked out of. Your wallet is your identity; your record is computed from settled payments and nothing else.') }),
                el('li', { text: t('Protect you. This is proof of payment, not escrow or a dispute service. Use it with clients you already talk to directly.') }),
              ],
            }),
          ],
        }),
        el('div', {
          class: 'card card--pad stack stack--tight',
          children: [
            el('h2', { text: t('How a receipt is checked') }),
            el('p', { class: 'secondary', text: t('The words are hashed; that hash is the 64-byte memo of the NIM payment. A receipt link carries the words, so your browser recomputes the hash and reads the transaction from a public Nimiq node — no chit server needed.') }),
          ],
        }),
        el('div', {
          class: 'card card--pad stack stack--tight',
          children: [
            el('h2', { text: t('The bounty') }),
            el('p', { class: 'secondary', text: t('chit pays real chits for a sentence of feedback, from a pool funded by the founder. The address, balance, rules and every payout are public.') }),
            el('button', { class: 'link-row foot__link', attrs: { type: 'button' }, children: [document.createTextNode(t('See the pool')), icon('arrow-right', 'icon--sm')], on: { click: () => navigate('/bounty') } }),
          ],
        }),
        el('div', {
          class: 'card card--pad stack stack--tight',
          children: [
            el('h2', { text: t('When something goes wrong') }),
            el('p', { class: 'secondary', text: t('There is no support queue, because there is nothing for support to release. Everything that can go wrong has an answer you can act on yourself:') }),
            el('ul', {
              class: 'rules',
              children: [
                el('li', { text: t('They signed and never paid. Nothing was lost — you were never owed anything until they paid. Their record now says one left unpaid, and anyone they send a chit to will see it.') }),
                el('li', { text: t('You paid and the work never came. chit cannot reverse a payment; nobody can. Pay in smaller steps with someone new, and check their record before you sign.') }),
                el('li', { text: t('The payment is not showing. chit watches the chain itself, not the wallet — reopen the chit and it will catch up. If the transaction is on nimiq.watch, the money has moved.') }),
                el('li', { text: t('You lost the link. Every chit your wallet signed is in Activity, on any device you connect the same wallet from.') }),
                el('li', { text: t('chit disappears. The receipt link carries the signed words, and your browser checks them against a public Nimiq node. It works without us.') }),
              ],
            }),
          ],
        }),
        el('p', { class: 'small muted', text: t('Open source under the MIT licence. Built for the Nimiq Mini Apps Competition, Cycle 2, 2026. Signatures are verified by chit’s server; payments by the Nimiq chain.') }),
        me ? null : el('p', { class: 'small muted', text: t('Nothing about you is stored until you sign something.') }),
      ],
      actions: [button(t('Start a chit'), () => navigate('/'), 'primary', 'pen')],
    }),
  );
}

/* ------------------------------------------------------------------ errors */

export function notFoundScreen(navigate: Navigate): void {
  mount(
    problemScreen(navigate, {
      title: t('Nothing here'),
      text: t('That link does not point at anything in chit.'),
      actions: [button(t('Start a chit'), () => navigate('/'))],
    }),
  );
}

/** Shown instead of a blank page when something throws. Exported for `main.ts`. */
export function brokenScreen(navigate: Navigate, detail: string | null): void {
  const actions: Array<HTMLElement | null> = [detail ? el('p', { class: 'small muted mono', text: detail }) : null, button(t('Start again'), () => navigate('/'))];
  mount(
    problemScreen(navigate, {
      title: t('Something broke'),
      text: t('chit hit an error it did not expect. Anything already signed is safe on the server, and anything paid is on chain.'),
      tone: 'bad',
      actions: actions.filter((n): n is HTMLElement => n !== null),
    }),
  );
}

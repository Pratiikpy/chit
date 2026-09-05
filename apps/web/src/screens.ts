/**
 * Door one, as screens — in both directions, with the bounty as the front door.
 *
 * Paste → check what we understood → sign → share → the other side signs or pays → receipt.
 * Each screen holds one idea, because the bar is "a first-time user reaches the point of the
 * app within 60 seconds without instructions" and every extra idea on a screen is time spent
 * deciding which one matters.
 *
 * Three habits throughout:
 * - **Nothing asks the wallet for anything until the user taps.** Detection is silent; the
 *   address is requested on Sign or Pay. A stranger opening a link reads first.
 * - **Cancelling is never an error.** The screen stays usable and nothing turns red. A
 *   declined dialog leaves the button exactly as it was.
 * - **Money is the largest thing on any screen that has any**, in the user's own currency,
 *   with the NIM figure beside it rather than hidden behind a toggle.
 *
 * The composer has two directions. "I'm getting paid" makes a quote: the worker signs alone
 * and whoever pays it first is the client — paying is accepting. "I'm paying" makes an open
 * chit the worker countersigns. Above both sits the bounty: a real chit chit itself posts and
 * pays, so a person with an empty wallet earns their first NIM by doing the core flow once.
 */

import { chitHash, fromBase64Url, parseCanonical, parseTerms, toBase64Url } from '@chit/core';
import QrCreator from 'qr-creator';
import { api, type ApiChit, type LedgerView } from './api.ts';
import {
  buildDraft,
  daysUntilBlock,
  fieldsFromTerms,
  isReady,
  quoteExpired,
  type DraftFields,
  type Quote,
} from './compose.ts';
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
import { NIMIQ_PAY_SITE, isPhone, nimiqPayDeepLink, nimpayOpenLink } from './links.ts';
import { nimRow, termsEditor } from './terms-editor.ts';
import { watchUntil } from './watch.ts';
import { readChainTransaction } from './chain.ts';
import { button, el, money, mount, nim, note, onLeave, prettyAddress, row, screen, shortAddress, withBusy } from './ui.ts';
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

/** A link that carries the signed words, so the receipt can be checked without us. */
function selfContainedLink(chit: ApiChit): string {
  return `${chit.shareUrl}#c=${toBase64Url(new TextEncoder().encode(chit.canonical))}`;
}

function chitPath(id: string): string {
  return `/c/${encodeURIComponent(id)}`;
}

/* ------------------------------------------------------------------ shared pieces */

/** The word "chit", and the ways around. Sits above the title. */
function topBar(navigate: Navigate, current?: 'compose' | 'activity' | 'bounty'): HTMLElement {
  const me = rememberedAddress();
  const brand = el('button', { class: 'topbar__brand', text: 'chit', attrs: { type: 'button', 'aria-label': 'chit home' } });
  brand.addEventListener('click', () => navigate('/'));
  const links = el('div', { class: 'topbar__links' });
  if (current !== 'bounty') {
    const bounty = el('button', { class: 'topbar__link', text: t('Bounty'), attrs: { type: 'button' } });
    bounty.addEventListener('click', () => navigate('/bounty'));
    links.append(bounty);
  }
  if (me && current !== 'activity') {
    const activity = el('button', { class: 'topbar__link', text: t('Activity'), attrs: { type: 'button' } });
    activity.addEventListener('click', () => navigate(`/a/${encodeURIComponent(me)}`));
    links.append(activity);
  }
  if (current !== 'compose') {
    const compose = el('button', { class: 'topbar__link', text: t('New chit'), attrs: { type: 'button' } });
    compose.addEventListener('click', () => navigate('/'));
    links.append(compose);
  }
  return el('nav', { class: 'topbar', children: [brand, links], attrs: { 'aria-label': 'chit' } });
}

/** A standing warning wherever a testnet chit is shown, so it is never mistaken for money. */
function testnetBanner(chit: ApiChit): HTMLElement | null {
  return chit.chit.chain === 'test' ? note(t('Test network — the signatures are real, the money is not.'), 'warn') : null;
}

/**
 * What a person without a wallet sees, with the way in: the deep link into Nimiq Pay and,
 * for someone who does not have it, the store. The docs warn the first open of an unlisted
 * app shows a confirmation — say so rather than promise magic.
 */
function walletBanner(detection: WalletDetection, link: string): HTMLElement | null {
  if (detection.tier === 'nimiq-pay') return null;
  if (detection.tier === 'demo') {
    return note(t('Demo mode — signatures here are for show and will not verify. Open in Nimiq Pay to sign for real.'), 'warn');
  }
  const open = el('a', { class: 'btn', text: t('Open in Nimiq Pay'), attrs: { href: nimpayOpenLink(link) } });
  const get = el('a', { class: 'btn btn--quiet', text: t('Get Nimiq Pay'), attrs: { href: NIMIQ_PAY_SITE, target: '_blank', rel: 'noopener' } });
  return el('div', {
    class: 'stack stack--tight',
    children: [
      note(
        isPhone()
          ? t('Signing and paying happen in the Nimiq Pay app. Open this there — Nimiq Pay may ask you to confirm the first time.')
          : t('Signing and paying happen in the Nimiq Pay app on your phone. Scan the code below with it, or open this link there.'),
        'calm',
      ),
      el('div', { class: 'row-actions', children: [open, get] }),
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

function amountBlock(chit: ApiChit, huge = false): HTMLElement {
  return el('div', {
    class: huge ? 'amount amount--huge' : 'amount',
    children: [
      document.createTextNode(money(chit.chit.amountMinor, chit.chit.currency)),
      el('div', { class: 'amount__sub mono', text: nim(chit.chit.luna) }),
    ],
  });
}

function termsCard(chit: ApiChit, options: { settled?: boolean } = {}): HTMLElement {
  const rows = [
    row(t('For'), chit.chit.text),
    row(t('Amount'), money(chit.chit.amountMinor, chit.chit.currency), 'mono'),
    row(t('In NIM'), nim(chit.chit.luna), 'mono'),
  ];
  if (chit.chit.deliverables > 1) rows.push(row(t('Deliverables'), String(chit.chit.deliverables)));

  // A deadline is stored as a block height because that is checkable against the chain,
  // but a block number tells a human nothing. Show the days; keep the height as small print.
  // Once paid, "due in 6 days" is noise on a receipt, so it goes.
  const currentBlock = chit.currentBlock ?? 0;
  if (!options.settled) {
    if (currentBlock > 0) {
      const days = daysUntilBlock(chit.chit.deadlineBlock, currentBlock);
      rows.push(row(t('Due'), days < 0 ? t('passed') : days === 0 ? t('today') : t('in about {n} days', { n: days })));
    }
    rows.push(row(t('Deadline'), `block ${chit.chit.deadlineBlock}`, 'mono small'));
  }

  if (chit.chit.kind === 'quote') rows.push(row(t('Quoted by'), shortAddress(chit.chit.payee), 'mono small'));
  else rows.push(row(t('From'), shortAddress(chit.chit.payer), 'mono small'));
  return el('div', { class: 'card', children: rows });
}

function qrFor(text: string): HTMLElement {
  const holder = el('div', { class: 'qr' });
  const canvas = el('canvas', { attrs: { 'aria-hidden': 'true' } });
  holder.append(canvas);
  queueMicrotask(() => {
    QrCreator.render({ text, radius: 0.4, ecLevel: 'M', fill: '#111112', background: '#ffffff', size: 220 }, canvas);
  });
  return holder;
}

/** Copy + native share for a link. The one place these two buttons are built. */
function shareActions(link: string, title: string, text: string): HTMLElement[] {
  const copy = button(t('Copy the link'), () => {
    void navigator.clipboard
      .writeText(link)
      .then(() => {
        copy.textContent = t('Copied');
        setTimeout(() => (copy.textContent = t('Copy the link')), 1600);
      })
      .catch(() => {
        copy.textContent = t('Copy failed — select the link below');
      });
  });
  const actions: HTMLElement[] = [copy];
  if (typeof navigator.share === 'function') {
    actions.unshift(
      button(t('Send it'), () => {
        void navigator.share({ title, text, url: link }).catch(() => {
          /* the user dismissed the sheet — nothing to say */
        });
      }),
    );
  }
  return actions;
}

function openInPayLine(link: string): HTMLElement {
  const a = el('a', { class: 'link small', text: t('Open in Nimiq Pay'), attrs: { href: nimiqPayDeepLink(link) } });
  return el('p', { class: 'small muted', children: [document.createTextNode(t('If they already have the app: ')), a] });
}

/**
 * The payer's record, above the worker's Sign button — the one moment it matters.
 * Computed from settled payments only. A wallet with no history reads as new, never as bad.
 */
async function payerStrip(payer: string, attached: string): Promise<HTMLElement> {
  const result = await api.ledger(payer);
  if (!result.ok) return el('p', { class: 'strip muted small', text: t('Could not load this wallet’s record.') });
  const p = result.value.asPayer;
  if (p.settled === 0 && p.leftUnpaid === 0) {
    return el('p', { class: 'strip small', text: t('First chit from this wallet · {amount} attached', { amount: attached }) });
  }
  const parts = [t('Paid {n} chits', { n: p.settled })];
  if (p.medianPaySeconds !== null) parts.push(t('usually within {d}', { d: formatDuration(p.medianPaySeconds) }));
  parts.push(p.leftUnpaid === 0 ? t('none left unpaid') : t('{n} left unpaid', { n: p.leftUnpaid }));
  return el('p', { class: `strip small${p.leftUnpaid > 0 ? ' strip--warn' : ''}`, text: parts.join(' · ') });
}

/** "Paid after the deadline" — labelled on the receipt, never enforced. */
function lateBadge(chit: ApiChit): HTMLElement | null {
  if (chit.settledBlock && chit.settledBlock > chit.chit.deadlineBlock) {
    return el('span', { class: 'badge badge--warn', text: t('Paid after the deadline') });
  }
  return null;
}

/* ------------------------------------------------------------------ the bounty card */

/**
 * The front door. A person with an empty wallet sees, first, a real chit they can be paid
 * for right now. It is a chit like any other — chit is simply the payer.
 */
async function bountyCard(navigate: Navigate): Promise<HTMLElement | null> {
  const result = await api.bounty();
  if (!result.ok) return null;
  const b = result.value;
  const first = b.open[0];
  if (!b.funded) {
    return el('div', {
      class: 'card card--accent',
      children: [
        el('div', { class: 'kicker', text: t('Bounty') }),
        el('p', { text: t('The pool is being funded. When it holds a payout, a real chit you can be paid for appears here.') }),
      ],
    });
  }
  if (!first) {
    return el('div', {
      class: 'card card--accent',
      children: [el('div', { class: 'kicker', text: t('Bounty') }), el('p', { text: t('Every bounty is taken for now. The next one opens shortly.') })],
    });
  }
  const go = button(t('Earn {amount} — test chit', { amount: money(first.chit.amountMinor, first.chit.currency) }), () => navigate(chitPath(first.id)));
  return el('div', {
    class: 'card card--accent',
    children: [
      el('div', { class: 'kicker', text: t('Bounty · paid by chit') }),
      el('p', { text: b.prompt }),
      el('p', { class: 'small muted', text: t('Sign it with your answer and the pool pays your wallet in NIM — your first, if it is empty. {n} open now.', { n: b.open.length }) }),
      go,
    ],
  });
}

/* ------------------------------------------------------------------ compose */

export async function composeScreen(navigate: Navigate): Promise<void> {
  const [detection, info] = await Promise.all([detectWallet(), api.serverInfo()]);

  if (!info.ok) {
    mount(
      screen({
        title: t('chit is not reachable'),
        body: [note(info.error, info.code === 'offline' ? 'calm' : 'bad')],
        actions: [button(t('Try again'), () => void composeScreen(navigate), 'quiet')],
      }),
    );
    return;
  }
  const chain = info.value.chain;

  let direction: 'paying' | 'earning' = 'earning';
  let fields: DraftFields | null = null;
  let quote: Quote | null = null;
  let currencyAlternatives: string[] = [];
  let feedback: HTMLElement | null = null;

  const input = el('textarea', {
    class: 'field',
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
  const intro = el('p', { class: 'muted' });
  function paintDirection(): void {
    earning.setAttribute('aria-pressed', String(direction === 'earning'));
    paying.setAttribute('aria-pressed', String(direction === 'paying'));
    intro.textContent =
      direction === 'earning'
        ? t('Paste the line from the chat where you agreed it. You sign; whoever pays the link has accepted; the NIM lands in your wallet.')
        : t('Paste the line from the chat where you agreed it. You sign; they sign; you pay once they have. The payment carries the proof.');
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
    if (fields.amountMinor === null || !fields.currency) {
      understood.append(note(t('Add an amount and a currency — "$40", "€120", "₹3500" — so both sides are agreeing to the same number. You can also tap any line above to set it yourself.'), 'calm'));
    } else if (!quote && !feedback) {
      understood.append(note(t('Pricing it in NIM…'), 'calm'));
    }
    if (feedback) understood.append(feedback);
    signButton.disabled = !isReady(fields) || quote === null || detection.tier === 'none';
  }

  async function reparse(): Promise<void> {
    const value = input.value.trim();
    feedback?.remove();
    feedback = null;
    if (value.length === 0) {
      fields = null;
      quote = null;
      render();
      return;
    }
    const parsed = parseTerms(value);
    const previous = fields;
    fields = fieldsFromTerms(parsed);
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
        const created = await api.createChit(draft.canonical, signature);
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

  const bounty = el('div');
  mount(
    screen({
      header: topBar(navigate, 'compose'),
      title: t('Paste the deal. Get a receipt.'),
      body: [
        el('p', { class: 'muted', text: t('For the clients you already talk to directly. Client pays; you get a receipt proving you were paid for exactly this. Proof of payment, not protection.') }),
        bounty,
        segmented,
        intro,
        input,
        understood,
        walletBanner(detection, window.location.href),
        messages,
      ],
      actions: [signButton],
    }),
  );

  // The bounty card lands when it lands — the composer never waits for it.
  void bountyCard(navigate).then((card) => {
    if (card) bounty.replaceChildren(card);
  });

  const prefill = new URLSearchParams(window.location.search).get('text');
  if (prefill) {
    input.value = prefill;
    void reparse();
  }
}

/* ------------------------------------------------------------------ the chit */

export async function chitScreen(id: string, navigate: Navigate): Promise<void> {
  const [result, detection] = await Promise.all([api.getChit(id), detectWallet()]);

  if (!result.ok) {
    mount(
      screen({
        title: t('Not found'),
        body: [note(result.error, result.code === 'offline' ? 'calm' : 'bad')],
        actions: [button(t('Start a chit'), () => navigate('/'), 'quiet'), button(t('Try again'), () => void chitScreen(id, navigate), 'plain')],
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
    class: 'field',
    attrs: { rows: 3, 'aria-label': t('Your answer'), placeholder: t('One sentence, in your own words'), autocomplete: 'off', spellcheck: 'true' },
  });
  const counter = el('p', { class: 'small muted', text: t('At least 4 words. No links. Something nobody has said yet.') });
  const claim = button(t('Sign and get paid'), () => void go(), 'primary');
  claim.disabled = true;
  answer.addEventListener('input', () => {
    const words = answer.value.trim().split(/\s+/).filter(Boolean).length;
    counter.textContent = words < 4 ? t('At least 4 words. No links. Something nobody has said yet.') : t('{n} words', { n: words });
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
      title: t('Earn {amount}', { amount: money(chit.chit.amountMinor, chit.chit.currency) }),
      body: [
        el('div', { class: 'kicker', text: t('Bounty · paid by chit') }),
        el('p', { text: chit.chit.text }),
        amountBlock(chit),
        answer,
        counter,
        el('p', { class: 'muted small', text: t('Signing is your answer. If it passes the rules — the same for everyone, no draw — the pool pays this amount to the wallet you sign with, and you hold a real receipt.') }),
        walletBanner(detection, chit.shareUrl),
        messages,
      ],
      actions: [claim, button(t('The rules and every payout'), () => navigate('/bounty'), 'plain')],
    }),
  );
}

/** The pool, in public: address, balance, rules, open bounties, every payout with its transaction. */
export async function bountyBoardScreen(navigate: Navigate): Promise<void> {
  const result = await api.bounty();
  if (!result.ok) {
    mount(
      screen({
        header: topBar(navigate, 'bounty'),
        title: t('Bounty'),
        body: [note(result.code === 'no-bounty' ? t('This deployment has no bounty pool.') : result.error, 'calm')],
        actions: [button(t('New chit'), () => navigate('/'))],
      }),
    );
    return;
  }
  const b = result.value;
  const openRows = b.open.map((c) => {
    const item = el('button', {
      class: 'list__item',
      attrs: { type: 'button' },
      children: [
        el('div', { class: 'list__main', children: [el('div', { class: 'list__text', text: c.chit.text })] }),
        el('div', { class: 'list__side', children: [el('div', { class: 'mono', text: money(c.chit.amountMinor, c.chit.currency) }), el('span', { class: 'pill', text: t('Open') })] }),
      ],
    });
    item.addEventListener('click', () => navigate(chitPath(c.id)));
    return item;
  });
  const paidRows = b.paid.map((p) =>
    el('div', {
      class: 'list__item list__item--static',
      children: [
        el('div', { class: 'list__main', children: [el('div', { class: 'list__text list__text--wrap', text: p.answer }), el('div', { class: 'list__meta muted small', text: `${shortAddress(p.worker)} · ${formatDate(p.at)}` })] }),
        el('div', { class: 'list__side', children: [el('div', { class: 'mono small', text: nim(p.luna) }), el('a', { class: 'link small mono', text: `${p.tx.slice(0, 8)}…`, attrs: { href: explorerUrl(p.tx), target: '_blank', rel: 'noopener' } })] }),
      ],
    }),
  );

  mount(
    screen({
      header: topBar(navigate, 'bounty'),
      title: t('Bounty'),
      body: [
        el('p', { class: 'muted', text: b.prompt }),
        el('div', {
          class: 'card',
          children: [
            row(t('Pool'), prettyAddress(b.address), 'mono small'),
            row(t('Balance'), b.balanceLuna === null ? t('unknown') : nim(b.balanceLuna), 'mono'),
            row(t('Paid today'), `${b.paidToday} · ${nim(b.paidTodayLuna)} ${t('of')} ${nim(b.dailyCapLuna)}`, 'small'),
          ],
        }),
        el('h2', { text: t('Open now') }),
        openRows.length ? el('div', { class: 'list', children: openRows }) : note(t('Every bounty is taken for now. The next one opens shortly.'), 'calm'),
        el('h2', { text: t('The rules') }),
        el('ul', { class: 'rules', children: b.rules.map((r) => el('li', { text: r })) }),
        el('h2', { text: t('Every payout') }),
        paidRows.length ? el('div', { class: 'list', children: paidRows }) : note(t('None yet.'), 'calm'),
        el('p', { class: 'muted small', text: t('chit pays its own bounty from this pool. It never holds anyone else’s money. Funded by the founder; every payout above is on chain.') }),
      ],
      actions: [button(t('New chit'), () => navigate('/'))],
    }),
  );
}

/* ------------------------------------------------------------------ share (payer's open chit) */

function shareScreen(chit: ApiChit, detection: WalletDetection, navigate: Navigate): void {
  const link = selfContainedLink(chit);
  const status = note(t('Nothing has been paid yet. You pay once they have signed — this screen will move on by itself.'), 'calm');
  const messages = el('div', { class: 'stack stack--tight' });

  const poller = watchUntil({
    poll: async () => {
      const latest = await api.getChit(chit.id);
      return latest.ok ? latest.value : null;
    },
    done: (latest) => latest.countersigned || latest.declined === true,
    onDone: () => navigate(chitPath(chit.id)),
    onGiveUp: () => status.replaceChildren(document.createTextNode(t('Still waiting for their signature. You can close this — it is in your Activity.'))),
  });

  // The demo worker: a labelled second party so one person can walk the whole flow alone.
  const demo = button(t('No one to send it to? Try the demo worker'), () => void tryDemo(), 'plain');
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
        el('p', { class: 'muted', text: t('They open it, read the same words you signed, and sign with the Nimiq Pay app — the link opens it. No account, no email.') }),
        testnetBanner(chit),
        termsCard(chit),
        qrFor(link),
        el('p', { class: 'mono small muted', text: link }),
        openInPayLine(link),
        status,
        walletBanner(detection, link),
        messages,
      ],
      actions: [...shareActions(link, t('A chit to sign'), chit.chit.text), demo, button(t('Done for now'), () => navigate('/'), 'plain')],
    }),
  );
  onLeave(poller.stop);
}

/* ------------------------------------------------------------------ quote (worker's open chit) */

function quoteOwnerScreen(chit: ApiChit, navigate: Navigate): void {
  const link = selfContainedLink(chit);
  const status = note(t('Whoever pays this first is your client. Nothing is held anywhere — the payment lands in your wallet, and this screen moves on when it does.'), 'calm');
  const poller = watchUntil({
    poll: async () => {
      const latest = await api.getChit(chit.id);
      return latest.ok ? latest.value : null;
    },
    done: (latest) => latest.settled,
    onDone: () => navigate(chitPath(chit.id)),
    onGiveUp: () => status.replaceChildren(document.createTextNode(t('No payment yet. Leave the link where clients can see it — it is in your Activity.'))),
  });
  mount(
    screen({
      header: topBar(navigate),
      title: t('Your quote'),
      body: [
        el('p', { class: 'muted', text: t('Put this where the client is — the chat, your bio, a message. Paying it is accepting it.') }),
        testnetBanner(chit),
        termsCard(chit),
        qrFor(link),
        el('p', { class: 'mono small muted', text: link }),
        openInPayLine(link),
        status,
      ],
      actions: [...shareActions(link, t('A quote to pay'), chit.chit.text), button(t('Done for now'), () => navigate('/'), 'plain')],
    }),
  );
  onLeave(poller.stop);
}

function acceptQuoteScreen(chit: ApiChit, detection: WalletDetection, navigate: Navigate): void {
  const messages = el('div', { class: 'stack stack--tight' });
  const payButton = button(t('Pay {amount}', { amount: money(chit.chit.amountMinor, chit.chit.currency) }), () => void payFlow({ chit, recipient: chit.chit.payee, button: payButton, messages, navigate }), 'primary');
  if (detection.tier === 'none') payButton.disabled = true;
  mount(
    screen({
      header: topBar(navigate),
      title: t('A quote for you'),
      body: [
        amountBlock(chit, true),
        testnetBanner(chit),
        termsCard(chit),
        el('p', { class: 'muted', text: t('Paying this accepts these exact words. The money goes straight to the wallet that signed the quote — nothing is held on the way.') }),
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
  if (detection.tier === 'none') signButton.disabled = true;

  const strip = el('div');
  void payerStrip(chit.chit.payer, money(chit.chit.amountMinor, chit.chit.currency)).then((node) => strip.replaceChildren(node));

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
  const decline = button(t('Decline'), () => void doDecline(), 'plain');
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

  mount(
    screen({
      header: topBar(navigate),
      title: t('Someone wants to agree this with you'),
      body: [
        testnetBanner(chit),
        termsCard(chit),
        amountBlock(chit),
        strip,
        el('p', { class: 'muted', text: t('Signing means you agree to these exact words. It does not move any money — they pay after you sign, and the payment goes to the wallet you sign with.') }),
        walletBanner(detection, chit.shareUrl),
        messages,
      ],
      actions: [signButton, decline, button(t('Not now'), () => navigate('/'), 'plain')],
    }),
  );
}

function declinedScreen(chit: ApiChit, navigate: Navigate, isPayer: boolean): void {
  mount(
    screen({
      header: topBar(navigate),
      title: isPayer ? t('They declined') : t('You declined'),
      body: [
        termsCard(chit),
        note(isPayer ? t('They chose not to sign these words. Nothing was paid. Change the line and send a new one.') : t('You chose not to sign. Nothing was paid, and nothing more will happen with this link.'), 'calm'),
      ],
      actions: [isPayer ? button(t('Send a new one'), () => navigate(`/?text=${encodeURIComponent(chit.chit.text)}`)) : button(t('New chit'), () => navigate('/'), 'quiet')],
    }),
  );
}

/* ------------------------------------------------------------------ pay */

function noNimHelp(): HTMLElement {
  const details = el('details', { class: 'help' });
  details.append(
    el('summary', { text: t('No NIM yet?') }),
    el('p', { class: 'small muted', text: t('NIM is the coin this pays in. Nimiq Pay itself cannot buy it; the Nimiq Wallet at wallet.nimiq.com can, by card in most countries, and then you send it to your Nimiq Pay address. Or earn your first NIM here: the bounty pays a real chit for a sentence of feedback.') }),
    el('p', { children: [el('a', { class: 'link small', text: 'Nimiq Wallet', attrs: { href: 'https://wallet.nimiq.com', target: '_blank', rel: 'noopener' } })] }),
  );
  return details;
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
        messages.append(note(t('The rate moved since this was signed. Keeping the agreed {amount} whole is now {nim}.', { amount: money(chit.chit.amountMinor, chit.chit.currency), nim: nim(luna.toString(10)) }), 'calm'));
      }
      await session.wallet.pay({ recipient, luna, data: chit.id });
      const waiting = note(t('Sent. Watching the chain…'), 'good');
      messages.append(waiting);
      const poller = watchUntil({
        poll: async () => {
          const latest = await api.getChit(chit.id);
          return latest.ok ? latest.value : null;
        },
        done: (latest) => latest.settled,
        onDone: () => navigate(chitPath(chit.id)),
        onGiveUp: () => {
          waiting.replaceChildren(document.createTextNode(t('Your payment was sent. It has not appeared on chain yet — that is unusual but not lost. Check again in a moment.')));
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
  const payButton = button(t('Pay {amount}', { amount: money(chit.chit.amountMinor, chit.chit.currency) }), () => void pay(), 'primary');
  const messages = el('div', { class: 'stack stack--tight' });
  if (detection.tier === 'none' || !payTo) payButton.disabled = true;
  async function pay(): Promise<void> {
    if (!payTo) return;
    await payFlow({ chit, recipient: payTo, button: payButton, messages, navigate });
  }
  const demoNote = chit.demoWorker ? note(t('Signed by the demo worker — a labelled stand-in so you can see the whole flow. It keeps whatever you pay it.'), 'warn') : null;
  mount(
    screen({
      header: topBar(navigate),
      title: t('They signed. Time to pay.'),
      body: [
        amountBlock(chit, true),
        demoNote,
        termsCard(chit),
        payTo ? el('div', { class: 'card card--flat', children: [row(t('Goes to'), prettyAddress(payTo), 'mono small')] }) : note(t('Waiting for their signature before there is anywhere to send this.'), 'calm'),
        walletBanner(detection, chit.shareUrl),
        noNimHelp(),
        messages,
      ],
      actions: [payButton, button(t('Later'), () => navigate('/'), 'plain')],
    }),
  );
}

function awaitingPaymentScreen(chit: ApiChit, navigate: Navigate, isWorker: boolean): void {
  const status = note(isWorker ? t('You signed. They can pay now — when it lands you will have a receipt anyone can check, and this screen will move on by itself.') : t('Both parties have signed. Waiting for the payment to land.'), 'calm');
  const poller = watchUntil({
    poll: async () => {
      const latest = await api.getChit(chit.id);
      return latest.ok ? latest.value : null;
    },
    done: (latest) => latest.settled,
    onDone: () => navigate(chitPath(chit.id)),
    onGiveUp: () => status.replaceChildren(document.createTextNode(t('Still waiting on their payment. Nothing is wrong — it is in your Activity, and you can come back any time.'))),
  });
  mount(
    screen({
      header: topBar(navigate),
      title: isWorker ? t('You signed it') : t('Both signed'),
      body: [termsCard(chit), status, amountBlock(chit)],
      actions: [button(t('Check now'), () => navigate(chitPath(chit.id)), 'quiet')],
    }),
  );
  onLeave(poller.stop);
}

/* ------------------------------------------------------------------ settled */

function receiptRows(chit: ApiChit): HTMLElement {
  const rows: HTMLElement[] = [];
  if (chit.settledAt) rows.push(row(t('Paid on'), formatDate(chit.settledAt)));
  if (chit.settledBlock) rows.push(row(t('Block'), String(chit.settledBlock), 'mono small'));
  if (chit.settledTx) {
    const a = el('a', { class: 'link mono small', text: `${chit.settledTx.slice(0, 10)}…${chit.settledTx.slice(-6)}`, attrs: { href: explorerUrl(chit.settledTx), target: '_blank', rel: 'noopener' } });
    rows.push(row(t('Transaction'), a, 'small'));
  }
  const paidBy = chit.chit.kind === 'quote' ? chit.settledFrom : chit.chit.payer;
  if (paidBy) rows.push(row(t('Paid by'), shortAddress(paidBy), 'mono small'));
  if (chit.payTo) rows.push(row(t('Paid to'), shortAddress(chit.payTo), 'mono small'));
  return el('div', { class: 'card card--flat', children: rows });
}

function settledScreen(chit: ApiChit, navigate: Navigate, isPayer: boolean, isWorker: boolean): void {
  const again = button(t('Same again'), () => navigate(`/?text=${encodeURIComponent(chit.chit.text)}`), 'quiet');
  const print = button(t('Print / save as PDF'), () => window.print(), 'plain');
  mount(
    screen({
      header: topBar(navigate),
      title: isWorker ? t('You were paid') : t('Paid'),
      body: [
        amountBlock(chit, true),
        el('div', { class: 'row-actions', children: [el('span', { class: 'badge badge--good', text: t('Settled on chain') }), lateBadge(chit)].filter((n): n is HTMLElement => n !== null) }),
        testnetBanner(chit),
        chit.bounty ? note(t('A bounty, paid by chit for your answer: “{answer}”', { answer: chit.answer ?? '' }), 'good') : null,
        termsCard(chit, { settled: true }),
        receiptRows(chit),
        note(isWorker ? t('That is yours. This receipt is the agreement — anyone can check it against the chain, with no account.') : t('This receipt is the agreement. Anyone can check it against the chain, with no account.'), 'good'),
      ],
      actions: [
        chit.settledTx ? button(t('Open the receipt'), () => navigate(`/v/${encodeURIComponent(chit.settledTx ?? '')}#c=${toBase64Url(new TextEncoder().encode(chit.canonical))}`)) : null,
        again,
        print,
        button(t('Start another'), () => navigate('/'), 'plain'),
      ].filter((node): node is HTMLButtonElement => node !== null),
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
 * the page says which check came from where.
 */
export async function verifyScreen(txHash: string, navigate: Navigate): Promise<void> {
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

  if (!result.ok && !carried) {
    mount(
      screen({
        title: t('Nothing to show'),
        body: [note(result.code === 'not-found' ? t('No chit has settled with that transaction. Check the link, or the payment may not have landed yet.') : result.error, result.code === 'offline' ? 'calm' : 'bad')],
        actions: [button(t('Try again'), () => void verifyScreen(txHash, navigate), 'quiet'), button(t('Go to chit'), () => navigate('/'), 'plain')],
      }),
    );
    return;
  }

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
        row(t('Paid to'), `${shortAddress(onChain.to)}${payeeMatch ? '' : ` — ${t('not the wallet the words name')}`}`, 'mono small'),
        row(t('Amount on chain'), nim(onChain.value.toString(10)), 'mono small'),
        row(t('Block'), String(onChain.blockNumber), 'mono small'),
      );
    } else {
      browserRows.push(row(t('Chain'), t('could not be read from your browser just now'), 'small'));
    }
  }

  const chit = result.ok ? result.value : null;
  const serverOk = chit?.verification?.ok === true;
  const good = browserOk === true || (browserOk === null && serverOk);
  const canonical = chit?.canonical ?? carried?.canonical ?? '';
  const text = chit?.chit.text ?? (carried ? parseCanonical(carried.canonical).text : '');

  const signed = el('details', { class: 'help' });
  signed.append(
    el('summary', { text: t('Show exactly what was signed') }),
    el('pre', { class: 'card mono small', text: canonical, attrs: { style: 'white-space:pre-wrap;overflow-x:auto' } }),
    el('p', { class: 'muted small', text: t('Every line above was signed by the wallets involved and anchored to the payment. Nothing here was typed by chit.') }),
  );

  mount(
    screen({
      header: topBar(navigate),
      title: good ? t('This is genuine') : t('This does not check out'),
      body: [
        el('span', { class: `badge ${good ? 'badge--good' : 'badge--bad'}`, text: good ? t('Signatures and payment match') : (chit?.verification?.detail ?? t('Verification failed')) }),
        chit?.chit.chain === 'test' ? note(t('This is a test-network chit. The signatures are real, but no real money moved — the amount below is not spendable.'), 'warn') : null,
        chit ? amountBlock(chit) : null,
        el('div', {
          class: 'card',
          children: [
            row(t('For'), text),
            chit ? row(t('Both signed'), chit.chit.kind === 'quote' ? t('quote — paying accepted it') : chit.verification?.countersigned ? t('yes') : t('no')) : null,
            chit ? row(t('On chain'), chit.settledTx ? `block ${chit.settledBlock}` : t('not yet'), 'mono small') : null,
          ].filter((n): n is HTMLElement => n !== null),
        }),
        chit ? receiptRows(chit) : null,
        browserRows.length
          ? el('div', { class: 'card', children: [el('div', { class: 'kicker', text: t('Checked in your browser, against the chain') }), ...browserRows] })
          : el('p', { class: 'muted small', text: t('This link does not carry the signed words, so the payment was checked by chit’s server. A link from the receipt screen carries them and is checked in your browser.') }),
        chit ? el('p', { class: 'muted small', text: t('Signatures checked by chit’s server.') }) : null,
        signed,
      ],
      actions: [button(t('What is chit?'), () => navigate('/'), 'quiet')],
    }),
  );
}

/* ------------------------------------------------------------------ activity */

function statusOf(chit: ApiChit): { label: string; cls: string } {
  if (chit.settled) return { label: t('Paid'), cls: 'pill pill--good' };
  if (chit.declined) return { label: t('Declined'), cls: 'pill' };
  if (chit.bounty) return { label: t('Bounty'), cls: 'pill' };
  if (chit.chit.kind === 'quote') return { label: t('Quote'), cls: 'pill' };
  if (chit.countersigned) return { label: t('Signed — unpaid'), cls: 'pill pill--warn' };
  return { label: t('Waiting for signature'), cls: 'pill' };
}

export async function activityScreen(address: string, navigate: Navigate): Promise<void> {
  const [list, led] = await Promise.all([api.forAddress(address), api.ledger(address)]);
  if (!list.ok) {
    mount(
      screen({
        header: topBar(navigate, 'activity'),
        title: t('Activity'),
        body: [note(list.error, list.code === 'offline' ? 'calm' : 'bad')],
        actions: [button(t('Try again'), () => void activityScreen(address, navigate), 'quiet')],
      }),
    );
    return;
  }
  const chits = list.value.chits;
  const header: HTMLElement[] = [row(t('Wallet'), prettyAddress(address), 'mono small')];
  if (led.ok) header.push(...ledgerRows(led.value));
  const rows = chits.map((chit) => {
    const status = statusOf(chit);
    const item = el('button', {
      class: 'list__item',
      attrs: { type: 'button' },
      children: [
        el('div', { class: 'list__main', children: [el('div', { class: 'list__text', text: chit.chit.text }), el('div', { class: 'list__meta muted small', text: formatDate(chit.createdAt) })] }),
        el('div', { class: 'list__side', children: [el('div', { class: 'mono', text: money(chit.chit.amountMinor, chit.chit.currency) }), el('span', { class: status.cls, text: status.label })] }),
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
        chits.length === 0 ? note(t('Nothing yet. Your first chit will appear here the moment it is signed.'), 'calm') : el('div', { class: 'list', children: rows }),
      ],
      actions: [button(t('New chit'), () => navigate('/'))],
    }),
  );
}

function ledgerRows(led: LedgerView): HTMLElement[] {
  const out: HTMLElement[] = [];
  const w = led.asWorker;
  if (w.settled > 0) {
    out.push(row(t('Paid to you'), `${nim(w.settledLuna)} · ${t('{n} chits', { n: w.settled })} · ${t('from {n} payers', { n: w.distinctPayers })}`, 'small'));
    out.push(row(t('Kept'), `${nim(w.keptLuna)} — ${t('what a 20% marketplace cut would have been')}`, 'small'));
  }
  const p = led.asPayer;
  if (p.settled > 0 || p.leftUnpaid > 0 || p.awaiting > 0) {
    const parts = [t('paid {n}', { n: p.settled })];
    if (p.medianPaySeconds !== null) parts.push(t('usually within {d}', { d: formatDuration(p.medianPaySeconds) }));
    if (p.awaiting > 0) parts.push(t('{n} awaiting', { n: p.awaiting }));
    parts.push(p.leftUnpaid === 0 ? t('none left unpaid') : t('{n} left unpaid', { n: p.leftUnpaid }));
    out.push(row(t('As a payer'), parts.join(' · '), 'small'));
  }
  return out;
}

/* ------------------------------------------------------------------ errors */

export function notFoundScreen(navigate: Navigate): void {
  mount(
    screen({
      header: topBar(navigate),
      title: t('Nothing here'),
      body: [note(t('That link does not point at anything in chit.'), 'calm')],
      actions: [button(t('Start a chit'), () => navigate('/'))],
    }),
  );
}

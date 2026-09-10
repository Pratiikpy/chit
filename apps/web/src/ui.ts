/**
 * Rendering helpers.
 *
 * No framework. A dozen screens is not enough surface to earn a runtime, and the
 * performance budget is under 150 KB of initial JavaScript on a mid-range Android
 * (DESIGN.md §7) — a budget the app should spend on `@nimiq/core`-shaped problems, not on
 * a virtual DOM.
 *
 * `el()` sets text through `textContent`, so no user-supplied string is ever parsed as
 * HTML. That is deliberate: the pasted line is arbitrary text a stranger will read on the
 * countersign page, and it must be impossible for it to become markup. The one place SVG is
 * built (`icon()`) draws from a fixed table of paths and never from input.
 */

type Child = Node | string | null | undefined | false;

export interface ElementOptions {
  class?: string;
  text?: string;
  html?: never; // deliberately impossible — see the note above
  attrs?: Record<string, string | number | boolean | undefined>;
  on?: Partial<Record<keyof HTMLElementEventMap, (event: Event) => void>>;
  children?: Child[];
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text !== undefined) node.textContent = options.text;

  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (value === undefined || value === false) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }

  for (const [event, handler] of Object.entries(options.on ?? {})) {
    if (handler) node.addEventListener(event, handler as EventListener);
  }

  for (const child of options.children ?? []) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  return node;
}

/* ------------------------------------------------------------------ icons */

/*
 * A small, fixed set of 24-unit stroke icons. Colour comes from `currentColor`, weight from
 * CSS. Kept as path data rather than an icon font or an image sprite: nothing to download,
 * nothing to fail, and a status is never colour alone.
 */
const ICONS = {
  check: 'M5 12.5l4.2 4.2L19 7.5',
  'chevron-down': 'M6 9.5l6 6 6-6',
  'chevron-right': 'M9.5 6l6 6-6 6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  receipt: 'M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17zM9 8.5h6M9 12h6M9 15.5h4',
  wallet: 'M3.5 7.5A2 2 0 0 1 5.5 5.5h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9zM3.5 9.5h17M15.5 13.5h2',
  copy: 'M9 9.5A1.5 1.5 0 0 1 10.5 8h8A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 9 17.5v-8zM15 8V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H8',
  share: 'M12 15V4M8 8l4-4 4 4M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6',
  print: 'M7 8V4.5h10V8M5 8h14a1.5 1.5 0 0 1 1.5 1.5v6H17v4H7v-4H3.5v-6A1.5 1.5 0 0 1 5 8zM7 15.5h10',
  gift: 'M4 11h16v9.5H4V11zM3 7.5h18V11H3V7.5zM12 7.5v13M12 7.5c-2-3.5-5.5-3.5-5.5-1.5S9.5 7.5 12 7.5zm0 0c2-3.5 5.5-3.5 5.5-1.5S14.5 7.5 12 7.5z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  alert: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5v.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5V8',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7L12.5 17',
  pen: 'M4 20h4l11-11-4-4L4 16v4zM13.5 6.5l4 4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  inbox: 'M4 13h5l1.5 2.5h3L15 13h5M4 13V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V13M4 13v5.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V13',
  shield: 'M12 3.5l7.5 3v5.5c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6.5l7.5-3zM9 12l2 2 4-4.5',
  x: 'M6 6l12 12M18 6L6 18',
  home: 'M4 11l8-7 8 7M6 10v10h12V10',
  // Closed, so the same path reads as an empty star or a filled one depending on `fill`.
  star: 'M12 3.8l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 10l5.9-.9L12 3.8z',
  // A magnifier, for the board. Same 24-grid and stroke weight as the rest of the set.
  search: 'M10.5 4a6.5 6.5 0 1 0 4.05 11.59l4.18 4.18 1.41-1.41-4.18-4.18A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z',
} as const;

export type IconName = keyof typeof ICONS;

/** A stroke icon, decorative unless a label is given. */
export function icon(name: IconName, extraClass = '', label?: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `icon ${extraClass}`.trim());
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/* ------------------------------------------------------------------ rows and blocks */

/** A labelled row. Used for every "here is what we understood" list. */
export function row(label: string, value: string | Node, valueClass = ''): HTMLElement {
  return el('div', {
    class: 'line',
    children: [
      el('span', { class: 'line__label', text: label }),
      typeof value === 'string'
        ? el('span', { class: `line__value ${valueClass}`.trim(), text: value })
        : el('span', { class: `line__value ${valueClass}`.trim(), children: [value] }),
    ],
  });
}

/** The money, as the largest thing on the screen. Fiat first, NIM beside it. */
export function hero(options: { label?: string; amount: string; sub?: string; huge?: boolean }): HTMLElement {
  return el('div', {
    class: options.huge ? 'hero hero--huge' : 'hero',
    children: [
      options.label ? el('div', { class: 'hero__label', text: options.label }) : null,
      el('div', { class: 'hero__amount', text: options.amount }),
      options.sub ? el('div', { class: 'hero__sub', text: options.sub }) : null,
    ],
  });
}

/** The signed words, as a quotation. */
export function deal(text: string, quiet = false): HTMLElement {
  return el('blockquote', { class: quiet ? 'deal deal--quiet' : 'deal', text });
}

/** Facts a person does not need in order to decide, folded away but never removed. */
export function details(summary: string, children: Child[], options: { open?: boolean; cls?: string } = {}): HTMLElement {
  const node = el('details', {
    class: options.cls ?? 'details',
    attrs: { open: options.open === true },
    children: [
      el('summary', { children: [document.createTextNode(summary), icon('chevron-down', 'icon--sm')] }),
      el('div', { class: options.cls === 'help' ? 'help__body' : 'details__body', children }),
    ],
  });
  return node;
}

/**
 * Progress as a sentence with a dot. `waiting` pulses; `good` is solid; `warn` is amber.
 * `setStatus` changes it in place, so a poller can move the sentence on without rebuilding
 * the screen.
 */
export type StatusTone = 'waiting' | 'good' | 'warn' | 'idle';

export function status(text: string, tone: StatusTone = 'idle'): HTMLElement {
  return el('div', {
    class: `status status--${tone}`,
    attrs: { role: 'status' },
    children: [el('span', { class: 'status__dot' }), el('span', { class: 'status__text', text })],
  });
}

export function setStatus(node: HTMLElement, text: string, tone: StatusTone): void {
  node.className = `status status--${tone}`;
  const label = node.querySelector('.status__text');
  if (label) label.textContent = text;
}

/** A slot holding its shape until the content arrives, so the page never jumps. */
export function skeleton(kind: 'line' | 'card' | 'row' = 'line'): HTMLElement {
  return el('div', { class: `skeleton skeleton--${kind}`, attrs: { 'aria-hidden': 'true' } });
}

/**
 * Nothing here — said honestly, with the next thing to do. When the empty state *is* the
 * screen (a problem page), its title is the page's `h1`, so `mount()` has a heading to focus
 * and a screen reader hears where it landed.
 */
export function emptyState(options: { icon: IconName; title: string; text?: string; action?: HTMLElement; heading?: boolean }): HTMLElement {
  return el('div', {
    class: 'empty',
    children: [
      el('div', { class: 'empty__icon', children: [icon(options.icon, 'icon--lg')] }),
      el(options.heading ? 'h1' : 'div', { class: 'empty__title', text: options.title }),
      options.text ? el('div', { class: 'empty__text', text: options.text }) : null,
      options.action ?? null,
    ],
  });
}

/** A short-form copy of something long (a link), with the copy button beside it. */
export function copyable(full: string, display: string, copiedLabel: string, copyLabel: string): HTMLElement {
  const copy = el('button', {
    class: 'btn btn--inline',
    attrs: { type: 'button', 'aria-label': copyLabel },
    children: [icon('copy', 'icon--sm'), document.createTextNode(copyLabel)],
  });
  copy.addEventListener('click', () => {
    void navigator.clipboard
      .writeText(full)
      .then(() => {
        copy.replaceChildren(icon('check', 'icon--sm'), document.createTextNode(copiedLabel));
        setTimeout(() => copy.replaceChildren(icon('copy', 'icon--sm'), document.createTextNode(copyLabel)), 1600);
      })
      .catch(() => {
        // No clipboard (older WebView): make the full link selectable instead.
        text.textContent = full;
        text.classList.remove('copyable__text');
        text.className = 'mono small';
      });
  });
  const text = el('span', { class: 'copyable__text', text: display, attrs: { title: full } });
  return el('div', { class: 'copyable', children: [text, copy] });
}

/* ------------------------------------------------------------------ screens */

export interface ScreenOptions {
  /** Rendered above the title — the brand and the way to your history. */
  header?: Child;
  title?: string;
  body: Child[];
  /** Rendered in the sticky footer, in thumb reach. */
  actions?: Child[];
}

export function screen(options: ScreenOptions): HTMLElement {
  const hasActions = (options.actions ?? []).some((a) => a !== null && a !== undefined && a !== false);
  return el('div', {
    class: 'screen',
    children: [
      el('div', {
        class: 'screen__body stack',
        children: [options.header ?? null, options.title ? el('h1', { text: options.title }) : null, ...options.body],
      }),
      hasActions ? el('div', { class: 'screen__sentinel', attrs: { 'aria-hidden': 'true' } }) : null,
      hasActions ? el('div', { class: 'screen__actions', children: options.actions ?? [] }) : null,
    ],
  });
}

export function button(
  label: string,
  onClick: () => void,
  variant: 'primary' | 'quiet' | 'plain' | 'inline' = 'primary',
  leading?: IconName,
): HTMLButtonElement {
  const classes = { primary: 'btn', quiet: 'btn btn--quiet', plain: 'btn btn--plain', inline: 'btn btn--inline' };
  return el('button', {
    class: classes[variant],
    attrs: { type: 'button' },
    children: [leading ? icon(leading, 'icon--sm') : null, document.createTextNode(label)],
    on: { click: () => onClick() },
  });
}

/** Put a button into a working state and guarantee it comes back out. */
export async function withBusy(target: HTMLButtonElement, label: string, work: () => Promise<void>): Promise<void> {
  const original = Array.from(target.childNodes);
  target.disabled = true;
  target.setAttribute('aria-busy', 'true');
  target.replaceChildren(el('span', { class: 'spin' }), document.createTextNode(label));
  try {
    await work();
  } finally {
    target.disabled = false;
    target.removeAttribute('aria-busy');
    target.replaceChildren(...original);
  }
}

const NOTE_ICON: Record<'calm' | 'good' | 'warn' | 'bad', IconName> = { calm: 'info', good: 'check', warn: 'alert', bad: 'alert' };

export function note(
  message: string,
  tone: 'calm' | 'good' | 'warn' | 'bad' = 'calm',
  extra?: Child,
): HTMLElement {
  return el('div', {
    class: `note note--${tone}`,
    attrs: { role: tone === 'bad' ? 'alert' : 'status' },
    children: [icon(NOTE_ICON[tone]), el('div', { class: 'note__body', children: [el('div', { text: message }), extra ?? null] })],
  });
}

/**
 * Work a screen started that must stop when the screen goes away — a settlement poller,
 * a countdown. Registered here so `mount` can guarantee cleanup rather than relying on
 * every screen to remember it.
 */
const teardown: Array<() => void> = [];

/** Register cleanup for the currently mounted screen. */
export function onLeave(stop: () => void): void {
  teardown.push(stop);
}

let mounted = 0;

/** Render a screen into the root, and put focus somewhere sensible for a screen reader. */
export function mount(node: HTMLElement): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app is missing from index.html');

  // A poller that outlives its screen writes into a DOM nobody is looking at, and keeps
  // making requests forever. Nothing survives a mount.
  while (teardown.length > 0) teardown.pop()?.();

  // A view being pushed arrives like one — but never the first, which must not delay the
  // user's first action by a quarter second of animation.
  if (mounted > 0) node.classList.add('screen--enter');
  mounted++;

  root.replaceChildren(node);
  window.scrollTo(0, 0);

  // The action bar grows a hairline when content is actually under it. Observed, not
  // computed from scroll events, so it costs nothing while the page is still.
  const sentinel = node.querySelector('.screen__sentinel');
  const actions = node.querySelector<HTMLElement>('.screen__actions');
  if (sentinel && actions && typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(
      ([entry]) => actions.classList.toggle('screen__actions--floating', entry ? !entry.isIntersecting : false),
      { rootMargin: `0px 0px -${actions.offsetHeight || 80}px 0px`, threshold: 0 },
    );
    observer.observe(sentinel);
    onLeave(() => observer.disconnect());
  }

  const heading = node.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

/**
 * Show a skeleton if a fetch is taking long enough to notice.
 *
 * Under ~160 ms the old screen simply stays; a flicker of grey bars is worse than a short
 * wait. Past that, the shape of what is coming is drawn so the app never looks frozen.
 * Returns the function that cancels it — call it once the real screen is mounted.
 */
export function loadingSoon(build: () => HTMLElement, delayMs = 160): () => void {
  const timer = setTimeout(() => mount(build()), delayMs);
  return () => clearTimeout(timer);
}

/* ------------------------------------------------------------------ formatting */

/** Format an integer minor-unit amount for display. Display only — never arithmetic. */
export function money(amountMinor: string, currency: string): string {
  const zeroDecimal = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'RWF', 'XOF', 'XAF', 'PYG']);
  const value = BigInt(amountMinor);
  if (zeroDecimal.has(currency.toUpperCase())) return `${value} ${currency}`;
  const major = value / 100n;
  const minor = (value % 100n).toString().padStart(2, '0');
  return `${major}.${minor} ${currency}`;
}

/**
 * The same amount the way the user's locale writes it — "$60.00", "60,00 €", "₹3,500.00".
 * Falls back to the plain form for a currency the platform does not know. Display only.
 */
export function moneyLocal(amountMinor: string, currency: string): string {
  const plain = money(amountMinor, currency);
  const [figure] = plain.split(' ');
  if (figure === undefined) return plain;
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() });
    // Format through parts so the figure itself is never a float: the integer and fraction
    // are taken from our exact string and only the symbol and grouping come from Intl.
    const [whole, fraction] = figure.split('.');
    const parts = formatter.formatToParts(0);
    const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, parts.find((p) => p.type === 'group')?.value ?? ',');
    const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
    return parts
      .map((p) => {
        if (p.type === 'integer') return grouped;
        if (p.type === 'decimal') return fraction === undefined ? '' : decimal;
        if (p.type === 'fraction') return fraction ?? '';
        return p.value;
      })
      .join('');
  } catch {
    return plain;
  }
}

/** Luna → NIM, for display beside the fiat figure. Never hidden behind a toggle. */
export function nim(luna: string): string {
  const value = BigInt(luna);
  const whole = value / 100_000n;
  const fraction = (value % 100_000n).toString().padStart(5, '0').replace(/0+$/, '');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fraction ? `${grouped}.${fraction} NIM` : `${grouped} NIM`;
}

/**
 * NIM rounded to what a person reads — "≈ 158,370 NIM". The exact Luna figure is what
 * settles and what the receipt shows; this is for the glance.
 */
export function nimApprox(luna: string): string {
  const value = BigInt(luna);
  if (value < 100_000n) return `≈ ${nim(luna)}`;
  const whole = Number((value + 50_000n) / 100_000n);
  return `≈ ${whole.toLocaleString(undefined, { maximumFractionDigits: 0 })} NIM`;
}

/** Nimiq addresses are shown in their space-grouped form — that is how people read them. */
export function prettyAddress(address: string): string {
  const tight = address.replace(/\s/g, '').toUpperCase();
  return tight.replace(/(.{4})/g, '$1 ').trim();
}

export function shortAddress(address: string): string {
  const pretty = prettyAddress(address);
  const parts = pretty.split(' ');
  return parts.length <= 4 ? pretty : `${parts.slice(0, 2).join(' ')} … ${parts.slice(-2).join(' ')}`;
}

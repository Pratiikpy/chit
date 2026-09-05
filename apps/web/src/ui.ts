/**
 * Rendering helpers.
 *
 * No framework. Seven screens is not enough surface to earn a runtime, and the
 * performance budget is under 150 KB of initial JavaScript on a mid-range Android
 * (DESIGN.md §7) — a budget the app should spend on `@nimiq/core`-shaped problems, not on
 * a virtual DOM.
 *
 * `el()` sets text through `textContent`, so no user-supplied string is ever parsed as
 * HTML. That is deliberate: the pasted line is arbitrary text a stranger will read on the
 * countersign page, and it must be impossible for it to become markup.
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

export interface ScreenOptions {
  /** Rendered above the title — the brand and the way to your history. */
  header?: Child;
  title?: string;
  body: Child[];
  /** Rendered in the sticky footer, in thumb reach. */
  actions?: Child[];
}

export function screen(options: ScreenOptions): HTMLElement {
  return el('div', {
    class: 'screen',
    children: [
      el('div', {
        class: 'screen__body stack',
        children: [options.header ?? null, options.title ? el('h1', { text: options.title }) : null, ...options.body],
      }),
      options.actions?.length ? el('div', { class: 'screen__actions', children: options.actions }) : null,
    ],
  });
}

export function button(
  label: string,
  onClick: () => void,
  variant: 'primary' | 'quiet' | 'plain' = 'primary',
): HTMLButtonElement {
  const classes = { primary: 'btn', quiet: 'btn btn--quiet', plain: 'btn btn--plain' };
  return el('button', {
    class: classes[variant],
    text: label,
    attrs: { type: 'button' },
    on: { click: () => onClick() },
  });
}

/** Put a button into a working state and guarantee it comes back out. */
export async function withBusy(target: HTMLButtonElement, label: string, work: () => Promise<void>): Promise<void> {
  const original = target.textContent ?? '';
  target.disabled = true;
  target.replaceChildren(el('span', { class: 'spin' }), document.createTextNode(label));
  try {
    await work();
  } finally {
    target.disabled = false;
    target.textContent = original;
  }
}

export function note(
  message: string,
  tone: 'calm' | 'good' | 'warn' | 'bad' = 'calm',
  extra?: Child,
): HTMLElement {
  return el('div', {
    class: `note note--${tone}`,
    attrs: { role: tone === 'bad' ? 'alert' : 'status' },
    children: [el('div', { text: message }), extra ?? null],
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

/** Render a screen into the root, and put focus somewhere sensible for a screen reader. */
export function mount(node: HTMLElement): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app is missing from index.html');

  // A poller that outlives its screen writes into a DOM nobody is looking at, and keeps
  // making requests forever. Nothing survives a mount.
  while (teardown.length > 0) teardown.pop()?.();

  root.replaceChildren(node);
  window.scrollTo(0, 0);
  const heading = node.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

/** Format an integer minor-unit amount for display. Display only — never arithmetic. */
export function money(amountMinor: string, currency: string): string {
  const zeroDecimal = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'RWF', 'XOF', 'XAF', 'PYG']);
  const value = BigInt(amountMinor);
  if (zeroDecimal.has(currency.toUpperCase())) return `${value} ${currency}`;
  const major = value / 100n;
  const minor = (value % 100n).toString().padStart(2, '0');
  return `${major}.${minor} ${currency}`;
}

/** Luna → NIM, for display beside the fiat figure. Never hidden behind a toggle. */
export function nim(luna: string): string {
  const value = BigInt(luna);
  const whole = value / 100_000n;
  const fraction = (value % 100_000n).toString().padStart(5, '0').replace(/0+$/, '');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fraction ? `${grouped}.${fraction} NIM` : `${grouped} NIM`;
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

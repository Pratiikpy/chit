/**
 * Nimiq identicons — the face a wallet has everywhere else in the Nimiq world.
 *
 * Every Nimiq wallet, the Hub and Nimiq Pay draw an address as the same generated figure,
 * so a person who has seen their own identicon once recognises it here. That is the whole
 * point: a trust block that says "from NQ20 AP18 …" asks the reader to compare letters; the
 * same block with the identicon they know beside it is read at a glance.
 *
 * The library is 87 KB with its image data inlined, so it is loaded on first use rather
 * than in the initial bundle — the composer never pays for it, and the countersign screen
 * pays once. Rendering goes through a data URL into an `<img>`: no SVG string is ever
 * parsed as markup, which keeps the "nothing is ever innerHTML" property of `ui.ts`.
 */

import { el } from './ui.ts';

type Lib = { toDataUrl(text: string): Promise<string> };
let lib: Promise<Lib> | undefined;

function load(): Promise<Lib> {
  lib ??= import('@nimiq/identicons/dist/identicons.bundle.min.js').then((m) => m.default as Lib);
  return lib;
}

const cache = new Map<string, Promise<string>>();

function dataUrl(address: string): Promise<string> {
  const key = address.replace(/\s/g, '').toUpperCase();
  let hit = cache.get(key);
  if (!hit) {
    hit = load().then((identicons) => identicons.toDataUrl(key));
    cache.set(key, hit);
  }
  return hit;
}

/**
 * A square that fills with the address's identicon when it is ready and stays a quiet
 * disc if it never is. `size` in CSS pixels.
 */
export function identicon(address: string, size = 40): HTMLElement {
  const holder = el('span', { class: 'idn', attrs: { style: `--idn-size:${size}px`, 'aria-hidden': 'true' } });
  void dataUrl(address)
    .then((url) => {
      const img = el('img', { attrs: { src: url, alt: '', width: size, height: size, decoding: 'async' } });
      holder.replaceChildren(img);
      holder.classList.add('idn--ready');
    })
    .catch(() => {
      // Offline or the chunk failed to load: the disc stays. Nothing else depends on it.
    });
  return holder;
}

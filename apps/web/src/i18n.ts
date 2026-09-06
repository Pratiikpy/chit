/**
 * Copy in the user's own language.
 *
 * Nimiq Pay tells the Mini App which language its user chose (`getHostLanguage()`, seeded
 * before the page script runs), and the platform ships in exactly five: English, German,
 * Spanish, French and Portuguese (`NIMIQ_DEV_DOCS_FULL_REFERENCE.md`). All five are here.
 * German carries the most weight by a distance — 68% of Nimiq Pay's users are German — but
 * a freelancer in São Paulo or Bogotá reading an English-only payment screen is the same
 * problem, and Latin America is where a feeless rail is worth the most.
 *
 * `t()` takes the English sentence as the key. That keeps the source readable, makes a
 * missing translation harmless (you see English, never a key), and means a sentence can be
 * changed in one place. Placeholders are `{name}`. Plurals are two keys — `'{n} chit'` and
 * `'{n} chits'` — chosen by the caller, because all five of these languages agree on
 * one-versus-many and a rules engine would be more code than the sentences it serves.
 *
 * **Each dictionary is loaded on demand.** Four of them inlined would be most of a hundred
 * kilobytes of strings shipped to every user so that one of them could be read, against a
 * budget of 150 KB of gzipped JavaScript for the whole app (DESIGN.md §7). A dynamic import
 * is one round trip, before the first paint, for the one language that will actually be
 * shown — so `initLanguage` is async and `main.ts` awaits it before the first screen.
 */

import { getHostLanguage } from '@nimiq/mini-app-sdk';

export type Dict = Record<string, string>;

/** The languages Nimiq Pay itself offers. Anything else is English. */
const SUPPORTED = ['de', 'es', 'fr', 'pt'] as const;
export type SupportedLanguage = (typeof SUPPORTED)[number];

function isSupported(code: string): code is SupportedLanguage {
  return (SUPPORTED as readonly string[]).includes(code);
}

/*
 * Static import specifiers, so the bundler can see all four and split each into its own
 * chunk. A computed `import('./locales/' + code)` would work in dev and produce either a
 * bundle containing every locale or a broken one in production, depending on the tool.
 */
const LOADERS: Record<SupportedLanguage, () => Promise<{ default: Dict }>> = {
  de: () => import('./locales/de.ts'),
  es: () => import('./locales/es.ts'),
  fr: () => import('./locales/fr.ts'),
  pt: () => import('./locales/pt.ts'),
};

let active: Dict = {};
let activeCode = 'en';

/**
 * Pick the dictionary, from the host. Anything unknown — or anything that fails to load —
 * is English, because a screen in English is usable and a screen of blanks is not.
 */
export async function initLanguage(override?: string): Promise<string> {
  const raw = (override ?? getHostLanguage() ?? (typeof navigator !== 'undefined' ? navigator.language : 'en') ?? 'en').toLowerCase();
  const code = raw.slice(0, 2);
  active = {};
  activeCode = 'en';

  if (isSupported(code)) {
    try {
      active = (await LOADERS[code]()).default;
      activeCode = code;
    } catch {
      // A chunk that will not load is a bad network, not a broken app.
      active = {};
      activeCode = 'en';
    }
  }

  if (typeof document !== 'undefined') document.documentElement.lang = activeCode;
  return activeCode;
}

/** Translate an English sentence, filling `{placeholders}`. Missing translations show English. */
export function t(english: string, vars: Record<string, string | number> = {}): string {
  const template = active[english] ?? english;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(vars[key]) : `{${key}}`));
}

/** Which language is in force. `'en'` when nothing was loaded. */
export function currentLanguage(): string {
  return activeCode;
}

/**
 * Every English key one language answers — so a test can prove coverage.
 *
 * Defaults to German because German is the translation the product depends on; the test
 * checks the other three against the same set, so a sentence added to the source has to be
 * answered in all four before the suite is green.
 */
export async function translatedKeys(language: SupportedLanguage = 'de'): Promise<string[]> {
  return Object.keys((await LOADERS[language]()).default);
}

/** The languages with a dictionary, for a test to iterate. */
export function supportedLanguages(): readonly SupportedLanguage[] {
  return SUPPORTED;
}

/**
 * Every sentence the app can show has one in every language it claims to speak.
 *
 * "Half-German page" was a finding of the trust walk: the dictionary covered the screens and
 * missed the editable rows, so a German user saw `Amount` and `How many` between German
 * sentences. This reads every `t(…)` call in the source and fails on the first English key
 * with no entry, in any of the four dictionaries, so the gap cannot reopen quietly.
 *
 * Claiming a language and half-speaking it is worse than not claiming it, so the four are
 * held to the same bar rather than German being the strict one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { currentLanguage, initLanguage, supportedLanguages, t, translatedKeys } from '../src/i18n.ts';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

/**
 * Every sentence the app can ask for.
 *
 * Three shapes, because three shapes exist in the source and a scanner that only knew the
 * first would quietly under-report:
 *
 *  - `t('…')`, the ordinary call;
 *  - `count(n, '{n} job', '{n} jobs')`, which picks one of two keys and calls `t` on it;
 *  - `message: '…'` in `wallet.ts`'s table of wallet failures, translated by lookup.
 */
function keysIn(source: string): string[] {
  const keys: string[] = [];
  const take = (pattern: RegExp): void => {
    for (const match of source.matchAll(pattern)) {
      for (const group of match.slice(1)) if (group !== undefined) keys.push(group.replace(/\\'/g, "'"));
    }
  };
  take(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g);
  take(/\bcount\([^,]+,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'/g);
  take(/\bmessage:\s*'((?:[^'\\]|\\.)*)'/g);
  return keys;
}

/** Every key the source can ask for, gathered once. */
function keysUsed(): Set<string> {
  const used = new Set<string>();
  for (const file of sourceFiles(join(import.meta.dirname, '..', 'src'))) {
    for (const key of keysIn(readFileSync(file, 'utf8'))) used.add(key);
  }
  return used;
}

test('⭐ every t() key in the source is translated, in every language chit claims', async () => {
  const used = keysUsed();
  for (const language of supportedLanguages()) {
    const known = new Set(await translatedKeys(language));
    const missing = [...used].filter((key) => !known.has(key));
    assert.deepEqual(missing, [], `${language} is missing: ${missing.map((k) => JSON.stringify(k)).join(', ')}`);
  }
});

test('no dictionary carries a sentence the app can no longer show', async () => {
  // A key nobody asks for is copy that was changed in the source and left behind here. It is
  // harmless at runtime and it is exactly how a dictionary rots, so it fails the build.
  const used = keysUsed();
  for (const language of supportedLanguages()) {
    const stale = (await translatedKeys(language)).filter((key) => !used.has(key));
    assert.deepEqual(stale, [], `${language} has unused entries: ${stale.map((k) => JSON.stringify(k)).join(', ')}`);
  }
});

test('every translation carries every placeholder its English key has', async () => {
  // A dropped `{amount}` is a screen that says "you would be paid" and no figure. Silent,
  // and only in one language, which is the hardest kind to notice.
  for (const language of supportedLanguages()) {
    await initLanguage(language);
    for (const key of await translatedKeys(language)) {
      const placeholders = key.match(/\{\w+\}/g) ?? [];
      const rendered = t(key);
      for (const p of placeholders) assert.ok(rendered.includes(p), `${language}: ${JSON.stringify(key)} drops ${p}`);
    }
  }
  await initLanguage('en');
});

test('no translation is left as its English original', async () => {
  // Copy-pasted keys are the other way a dictionary rots: it looks complete and reads English.
  // A handful of words are genuinely identical across these languages and are listed here.
  const SAME = new Set([
    'Details', 'Transaction', 'Chain', 'Pool', 'Balance', 'Address', 'Invoice', 'Record',
    'Quote', 'Status', 'Block', 'no', 'of',
    // A URL scheme and a bracketed word: identical in German by nature, not by neglect.
    'https://… (optional)',
  ]);
  for (const language of supportedLanguages()) {
    await initLanguage(language);
    const untouched = (await translatedKeys(language)).filter((key) => t(key) === key && key.length > 12 && !SAME.has(key));
    assert.deepEqual(untouched, [], `${language} left in English: ${untouched.map((k) => JSON.stringify(k)).join(', ')}`);
  }
  await initLanguage('en');
});

test('an unknown language falls back to English, never to a key', async () => {
  assert.equal(await initLanguage('xx'), 'en');
  assert.equal(currentLanguage(), 'en');
  assert.equal(t('Sign it'), 'Sign it');
  assert.equal(t('{n} words', { n: 3 }), '3 words');
});

test('each language actually loads, and reports itself', async () => {
  for (const language of supportedLanguages()) {
    assert.equal(await initLanguage(language), language);
    assert.equal(currentLanguage(), language);
    assert.notEqual(t('Sign it'), 'Sign it', `${language} did not load`);
  }
  await initLanguage('en');
});

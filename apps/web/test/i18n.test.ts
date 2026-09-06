/**
 * Every sentence the app can show has a German one.
 *
 * "Half-German page" was a finding of the trust walk: the dictionary covered the screens and
 * missed the editable rows, so a German user saw `Amount` and `How many` between German
 * sentences. This reads every `t('…')` call in the source and fails on the first English key
 * with no German entry, so the gap cannot reopen quietly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initLanguage, t, translatedKeys } from '../src/i18n.ts';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Every string literal passed as the first argument of `t(…)`. */
function keysIn(source: string): string[] {
  const keys: string[] = [];
  const pattern = /\bt\(\s*'((?:[^'\\]|\\.)*)'/g;
  for (const match of source.matchAll(pattern)) keys.push(match[1]!.replace(/\\'/g, "'"));
  return keys;
}

test('⭐ every t() key in the source has a German translation', () => {
  const german = new Set(translatedKeys());
  const missing = new Set<string>();
  for (const file of sourceFiles(join(import.meta.dirname, '..', 'src'))) {
    for (const key of keysIn(readFileSync(file, 'utf8'))) {
      if (!german.has(key)) missing.add(key);
    }
  }
  assert.deepEqual([...missing], [], `untranslated: ${[...missing].map((k) => JSON.stringify(k)).join(', ')}`);
});

test('a German translation carries every placeholder its English key has', () => {
  initLanguage('de');
  for (const key of translatedKeys()) {
    const placeholders = key.match(/\{\w+\}/g) ?? [];
    const rendered = t(key);
    for (const p of placeholders) assert.ok(rendered.includes(p), `${JSON.stringify(key)} drops ${p} in German`);
  }
  initLanguage('en');
});

test('an unknown language falls back to English, never to a key', () => {
  assert.equal(initLanguage('xx'), 'en');
  assert.equal(t('Sign it'), 'Sign it');
  assert.equal(t('{n} words', { n: 3 }), '3 words');
});

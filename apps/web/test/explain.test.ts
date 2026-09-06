/**
 * What a person is told when the wallet says no.
 *
 * A provider's own text is written for whoever wrote the provider — "user rejected the
 * request", "insufficient funds", "Failed to fetch". Shown as-is it is always English however
 * the app is set, tells nobody what to do, and reads as though chit broke when in most of
 * these cases nothing is wrong at all.
 *
 * The two properties worth pinning: a cancellation is never presented as an error, and an
 * unrecognised message is quoted rather than reinterpreted. Guessing wrong about an error is
 * worse than admitting it came from somewhere else.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain } from '../src/wallet.ts';
import { initLanguage } from '../src/i18n.ts';

test('a decline is calm, in every spelling a provider uses for it', async () => {
  await initLanguage('en');
  for (const wording of [
    'User rejected the request',
    'user denied transaction signature',
    'The user declined',
    'Request cancelled by user',
    'aborted',
  ]) {
    const { message, tone } = explain(new Error(wording));
    assert.equal(tone, 'calm', wording);
    assert.equal(message, 'You cancelled. Nothing was sent.', wording);
  }
});

test('running out of NIM says so, and says nothing was sent', async () => {
  await initLanguage('en');
  const { message, tone } = explain(new Error('insufficient funds for transfer'));
  assert.equal(tone, 'calm');
  assert.match(message, /not hold enough NIM/);
  assert.match(message, /nothing was sent/i);
});

test('a network failure is not presented as the app breaking', async () => {
  await initLanguage('en');
  for (const wording of ['Failed to fetch', 'NetworkError when attempting to fetch resource', 'ECONNRESET', 'request timed out']) {
    const { message, tone } = explain(new Error(wording));
    assert.equal(tone, 'calm', wording);
    assert.match(message, /network|connection/i, wording);
  }
});

test('an unrecognised failure is quoted, and attributed to the wallet', async () => {
  await initLanguage('en');
  const { message, tone } = explain(new Error('E_UNKNOWN_0x41'));
  assert.equal(tone, 'bad');
  assert.match(message, /E_UNKNOWN_0x41/, 'the original is kept — a wrong guess is worse than a quotation');
  assert.match(message, /Your wallet reported/, 'and it is clear whose words they are');
});

test('something that is not an Error at all still produces a sentence', async () => {
  await initLanguage('en');
  const { message, tone } = explain('boom');
  assert.equal(tone, 'bad');
  assert.match(message, /Nothing was signed and nothing was sent/);
});

test('every one of these is translated, so a German user never gets a half-English screen', async () => {
  await initLanguage('de');
  try {
    const cancelled = explain(new Error('user rejected'));
    assert.match(cancelled.message, /abgebrochen/, 'a decline reads in German');
    const short = explain(new Error('insufficient funds'));
    assert.match(short.message, /nicht genug NIM/);
    // Even the fallback keeps its German frame around the provider's English words.
    const unknown = explain(new Error('E_UNKNOWN'));
    assert.match(unknown.message, /Deine Wallet meldet/);
    assert.match(unknown.message, /E_UNKNOWN/);
  } finally {
    await initLanguage('en');
  }
});

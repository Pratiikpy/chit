/**
 * Rendering tests, against a real DOM.
 *
 * The pasted line is arbitrary text written by one person and read by another on the
 * countersign page. That makes "it can never become markup" a security property, not a
 * style preference — so it is asserted here rather than assumed from using `textContent`.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

// A DOM has to exist before the modules under test are imported, because they touch
// `document` at module scope.
const window = new Window({ url: 'https://chit.test/' });

// `navigator` is a getter-only global in Node 22, so it cannot be assigned. Nothing under
// test reads it at module scope, so it is deliberately left alone rather than forced.
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  // Runs the QR render and focus calls synchronously so assertions see the final DOM.
  queueMicrotask: (fn: () => void) => fn(),
});

let ui: typeof import('../src/ui.ts');
let editor: typeof import('../src/terms-editor.ts');
let compose: typeof import('../src/compose.ts');
let core: typeof import('@chit/core');

before(async () => {
  ui = await import('../src/ui.ts');
  editor = await import('../src/terms-editor.ts');
  compose = await import('../src/compose.ts');
  core = await import('@chit/core');
});

/* ---------------------------------------------------------------- safety */

test('⭐ pasted text can never become markup', () => {
  const attacks = [
    '<img src=x onerror="alert(1)">',
    '<script>alert(1)</script>',
    '"><svg/onload=alert(1)>',
    '<iframe src="javascript:alert(1)">',
    '${constructor.constructor("alert(1)")()}',
  ];

  for (const attack of attacks) {
    const node = ui.el('div', { text: attack });
    assert.equal(node.textContent, attack, 'the text survives verbatim');
    assert.equal(node.querySelector('img,script,svg,iframe'), null, `markup was created for: ${attack}`);
    assert.ok(!node.innerHTML.includes('<img'), 'no raw tag reached innerHTML');
    assert.ok(!node.innerHTML.includes('<script'), 'no script tag reached innerHTML');
  }
});

test('a hostile line renders as text in a row and in a screen', () => {
  const attack = '<script>alert(1)</script> and $40';
  const line = ui.row('For', attack);
  assert.equal(line.querySelector('script'), null);
  assert.ok(line.textContent?.includes(attack));

  const rendered = ui.screen({ title: attack, body: [ui.el('p', { text: attack })] });
  assert.equal(rendered.querySelector('script'), null);
});

test('attributes are set safely and falsy ones are omitted', () => {
  const node = ui.el('button', {
    attrs: { type: 'button', disabled: false, 'aria-pressed': true, title: undefined },
  });
  assert.equal(node.getAttribute('type'), 'button');
  assert.equal(node.hasAttribute('disabled'), false, 'false omits the attribute entirely');
  assert.equal(node.getAttribute('aria-pressed'), '', 'true renders as a bare attribute');
  assert.equal(node.hasAttribute('title'), false);
});

/* ---------------------------------------------------------------- formatting */

test('money renders exactly, with no float anywhere', () => {
  assert.equal(ui.money('4000', 'USD'), '40.00 USD');
  assert.equal(ui.money('4015', 'USD'), '40.15 USD');
  assert.equal(ui.money('5', 'USD'), '0.05 USD');
  assert.equal(ui.money('0', 'USD'), '0.00 USD');
  assert.equal(ui.money('4000', 'JPY'), '4000 JPY', 'no decimals for a zero-decimal currency');
  // Beyond 2^53 — this is why the wire format is a string.
  assert.equal(ui.money('9007199254740993', 'USD'), '90071992547409.93 USD');
});

test('NIM renders grouped, with trailing zeros trimmed', () => {
  assert.equal(ui.nim('100000'), '1 NIM');
  assert.equal(ui.nim('10436234607'), '104 362.34607 NIM');
  assert.equal(ui.nim('150000'), '1.5 NIM');
  assert.equal(ui.nim('1'), '0.00001 NIM', 'one Luna is visible, not rounded away');
  assert.equal(ui.nim('0'), '0 NIM');
});

test('addresses render the way people read them', () => {
  const tight = 'NQ56M67GT26X3N9VXDGEQ3BNHSVUE13YQNGV';
  assert.equal(ui.prettyAddress(tight), 'NQ56 M67G T26X 3N9V XDGE Q3BN HSVU E13Y QNGV');
  assert.equal(ui.prettyAddress('nq56 m67g t26x 3n9v xdge q3bn hsvu e13y qngv'), ui.prettyAddress(tight));
  assert.match(ui.shortAddress(tight), /^NQ56 M67G … E13Y QNGV$/);
});

/* ---------------------------------------------------------------- editing */

function fieldsFor(line: string) {
  return compose.fieldsFromTerms(core.parseTerms(line, new Date('2026-09-09T12:00:00Z')));
}

test('⭐ every parsed value can be corrected — the parser proposes, the human decides', () => {
  const fields = fieldsFor('$40 for 3 thumbnails by Friday');
  let changes = 0;

  const card = editor.termsEditor({
    fields,
    currencyAlternatives: ['CAD', 'AUD'],
    onChange: () => changes++,
  });

  const triggers = card.querySelectorAll('button');
  assert.ok(triggers.length >= 4, 'amount, currency, deadline and count are all reachable');

  // Correct the currency: open the row, then pick an alternative.
  const currencyTrigger = [...triggers].find((b) => b.textContent?.includes('USD'));
  assert.ok(currencyTrigger, 'the currency is shown and tappable');
  currencyTrigger.click();

  const cadChip = [...card.querySelectorAll('button')].find((b) => b.textContent === 'CAD');
  assert.ok(cadChip, 'the parser\'s own alternatives are offered first');
  cadChip.click();

  assert.equal(fields.currency, 'CAD');
  assert.ok(fields.edited.has('currency'));
  assert.equal(changes, 1, 'a correction triggers a re-quote');
});

test('correcting the deadline records the choice', () => {
  const fields = fieldsFor('$40 for a logo');
  const card = editor.termsEditor({ fields, currencyAlternatives: [], onChange: () => {} });

  const trigger = [...card.querySelectorAll('button')].find((b) => b.textContent?.includes('7 days'));
  assert.ok(trigger, 'the proposed default is visible and changeable');
  trigger.click();

  const tomorrow = [...card.querySelectorAll('button')].find((b) => b.textContent === 'tomorrow');
  assert.ok(tomorrow);
  tomorrow.click();

  assert.equal(fields.deadlineDays, 1);
  assert.ok(fields.edited.has('deadline'));
});

test('an unparseable amount is refused with a sentence, not silently accepted', () => {
  const fields = fieldsFor('$40 for a logo');
  const card = editor.termsEditor({ fields, currencyAlternatives: [], onChange: () => {} });

  const trigger = [...card.querySelectorAll('button')].find((b) => b.textContent?.includes('40.00'));
  assert.ok(trigger);
  trigger.click();

  const input = card.querySelector('input');
  assert.ok(input);
  input.value = 'not money';
  const setIt = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Set it');
  assert.ok(setIt);
  setIt.click();

  assert.equal(fields.amountMinor, 4000n, 'the old value is kept');
  assert.ok(card.textContent?.includes('not an amount chit can read'));
});

test('a valid correction is applied and the row closes', () => {
  const fields = fieldsFor('$40 for a logo');
  let changes = 0;
  const card = editor.termsEditor({ fields, currencyAlternatives: [], onChange: () => changes++ });

  [...card.querySelectorAll('button')].find((b) => b.textContent?.includes('40.00'))?.click();
  const input = card.querySelector('input');
  assert.ok(input);
  input.value = '62.50';
  [...card.querySelectorAll('button')].find((b) => b.textContent === 'Set it')?.click();

  assert.equal(fields.amountMinor, 6250n);
  assert.ok(fields.edited.has('amount'));
  assert.equal(changes, 1);
});

/* ---------------------------------------------------------------- screens */

test('a screen puts its primary action in a sticky footer, in thumb reach', () => {
  const rendered = ui.screen({
    title: 'Paste what you agreed',
    body: [ui.el('p', { text: 'body' })],
    actions: [ui.button('Sign it', () => {})],
  });
  assert.ok(rendered.querySelector('.screen__actions'));
  assert.equal(rendered.querySelector('.screen__actions button')?.textContent, 'Sign it');
});

test('a busy button always comes back, even when the work throws', async () => {
  const target = ui.button('Sign it', () => {});
  await assert.rejects(() =>
    ui.withBusy(target, 'Waiting…', () => Promise.reject(new Error('declined'))),
  );
  assert.equal(target.disabled, false, 'never left stuck');
  assert.equal(target.textContent, 'Sign it', 'label restored');
});

test('a cancellation is not styled as an error', () => {
  const calm = ui.note('You cancelled. Nothing was sent.', 'calm');
  assert.ok(calm.className.includes('note--calm'));
  assert.equal(calm.getAttribute('role'), 'status', 'announced, not alarmed');

  const bad = ui.note('That signature did not verify.', 'bad');
  assert.equal(bad.getAttribute('role'), 'alert');
});

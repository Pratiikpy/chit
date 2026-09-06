/**
 * Correcting what the parser understood.
 *
 * The parser proposes; the human confirms. That split is only real if correcting is
 * genuinely easy — otherwise the honest confidence levels in `@chit/core/terms` are
 * decoration and the user is stuck with our guess.
 *
 * The brief's constraint was "**without a form**". So nothing here is a form: every value
 * is the control. Tap the amount and it becomes an input; tap the currency and the
 * plausible alternatives are already sitting there as one-tap chips, because the parser
 * has told us exactly which ones it was choosing between.
 */

import { formatMinor, minorUnitsPer, parseMoneyToMinor } from '@chit/core';
import type { DraftFields } from './compose.ts';
import { el, icon } from './ui.ts';
import { t } from './i18n.ts';

/** Currencies offered when the parser had no opinion. Nimiq Pay's own four lead. */
const COMMON_CURRENCIES = ['USD', 'EUR', 'CRC', 'GMD', 'GBP', 'INR', 'NGN', 'BRL', 'PHP', 'PKR'];

const DEADLINE_CHOICES: Array<{ label: () => string; days: number }> = [
  { label: () => t('today'), days: 0 },
  { label: () => t('tomorrow'), days: 1 },
  { label: () => t('3 days'), days: 3 },
  { label: () => t('a week'), days: 7 },
  { label: () => t('2 weeks'), days: 14 },
];

export interface EditorOptions {
  fields: DraftFields;
  /** Alternatives the parser was choosing between, e.g. $ → USD, CAD, AUD. */
  currencyAlternatives: string[];
  /** Called whenever the user changes something. Triggers a re-quote. */
  onChange: () => void;
}

function chip(label: string, pressed: boolean, onPick: () => void): HTMLButtonElement {
  return el('button', {
    class: 'chip',
    text: label,
    attrs: { type: 'button', 'aria-pressed': pressed ? 'true' : 'false' },
    on: { click: () => onPick() },
  });
}

/** Days from now, the way a person says it. */
export function deadlineLabel(days: number): string {
  if (days === 0) return t('today');
  if (days === 1) return t('tomorrow');
  return t('{n} days', { n: days });
}

/**
 * A row whose value can be corrected in place.
 *
 * Collapsed it reads as a plain fact with a pen beside it. Tapped, it expands into exactly
 * the control that value needs — and nothing else appears on screen.
 */
function editableRow(
  label: string,
  display: string,
  buildEditor: (close: () => void) => HTMLElement,
): HTMLElement {
  const container = el('div', { class: 'edit' });
  let open = false;

  const render = (): void => {
    container.replaceChildren();
    if (!open) {
      const trigger = el('button', {
        class: 'line edit__trigger',
        attrs: { type: 'button', 'aria-label': t('{label}: {value}. Tap to change.', { label, value: display }) },
        children: [
          el('span', { class: 'line__label', text: label }),
          el('span', { class: 'line__value', children: [el('span', { text: display }), icon('pen', 'icon--sm edit__pen')] }),
        ],
        on: {
          click: () => {
            open = true;
            render();
          },
        },
      });
      container.append(trigger);
      return;
    }

    container.append(
      el('div', {
        class: 'stack stack--tight edit__panel',
        children: [el('span', { class: 'line__label', text: label }), buildEditor(() => {
          open = false;
          render();
        })],
      }),
    );
  };

  render();
  return container;
}

/** The whole "what we understood" block, with every value correctable. */
export function termsEditor(options: EditorOptions): HTMLElement {
  const { fields, onChange } = options;

  const amountRow = editableRow(
    t('Amount'),
    fields.amountMinor !== null && fields.currency ? formatMinor(fields.amountMinor, fields.currency) : t('not sure yet'),
    (close) => {
      const input = el('input', {
        class: 'field',
        attrs: {
          type: 'text',
          // `inputmode` rather than `type=number`: a number input hides the decimal
          // separator on some Android keyboards and silently drops what the user typed.
          inputmode: 'decimal',
          autocomplete: 'off',
          'aria-label': t('Amount'),
          value: fields.amountMinor !== null && fields.currency ? formatMinor(fields.amountMinor, fields.currency) : '',
        },
      });

      const problem = el('div', { class: 'small edit__problem', attrs: { role: 'alert' } });

      const apply = (): void => {
        const parsed = parseMoneyToMinor(input.value.trim(), fields.currency ?? 'USD');
        if (parsed === null || parsed <= 0n) {
          problem.textContent =
            minorUnitsPer(fields.currency ?? 'USD') === 1n
              ? t('A whole number, please — this currency has no decimals.')
              : t('That is not an amount chit can read. Try 40 or 40.50.');
          return;
        }
        fields.amountMinor = parsed;
        fields.edited.add('amount');
        problem.textContent = '';
        close();
        onChange();
      };

      input.addEventListener('keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Enter') {
          event.preventDefault();
          apply();
        }
      });

      queueMicrotask(() => input.focus());
      return el('div', {
        class: 'stack stack--tight',
        children: [input, problem, el('button', { class: 'btn', text: t('Set it'), attrs: { type: 'button' }, on: { click: apply } })],
      });
    },
  );

  const currencyRow = editableRow(t('Currency'), fields.currency ?? t('not sure yet'), (close) => {
    // The parser's own alternatives come first — it already knows which currencies share
    // the symbol it saw, so those are the corrections actually likely to be wanted.
    const offered = [...(fields.currency ? [fields.currency] : []), ...options.currencyAlternatives, ...COMMON_CURRENCIES].filter(
      (code, index, all) => all.indexOf(code) === index,
    );

    return el('div', {
      class: 'chips',
      children: offered.map((code) =>
        chip(code, code === fields.currency, () => {
          fields.currency = code;
          fields.edited.add('currency');
          close();
          onChange();
        }),
      ),
    });
  });

  const deadlineRow = editableRow(t('By'), deadlineLabel(fields.deadlineDays), (close) =>
    el('div', {
      class: 'chips',
      children: DEADLINE_CHOICES.map((choice) =>
        chip(choice.label(), choice.days === fields.deadlineDays, () => {
          fields.deadlineDays = choice.days;
          fields.edited.add('deadline');
          close();
          onChange();
        }),
      ),
    }),
  );

  const deliverablesRow = editableRow(t('How many'), String(fields.deliverables), (close) =>
    el('div', {
      class: 'chips',
      children: [1, 2, 3, 4, 5, 10].map((count) =>
        chip(String(count), count === fields.deliverables, () => {
          fields.deliverables = count;
          fields.edited.add('deliverables');
          close();
          onChange();
        }),
      ),
    }),
  );

  return el('div', { class: 'card', children: [amountRow, currencyRow, deadlineRow, deliverablesRow] });
}

/** A read-only NIM line — the settlement figure, never editable because we quote it. */
export function nimRow(nimText: string): HTMLElement {
  return el('div', {
    class: 'line',
    children: [el('span', { class: 'line__label', text: t('In NIM') }), el('span', { class: 'line__value num', text: nimText })],
  });
}

/**
 * Reading a pasted line into structured terms.
 *
 * **This file is NOT frozen** — unlike `canonical.ts`, nothing signed depends on how we
 * parse. The parser only proposes; the human confirms, and what they confirm is what gets
 * signed. That separation is deliberate: a parser that is merely good is safe here,
 * whereas a serializer that is merely good would be a disaster.
 *
 * Two rules the whole file obeys:
 *
 * 1. **Never guess silently.** Every field carries where it came from and how confident
 *    we are. The UI shows the user what we understood and lets them fix it. A wrong
 *    amount that looks confident is worse than an empty field.
 * 2. **Ambiguity is reported, not resolved.** `$` could be USD, CAD, AUD, SGD. We default
 *    to USD *and say so*, so the user can correct it in one tap.
 */

/** How sure we are about one extracted field. */
export type Confidence = 'certain' | 'likely' | 'guess';

export interface ParsedField<T> {
  value: T;
  confidence: Confidence;
  /** The exact substring this came from, so the UI can highlight it in the original line. */
  source: string;
  /** Present when more than one reading was plausible. The UI offers these as one tap. */
  alternatives?: T[];
}

export interface ParsedTerms {
  /** The line exactly as pasted, trimmed. This is what gets signed, not our reading of it. */
  text: string;
  amountMinor?: ParsedField<bigint>;
  currency?: ParsedField<string>;
  /** Days from today. Converted to a block height by the caller, which knows the chain. */
  deadlineDays?: ParsedField<number>;
  deliverables?: ParsedField<number>;
  /** Everything we could not account for. Shown to the user as "we didn't understand this". */
  unparsed: string[];
}

/**
 * Currency symbols → ISO 4217. Ordered so that longer symbols match first.
 * `alternatives` lists the other currencies that share a symbol.
 */
const SYMBOLS: Array<{ symbol: string; code: string; alternatives?: string[] }> = [
  { symbol: 'US$', code: 'USD' },
  { symbol: 'C$', code: 'CAD' },
  { symbol: 'A$', code: 'AUD' },
  { symbol: 'R$', code: 'BRL' },
  { symbol: '₡', code: 'CRC' },
  { symbol: '₦', code: 'NGN' },
  { symbol: '₱', code: 'PHP' },
  { symbol: '₹', code: 'INR' },
  { symbol: '₨', code: 'PKR', alternatives: ['INR', 'LKR', 'NPR'] },
  { symbol: '£', code: 'GBP' },
  { symbol: '€', code: 'EUR' },
  { symbol: '¥', code: 'JPY', alternatives: ['CNY'] },
  { symbol: 'D', code: 'GMD' }, // Gambian dalasi — only matched with an explicit code, see below
  { symbol: '$', code: 'USD', alternatives: ['CAD', 'AUD', 'SGD', 'NZD', 'HKD', 'MXN'] },
];

/** ISO codes we accept written out. Nimiq Pay displays USD, EUR, CRC and GMD natively. */
const CODES = new Set([
  'USD', 'EUR', 'GBP', 'CRC', 'GMD', 'INR', 'NGN', 'PHP', 'PKR', 'BRL', 'MXN', 'ARS',
  'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'JPY', 'CNY', 'ZAR', 'KES', 'GHS', 'IDR', 'VND',
  'TRY', 'UAH', 'PLN', 'SEK', 'NOK', 'DKK', 'CHF', 'CZK', 'RON', 'HUF', 'THB', 'MYR',
]);

/** Currencies with no minor unit. Multiplying these by 100 would inflate them 100×. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'RWF', 'XOF', 'XAF', 'PYG']);

/** How many minor units make one major unit for a currency. */
export function minorUnitsPer(currency: string): bigint {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 1n : 100n;
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  a: 1, an: 1, couple: 2, dozen: 12,
};

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Turn a numeric string into minor units without ever going through a float.
 *
 * Money in a float is a bug waiting for a specific amount: `0.1 + 0.2 !== 0.3`, and
 * `40.15 * 100` is `4014.999…`. Everything here is integer arithmetic on strings.
 *
 * Handles `1,200.50` (English) and `1.200,50` (European) by looking at which separator
 * comes last, and `1200` with no separator at all.
 */
export function parseMoneyToMinor(raw: string, currency: string): bigint | null {
  const cleaned = raw.replace(/\s/g, '');
  if (!/^[\d.,]+$/.test(cleaned) || cleaned.length === 0) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let integerPart: string;
  let fractionPart: string;

  if (lastComma === -1 && lastDot === -1) {
    integerPart = cleaned;
    fractionPart = '';
  } else {
    const decimalAt = Math.max(lastComma, lastDot);
    // Safe: decimalAt came from lastIndexOf on this same string and is >= 0 here.
    const separator = cleaned.charAt(decimalAt);
    const after = cleaned.slice(decimalAt + 1);

    // A separator followed by exactly 3 digits, with no other separator, is a thousands
    // group — "1,200" is twelve hundred, not one-point-two. Two digits is a decimal.
    const isThousands =
      after.length === 3 && cleaned.indexOf(separator) === cleaned.lastIndexOf(separator) && /^\d{3}$/.test(after);

    if (isThousands) {
      integerPart = cleaned.replace(/[.,]/g, '');
      fractionPart = '';
    } else {
      integerPart = cleaned.slice(0, decimalAt).replace(/[.,]/g, '');
      fractionPart = after;
    }
  }

  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(fractionPart)) return null;
  if (integerPart === '' && fractionPart === '') return null;

  const per = minorUnitsPer(currency);
  if (per === 1n) {
    // Zero-decimal currency: any fraction is meaningless, so refuse rather than round.
    if (fractionPart.replace(/0/g, '') !== '') return null;
    return BigInt(integerPart || '0');
  }

  const padded = (fractionPart + '00').slice(0, 2);
  return BigInt(integerPart || '0') * 100n + BigInt(padded || '0');
}

/** Find a currency in the line. Returns null when nothing indicates one. */
function findCurrency(text: string): ParsedField<string> | null {
  const upper = text.toUpperCase();

  // An explicit ISO code is unambiguous and beats any symbol.
  for (const code of CODES) {
    const match = new RegExp(`\\b${code}\\b`).exec(upper);
    if (match) return { value: code, confidence: 'certain', source: match[0] };
  }

  for (const { symbol, code, alternatives } of SYMBOLS) {
    if (symbol === 'D') continue; // dalasi needs the explicit code; bare "D" is a false friend
    if (!text.includes(symbol)) continue;
    return {
      value: code,
      confidence: alternatives ? 'likely' : 'certain',
      source: symbol,
      ...(alternatives ? { alternatives } : {}),
    };
  }

  return null;
}

/** Find the money amount. Requires a currency, because 100 what? is not a question we guess at. */
function findAmount(text: string, currency: string): ParsedField<bigint> | null {
  // "40k" / "1.5k" — common in freelance rates.
  const thousands = /(\d[\d.,]*)\s*k\b/i.exec(text);
  if (thousands?.[1]) {
    const base = parseMoneyToMinor(thousands[1], currency);
    if (base !== null) {
      return { value: base * 1000n, confidence: 'likely', source: thousands[0] };
    }
  }

  // A number adjacent to a currency symbol or code is the amount, either side.
  const symbols = SYMBOLS.map((s) => s.symbol.replace(/[$]/g, '\\$')).join('|');
  const attached = new RegExp(`(?:${symbols}|\\b[A-Z]{3}\\b)\\s*(\\d[\\d.,]*)|(\\d[\\d.,]*)\\s*(?:${symbols}|\\b[A-Z]{3}\\b)`, 'i');
  const match = attached.exec(text);
  const captured = match?.[1] ?? match?.[2];
  if (match && captured) {
    const value = parseMoneyToMinor(captured, currency);
    if (value !== null) return { value, confidence: 'certain', source: match[0].trim() };
  }

  return null;
}

/**
 * Words that follow a number but are never the thing being delivered.
 * Without this, "$40 for 3 thumbnails" reads "40 for" as forty deliverables.
 */
const NOT_A_DELIVERABLE =
  /^(day|days|week|weeks|hour|hours|month|months|year|years|min|mins|minute|minutes|sec|secs|second|seconds|am|pm|k|for|the|and|but|per|out|off|via|usd|eur|gbp|inr|ngn|php|pkr|brl|mxn|ars|cad|aud|nzd|sgd|hkd|jpy|cny|zar|crc|gmd|kes|ghs|idr|vnd|try|uah|pln|sek|nok|dkk|chf|czk|ron|huf|thb|myr)$/i;

/**
 * Find how many things are being delivered.
 *
 * `exclude` is the amount's source text, removed before searching. The amount is always
 * a number next to a noun-ish word, so leaving it in makes it the first match every time.
 */
function findDeliverables(text: string, exclude?: string): ParsedField<number> | null {
  const haystack = exclude ? text.replace(exclude, ' ') : text;

  // "3 thumbnails", "3x logo", "three articles" — a count followed by a noun.
  // Scan every match rather than taking the first, so a leading false friend
  // ("30-second") does not hide the real count later in the line.
  for (const digits of haystack.matchAll(/\b(\d{1,3})\s*(?:x\s*)?([a-z][a-z-]{2,})/gi)) {
    const [, rawCount, noun] = digits;
    if (!rawCount || !noun) continue;
    if (NOT_A_DELIVERABLE.test(noun)) continue;
    const count = Number(rawCount);
    if (count >= 1 && count <= 999) {
      return { value: count, confidence: 'likely', source: digits[0] };
    }
  }

  for (const [word, count] of Object.entries(WORD_NUMBERS)) {
    if (word === 'a' || word === 'an') continue; // far too common to be a signal
    const match = new RegExp(`\\b${word}\\s+([a-z][a-z-]{2,})`, 'i').exec(text);
    if (match) return { value: count, confidence: 'likely', source: match[0] };
  }

  return null;
}

/**
 * Find a deadline, expressed as whole days from `now`.
 *
 * Days, not a timestamp, because the chain deadline is a block height and the caller is
 * the only thing that knows the current height. Keeping this unit-free avoids a timezone
 * bug living inside the parser.
 */
function findDeadlineDays(text: string, now: Date): ParsedField<number> | null {
  const lower = text.toLowerCase();

  if (/\btoday\b|\btonight\b/.test(lower)) {
    return { value: 0, confidence: 'certain', source: /\btonight\b/.test(lower) ? 'tonight' : 'today' };
  }
  if (/\btomorrow\b/.test(lower)) {
    return { value: 1, confidence: 'certain', source: 'tomorrow' };
  }

  const inDays = /\b(?:in|within)\s+(\d{1,3}|one|two|three|four|five|six|seven|ten)\s+(day|days|week|weeks|hour|hours)\b/i.exec(lower);
  if (inDays?.[1] && inDays[2]) {
    const raw = inDays[1];
    const count = /^\d+$/.test(raw) ? Number(raw) : (WORD_NUMBERS[raw] ?? 1);
    const unit = inDays[2].toLowerCase();
    const days = unit.startsWith('week') ? count * 7 : unit.startsWith('hour') ? Math.ceil(count / 24) : count;
    return { value: days, confidence: 'certain', source: inDays[0] };
  }

  if (/\bnext week\b/.test(lower)) return { value: 7, confidence: 'likely', source: 'next week' };
  if (/\bend of (?:the )?week\b/.test(lower)) {
    // Friday of the current week; if it has passed, the coming Friday.
    const days = (5 - now.getDay() + 7) % 7 || 7;
    return { value: days, confidence: 'likely', source: 'end of week' };
  }

  // "by Friday" — the next occurrence of that weekday, never today.
  const weekday = /\b(?:by|before|due|on)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(lower);
  if (weekday?.[1]) {
    const target = WEEKDAYS.indexOf(weekday[1].toLowerCase());
    const days = (target - now.getDay() + 7) % 7 || 7;
    return { value: days, confidence: 'likely', source: weekday[0].trim() };
  }

  return null;
}

/**
 * Read a pasted line into terms.
 *
 * `now` is injected so the deadline logic is deterministic and testable — a parser whose
 * output depends on the wall clock cannot be tested, and a deadline is exactly the field
 * you cannot afford to get wrong.
 */
export function parseTerms(input: string, now: Date = new Date()): ParsedTerms {
  const text = input.trim().replace(/\s+/g, ' ');

  const currency = findCurrency(text);
  const amount = currency ? findAmount(text, currency.value) : null;
  const deliverables = findDeliverables(text, amount?.source);
  const deadlineDays = findDeadlineDays(text, now);

  // What we could not account for — shown to the user so nothing is silently dropped.
  const consumed = [currency?.source, amount?.source, deliverables?.source, deadlineDays?.source]
    .filter((s): s is string => typeof s === 'string' && s.length > 0);

  let remainder = text;
  for (const piece of consumed) remainder = remainder.replace(piece, ' ');
  const unparsed = remainder
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w]+|[^\w]+$/g, ''))
    .filter((w) => w.length > 2 && !/^(for|the|and|by|with|from|into|please|need|want|make|then)$/i.test(w));

  return {
    text,
    ...(amount ? { amountMinor: amount } : {}),
    ...(currency ? { currency } : {}),
    ...(deadlineDays ? { deadlineDays } : {}),
    ...(deliverables ? { deliverables } : {}),
    unparsed,
  };
}

/** True when we have enough to build a chit without the user typing anything. */
export function isComplete(terms: ParsedTerms): boolean {
  return terms.amountMinor !== undefined && terms.currency !== undefined;
}

/** Format minor units for display. Never used for arithmetic — display only. */
export function formatMinor(amountMinor: bigint, currency: string): string {
  const per = minorUnitsPer(currency);
  if (per === 1n) return amountMinor.toString(10);
  const major = amountMinor / 100n;
  const minor = amountMinor % 100n;
  return `${major.toString(10)}.${minor.toString(10).padStart(2, '0')}`;
}

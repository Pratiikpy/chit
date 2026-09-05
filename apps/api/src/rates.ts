/**
 * Turning a fiat amount into Luna, and pinning the rate.
 *
 * The rule from `PRODUCT_SPEC.md` §3d: **the fiat number is the contract.** NIM is only
 * ever the settlement instruction. So the quote is computed once, server-side, held for
 * fifteen minutes (BitPay and BTCPay's number, and the ceiling of the range the industry
 * converged on), and pinned to a block height so anyone can check later what the rate was
 * when the chit was signed.
 *
 * Server-side and not in the browser for two reasons: a client-supplied rate is a client
 * that can pay less than it agreed, and `@nimiq/utils` plus its rate limiter has no
 * business in a phone's bundle.
 *
 * Failure policy: **never block a payment on a price API.** A feeless one-second rail that
 * refuses to settle because a free endpoint is rate-limited is a worse product than a
 * receipt that says which minute its rate came from. So the last good rate is cached and
 * reused, and the receipt records when it was taken.
 */

import { CryptoCurrency, FiatCurrency, Provider, getExchangeRates } from '@nimiq/utils/fiat-api';

/**
 * CoinGecko, not the library's default.
 *
 * `@nimiq/utils` defaults to `Provider.CryptoCompare`, which now answers
 * *"API key required"* — verified by calling it: the quote endpoint returned
 * `CryptoCompare error 2` against the live service. CoinGecko is the keyless option, so
 * chit works on a fresh deployment with no credential to obtain, lose, or leak.
 */
const RATE_PROVIDER = Provider.CoinGecko;

/** How long a quote is honoured before the client must ask again. */
export const QUOTE_TTL_MS = 15 * 60 * 1000;

/** 1 NIM = 100 000 Luna (core-rs-albatross `coin.rs:26`). */
const LUNA_PER_NIM = 100_000n;

/** Currencies with no minor unit — multiplying these by 100 would inflate them 100×. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'RWF', 'XOF', 'XAF', 'PYG']);

export interface Quote {
  amountMinor: bigint;
  currency: string;
  luna: bigint;
  /** NIM price in the quoted currency, as reported. Recorded for the receipt. */
  rate: number;
  /** Block height the quote is pinned to. */
  rateBlock: number;
  /** When the rate was taken, not when it was served — they differ when the cache is used. */
  quotedAt: number;
  expiresAt: number;
  /** True when a cached rate was used because the price API was unreachable. */
  stale: boolean;
}

export class RateUnavailableError extends Error {
  override readonly name = 'RateUnavailableError';
}

interface CachedRate {
  rate: number;
  at: number;
}

/**
 * Convert a fiat amount to Luna without ever touching a float for the money itself.
 *
 * The rate is unavoidably a float — it is a price. But the amount is not: the division is
 * done in integer arithmetic, scaled by 10^12, so a $40.15 chit produces exactly the same
 * Luna figure on every machine that computes it. Rounding is **up**, so a chit is never
 * underfunded by a fraction of a Luna.
 */
export function fiatToLuna(amountMinor: bigint, currency: string, nimPriceInFiat: number): bigint {
  if (!Number.isFinite(nimPriceInFiat) || nimPriceInFiat <= 0) {
    throw new RateUnavailableError(`invalid NIM price: ${nimPriceInFiat}`);
  }

  const minorPerMajor = ZERO_DECIMAL.has(currency.toUpperCase()) ? 1n : 100n;

  // Scale the price to an integer with 12 decimal places, then do exact integer maths.
  const SCALE = 1_000_000_000_000n;
  const scaledPrice = BigInt(Math.round(nimPriceInFiat * 1e12));
  if (scaledPrice <= 0n) {
    throw new RateUnavailableError(`NIM price rounds to zero at 12dp: ${nimPriceInFiat}`);
  }

  // luna = (amountMinor / minorPerMajor) / price * LUNA_PER_NIM, all scaled up first.
  const numerator = amountMinor * SCALE * LUNA_PER_NIM;
  const denominator = minorPerMajor * scaledPrice;

  // Ceiling division — never leave a chit a Luna short of what was agreed.
  return (numerator + denominator - 1n) / denominator;
}

export class RateService {
  #cache = new Map<string, CachedRate>();
  readonly #fetchRates: typeof getExchangeRates;

  /** The fetcher is injectable so tests never depend on a live price API. */
  constructor(fetchRates: typeof getExchangeRates = getExchangeRates) {
    this.#fetchRates = fetchRates;
  }

  /** Look up the NIM price, falling back to the last good value rather than failing. */
  async nimPrice(currency: string): Promise<{ rate: number; at: number; stale: boolean }> {
    const code = currency.toUpperCase();
    const cached = this.#cache.get(code);

    if (cached && Date.now() - cached.at < 60_000) {
      return { rate: cached.rate, at: cached.at, stale: false };
    }

    try {
      const rates = await this.#fetchRates(
        [CryptoCurrency.NIM],
        [code.toLowerCase() as FiatCurrency],
        RATE_PROVIDER,
      );
      const rate = rates[CryptoCurrency.NIM]?.[code.toLowerCase() as FiatCurrency];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        throw new RateUnavailableError(`no NIM/${code} rate returned`);
      }
      const at = Date.now();
      this.#cache.set(code, { rate, at });
      return { rate, at, stale: false };
    } catch (error) {
      if (cached) {
        // Stale but usable. Better than refusing to let someone be paid.
        return { rate: cached.rate, at: cached.at, stale: true };
      }
      throw new RateUnavailableError(
        `Could not price NIM in ${code}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async quote(amountMinor: bigint, currency: string, blockNumber: number): Promise<Quote> {
    const { rate, at, stale } = await this.nimPrice(currency);
    const now = Date.now();
    return {
      amountMinor,
      currency: currency.toUpperCase(),
      luna: fiatToLuna(amountMinor, currency, rate),
      rate,
      rateBlock: blockNumber,
      quotedAt: at,
      expiresAt: now + QUOTE_TTL_MS,
      stale,
    };
  }
}

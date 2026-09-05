import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUOTE_TTL_MS, RateService, RateUnavailableError, fiatToLuna } from '../src/rates.ts';

/** A stand-in for the price API, so no test depends on a live endpoint. */
function fakeRates(price: number | (() => number)) {
  return (() =>
    Promise.resolve({
      nim: { usd: typeof price === 'function' ? price() : price },
    })) as never;
}

test('fiat converts to Luna with exact integer arithmetic', () => {
  // $40.00 at $0.0004/NIM = 100 000 NIM = 10 000 000 000 Luna.
  assert.equal(fiatToLuna(4000n, 'USD', 0.0004), 10_000_000_000n);
  assert.equal(fiatToLuna(100n, 'USD', 0.0004), 250_000_000n, '$1.00');
});

test('conversion rounds up — a chit is never a Luna short of what was agreed', () => {
  // $0.01 at $0.00039007/NIM is 25.636… NIM, which is 2 563 642.7… Luna.
  const luna = fiatToLuna(1n, 'USD', 0.00039007);
  assert.equal(luna, 2_563_643n, 'the ceiling, not the floor');

  // Proof it really is the ceiling: this amount divides evenly, so there is no extra Luna.
  assert.equal(fiatToLuna(4000n, 'USD', 0.0004), 10_000_000_000n);
  // And one that does not divide evenly gains exactly one Luna over the floor.
  assert.equal(fiatToLuna(3n, 'USD', 0.0007), 4_285_715n);
});

test('the same amount gives the identical figure every time', () => {
  const a = fiatToLuna(4015n, 'USD', 0.00039007);
  const b = fiatToLuna(4015n, 'USD', 0.00039007);
  assert.equal(a, b, 'deterministic across calls');
  assert.equal(typeof a, 'bigint', 'never a float');
});

test('zero-decimal currencies are not inflated 100x', () => {
  // ¥4000 is four thousand yen; 4000 USD *minor units* is forty dollars. At the same
  // nominal price the yen figure must be ~100× the dollar one, or a Japanese chit pays
  // a hundredth of what it says.
  const yen = fiatToLuna(4000n, 'JPY', 0.06);
  const dollars = fiatToLuna(4000n, 'USD', 0.06);

  assert.equal(yen, 6_666_666_667n);
  assert.equal(dollars, 66_666_667n);

  // Not exactly 100× — the ceiling is applied once at each scale, so they can differ by
  // a few Luna. Asserting exact equality here would be asserting a rounding artefact.
  const ratio = Number(yen) / Number(dollars);
  assert.ok(Math.abs(ratio - 100) < 0.001, `expected ~100×, got ${ratio}`);
});

test('an impossible price is refused rather than producing a nonsense amount', () => {
  for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => fiatToLuna(4000n, 'USD', price), RateUnavailableError, `price ${price}`);
  }
});

test('a quote is pinned to a block and carries an expiry', async () => {
  const service = new RateService(fakeRates(0.0004));
  const quote = await service.quote(4000n, 'USD', 4_102_887);

  assert.equal(quote.luna, 10_000_000_000n);
  assert.equal(quote.rateBlock, 4_102_887, 'checkable afterwards, not asserted');
  assert.equal(quote.currency, 'USD');
  assert.equal(quote.stale, false);
  assert.ok(quote.expiresAt - Date.now() > QUOTE_TTL_MS - 5_000);
  assert.ok(quote.expiresAt - Date.now() <= QUOTE_TTL_MS);
});

test('rates are cached briefly so a burst does not hammer the price API', async () => {
  let calls = 0;
  const service = new RateService(fakeRates(() => {
    calls++;
    return 0.0004;
  }));

  await service.nimPrice('USD');
  await service.nimPrice('USD');
  await service.nimPrice('USD');
  assert.equal(calls, 1);
});

test('⭐ a price-API outage falls back to the last good rate rather than blocking payment', async () => {
  // A feeless one-second rail that refuses to settle because a free endpoint is
  // rate-limited is a worse product than a receipt that says which minute its rate is from.
  let shouldFail = false;
  const service = new RateService((() =>
    shouldFail ? Promise.reject(new Error('429 rate limited')) : Promise.resolve({ nim: { usd: 0.0004 } })) as never);

  const first = await service.nimPrice('USD');
  assert.equal(first.stale, false);

  shouldFail = true;
  // Age the cache past its freshness window so the fetch is actually attempted.
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await service.nimPrice('USD');

  assert.equal(second.rate, first.rate, 'the last good rate is reused');
  assert.equal(second.at, first.at, 'and the receipt records when it was taken');
});

test('with no cached rate at all, the failure is explicit', async () => {
  const service = new RateService((() => Promise.reject(new Error('offline'))) as never);
  await assert.rejects(() => service.nimPrice('USD'), RateUnavailableError);
});

test('a malformed rate response is refused, not coerced', async () => {
  for (const bad of [{ nim: {} }, { nim: { usd: 0 } }, { nim: { usd: -1 } }, {}]) {
    const service = new RateService((() => Promise.resolve(bad)) as never);
    await assert.rejects(() => service.nimPrice('USD'), RateUnavailableError, JSON.stringify(bad));
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, loadConfig } from '../src/config.ts';

test('the chain must be stated, and must be one of exactly two values', () => {
  assert.throws(() => loadConfig({}), ConfigError);
  assert.throws(() => loadConfig({ CHIT_CHAIN: 'mainnet' }), /must be "main" or "test"/);
});

test('⭐ a testnet service refuses to start against the mainnet default RPC', () => {
  // Found by running it: CHIT_CHAIN=test with the default endpoint produced a quote
  // pinned to mainnet block 60 760 916. Deadlines are block heights, so that is a
  // deadline on the wrong chain — and sign() has no domain separation to catch it.
  assert.throws(() => loadConfig({ CHIT_CHAIN: 'test' }), /requires CHIT_RPC_URL/);
  assert.doesNotThrow(() => loadConfig({ CHIT_CHAIN: 'test', CHIT_RPC_URL: 'http://localhost:8648' }));
});

test('mainnet uses the documented public endpoint by default', () => {
  assert.equal(loadConfig({ CHIT_CHAIN: 'main' }).rpcUrl, 'https://rpc.nimiqwatch.com');
});

test('numeric settings are validated rather than silently coerced', () => {
  assert.throws(() => loadConfig({ CHIT_CHAIN: 'main', PORT: 'eight' }), /positive number/);
  assert.throws(() => loadConfig({ CHIT_CHAIN: 'main', PORT: '-1' }), /positive number/);
  assert.equal(loadConfig({ CHIT_CHAIN: 'main', PORT: '9000' }).port, 9000);
});

test('the base URL never keeps a trailing slash — links are built by concatenation', () => {
  assert.equal(loadConfig({ CHIT_CHAIN: 'main', CHIT_BASE_URL: 'https://chit.app/' }).baseUrl, 'https://chit.app');
});

test('⭐ zero is a legal rate limit — it is how the limiter is turned off', () => {
  // The routes accept 0 to disable the limiter, but the config refused to load it, so the
  // service would not boot in any setup that wanted it off. Found by running the journey.
  assert.equal(loadConfig({ CHIT_CHAIN: 'main', CHIT_RATE_LIMIT_PER_MINUTE: '0' }).rateLimitPerMinute, 0);
  assert.equal(loadConfig({ CHIT_CHAIN: 'main' }).rateLimitPerMinute, 120, 'on by default');
  assert.throws(() => loadConfig({ CHIT_CHAIN: 'main', CHIT_RATE_LIMIT_PER_MINUTE: '-1' }), /zero or more/);
  assert.throws(() => loadConfig({ CHIT_CHAIN: 'main', CHIT_RATE_LIMIT_PER_MINUTE: 'lots' }), /zero or more/);
});

test('trusted proxies is validated, not silently coerced', () => {
  assert.equal(loadConfig({ CHIT_CHAIN: 'main', CHIT_TRUSTED_PROXIES: '2' }).trustedProxies, 2);
  assert.equal(loadConfig({ CHIT_CHAIN: 'main' }).trustedProxies, 0, 'x-forwarded-for ignored by default');
  assert.throws(() => loadConfig({ CHIT_CHAIN: 'main', CHIT_TRUSTED_PROXIES: 'yes' }), /zero or more/);
});

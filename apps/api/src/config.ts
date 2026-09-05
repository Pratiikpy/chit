/**
 * Configuration, read once at boot and validated loudly.
 *
 * A misconfigured chain is the worst failure this app has: `sign()` has no domain
 * separation, so a service that thinks it is on testnet while its users are on mainnet
 * would accept signatures that are worthless. So `CHIT_CHAIN` is required, has no default,
 * and must be one of exactly two values.
 */

export interface Config {
  chain: 'main' | 'test';
  port: number;
  /** Public base URL, used to build share and verify links. No trailing slash. */
  baseUrl: string;
  /** SQLite file. `:memory:` for tests. */
  databasePath: string;
  /** Nimiq JSON-RPC endpoint. */
  rpcUrl: string;
  /** Poll interval for the settlement watcher. */
  watchIntervalMs: number;
  /** API requests allowed per client per minute. */
  rateLimitPerMinute: number;
  /** Proxies in front of this service. 0 means x-forwarded-for is ignored. */
  trustedProxies: number;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value || value.trim() === '') {
    throw new ConfigError(`${key} is required and was not set`);
  }
  return value.trim();
}

/**
 * A non-negative setting, where zero carries meaning.
 *
 * `optionalNumber` refuses zero, which is right for a port or an interval. It is wrong for
 * the rate limit, where zero is the documented way to turn the limiter off — the service
 * refused to boot with `CHIT_RATE_LIMIT_PER_MINUTE=0` even though the routes support it.
 */
function optionalCount(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new ConfigError(`${key} must be a whole number of zero or more, got ${JSON.stringify(raw)}`);
  }
  return value;
}

function optionalNumber(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConfigError(`${key} must be a positive number, got ${JSON.stringify(raw)}`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const chain = required(env, 'CHIT_CHAIN');
  if (chain !== 'main' && chain !== 'test') {
    throw new ConfigError(`CHIT_CHAIN must be "main" or "test", got ${JSON.stringify(chain)}`);
  }

  const baseUrl = (env['CHIT_BASE_URL'] ?? 'http://localhost:8787').replace(/\/+$/, '');

  /*
   * The RPC must be on the same network as CHIT_CHAIN.
   *
   * This is not a theoretical concern — it was hit while bringing the service up:
   * `CHIT_CHAIN=test` with the default RPC produced a quote pinned to mainnet block
   * 60 760 916. Deadlines are stored as block heights, so a mainnet height on a testnet
   * chit is a deadline in the wrong universe, and `sign()` has no domain separation to
   * catch it. There is only one documented public endpoint and it is mainnet
   * (research/verification/05b §3), so testnet must name its own explicitly.
   */
  const MAINNET_RPC = 'https://rpc.nimiqwatch.com';
  const rpcUrl = env['CHIT_RPC_URL']?.trim();

  if (chain === 'test' && !rpcUrl) {
    throw new ConfigError(
      'CHIT_CHAIN=test requires CHIT_RPC_URL — the default endpoint is mainnet, and a ' +
        'mainnet block height on a testnet chit would put its deadline on the wrong chain.',
    );
  }
  if (chain === 'main' && rpcUrl && !/nimiqwatch\.com|mainnet/i.test(rpcUrl)) {
    // A warning rather than a failure: a private mainnet node is a legitimate setup and
    // its hostname is unguessable. Loud, so a mistake is not silent.
    console.warn(`[config] CHIT_CHAIN=main with a non-default RPC (${rpcUrl}) — confirm it is mainnet.`);
  }

  return {
    chain,
    port: optionalNumber(env, 'PORT', 8787),
    baseUrl,
    databasePath: env['CHIT_DB'] ?? './chit.db',
    rpcUrl: rpcUrl ?? MAINNET_RPC,
    watchIntervalMs: optionalNumber(env, 'CHIT_WATCH_INTERVAL_MS', 15_000),
    rateLimitPerMinute: optionalCount(env, 'CHIT_RATE_LIMIT_PER_MINUTE', 120),
    // Zero by default: trusting x-forwarded-for without a proxy in front lets any client
    // mint a fresh rate-limit bucket per request.
    trustedProxies: optionalCount(env, 'CHIT_TRUSTED_PROXIES', 0),
  };
}

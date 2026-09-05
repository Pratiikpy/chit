/**
 * Entry point.
 *
 * Boots the store, the chain client and the watcher, then serves. Every failure at boot
 * is fatal and printed plainly — a service that starts in a broken state and answers 200
 * is worse than one that refuses to start.
 */

import { serve } from '@hono/node-server';
import { loadConfig } from './config.ts';
import { SqliteRepository } from './repository.ts';
import { NimiqRpcClient } from './chain.ts';
import { SettlementWatcher } from './watcher.ts';
import { createRoutes } from './routes.ts';
import { RateService } from './rates.ts';
import { BountyService, DemoWorker } from './bounty.ts';

const config = loadConfig();
const store = new SqliteRepository(config.databasePath);
const chain = new NimiqRpcClient(config.rpcUrl);

const watcher = new SettlementWatcher({
  store,
  chain,
  intervalMs: config.watchIntervalMs,
  onSettled: (chitId, txHash) => {
    console.log(`[watcher] settled ${chitId} in ${txHash}`);
  },
  onError: (error) => {
    // Logged, never fatal. A watcher that dies on one bad response stops watching, and
    // nobody would notice until a worker asked why they had not been paid.
    console.error('[watcher]', error instanceof Error ? error.message : error);
  },
});

const rates = new RateService();
const bounty = process.env['CHIT_BOUNTY_KEY']
  ? new BountyService(store, chain, rates, { privateKeyHex: process.env['CHIT_BOUNTY_KEY'], chain: config.chain })
  : undefined;
const demoWorker = process.env['CHIT_DEMO_KEY'] ? new DemoWorker(process.env['CHIT_DEMO_KEY']) : undefined;
const app = createRoutes({
  store,
  watcher,
  chain: config.chain,
  baseUrl: config.baseUrl,
  rates,
  chainClient: chain,
  rateLimitPerMinute: config.rateLimitPerMinute,
  trustedProxies: config.trustedProxies,
  ...(bounty ? { bounty } : {}),
  ...(demoWorker ? { demoWorker } : {}),
});

watcher.start();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`chit api on :${info.port}  chain=${config.chain}  rpc=${config.rpcUrl}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    watcher.stop();
    store.close();
    process.exit(0);
  });
}

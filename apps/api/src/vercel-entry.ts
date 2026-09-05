/**
 * chit on a serverless platform.
 *
 * The same routes, the same verification, the same settlement rule — assembled with the
 * two pieces a platform without a disk or a background process demands:
 *
 *  - storage is the object store (`BlobRepository`) rather than SQLite;
 *  - settlement is confirmed while answering a read (`confirmSettlement`) rather than by a
 *    watcher loop, because there is no process between requests to run a loop in.
 *
 * Nothing about what the app *promises* changes. A payment still only settles a chit when
 * it carries that chit's digest and reaches the address the chit names, and the client is
 * still never asked whether it paid.
 *
 * This file is bundled to `api/index.js` by `npm run build:api`. It is not the deployed
 * file itself: the platform transpiles a function in place without resolving workspace
 * imports, so a deployed `api/index.ts` died on `Cannot find module '.../routes.ts'`.
 * Bundling first leaves the function with no relative imports to resolve.
 */

import { handle } from 'hono/vercel';
import { createRoutes } from './routes.ts';
import { BlobRepository } from './blob-repository.ts';
import { NimiqRpcClient } from './chain.ts';
import { RateService } from './rates.ts';
import { confirmSettlement } from './settlement.ts';
import { BountyService, DemoWorker } from './bounty.ts';
import type { StoredChit } from './repository.ts';

/** Mainnet unless told otherwise — a deployment people can actually use. */
const chain = (process.env['CHIT_CHAIN'] ?? 'main') as 'main' | 'test';

/**
 * The public RPC. `rpc.nimiqwatch.com` is the only documented public mainnet endpoint
 * (research/verification/01), and it answers polls but not sockets — which suits a
 * request-scoped check exactly.
 */
const rpcUrl = process.env['CHIT_RPC_URL'] ?? 'https://rpc.nimiqwatch.com';

/**
 * The public origin. Vercel supplies the deployment host; `CHIT_BASE_URL` pins a stable one
 * so a share link created today still resolves after the next deploy.
 */
const baseUrl =
  process.env['CHIT_BASE_URL'] ??
  (process.env['VERCEL_PROJECT_PRODUCTION_URL']
    ? `https://${process.env['VERCEL_PROJECT_PRODUCTION_URL']}`
    : process.env['VERCEL_URL']
      ? `https://${process.env['VERCEL_URL']}`
      : 'http://localhost:3000');

const repository = new BlobRepository(process.env['BLOB_READ_WRITE_TOKEN']);
const chainClient = new NimiqRpcClient(rpcUrl);
const rates = new RateService();

/**
 * The bounty pool and the demo worker exist only when their keys are configured. Without
 * them the routes answer honestly that there is none; nothing pretends.
 */
const bounty = process.env['CHIT_BOUNTY_KEY']
  ? new BountyService(repository, chainClient, rates, {
      privateKeyHex: process.env['CHIT_BOUNTY_KEY'],
      chain,
      ...(process.env['CHIT_NETWORK_ID'] ? { networkId: Number(process.env['CHIT_NETWORK_ID']) } : {}),
      ...(process.env['CHIT_BOUNTY_MINOR'] ? { amountMinor: BigInt(process.env['CHIT_BOUNTY_MINOR']) } : {}),
      ...(process.env['CHIT_BOUNTY_DAILY_CAP_LUNA'] ? { dailyCapLuna: BigInt(process.env['CHIT_BOUNTY_DAILY_CAP_LUNA']) } : {}),
      ...(process.env['CHIT_BOUNTY_SLOTS'] ? { openSlots: Number(process.env['CHIT_BOUNTY_SLOTS']) } : {}),
    })
  : undefined;
const demoWorker = process.env['CHIT_DEMO_KEY'] ? new DemoWorker(process.env['CHIT_DEMO_KEY']) : undefined;

/**
 * The chain height, cached briefly.
 *
 * Reads need a height to render a deadline in days. Asking the RPC on every request would
 * put a network round trip in front of every page; a block is ~1s and this value is only
 * used to say "about six days", so a few seconds of staleness is invisible.
 */
let heightCache: { value: number; at: number } | undefined;
const HEIGHT_TTL_MS = 15_000;

async function currentHeight(): Promise<number> {
  if (heightCache && Date.now() - heightCache.at < HEIGHT_TTL_MS) return heightCache.value;
  const value = await chainClient.getBlockNumber();
  heightCache = { value, at: Date.now() };
  return value;
}

const app = createRoutes({
  store: repository,
  chain,
  baseUrl,
  rates,
  chainClient,
  ...(bounty ? { bounty } : {}),
  ...(demoWorker ? { demoWorker } : {}),
  rateLimitPerMinute: Number(process.env['CHIT_RATE_LIMIT_PER_MINUTE'] ?? '120'),
  // Vercel terminates TLS and sets x-forwarded-for itself, so exactly one hop is trusted.
  // Left at zero, every request would share a single rate-limit bucket.
  trustedProxies: 1,
  currentHeight,
  confirmSettlement: (stored: StoredChit) =>
    confirmSettlement(repository, chainClient, stored, (error) => {
      console.error('[settlement]', error instanceof Error ? error.message : error);
    }),
});

export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);

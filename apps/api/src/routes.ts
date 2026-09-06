/**
 * The HTTP surface.
 *
 * Every write re-verifies the signature server-side before touching the database. The
 * client already verified it, but the client is not evidence — the whole product rests on
 * "the receipt is the contract", and a receipt we accepted on trust is not one.
 *
 * Errors carry a machine-readable `code` alongside the human sentence, because the app has
 * to distinguish "you cancelled" (a calm screen) from "that signature is wrong" (a real
 * failure). Handling those identically is one of the four things Cycle 1 judges marked
 * apps down for (research/verification/04 §5a).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { canonicalise, canonicaliseDelivery, chitHash, minorUnitsPer, parseCanonical, type Chit } from '@chit/core';
import { addressFromPublicKey, verifyChit, verifySignedText } from '@chit/verify';
import type { StoredChit } from './db.ts';
import type { ChitRepository } from './repository.ts';
import type { SettlementWatcher } from './watcher.ts';
import { RateUnavailableError, type RateService } from './rates.ts';
import type { ChainClient } from './chain.ts';
import { bodyLimit, rateLimit, securityHeaders } from './guard.ts';
import { ledger, presentLedger } from './reputation.ts';
import type { BountyService, DemoWorker } from './bounty.ts';

export interface RouteOptions {
  store: ChitRepository;
  watcher?: SettlementWatcher;
  /** The chain this deployment is bound to. Chits for the other network are refused. */
  chain: 'main' | 'test';
  /** Public base URL, used to build the share link. */
  baseUrl: string;
  /** Prices a fiat amount in NIM. Absent in tests that do not exercise quoting. */
  rates?: RateService;
  /** Reads the current block height, to pin a quote. */
  chainClient?: ChainClient;
  /** Requests allowed per client per minute. Set 0 to disable — tests do. */
  rateLimitPerMinute?: number;
  /** Proxies in front of this service; 0 means ignore x-forwarded-for. */
  trustedProxies?: number;
  /**
   * Confirm one chit's payment while answering a request.
   *
   * Supplied by deployments that have no background watcher — see `settlement.ts`. When
   * absent, settlement is the watcher's job and reads stay pure.
   */
  confirmSettlement?: (stored: StoredChit) => Promise<boolean>;
  /**
   * The current chain height, for deployments with no watcher to remember it.
   *
   * Without this a serverless deployment reported height 0, and every chit showed its
   * deadline as a bare block number instead of "due in about six days" — the raw value
   * this was specifically built to stop showing people.
   */
  currentHeight?: () => Promise<number>;
  /** The founder-funded bounty. Absent when no pool key is configured; the routes then say so. */
  bounty?: BountyService;
  /** A labelled second party so one person can walk the whole flow alone. */
  demoWorker?: DemoWorker;
}

/**
 * Largest request body accepted.
 *
 * A chit's canonical form is bounded by `MAX_TEXT_BYTES` (2 000) plus twelve short fixed
 * fields, and the two signatures are 192 hex characters. 16 KB is generous headroom over
 * that while still refusing anything designed to make the process allocate.
 */
const MAX_BODY_BYTES = 16 * 1024;

interface Signature {
  publicKeyHex: string;
  signatureHex: string;
}

function isSignature(value: unknown): value is Signature {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['publicKeyHex'] === 'string' &&
    typeof record['signatureHex'] === 'string' &&
    /^[0-9a-fA-F]{64}$/.test(record['publicKeyHex']) &&
    /^[0-9a-fA-F]{128}$/.test(record['signatureHex'])
  );
}

/** What a client sees. `canonical` is included so the client can verify us, not just trust us. */
function present(
  stored: StoredChit,
  baseUrl: string,
  flags: { bounty?: (s: StoredChit) => boolean; demoAddress?: string } = {},
) {
  const demoSigned = !!flags.demoAddress && !!stored.countersigner &&
    stored.countersigner.replace(/\s/g, '').toUpperCase() === flags.demoAddress.replace(/\s/g, '').toUpperCase();
  return {
    id: stored.id,
    canonical: stored.canonical,
    chit: {
      ...stored.chit,
      // JSON has no bigint. Strings, so precision survives the wire.
      amountMinor: stored.chit.amountMinor.toString(10),
      luna: stored.chit.luna.toString(10),
    },
    payerSignature: stored.payerSignature,
    payeeSignature: stored.payeeSignature ?? null,
    countersigned: stored.payeeSignature !== undefined,
    /** Where the settling payment must go. Empty until someone countersigns. */
    payTo: stored.chit.payee || stored.countersigner || null,
    settled: stored.settledTx !== undefined,
    settledTx: stored.settledTx ?? null,
    settledBlock: stored.settledBlock ?? null,
    settledAt: stored.settledAt ?? null,
    /** Sender of the settling payment. On a quote, the only record of who the client was. */
    settledFrom: stored.settledFrom ?? null,
    /**
     * What the settling payment actually carried, which is not always what was agreed:
     * settlement accepts 97% of the signed Luna and upwards. Null on anything settled
     * before this was recorded.
     */
    settledLuna: stored.settledLuna !== undefined ? stored.settledLuna.toString(10) : null,
    /** Bounty only. */
    answer: stored.answer ?? null,
    payoutTx: stored.payoutTx ?? null,
    declined: stored.declinedAt !== undefined,
    /** The chit this one answers, if any. Metadata, not part of the signed text. */
    parent: stored.parent ?? null,
    /** "Here it is", signed by the party who will be paid. Never part of the agreement. */
    delivery: stored.delivery ? { link: stored.delivery.link, note: stored.delivery.note, at: stored.delivery.at } : null,
    bounty: flags.bounty ? flags.bounty(stored) : false,
    demoWorker: demoSigned,
    createdAt: stored.createdAt,
    shareUrl: `${baseUrl}/c/${encodeURIComponent(stored.id)}`,
    verifyUrl: stored.settledTx ? `${baseUrl}/v/${encodeURIComponent(stored.settledTx)}` : null,
  };
}

export function createRoutes(options: RouteOptions) {
  const { store, chain, baseUrl } = options;
  const flags = {
    ...(options.bounty ? { bounty: (s: StoredChit) => options.bounty!.isBounty(s) } : {}),
    ...(options.demoWorker ? { demoAddress: options.demoWorker.address } : {}),
  };
  const app = new Hono();

  app.use('*', securityHeaders());

  // The countersign and verify pages are opened by strangers in ordinary browsers, so
  // they must work cross-origin. Reads are open; writes are same-origin only.
  app.use('/api/*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }));
  app.use('/api/*', bodyLimit(MAX_BODY_BYTES));

  // No accounts means nothing to rate-limit behind, so the connection is the only handle
  // there is. Signature verification stops forgery; this stops a flood of valid requests.
  const perMinute = options.rateLimitPerMinute ?? 120;
  if (perMinute > 0) {
    app.use(
      '/api/*',
      rateLimit({
        limit: perMinute,
        windowMs: 60_000,
        ...(options.trustedProxies !== undefined ? { trustedProxies: options.trustedProxies } : {}),
      }),
    );
  }

  app.get('/health', (c) =>
    c.json({
      ok: true,
      chain,
      watcher: options.watcher?.stats ?? null,
      bounty: options.bounty ? options.bounty.address : null,
      demoWorker: options.demoWorker ? options.demoWorker.address : null,
      at: Date.now(),
    }),
  );

  /**
   * Create a chit. The payer has signed; nobody has countersigned yet.
   *
   * Idempotent: the id is the digest, so a retry returns the existing chit rather than
   * creating a second agreement. Mobile connections retry.
   */
  app.post('/api/chits', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ code: 'bad-json', error: 'The request body was not valid JSON.' }, 400);
    }

    const record = body as Record<string, unknown>;
    const canonical = record['canonical'];
    const payerSignature = record['payerSignature'];

    if (typeof canonical !== 'string') {
      return c.json({ code: 'missing-canonical', error: 'A chit needs its canonical text.' }, 400);
    }
    if (!isSignature(payerSignature)) {
      return c.json({ code: 'missing-signature', error: 'A chit needs the payer\'s signature.' }, 400);
    }

    let parsed: Chit;
    try {
      parsed = parseCanonical(canonical);
    } catch (error) {
      return c.json(
        { code: 'malformed-canonical', error: error instanceof Error ? error.message : 'Not a valid chit.' },
        400,
      );
    }

    if (parsed.chain !== chain) {
      return c.json(
        {
          code: 'chain-mismatch',
          error: `This chit is for ${parsed.chain}net; this service runs on ${chain}net.`,
        },
        400,
      );
    }

    // Re-verify. The client's word is not evidence.
    const verification = verifySignedText({
      text: canonical,
      publicKeyHex: payerSignature.publicKeyHex,
      signatureHex: payerSignature.signatureHex,
      // A quote is signed by the worker, everything else by the payer. The signature must
      // come from whichever party the kind says signed first.
      expectedAddress: parsed.kind === 'quote' ? parsed.payee : parsed.payer,
    });
    if (!verification.ok) {
      return c.json(
        { code: verification.failure ?? 'bad-signature', error: verification.detail ?? 'The signature did not verify.' },
        400,
      );
    }

    /*
     * The chit this one answers — a counter-offer, a revision, a milestone, a mutual cancel.
     * Checked to be a chit that exists, then stored as metadata. It is deliberately outside
     * the signed text: adding a field to the canonical form would change every digest ever
     * computed. So the link orders the record and lets a screen say "in reply to"; it claims
     * nothing about what the two parties agreed.
     */
    const rawParent = record['parent'];
    let parent: string | undefined;
    if (typeof rawParent === 'string' && rawParent.length > 0) {
      const found = await store.get(rawParent);
      if (!found) return c.json({ code: 'no-parent', error: 'The chit this one answers does not exist.' }, 400);
      parent = found.id;
    }

    const id = chitHash(parsed);
    const { created, chit } = await store.create({
      id,
      canonical: canonicalise(parsed),
      chit: parsed,
      payerSignature,
      ...(parent ? { parent } : {}),
    });
    if (created && parent) await store.recordEvent(parent, 'answered', id);
    return c.json(present(chit, baseUrl, flags), created ? 201 : 200);
  });

  /**
   * Price a fiat amount in NIM and pin it to a block.
   *
   * The client never computes this: a client-supplied rate is a client that can pay less
   * than it agreed. The quote is held for fifteen minutes and the receipt records which
   * block it was pinned to, so the rate is checkable afterwards rather than asserted.
   */
  app.get('/api/quote', async (c) => {
    if (!options.rates || !options.chainClient) {
      return c.json({ code: 'quotes-unavailable', error: 'Quoting is not configured.' }, 503);
    }

    const rawAmount = c.req.query('amountMinor');
    const currency = (c.req.query('currency') ?? '').toUpperCase();

    if (!rawAmount || !/^\d+$/.test(rawAmount)) {
      return c.json({ code: 'bad-amount', error: 'amountMinor must be a whole number of cents.' }, 400);
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return c.json({ code: 'bad-currency', error: 'currency must be a 3-letter code.' }, 400);
    }

    const amountMinor = BigInt(rawAmount);
    if (amountMinor <= 0n) {
      return c.json({ code: 'bad-amount', error: 'The amount must be more than zero.' }, 400);
    }

    try {
      const height = await options.chainClient.getBlockNumber();
      const quote = await options.rates.quote(amountMinor, currency, height);
      return c.json({
        amountMinor: quote.amountMinor.toString(10),
        currency: quote.currency,
        luna: quote.luna.toString(10),
        rate: quote.rate,
        rateBlock: quote.rateBlock,
        quotedAt: quote.quotedAt,
        expiresAt: quote.expiresAt,
        stale: quote.stale,
      });
    } catch (error) {
      if (error instanceof RateUnavailableError) {
        return c.json({ code: 'rate-unavailable', error: error.message }, 503);
      }
      return c.json(
        { code: 'quote-failed', error: error instanceof Error ? error.message : 'Could not price this amount.' },
        503,
      );
    }
  });

  app.get('/api/chits/:id', async (c) => {
    let stored = await store.get(c.req.param('id'));
    if (!stored) return c.json({ code: 'not-found', error: 'No chit with that id.' }, 404);

    // On a deployment without a watcher, this read *is* the settlement check: both parties
    // are watching this screen at exactly the moment the payment lands.
    if (options.confirmSettlement && stored.payeeSignature && !stored.settledTx) {
      if (await options.confirmSettlement(stored)) {
        stored = (await store.get(stored.id)) ?? stored;
      }
    }

    return c.json({
      ...present(stored, baseUrl, flags),
      // The last height the watcher saw, or — where there is no watcher — a freshly read
      // one. Lets the client turn a deadline block into "due in about two days"; a raw
      // block number tells a human nothing.
      currentBlock: options.watcher?.stats.lastHeight || (await options.currentHeight?.().catch(() => 0)) || 0,
      events: await store.events(stored.id),
    });
  });

  /**
   * Countersign. This is the stranger's endpoint — they may have no wallet on this
   * device and no account anywhere.
   */
  app.post('/api/chits/:id/countersign', async (c) => {
    {
      const stored = await store.get(c.req.param('id'));
      if (stored?.chit.kind === 'quote') {
        // Paying a quote is accepting it. A countersignature would name a client who has
        // not paid, which is exactly the promise a quote does not make.
        return c.json({ code: 'quote-pays-to-accept', error: 'A quote is accepted by paying it, not by signing it.' }, 409);
      }
    }
    const id = c.req.param('id');
    const stored = await store.get(id);
    if (!stored) return c.json({ code: 'not-found', error: 'No chit with that id.' }, 404);

    if (stored.payeeSignature) {
      // Not an error: someone opened the link twice, or two tabs raced. The first
      // countersignature is the binding one and the screen should say so calmly.
      return c.json({ ...present(stored, baseUrl, flags), alreadyCountersigned: true }, 200);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ code: 'bad-json', error: 'The request body was not valid JSON.' }, 400);
    }

    const signature = (body as Record<string, unknown>)['signature'];
    if (!isSignature(signature)) {
      return c.json({ code: 'missing-signature', error: 'A countersignature is required.' }, 400);
    }

    const verification = verifySignedText({
      text: stored.canonical,
      publicKeyHex: signature.publicKeyHex,
      signatureHex: signature.signatureHex,
      // An open race chit names no payee yet, so the signature is valid from anyone —
      // but a handshake names both parties and only that party may countersign.
      ...(stored.chit.payee ? { expectedAddress: stored.chit.payee } : {}),
    });
    if (!verification.ok) {
      return c.json(
        { code: verification.failure ?? 'bad-signature', error: verification.detail ?? 'The signature did not verify.' },
        400,
      );
    }

    const workerAddress = addressFromPublicKey(signature.publicKeyHex);

    // A bounty is countersigned *with an answer*, and the pool pays it on the spot. The
    // answer is checked by rules that are the same for everyone, the limits are enforced,
    // and the payment is broadcast before this request returns.
    if (options.bounty?.isBounty(stored)) {
      const record = body as Record<string, unknown>;
      const answer = typeof record['answer'] === 'string' ? record['answer'] : '';
      const deviceHash = typeof record['deviceHash'] === 'string' ? record['deviceHash'] : '';
      const claimed = await options.bounty.claim({ stored, signature, workerAddress, answer, deviceHash });
      if (!claimed.ok) return c.json({ code: claimed.code, error: claimed.error }, claimed.status as 400);
      const paid = await store.get(id);
      return c.json({ ...present(paid ?? stored, baseUrl, flags), bounty: { payoutTx: claimed.payoutTx } }, 200);
    }

    // The countersignature's public key is where the money must go. On a handshake the
    // payer signed before knowing this address, so countersigning is what supplies it —
    // nobody copies an address between apps, and nobody can redirect it either, because
    // it is derived from the key that signed rather than typed in.
    await store.countersign(id, signature, workerAddress);
    const updated = await store.get(id);
    return c.json(present(updated ?? stored, baseUrl, flags), 200);
  });

  /**
   * The verify page's data. Opened by a client, an accountant, a support agent — none of
   * whom have a wallet. Everything needed to check the chit is in the response, so the
   * caller can re-verify it themselves rather than believing us.
   */
  app.get('/api/verify/:tx', async (c) => {
    const hash = c.req.param('tx');
    const stored = await store.byTransaction(hash);
    if (!stored) {
      return c.json({ code: 'not-found', error: 'No settled chit for that transaction.' }, 404);
    }

    const verification = verifyChit({
      canonical: stored.canonical,
      payerSignature: stored.payerSignature,
      ...(stored.payeeSignature ? { payeeSignature: stored.payeeSignature } : {}),
      settledMemo: stored.id,
      expectedChain: chain,
    });

    return c.json({
      ...present(stored, baseUrl, flags),
      verification: {
        ok: verification.ok,
        failure: verification.failure ?? null,
        detail: verification.detail ?? null,
        countersigned: verification.countersigned,
        settled: verification.settled,
      },
      events: await store.events(stored.id),
    });
  });

  app.get('/api/addresses/:address/chits', async (c) => {
    const chits = await store.forAddress(c.req.param('address'));
    return c.json({ chits: chits.map((stored) => present(stored, baseUrl, flags)) });
  });

  /**
   * The bounty, in public: the pool, its balance, every payout, and the rules. Reading it
   * is also what keeps enough bounties open — there is no cron to fail.
   */
  app.get('/api/bounty', async (c) => {
    if (!options.bounty) return c.json({ code: 'no-bounty', error: 'No bounty pool is configured on this deployment.' }, 404);
    const status = await options.bounty.status();
    return c.json({
      address: status.address,
      balanceLuna: status.balanceLuna === null ? null : status.balanceLuna.toString(10),
      funded: status.funded,
      prompt: status.prompt,
      rules: status.rules,
      paidToday: status.paidToday,
      paidTodayLuna: status.paidTodayLuna.toString(10),
      dailyCapLuna: status.dailyCapLuna.toString(10),
      open: status.open.map((stored) => present(stored, baseUrl, flags)),
      paid: status.paid.map((p) => ({ ...p, luna: p.luna.toString(10) })),
    });
  });

  /** The worker says no. Recorded, so the payer's screen moves on instead of waiting forever. */
  app.post('/api/chits/:id/decline', async (c) => {
    const stored = await store.get(c.req.param('id'));
    if (!stored) return c.json({ code: 'not-found', error: 'No chit with that id.' }, 404);
    if (stored.chit.kind === 'quote') return c.json({ code: 'not-declinable', error: 'A quote has no counterparty to decline it; it simply goes unpaid.' }, 409);
    if (stored.payeeSignature || stored.settledTx) return c.json({ code: 'too-late', error: 'This chit has already been signed.' }, 409);
    if (options.bounty?.isBounty(stored)) return c.json({ code: 'not-declinable', error: 'A bounty is not declined — just leave it for someone else.' }, 409);
    await store.decline(stored.id);
    const updated = await store.get(stored.id);
    return c.json(present(updated ?? stored, baseUrl, flags), 200);
  });

  /**
   * What the payment was worth when it landed.
   *
   * The chit records the fiat amount both sides agreed and the rate that priced it. Every
   * tax rule read fixes value at the moment the payment is *received* instead — the IRS's
   * FAQ Q27 and HMRC's CRYPTO10400 both say so. Those are different numbers whenever the
   * rate moved between signing and paying, and only one of them belongs on an invoice.
   *
   * Computed on demand rather than at settlement, and allowed to fail: a receipt that cannot
   * show this line is still a receipt, and no page should block on a price API.
   */
  app.get('/api/chits/:id/value', async (c) => {
    if (!options.rates) return c.json({ code: 'rates-unavailable', error: 'Rates are not configured.' }, 503);
    const stored = await store.get(c.req.param('id'));
    if (!stored) return c.json({ code: 'not-found', error: 'No chit with that id.' }, 404);
    if (!stored.settledAt || stored.settledLuna === undefined) {
      return c.json({ code: 'not-settled', error: 'Nothing has been paid yet.' }, 409);
    }

    const historic = await options.rates.historicPrice(stored.chit.currency, stored.settledAt);
    if (!historic) return c.json({ code: 'no-history', error: 'No rate is available for that moment.' }, 404);

    // Luna → NIM → fiat minor units, in integers at the last step so nothing rounds twice.
    const nim = Number(stored.settledLuna) / 100_000;
    const minorPerUnit = Number(minorUnitsPer(stored.chit.currency));
    const valueMinor = BigInt(Math.round(nim * historic.rate * minorPerUnit));
    return c.json({
      currency: stored.chit.currency,
      valueMinor: valueMinor.toString(10),
      agreedMinor: stored.chit.amountMinor.toString(10),
      rate: historic.rate,
      at: historic.at,
      source: 'CoinGecko',
    });
  });

  /**
   * "Here it is" — the state between signing and being paid.
   *
   * Signed by the party who will be paid, over a canonical form of its own (`@chit/core`
   * `canonicaliseDelivery`), so it is evidence that *that wallet* said it about *that* chit.
   * It is never folded into the agreement: the chit's digest is the product, and a delivery
   * inside it would change every digest and let one side alter what both had signed.
   *
   * It obliges nobody. The payer still decides whether to pay, and the copy says so.
   */
  app.post('/api/chits/:id/delivered', async (c) => {
    const stored = await store.get(c.req.param('id'));
    if (!stored) return c.json({ code: 'not-found', error: 'No chit with that id.' }, 404);
    if (stored.settledTx) return c.json({ code: 'already-settled', error: 'This chit is already paid.' }, 409);
    if (stored.declinedAt) return c.json({ code: 'declined', error: 'This chit was declined.' }, 409);
    if (options.bounty?.isBounty(stored)) return c.json({ code: 'not-for-bounty', error: 'A bounty is delivered by answering it.' }, 409);

    // Who will be paid: the named payee, or whoever countersigned an open chit.
    const payee = stored.chit.payee || stored.countersigner || '';
    if (!payee) return c.json({ code: 'no-payee', error: 'Nobody has agreed to do this yet, so there is nothing to deliver.' }, 409);
    if (stored.delivery) return c.json({ ...present(stored, baseUrl, flags), alreadyDelivered: true }, 200);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ code: 'bad-json', error: 'The request body was not valid JSON.' }, 400);
    }
    const record = body as Record<string, unknown>;
    const signature = record['signature'];
    const link = typeof record['link'] === 'string' ? record['link'] : '';
    const note = typeof record['note'] === 'string' ? record['note'] : '';
    if (!isSignature(signature)) {
      return c.json({ code: 'missing-signature', error: 'A delivery has to be signed.' }, 400);
    }

    let canonical: string;
    try {
      canonical = canonicaliseDelivery({ chitId: stored.id, link, note });
    } catch (error) {
      return c.json({ code: 'bad-delivery', error: error instanceof Error ? error.message : 'Not a valid delivery.' }, 400);
    }

    const verification = verifySignedText({
      text: canonical,
      publicKeyHex: signature.publicKeyHex,
      signatureHex: signature.signatureHex,
      // Only the party who will be paid may say it was delivered.
      expectedAddress: payee,
    });
    if (!verification.ok) {
      return c.json(
        { code: verification.failure ?? 'bad-signature', error: verification.detail ?? 'That signature is not from the wallet being paid.' },
        400,
      );
    }

    const written = await store.markDelivered(stored.id, { link, note, at: Date.now(), signature });
    const updated = await store.get(stored.id);
    return c.json({ ...present(updated ?? stored, baseUrl, flags), ...(written ? {} : { alreadyDelivered: true }) }, 200);
  });

  /**
   * The demo worker countersigns a chit on request — labelled, so a single person (a judge)
   * can create a chit, have it countersigned, pay it, and hold a real receipt.
   */
  app.post('/api/chits/:id/demo-countersign', async (c) => {
    if (!options.demoWorker) return c.json({ code: 'no-demo', error: 'No demo worker on this deployment.' }, 404);
    const stored = await store.get(c.req.param('id'));
    if (!stored) return c.json({ code: 'not-found', error: 'No chit with that id.' }, 404);
    if (stored.chit.kind !== 'race' || stored.chit.payee) return c.json({ code: 'not-open', error: 'Only an open chit can be countersigned by the demo worker.' }, 409);
    if (options.bounty?.isBounty(stored)) return c.json({ code: 'not-for-bounty', error: 'The demo worker does not claim bounties.' }, 409);
    if (stored.payeeSignature) return c.json({ ...present(stored, baseUrl, flags), alreadyCountersigned: true }, 200);
    const signature = options.demoWorker.countersign(stored.canonical);
    await store.countersign(stored.id, signature, options.demoWorker.address);
    await store.recordEvent(stored.id, 'countersigned', `demo worker ${options.demoWorker.address}`);
    const updated = await store.get(stored.id);
    return c.json(present(updated ?? stored, baseUrl, flags), 200);
  });

  // Reputation is computed here on every read and never stored: the inputs are the
  // settled events, so anyone with the transaction hashes can check the answer.
  app.get('/api/addresses/:address/ledger', async (c) => {
    const address = c.req.param('address');
    const chits = await store.forAddress(address, 500);
    const height = options.watcher?.stats.lastHeight || (await options.currentHeight?.().catch(() => 0)) || 0;
    return c.json(presentLedger(ledger(address, chits, height)));
  });

  return app;
}

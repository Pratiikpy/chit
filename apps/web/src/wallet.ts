/**
 * Getting a wallet, in whichever of the three places the user opened this — without ever
 * asking for anything before the user does.
 *
 * Two rules from the audit of the official mini-app checklist shape this file:
 *
 * 1. **No approval dialog on page load.** Detecting the provider is silent; asking it for an
 *    address (`listAccounts`) is a dialog, so it happens only when the user taps Sign or Pay.
 *    The previous version asked on load, which meant a stranger opening a shared link was
 *    interrogated by their wallet before they had read a word.
 * 2. **A decline is not the end.** Declining the dialog used to be cached as "unavailable"
 *    and the button went dead for the rest of the visit. Now a decline forgets the session
 *    and the next tap simply asks again.
 *
 * Detection goes through the SDK's own `init()` rather than a hand-rolled poll, so any
 * host-side fix Nimiq ships in the SDK is inherited. `init()` is only awaited when there is
 * a host to wait for: `window.nimiqPay` is seeded synchronously before the page script runs,
 * so its absence proves this is an ordinary browser and there is nothing to wait for.
 */

import { init, requestDeviceIdentifier } from '@nimiq/mini-app-sdk';
import { t } from './i18n.ts';
import {
  MockWallet,
  NimiqPayWallet,
  SignatureDeclinedError,
  SignatureShapeError,
  WalletOperationError,
  type ChitWallet,
  type NormalisedSignature,
  type PaymentRequest,
  type PaymentResult,
} from '@chit/core';

export { SignatureDeclinedError, SignatureShapeError, WalletOperationError };
export type { ChitWallet };

/** The SDK's own default. Inside Nimiq Pay the provider is normally present on the first tick. */
const INSIDE_PAY_TIMEOUT_MS = 10_000;

/** The address of the last successful connection, so a return visit knows who it is without a dialog. */
const ADDRESS_KEY = 'chit.address';

export type WalletTier = 'nimiq-pay' | 'demo' | 'none';

export interface WalletDetection {
  tier: WalletTier;
  /** For `none`: the one sentence to show a person. */
  reason?: string;
}

export interface WalletSession {
  tier: 'nimiq-pay' | 'demo';
  wallet: ChitWallet;
  address: string;
}

/** Thrown by `connectWallet` when there is no wallet to connect to. Not a decline. */
export class WalletUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'WalletUnavailableError';
  }
}

/** A provider call that never answered. The wallet may have been backgrounded mid-dialog. */
export class WalletTimeoutError extends Error {
  /**
   * `what` is the step, in the app's own language: "Signing", "Paying". The whole sentence is
   * built here rather than at the point of failure so a German user is never handed half an
   * English message, which is what happened while the copy lived in the call sites.
   */
  constructor(what: string) {
    super(t('{step} — Nimiq Pay did not answer. Open the wallet and try again.', { step: what }));
    this.name = 'WalletTimeoutError';
  }
}

export function insideNimiqPay(): boolean {
  return typeof window !== 'undefined' && (window as { nimiqPay?: unknown }).nimiqPay !== undefined;
}

/** True when the URL asks for demo mode — the pattern Cinima ships for desktop judges. */
export function demoRequested(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('demo') === '1' || import.meta.env.DEV;
}

type Provider = ConstructorParameters<typeof NimiqPayWallet>[0];

/** `undefined` = not detected yet · `null` = detected absent. */
let provider: Provider | null | undefined;
let session: WalletSession | undefined;

/**
 * Find out which tier we are in. Silent: nothing here can open a dialog.
 */
export async function detectWallet(): Promise<WalletDetection> {
  if (provider === undefined) {
    const scope = window as unknown as { nimiq?: Provider };
    if (scope.nimiq) {
      provider = scope.nimiq;
    } else if (!insideNimiqPay()) {
      provider = null;
    } else {
      try {
        provider = (await init({ timeout: INSIDE_PAY_TIMEOUT_MS })) as unknown as Provider;
      } catch {
        provider = null;
      }
    }
  }

  if (provider) return { tier: 'nimiq-pay' };
  if (demoRequested()) return { tier: 'demo' };
  return { tier: 'none', reason: 'Open this in Nimiq Pay to sign and pay.' };
}

/**
 * Who this device connected as last time, if anyone. Never a dialog.
 *
 * Kept in localStorage, not the session: three screens promise "it is in your Activity",
 * and a promise that expires when the WebView is closed is a broken one. An address is
 * public information; nothing here can sign or spend.
 */
export function rememberedAddress(): string | null {
  try {
    return localStorage.getItem(ADDRESS_KEY) ?? sessionStorage.getItem(ADDRESS_KEY);
  } catch {
    return null;
  }
}

/**
 * Connect — the one call that may open a wallet dialog. Call it from a tap.
 *
 * Throws `SignatureDeclinedError` when the user says no (the caller should stay calm and
 * leave the button enabled), `WalletUnavailableError` when there is no wallet at all.
 */
export async function connectWallet(): Promise<WalletSession> {
  if (session) return session;

  const detection = await detectWallet();
  if (detection.tier === 'nimiq-pay' && provider) {
    const wallet = new GuardedWallet(new NimiqPayWallet(provider));
    const address = await wallet.getAddress();
    session = { tier: 'nimiq-pay', wallet, address };
  } else if (detection.tier === 'demo') {
    const wallet = new MockWallet();
    session = { tier: 'demo', wallet, address: await wallet.getAddress() };
  } else {
    throw new WalletUnavailableError(detection.reason ?? 'No wallet.');
  }

  try {
    localStorage.setItem(ADDRESS_KEY, session.address);
  } catch {
    /* storage blocked — the next visit will simply ask again */
  }
  return session;
}

/**
 * The per-device identifier, for the bounty's one-per-device-per-day rule.
 *
 * Inside Nimiq Pay this is the SDK's `requestDeviceIdentifier`: a 64-hex SHA-256 scoped to
 * this origin, stable across reinstalls, prompting the user once with `reason`. Outside
 * Nimiq Pay there is no such thing; the demo tier gets a fixed placeholder so the flow can
 * be walked, and the server treats it as one device.
 */
export async function requestDeviceHash(reason: string): Promise<string> {
  if (insideNimiqPay()) {
    const id = await withTimeout(requestDeviceIdentifier({ reason }), 60_000, 'Identifying this device');
    return id.toLowerCase();
  }
  return 'd'.repeat(64);
}

/** Drop the session — after a decline, so the next tap asks again. */
export function forgetWallet(): void {
  session = undefined;
}

/**
 * Does the wallet live on the same network as the service?
 *
 * Nimiq's `sign()` has no domain separation, so a testnet wallet can produce a signature
 * the mainnet service accepts and then never be able to pay. Nothing on the server can see
 * the wallet's network; only the provider's own view of the chain can. The heights differ
 * by more than an order of magnitude, which is the whole test.
 *
 * `unknown` when the provider offers no height — it is never reported as a mismatch.
 */
export async function checkNetwork(serverChain: 'main' | 'test'): Promise<'match' | 'mismatch' | 'unknown'> {
  const p = provider as { getBlockNumber?: () => Promise<unknown> } | null | undefined;
  if (!p || typeof p.getBlockNumber !== 'function') return 'unknown';
  try {
    const raw = await withTimeout(p.getBlockNumber(), 5_000, 'Reading the chain height');
    const height = typeof raw === 'number' ? raw : Number((raw as { data?: unknown })?.data ?? raw);
    if (!Number.isFinite(height) || height <= 0) return 'unknown';
    // Mainnet passed 60 000 000 in 2026; testnet is in the single-digit millions.
    const looksMain = height > 20_000_000;
    return (serverChain === 'main') === looksMain ? 'match' : 'mismatch';
  } catch {
    return 'unknown';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new WalletTimeoutError(what)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Every provider call bounded in time.
 *
 * A wallet dialog can be abandoned — the phone locks, the app is backgrounded — and the
 * promise then never settles. Without a bound the button would read "Waiting for your
 * wallet…" forever. The bounds are generous: a person reading a dialog is not slow.
 */
class GuardedWallet implements ChitWallet {
  readonly #inner: ChitWallet;
  readonly tier: ChitWallet['tier'];

  constructor(inner: ChitWallet) {
    this.#inner = inner;
    this.tier = inner.tier;
  }

  getBlockNumber(): Promise<number> {
    return withTimeout(this.#inner.getBlockNumber(), 10_000, t('Reading the chain height'));
  }

  isConsensusEstablished(): Promise<boolean> {
    return withTimeout(this.#inner.isConsensusEstablished(), 10_000, t('Checking sync'));
  }

  getAddress(): Promise<string> {
    return withTimeout(this.#inner.getAddress(), 60_000, t('Sharing your address'));
  }

  signText(text: string): Promise<NormalisedSignature> {
    return withTimeout(this.#inner.signText(text), 120_000, t('Signing'));
  }

  pay(request: PaymentRequest): Promise<PaymentResult> {
    return withTimeout(this.#inner.pay(request), 180_000, t('Paying'));
  }
}

/*
 * The failures a wallet actually reports, and what to say instead.
 *
 * A provider's own text is written for whoever wrote the provider: "user rejected the
 * request", "insufficient funds for gas", "Failed to fetch". Shown as-is it tells a person
 * nothing they can act on, is always in English however the app is set, and — worst — reads
 * as though chit broke when in most cases nothing is wrong at all.
 *
 * So each known shape is matched on the wire text and answered with a sentence that says
 * what happened and what to do next. Anything unrecognised still falls through to the raw
 * message: a wrong guess about an error is worse than an honest quotation of one.
 */
const WALLET_FAILURES: Array<{ match: RegExp; message: string; tone: 'calm' | 'bad' }> = [
  {
    // Every provider spells a decline differently, and none of them is an error.
    match: /reject|denied|declin|cancel|abort/i,
    message: 'You cancelled. Nothing was sent.',
    tone: 'calm',
  },
  {
    match: /insufficient|not enough|balance too low/i,
    message: 'Your wallet does not hold enough NIM for this. Top it up and try again — nothing was sent.',
    tone: 'calm',
  },
  {
    match: /failed to fetch|network|offline|econn|timed? ?out|timeout/i,
    message: 'Your phone could not reach the network. Nothing was sent — check your connection and try again.',
    tone: 'calm',
  },
  {
    match: /consensus|not synced|syncing/i,
    message: 'Nimiq Pay is still catching up with the chain. Give it a few seconds and try again.',
    tone: 'calm',
  },
  {
    match: /locked|unlock|password/i,
    message: 'Your wallet is locked. Unlock Nimiq Pay and try again.',
    tone: 'calm',
  },
];

/**
 * Turn any wallet failure into a sentence for a person.
 *
 * A decline is deliberately *not* an error: the user chose it, the screen stays usable,
 * and nothing is red (DESIGN.md §8).
 */
export function explain(error: unknown): { message: string; tone: 'calm' | 'bad' } {
  if (error instanceof SignatureDeclinedError) {
    return { message: t('You cancelled. Nothing was sent.'), tone: 'calm' };
  }
  if (error instanceof WalletUnavailableError) {
    return { message: error.message, tone: 'calm' };
  }
  if (error instanceof WalletTimeoutError) {
    return { message: error.message, tone: 'calm' };
  }
  if (error instanceof SignatureShapeError) {
    return {
      message: t('Your wallet returned a signature chit could not read. Please report this — it is our bug, not yours.'),
      tone: 'bad',
    };
  }
  if (error instanceof Error) {
    const known = WALLET_FAILURES.find((f) => f.match.test(error.message));
    if (known) return { message: t(known.message), tone: known.tone };
    // Unrecognised. Quote it rather than invent a friendlier meaning for it, and say whose
    // words they are so nobody reads a provider's jargon as chit's own explanation.
    return { message: t('Your wallet reported: {message}', { message: error.message }), tone: 'bad' };
  }
  return { message: t('Something went wrong. Nothing was signed and nothing was sent.'), tone: 'bad' };
}

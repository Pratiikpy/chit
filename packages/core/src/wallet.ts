/**
 * The wallet chit talks to, and the three places it can come from.
 *
 * Reef — the deepest Nimiq integration in the ecosystem, by a Nimiq core contributor —
 * resolves its signing provider "best first: Nimiq Pay when the Mini App host injected
 * `window.nimiq`; the Nimiq Wallet Hub in an ordinary browser; the dev mock, and only in
 * development" (research/verification/04b). chit does the same, for three reasons:
 *
 * 1. **A Council member may open the link on a laptop.** Judging happens at random after
 *    18 Sep (SIP_AND_SHIP_C2_CALL2_FINDINGS.md §1). An app that shows "please open me in
 *    Nimiq Pay" to a desktop browser has thrown away its first impression.
 * 2. **The whole flow must be runnable in tests** with no phone attached, or we cannot
 *    have the "no half-baked" confidence the build depends on.
 * 3. **It isolates the resolved-union problem.** `listAccounts` and `sign` resolve with an
 *    error object instead of rejecting (NimiqProvider.ts:89-109). That is handled once,
 *    here, rather than at forty call sites.
 *
 * This file deliberately does NOT expose the staking methods. They exist on the provider,
 * but Reef already owns that lane and they are not chit's story (PRODUCT_SPEC.md §10).
 */

import {
  SignatureDeclinedError,
  SignatureShapeError,
  normaliseSignature,
  type NormalisedSignature,
} from './signature.ts';

/** 1 NIM = 100 000 Luna. Verified in core-rs-albatross `coin.rs:26`. */
export const LUNA_PER_NIM = 100_000n;

/** Which implementation answered. Shown in the UI so the user knows where they are. */
export type WalletTier = 'nimiq-pay' | 'hub' | 'mock';

export interface PaymentRequest {
  recipient: string;
  /** Amount in Luna. bigint at the boundary; converted once, with a bound check. */
  luna: bigint;
  /** The chit memo. Must already be within Nimiq's 64-byte data field. */
  data: string;
  /** Optional; Nimiq Pay chooses a fee automatically, "using 0 if possible". */
  validityStartHeight?: number;
}

export interface PaymentResult {
  /**
   * What the provider returned for the send call.
   *
   * ⚠️ The SDK documents this as "the serialized transaction", not a hash
   * (NimiqProvider.ts:136-140). Whether Nimiq Pay returns a hash, a serialized
   * transaction, or something else is **NOT VERIFIED** — it needs one send on a real
   * device. chit therefore never treats this as an identifier: settlement is confirmed by
   * the chain watcher matching the memo, which works regardless of what this string is.
   */
  raw: string;
}

/** Everything chit needs from a wallet. Deliberately small. */
export interface ChitWallet {
  readonly tier: WalletTier;
  /** The connected address, user-friendly form. */
  getAddress(): Promise<string>;
  /** Sign UTF-8 text, normalised to hex regardless of how the host framed it. */
  signText(text: string): Promise<NormalisedSignature>;
  /** Current block height — used for rate locks and deadlines. */
  getBlockNumber(): Promise<number>;
  /** Honest sync state. Never blocks the UI on it; it is a known-unstable signal. */
  isConsensusEstablished(): Promise<boolean>;
  /** Send a payment carrying the chit memo. */
  pay(request: PaymentRequest): Promise<PaymentResult>;
}

/** The wallet is unavailable or the user is not in a wallet context. */
export class WalletUnavailableError extends Error {
  override readonly name = 'WalletUnavailableError';
}

/** The wallet refused an operation for a stated reason (not a decline). */
export class WalletOperationError extends Error {
  override readonly name = 'WalletOperationError';
  readonly type: string;
  constructor(type: string, message: string) {
    super(message);
    this.type = type;
  }
}

export { SignatureDeclinedError, SignatureShapeError };

/**
 * Unwrap a `T | ErrorResponse`.
 *
 * The provider resolves with `{ error: { type, message } }` rather than rejecting, so a
 * caller that only uses try/catch silently treats an error object as a success value —
 * which would mean signing an agreement against the string "[object Object]".
 */
export function unwrap<T>(value: T | { error: { type: string; message: string } }, operation: string): T {
  if (typeof value === 'object' && value !== null && 'error' in value) {
    const { type, message } = (value as { error: { type?: string; message?: string } }).error ?? {};
    const description = [type, message].filter(Boolean).join(': ') || 'unknown error';
    if (/permission|denied|reject|cancel|abort/i.test(description)) {
      throw new SignatureDeclinedError(description);
    }
    throw new WalletOperationError(type ?? 'UnknownError', `${operation} failed: ${description}`);
  }
  return value as T;
}

/** Convert Luna to the `number` the provider expects, refusing anything unsafe. */
export function lunaToProviderValue(luna: bigint): number {
  if (luna <= 0n) {
    throw new WalletOperationError('InvalidAmount', `amount must be positive, got ${luna} Luna`);
  }
  if (luna > BigInt(Number.MAX_SAFE_INTEGER)) {
    // Unreachable for chit's $3–$500 range (~10^7–10^9 Luna) but asserted rather than
    // assumed, because a silent precision loss here is a wrong payment.
    throw new WalletOperationError('AmountTooLarge', `${luna} Luna exceeds safe integer precision`);
  }
  return Number(luna);
}

/** The subset of the injected provider chit uses. Structural, so no SDK import is needed. */
interface InjectedNimiqProvider {
  listAccounts(): Promise<unknown>;
  sign(message: string | { message: string; isHex?: boolean }): Promise<unknown>;
  getBlockNumber(): Promise<number>;
  isConsensusEstablished(): Promise<boolean>;
  sendBasicTransactionWithData(tx: {
    recipient: string;
    value: number;
    fee?: number;
    data: string;
    validityStartHeight?: number;
  }): Promise<unknown>;
}

/** Tier 1 — running inside Nimiq Pay, with `window.nimiq` injected. */
export class NimiqPayWallet implements ChitWallet {
  readonly tier = 'nimiq-pay' as const;
  readonly #provider: InjectedNimiqProvider;
  #address: string | undefined;

  constructor(provider: InjectedNimiqProvider) {
    this.#provider = provider;
  }

  async getAddress(): Promise<string> {
    if (this.#address) return this.#address;
    const accounts = unwrap<unknown>(await this.#provider.listAccounts(), 'listAccounts');
    if (!Array.isArray(accounts) || accounts.length === 0 || typeof accounts[0] !== 'string') {
      throw new WalletOperationError('NoAccounts', 'The wallet returned no accounts');
    }
    this.#address = accounts[0];
    return this.#address;
  }

  async signText(text: string): Promise<NormalisedSignature> {
    // `normaliseSignature` handles both the resolved-error union and every framing the
    // host might use, so nothing else in chit has to know about either problem.
    return normaliseSignature(await this.#provider.sign({ message: text }));
  }

  getBlockNumber(): Promise<number> {
    return this.#provider.getBlockNumber();
  }

  async isConsensusEstablished(): Promise<boolean> {
    try {
      return await this.#provider.isConsensusEstablished();
    } catch {
      // A known-unstable signal. Not knowing is not a failure — never block on it.
      return false;
    }
  }

  async pay(request: PaymentRequest): Promise<PaymentResult> {
    const raw = unwrap<unknown>(
      await this.#provider.sendBasicTransactionWithData({
        recipient: request.recipient,
        value: lunaToProviderValue(request.luna),
        data: request.data,
        // Fee is deliberately omitted: "Nimiq Pay chooses a fee automatically, using 0 if
        // possible" — stated eight times in the official API reference.
        ...(request.validityStartHeight !== undefined
          ? { validityStartHeight: request.validityStartHeight }
          : {}),
      }),
      'sendBasicTransactionWithData',
    );
    if (typeof raw !== 'string') {
      throw new WalletOperationError('UnexpectedResult', 'The wallet returned a non-string result for a payment');
    }
    return { raw };
  }
}

/** Options for resolving a wallet. */
export interface ResolveWalletOptions {
  /** How long to wait for `window.nimiq` to appear. The SDK's own default is 10s. */
  timeoutMs?: number;
  /** Supplied by the caller when a non-Pay tier is available. */
  fallback?: () => Promise<ChitWallet> | ChitWallet;
}

/**
 * Wait for Nimiq Pay to inject its provider.
 *
 * Mirrors the SDK's own `init()` — poll every 50 ms up to a timeout — rather than calling
 * it, so that core stays dependency-free and testable in Node.
 */
export function waitForInjectedProvider(
  timeoutMs = 10_000,
  scope: { nimiq?: unknown } = globalThis as { nimiq?: unknown },
): Promise<InjectedNimiqProvider> {
  if (scope.nimiq) return Promise.resolve(scope.nimiq as InjectedNimiqProvider);

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const interval = setInterval(() => {
      if (scope.nimiq) {
        clearInterval(interval);
        resolve(scope.nimiq as InjectedNimiqProvider);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(interval);
        reject(new WalletUnavailableError('Nimiq Pay did not inject a provider'));
      }
    }, 50);
  });
}

/**
 * Pick the best available wallet: Nimiq Pay, then whatever fallback the caller supplies.
 *
 * When `window.nimiq` is already present the promise resolves immediately, so a Mini App
 * inside Nimiq Pay never waits. Only a plain browser pays the timeout.
 */
export async function resolveWallet(options: ResolveWalletOptions = {}): Promise<ChitWallet> {
  const scope = globalThis as { nimiq?: unknown };

  if (scope.nimiq) {
    return new NimiqPayWallet(scope.nimiq as InjectedNimiqProvider);
  }

  if (options.fallback) {
    return await options.fallback();
  }

  // No injected provider and no fallback: wait, in case the host is still booting.
  return new NimiqPayWallet(await waitForInjectedProvider(options.timeoutMs));
}

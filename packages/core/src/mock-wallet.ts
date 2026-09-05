/**
 * A deterministic in-memory wallet.
 *
 * Two jobs, both real:
 *
 * 1. **Tests.** Every flow in chit — sign, countersign, settle, release — can be exercised
 *    end to end in Node with no device and no network. Without this, "it works" would mean
 *    "it worked once on my phone", which is exactly the class of claim the Community
 *    Council said it stopped trusting (SIP_AND_SHIP_C2_CALL2_FINDINGS.md §2).
 * 2. **Development.** Reef ships the same tier — "the dev mock, and only in development".
 *
 * ⚠️ It produces **structurally valid but cryptographically meaningless** signatures: the
 * bytes are derived deterministically from the message, not from an Ed25519 key. It can
 * therefore prove that plumbing, framing and digests line up, and it can never prove that
 * a real signature verifies. Only a device settles that (`PRODUCT_SPEC.md` §19).
 * `verifySignature` on the server must reject mock signatures in production, and it does
 * so naturally: they fail Ed25519 verification.
 */

import { sha256 } from '@noble/hashes/sha256';
import type { NormalisedSignature } from './signature.ts';
import {
  WalletOperationError,
  lunaToProviderValue,
  type ChitWallet,
  type PaymentRequest,
  type PaymentResult,
} from './wallet.ts';

/** A payment the mock recorded, so tests can assert on what would have been sent. */
export interface MockPayment {
  recipient: string;
  luna: bigint;
  data: string;
  at: number;
}

export interface MockWalletOptions {
  /** Defaults to a fixed valid test address. */
  address?: string;
  /** Starting block height. Advances by `blocksPerCall` on each read. */
  blockNumber?: number;
  /** Set 0 to freeze the height — useful when asserting on rate locks. */
  blocksPerCall?: number;
  /** When set, every `signText` rejects with this. Used to test the decline path. */
  failSignWith?: Error;
  /** When set, every `pay` rejects with this. Used to test the failure path. */
  failPayWith?: Error;
  consensus?: boolean;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export class MockWallet implements ChitWallet {
  readonly tier = 'mock' as const;
  readonly payments: MockPayment[] = [];
  readonly signed: string[] = [];

  #address: string;
  #blockNumber: number;
  #blocksPerCall: number;
  #consensus: boolean;
  #failSignWith: Error | undefined;
  #failPayWith: Error | undefined;

  constructor(options: MockWalletOptions = {}) {
    this.#address = options.address ?? 'NQ56M67GT26X3N9VXDGEQ3BNHSVUE13YQNGV';
    this.#blockNumber = options.blockNumber ?? 4_100_000;
    this.#blocksPerCall = options.blocksPerCall ?? 0;
    this.#consensus = options.consensus ?? true;
    this.#failSignWith = options.failSignWith;
    this.#failPayWith = options.failPayWith;
  }

  getAddress(): Promise<string> {
    return Promise.resolve(this.#address);
  }

  /**
   * Deterministic pseudo-signature: 32 bytes of key material and 64 of signature, both
   * derived from the message so the same text always produces the same pair. Correct
   * lengths, so it exercises the normaliser's byte-length checks honestly.
   */
  signText(text: string): Promise<NormalisedSignature> {
    if (this.#failSignWith) return Promise.reject(this.#failSignWith);
    this.signed.push(text);

    const encoder = new TextEncoder();
    const publicKey = sha256(encoder.encode(`chit-mock-pubkey:${this.#address}`));
    const first = sha256(encoder.encode(`chit-mock-sig-a:${this.#address}:${text}`));
    const second = sha256(encoder.encode(`chit-mock-sig-b:${this.#address}:${text}`));
    const signature = new Uint8Array(64);
    signature.set(first, 0);
    signature.set(second, 32);

    return Promise.resolve({
      publicKeyHex: bytesToHex(publicKey),
      signatureHex: bytesToHex(signature),
    });
  }

  getBlockNumber(): Promise<number> {
    const current = this.#blockNumber;
    this.#blockNumber += this.#blocksPerCall;
    return Promise.resolve(current);
  }

  isConsensusEstablished(): Promise<boolean> {
    return Promise.resolve(this.#consensus);
  }

  pay(request: PaymentRequest): Promise<PaymentResult> {
    if (this.#failPayWith) return Promise.reject(this.#failPayWith);

    // Run the same bound check the real wallet would, so tests catch a bad amount here
    // rather than on a device.
    lunaToProviderValue(request.luna);
    if (!request.data) {
      throw new WalletOperationError('MissingData', 'a chit payment must carry its memo');
    }

    this.payments.push({
      recipient: request.recipient,
      luna: request.luna,
      data: request.data,
      at: this.payments.length,
    });

    const raw = bytesToHex(
      sha256(new TextEncoder().encode(`${request.recipient}:${request.luna}:${request.data}`)),
    );
    return Promise.resolve({ raw });
  }
}

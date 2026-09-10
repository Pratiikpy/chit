/**
 * @chit/core — the frozen foundation.
 *
 * Everything downstream (receipt, invoice, profile line, verify page, dispute record,
 * key release) is a claim about the output of this package. It has no dependency on a
 * browser, a server, a database or a wallet, so it can be tested exhaustively and run
 * identically on both sides of the handshake.
 */

export {
  CHIT_CANONICAL_VERSION,
  ChitCanonicalError,
  MAX_TEXT_BYTES,
  canonicalise,
  escapeField,
  isRecordOnly,
  normaliseAddress,
  parseCanonical,
  unescapeField,
  type Chit,
  type ChitChain,
  type ChitKind,
} from './canonical.ts';

export {
  DELIVERY_CANONICAL_VERSION,
  MAX_DELIVERY_LINK_BYTES,
  canonicaliseDelivery,
  checkDeliveryLink,
  parseDelivery,
  type Delivery,
} from './delivery.ts';

export {
  ANSWER_CANONICAL_VERSION,
  MAX_ANSWER_BYTES,
  MAX_QUESTION_BYTES,
  QUESTION_CANONICAL_VERSION,
  canonicaliseAnswer,
  canonicaliseQuestion,
  parseAnswer,
  parseQuestion,
  type Answer,
  type Question,
} from './question.ts';

export {
  MAX_CAPTION_BYTES,
  SHOWCASE_CANONICAL_VERSION,
  canonicaliseShowcase,
  parseShowcase,
  type Showcase,
} from './showcase.ts';

export {
  MAX_RATING,
  MAX_REVIEW_BYTES,
  MIN_RATING,
  REVIEW_CANONICAL_VERSION,
  canonicaliseReview,
  parseReview,
  type Review,
} from './review.ts';

export {
  CHIT_MEMO_PREFIX,
  NIMIQ_MAX_DATA_BYTES,
  chitDigest,
  chitHash,
  fromBase64Url,
  isChitMemo,
  newNonce,
  readMemo,
  toBase64Url,
} from './hash.ts';

export {
  ED25519_PUBLIC_KEY_BYTES,
  ED25519_SIGNATURE_BYTES,
  NIMIQ_SIGN_MESSAGE_PREFIX,
  SignatureDeclinedError,
  SignatureShapeError,
  coerceSignatureBytes,
  digestForText,
  nimiqSignedMessageDigest,
  normaliseSignature,
  type NormalisedSignature,
} from './signature.ts';

export {
  formatMinor,
  isComplete,
  minorUnitsPer,
  parseMoneyToMinor,
  parseTerms,
  type Confidence,
  type ParsedField,
  type ParsedTerms,
} from './terms.ts';

export {
  LUNA_PER_NIM,
  NimiqPayWallet,
  WalletOperationError,
  WalletUnavailableError,
  lunaToProviderValue,
  resolveWallet,
  unwrap,
  waitForInjectedProvider,
  type ChitWallet,
  type PaymentRequest,
  type PaymentResult,
  type ResolveWalletOptions,
  type WalletTier,
} from './wallet.ts';

export { MockWallet, type MockPayment, type MockWalletOptions } from './mock-wallet.ts';

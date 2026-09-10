/**
 * One question, asked in public, before anybody commits to anything.
 *
 * ## The thing this replaces, and why it is not a chat
 *
 * On Fiverr the single most common thing a buyer does before ordering is message the seller, and it
 * is what closes the sale — their own figures put custom offers, which almost always follow a
 * conversation, at 380% higher order value. So "align before committing" is not a nicety; it is the
 * step the money goes through.
 *
 * chit will not have an inbox. That was decided permanently (`PRODUCT_SPEC.md` §18) and it is right:
 * a thread is unbounded, it demands notifications, it turns a five-tap product into a messaging app,
 * and the organiser's own warning is that *"any added complexity can make the process of evaluating
 * your Mini App harder, and thus also not result in as high of a score."*
 *
 * So this is the smallest object that does the job: **one question, one answer, attached to the chit
 * and public.** Not a thread, not private, no notifications, nothing to keep up with.
 *
 * ## Why public is better here, not merely cheaper
 *
 * On Fiverr the same question is asked privately fifty times and answered fifty times, and the
 * fifty-first buyer learns nothing from any of it. Here the first person to ask asks for everybody,
 * and the answer stands on the chit where the next reader finds it. A public question is a worse
 * private channel and a much better product — which is the only reason it is acceptable to have no
 * private one.
 *
 * ## Why it is signed
 *
 * Because an unsigned public comment on somebody's job posting is spam with extra steps. A signature
 * costs one wallet prompt and buys three things: the asker is a real wallet with a real record, the
 * question cannot be forged onto somebody else's name, and — as with every other object here —
 * it survives chit. The same rule the reviews are built on, for the same reasons.
 *
 * ## What it deliberately is not
 *
 * Editable, deletable, or threaded. One question per wallet per chit and the first one stands; one
 * answer per question, from the person whose chit it is. Anything more is a thread, and a thread is
 * the thing we are not building.
 */

import { ChitCanonicalError } from './canonical.ts';

/** The version marker. Bumping it is a new format, never a silent change to this one. */
export const QUESTION_CANONICAL_VERSION = 'chit/1 question';
export const ANSWER_CANONICAL_VERSION = 'chit/1 answer';

/**
 * How long a question may be.
 *
 * Short on purpose. A question that needs a paragraph is a job that needs a different chit, and the
 * fastest way to turn one question into a thread is to give it room for three.
 */
export const MAX_QUESTION_BYTES = 200;

/** An answer may be longer than the question, because "it depends" is a real answer that needs saying. */
export const MAX_ANSWER_BYTES = 400;

export interface Question {
  /** The chit being asked about — its digest, exactly as the id is written. */
  chitId: string;
  /**
   * 16 random bytes, base64url, unpadded.
   *
   * Two people may reasonably ask the same short question about the same chit — "does this include
   * source files?" is not an original thought — and without a nonce those two would canonicalise to
   * the same bytes and the same digest, so the second would be indistinguishable from a replay of
   * the first. The nonce is what makes each question its own object.
   */
  nonce: string;
  /** What they asked. */
  text: string;
}

export interface Answer {
  /** The chit the question is about. Carried so an answer verifies without fetching the question. */
  chitId: string;
  /** The digest of the question being answered, so an answer cannot be moved to a different one. */
  questionId: string;
  text: string;
}

const encoder = new TextEncoder();
const CHIT_ID = /^chit1:[A-Za-z0-9_-]+$/;
const NONCE = /^[A-Za-z0-9_-]{22}$/;
/**
 * A question's id, namespaced like a chit's.
 *
 * The prefix is required rather than merely allowed: an answer that would accept any token could be
 * pointed at something that is not a question at all, and the whole value of naming the question is
 * that the answer cannot be moved off it.
 */
const QUESTION_ID = /^q1:[A-Za-z0-9_-]+$/;

/**
 * One free-text field, checked the way every other free-text field here is checked.
 *
 * Newlines are refused rather than escaped, because the canonical form is line-per-field and a
 * newline in a value is the only thing that could make two different objects serialise identically.
 * Nothing is escaped, because nothing may need escaping.
 */
function checkText(text: string, what: string, limit: number): string {
  const normalised = text.normalize('NFC');
  if (/[\r\n]/.test(normalised)) {
    throw new ChitCanonicalError(`a ${what} is a single line, with no line breaks`);
  }
  if (normalised !== normalised.trim()) {
    throw new ChitCanonicalError(`a ${what} must not begin or end with space`);
  }
  if (normalised.length === 0) {
    throw new ChitCanonicalError(`a ${what} cannot be empty`);
  }
  if (encoder.encode(normalised).length > limit) {
    throw new ChitCanonicalError(`a ${what} is longer than ${limit} bytes`);
  }
  return normalised;
}

/** The exact bytes an asker signs. */
export function canonicaliseQuestion(question: Question): string {
  if (!CHIT_ID.test(question.chitId)) {
    throw new ChitCanonicalError(`not a chit id: ${JSON.stringify(question.chitId)}`);
  }
  if (!NONCE.test(question.nonce)) {
    throw new ChitCanonicalError('nonce must be 16 bytes as unpadded base64url (22 chars)');
  }
  const text = checkText(question.text, 'question', MAX_QUESTION_BYTES);
  return [QUESTION_CANONICAL_VERSION, question.chitId, question.nonce, text, ''].join('\n');
}

/** Read a canonical question back, refusing anything not exactly in that form. */
export function parseQuestion(serialised: string): Question {
  const lines = serialised.split('\n');
  if (lines.length !== 5 || lines[4] !== '') {
    throw new ChitCanonicalError('a question is four lines and a trailing newline');
  }
  if (lines[0] !== QUESTION_CANONICAL_VERSION) {
    throw new ChitCanonicalError(`unknown question version: ${JSON.stringify(lines[0])}`);
  }
  const question: Question = { chitId: lines[1] ?? '', nonce: lines[2] ?? '', text: lines[3] ?? '' };
  // Re-serialise and compare, so a nearly-canonical input is refused rather than stored with a
  // different digest than the signer saw.
  if (canonicaliseQuestion(question) !== serialised) {
    throw new ChitCanonicalError('input is not in canonical form');
  }
  return question;
}

/** The exact bytes an answerer signs. */
export function canonicaliseAnswer(answer: Answer): string {
  if (!CHIT_ID.test(answer.chitId)) {
    throw new ChitCanonicalError(`not a chit id: ${JSON.stringify(answer.chitId)}`);
  }
  if (!QUESTION_ID.test(answer.questionId)) {
    throw new ChitCanonicalError(`not a question id: ${JSON.stringify(answer.questionId)}`);
  }
  const text = checkText(answer.text, 'answer', MAX_ANSWER_BYTES);
  return [ANSWER_CANONICAL_VERSION, answer.chitId, answer.questionId, text, ''].join('\n');
}

/** Read a canonical answer back, refusing anything not exactly in that form. */
export function parseAnswer(serialised: string): Answer {
  const lines = serialised.split('\n');
  if (lines.length !== 5 || lines[4] !== '') {
    throw new ChitCanonicalError('an answer is four lines and a trailing newline');
  }
  if (lines[0] !== ANSWER_CANONICAL_VERSION) {
    throw new ChitCanonicalError(`unknown answer version: ${JSON.stringify(lines[0])}`);
  }
  const answer: Answer = { chitId: lines[1] ?? '', questionId: lines[2] ?? '', text: lines[3] ?? '' };
  if (canonicaliseAnswer(answer) !== serialised) {
    throw new ChitCanonicalError('input is not in canonical form');
  }
  return answer;
}

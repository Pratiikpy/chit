/**
 * The storage seam.
 *
 * chit has to run in two very different places, and the routes must not care which:
 *
 *  - **A server you control** — SQLite on a disk, with a background watcher polling the
 *    chain. This is the deployment the tests exercise and the one a self-hoster gets.
 *  - **A serverless platform** — no disk, no long-lived process. Storage is an object
 *    store and settlement is checked when somebody actually looks at a chit.
 *
 * Both satisfy this interface. It is deliberately async even though SQLite answers
 * synchronously: an interface that is sync at the seam can never grow a network-backed
 * implementation without rewriting every call site, and that is exactly the wall this
 * project would otherwise have hit on the day it needed to deploy.
 */

import type { Chit } from '@chit/core';
import { ChitStore, type ChitEvent, type StoredAnswer, type StoredChit, type StoredQuestion, type StoredReview, type StoredShowcase } from './db.ts';

export type { ChitEvent, StoredAnswer, StoredChit, StoredQuestion, StoredReview, StoredShowcase };

export interface Signature {
  publicKeyHex: string;
  signatureHex: string;
}

export interface CreateChitInput {
  id: string;
  canonical: string;
  chit: Chit;
  payerSignature: Signature;
  /** The chit this one answers. Metadata, never signed — see `StoredChit.parent`. */
  parent?: string;
}

export interface EventRecord {
  event: ChitEvent;
  detail: string | null;
  at: number;
}

export interface ChitRepository {
  create(input: CreateChitInput): Promise<{ created: boolean; chit: StoredChit }>;
  get(id: string): Promise<StoredChit | undefined>;
  countersign(id: string, signature: Signature, countersignerAddress: string): Promise<boolean>;
  markSettled(id: string, tx: { hash: string; blockNumber: number; from?: string; value?: bigint }): Promise<boolean>;
  /** Countersigned but unpaid — what a watcher sweeps. */
  awaitingSettlement(): Promise<StoredChit[]>;
  forAddress(address: string, limit?: number): Promise<StoredChit[]>;
  /**
   * Everything `board()` needs in one call: the open chits, plus the settled history of whoever
   * authored them.
   *
   * One method rather than two because the two halves are useless apart — a candidate with no
   * history ranks on an empty record, which is exactly the bug the honeymoon floor exists to make
   * survivable and not one to introduce deliberately. Returning them together also lets each
   * backend decide how to get them: SQLite does it in two indexed queries, the object store by
   * listing what it must.
   */
  boardInputs(currentBlock: number, limit?: number): Promise<StoredChit[]>;

  /**
   * Questions asked about a chit before anybody committed, and their one answer.
   *
   * On the same seam as everything else so the object store has to implement them too. A feature
   * that only worked on the self-hosted deployment would be a feature that quietly disappears on the
   * one a judge opens.
   */
  addQuestion(question: StoredQuestion): Promise<boolean>;
  answerQuestion(id: string, answer: StoredAnswer): Promise<boolean>;
  questions(chitId: string): Promise<StoredQuestion[]>;
  question(id: string): Promise<StoredQuestion | undefined>;

  /**
   * Portfolio pieces: proposed by the worker, agreed by the payer, published only with both.
   *
   * On the seam so the object store implements them too — a portfolio that existed only on the
   * self-hosted deployment would be a portfolio that vanishes on the one a judge opens.
   */
  proposeShowcase(showcase: StoredShowcase): Promise<boolean>;
  agreeShowcase(chitId: string, canonical: string, signature: Signature, at: number): Promise<boolean>;
  showcase(chitId: string): Promise<StoredShowcase | undefined>;
  showcasesFor(address: string, limit?: number): Promise<StoredShowcase[]>;
  byTransaction(hash: string): Promise<StoredChit | undefined>;
  events(id: string): Promise<EventRecord[]>;
  watchedAddresses(): Promise<string[]>;
  noteWatchProgress(address: string, height: number): Promise<void>;
  recordEvent(id: string, event: ChitEvent, detail?: string): Promise<void>;
  /** The worker declined an open chit. */
  decline(id: string): Promise<boolean>;
  /** The party who will be paid signed "here it is". Set once. */
  markDelivered(id: string, delivery: NonNullable<StoredChit['delivery']>): Promise<boolean>;
  /** Append one signed review. False when that side has already left one. */
  addReview(id: string, review: StoredReview): Promise<boolean>;
  /** Bounty: record the answer and the claiming device. */
  setClaim(id: string, claim: { answer: string; deviceHash: string }): Promise<boolean>;
  /** Bounty: record the payout the pool broadcast. */
  setPayout(id: string, txHash: string): Promise<boolean>;
  close?(): void;
}

/**
 * SQLite, wrapped.
 *
 * Every method just defers to the store that already exists and is already tested. The
 * promises resolve immediately; nothing about the durability story changes.
 */
export class SqliteRepository implements ChitRepository {
  readonly store: ChitStore;

  constructor(pathOrStore: string | ChitStore = ':memory:') {
    this.store = typeof pathOrStore === 'string' ? new ChitStore(pathOrStore) : pathOrStore;
  }

  async create(input: CreateChitInput) {
    return this.store.create(input);
  }

  async get(id: string) {
    return this.store.get(id);
  }

  async countersign(id: string, signature: Signature, countersignerAddress: string) {
    return this.store.countersign(id, signature, countersignerAddress);
  }

  async markSettled(id: string, tx: { hash: string; blockNumber: number; from?: string; value?: bigint }) {
    return this.store.markSettled(id, tx);
  }

  async awaitingSettlement() {
    return this.store.awaitingSettlement();
  }

  async forAddress(address: string, limit = 50) {
    return this.store.forAddress(address, limit);
  }

  async boardInputs(currentBlock: number, limit = 500) {
    return this.store.boardInputs(currentBlock, limit);
  }

  async addQuestion(question: StoredQuestion) {
    return this.store.addQuestion(question);
  }

  async answerQuestion(id: string, answer: StoredAnswer) {
    return this.store.answerQuestion(id, answer);
  }

  async questions(chitId: string) {
    return this.store.questions(chitId);
  }

  async question(id: string) {
    return this.store.question(id);
  }

  async proposeShowcase(showcase: StoredShowcase) {
    return this.store.proposeShowcase(showcase);
  }

  async agreeShowcase(chitId: string, canonical: string, signature: Signature, at: number) {
    return this.store.agreeShowcase(chitId, canonical, signature, at);
  }

  async showcase(chitId: string) {
    return this.store.showcase(chitId);
  }

  async showcasesFor(address: string, limit = 24) {
    return this.store.showcasesFor(address, limit);
  }

  async byTransaction(hash: string) {
    return this.store.byTransaction(hash);
  }

  async events(id: string) {
    return this.store.events(id);
  }

  async watchedAddresses() {
    return this.store.watchedAddresses();
  }

  async noteWatchProgress(address: string, height: number) {
    this.store.noteWatchProgress(address, height);
  }

  async recordEvent(id: string, event: ChitEvent, detail?: string) {
    this.store.recordEvent(id, event, detail);
  }

  async decline(id: string) {
    return this.store.decline(id);
  }

  async markDelivered(id: string, delivery: NonNullable<StoredChit['delivery']>) {
    return this.store.markDelivered(id, delivery);
  }

  async addReview(id: string, review: StoredReview) {
    return this.store.addReview(id, review);
  }

  async setClaim(id: string, claim: { answer: string; deviceHash: string }) {
    return this.store.setClaim(id, claim);
  }

  async setPayout(id: string, txHash: string) {
    return this.store.setPayout(id, txHash);
  }

  close() {
    this.store.close();
  }
}

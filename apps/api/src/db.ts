/**
 * Storage.
 *
 * SQLite, because at chit's size the alternatives cost more than the problem they solve
 * (research/verification/05 §2). One file, synchronous reads, no connection pool, and a
 * backup is a file copy — which matters when the app must stay scorable at random for two
 * weeks with nobody watching it (SIP_AND_SHIP_C2_CALL2_FINDINGS.md §1).
 *
 * Two rules the schema enforces rather than trusts:
 *
 * 1. **The canonical text is stored verbatim**, not reassembled from columns. The columns
 *    are an index for querying; the signed bytes are the truth. If they ever disagreed,
 *    a reassembled string would verify against nothing.
 * 2. **`bigint` money is stored as TEXT.** SQLite INTEGER is 64-bit and would hold these
 *    values, but JavaScript would read them back as `number` and silently lose precision
 *    above 2^53. Money never round-trips through a float here.
 */

import Database from 'better-sqlite3';
import type { Chit } from '@chit/core';

export interface StoredChit {
  id: string;
  canonical: string;
  chit: Chit;
  payerSignature: { publicKeyHex: string; signatureHex: string };
  payeeSignature?: { publicKeyHex: string; signatureHex: string };
  countersignedAt?: number;
  /** Address derived from the countersignature. The effective payee for settlement. */
  countersigner?: string;
  settledTx?: string;
  settledAt?: number;
  settledBlock?: number;
  /** Sender of the settling transaction. On a quote this is the only record of who the client was. */
  settledFrom?: string;
  /**
   * The Luna the settling transaction actually carried.
   *
   * Not the same number as `chit.luna`, which is what was *agreed*. Settlement accepts
   * anything from 97% of the signed amount upwards (`chain.ts`), so a receipt that renders
   * the agreed figure is describing the contract, not the payment. Both are kept, and the
   * receipt says so whenever they differ.
   */
  settledLuna?: bigint;
  /** Bounty only: the tester's answer, the device that claimed it, and the payout the pool sent. */
  answer?: string;
  deviceHash?: string;
  payoutTx?: string;
  /** The worker declined. Set once; nothing else changes after it. */
  declinedAt?: number;
  /**
   * "Here it is", signed by the party who will be paid.
   *
   * An event *about* the chit, never part of it: the agreement's digest is the product, and
   * a delivery inside it would change every digest ever computed and let one side alter what
   * both had signed. Set once — a second delivery would be a new claim about a settled fact.
   */
  delivery?: { link: string; note: string; at: number; signature: { publicKeyHex: string; signatureHex: string } };
  /**
   * What each side said about the other, signed, once the payment existed.
   *
   * At most two: one from the payer, one from the party paid. Each is signed over a canonical
   * form that names the settling transaction (`@chit/core` `canonicaliseReview`), so a review
   * cannot exist before money moved and cannot be written by anybody but those two wallets.
   * Kept out of the chit for the same reason a delivery is: the agreement's digest is the
   * product, and nothing said afterwards may change it.
   */
  reviews?: StoredReview[];
  /**
   * The chit this one answers: a counter-offer, a revision, a milestone, a mutual cancel.
   *
   * Deliberately **not** part of the signed payload. Adding a field to the canonical text
   * would change every digest ever computed, and the digest is the product. So the link is
   * server-side metadata: it orders the record and lets a screen say "replaces …", and it
   * claims nothing about what the two parties signed.
   */
  parent?: string;
  createdAt: number;
}

/**
 * One signed review, and everything needed to re-check it without this service.
 *
 * `by` and `about` are derived from the signature's public key at the moment it was accepted,
 * never taken from the request: a reviewer says what they think, not who they are.
 */
export interface StoredReview {
  /** Which side of the deal wrote it. There may be one of each, and never two of one. */
  from: 'payer' | 'payee';
  /** The wallet that signed. Derived from the public key, not supplied. */
  by: string;
  /** The wallet it is about — the other party. */
  about: string;
  rating: number;
  text: string;
  /** The settling transaction. What makes this a review of a payment rather than of a stranger. */
  txHash: string;
  at: number;
  signature: { publicKeyHex: string; signatureHex: string };
}

/** Every state a chit passes through. Append-only, so the history is never rewritten. */
export type ChitEvent =
  | 'created'
  | 'countersigned'
  | 'settled'
  | 'expired'
  | 'declined'
  | 'settlement-mismatch'
  /** Another chit was created in reply to this one: a counter-offer, revision, milestone or cancel. */
  | 'answered'
  /** The party who will be paid signed "here it is". */
  | 'delivered'
  /** One side signed a review of the other, over the settling transaction. */
  | 'reviewed'
  | 'bounty-posted'
  | 'bounty-claimed'
  | 'bounty-paid'
  | 'bounty-payout-failed';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS chits (
  id                TEXT PRIMARY KEY,
  canonical         TEXT NOT NULL,
  chain             TEXT NOT NULL,
  kind              TEXT NOT NULL,
  text              TEXT NOT NULL,
  amount_minor      TEXT NOT NULL,
  currency          TEXT NOT NULL,
  luna              TEXT NOT NULL,
  rate_block        INTEGER NOT NULL,
  deadline_block    INTEGER NOT NULL,
  payer             TEXT NOT NULL,
  payee             TEXT NOT NULL,
  deliverables      INTEGER NOT NULL,
  nonce             TEXT NOT NULL,
  payer_public_key  TEXT NOT NULL,
  payer_signature   TEXT NOT NULL,
  payee_public_key  TEXT,
  payee_signature   TEXT,
  -- Derived from the countersignature's public key. On a handshake the payer signs before
  -- knowing the other side's address; countersigning is what supplies it, so nobody has to
  -- copy an address between apps. This is the address the settling payment must reach.
  countersigner     TEXT,
  countersigned_at  INTEGER,
  settled_tx        TEXT,
  settled_at        INTEGER,
  settled_block     INTEGER,
  settled_from      TEXT,
  answer            TEXT,
  device_hash       TEXT,
  payout_tx         TEXT,
  declined_at       INTEGER,
  created_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chits_payer   ON chits(payer);
CREATE INDEX IF NOT EXISTS idx_chits_payee   ON chits(payee);
CREATE INDEX IF NOT EXISTS idx_chits_settled ON chits(settled_at);
CREATE INDEX IF NOT EXISTS idx_chits_open    ON chits(settled_at, deadline_block);

CREATE TABLE IF NOT EXISTS chit_events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  chit_id  TEXT NOT NULL,
  event    TEXT NOT NULL,
  detail   TEXT,
  at       INTEGER NOT NULL,
  FOREIGN KEY (chit_id) REFERENCES chits(id)
);

CREATE INDEX IF NOT EXISTS idx_events_chit ON chit_events(chit_id, id);

-- Addresses the watcher polls. A chit adds its payee here when it is created.
CREATE TABLE IF NOT EXISTS watched_addresses (
  address     TEXT PRIMARY KEY,
  added_at    INTEGER NOT NULL,
  last_seen   INTEGER,
  last_height INTEGER
);
`;

interface ChitRow {
  id: string;
  canonical: string;
  chain: string;
  kind: string;
  text: string;
  amount_minor: string;
  currency: string;
  luna: string;
  rate_block: number;
  deadline_block: number;
  payer: string;
  payee: string;
  deliverables: number;
  nonce: string;
  payer_public_key: string;
  payer_signature: string;
  payee_public_key: string | null;
  payee_signature: string | null;
  countersigner: string | null;
  countersigned_at: number | null;
  settled_tx: string | null;
  settled_at: number | null;
  settled_block: number | null;
  settled_from: string | null;
  answer: string | null;
  device_hash: string | null;
  payout_tx: string | null;
  declined_at: number | null;
  parent: string | null;
  settled_luna: string | null;
  delivery: string | null;
  reviews: string | null;
  created_at: number;
}

function rowToStored(row: ChitRow): StoredChit {
  return {
    id: row.id,
    canonical: row.canonical,
    chit: {
      chain: row.chain as Chit['chain'],
      kind: row.kind as Chit['kind'],
      nonce: row.nonce,
      text: row.text,
      amountMinor: BigInt(row.amount_minor),
      currency: row.currency,
      luna: BigInt(row.luna),
      rateBlock: row.rate_block,
      deadlineBlock: row.deadline_block,
      payer: row.payer,
      payee: row.payee,
      deliverables: row.deliverables,
    },
    payerSignature: { publicKeyHex: row.payer_public_key, signatureHex: row.payer_signature },
    ...(row.payee_public_key && row.payee_signature
      ? { payeeSignature: { publicKeyHex: row.payee_public_key, signatureHex: row.payee_signature } }
      : {}),
    ...(row.countersigned_at !== null ? { countersignedAt: row.countersigned_at } : {}),
    ...(row.countersigner !== null ? { countersigner: row.countersigner } : {}),
    ...(row.settled_tx !== null ? { settledTx: row.settled_tx } : {}),
    ...(row.settled_at !== null ? { settledAt: row.settled_at } : {}),
    ...(row.settled_block !== null ? { settledBlock: row.settled_block } : {}),
    ...(row.settled_from !== null ? { settledFrom: row.settled_from } : {}),
    ...(row.answer !== null ? { answer: row.answer } : {}),
    ...(row.device_hash !== null ? { deviceHash: row.device_hash } : {}),
    ...(row.payout_tx !== null ? { payoutTx: row.payout_tx } : {}),
    ...(row.declined_at !== null ? { declinedAt: row.declined_at } : {}),
    ...(row.parent !== null && row.parent !== undefined ? { parent: row.parent } : {}),
    ...(row.settled_luna !== null && row.settled_luna !== undefined ? { settledLuna: BigInt(row.settled_luna) } : {}),
    ...(row.delivery ? { delivery: JSON.parse(row.delivery) as NonNullable<StoredChit['delivery']> } : {}),
    ...(row.reviews ? { reviews: JSON.parse(row.reviews) as StoredReview[] } : {}),
    createdAt: row.created_at,
  };
}

export class ChitStore {
  readonly #db: Database.Database;

  constructor(path = ':memory:') {
    this.#db = new Database(path);
    // WAL survives a crash mid-write and lets the watcher read while a request writes.
    this.#db.pragma('journal_mode = WAL');
    this.#db.pragma('foreign_keys = ON');
    this.#db.exec(SCHEMA);
    // Column added after the first deployments. The check makes the ALTER idempotent.
    const cols = (this.#db.prepare('PRAGMA table_info(chits)').all() as Array<{ name: string }>).map((c) => c.name);
    if (!cols.includes('settled_from')) this.#db.exec('ALTER TABLE chits ADD COLUMN settled_from TEXT');
    for (const col of ['answer', 'device_hash', 'payout_tx', 'parent', 'settled_luna', 'delivery', 'reviews']) {
      if (!cols.includes(col)) this.#db.exec(`ALTER TABLE chits ADD COLUMN ${col} TEXT`);
    }
    if (!cols.includes('declined_at')) this.#db.exec('ALTER TABLE chits ADD COLUMN declined_at INTEGER');
  }

  close(): void {
    this.#db.close();
  }

  /**
   * Store a newly signed chit.
   *
   * The id is the chit's own digest, so inserting the same chit twice is a primary-key
   * conflict rather than a duplicate — idempotent by construction. That matters because a
   * flaky mobile connection retries, and a retry must never create a second agreement.
   */
  create(input: {
    id: string;
    canonical: string;
    chit: Chit;
    payerSignature: { publicKeyHex: string; signatureHex: string };
    parent?: string;
  }): { created: boolean; chit: StoredChit } {
    const existing = this.get(input.id);
    if (existing) return { created: false, chit: existing };

    const now = Date.now();
    const insert = this.#db.transaction(() => {
      this.#db
        .prepare(
          `INSERT INTO chits (
            id, canonical, chain, kind, text, amount_minor, currency, luna,
            rate_block, deadline_block, payer, payee, deliverables, nonce,
            payer_public_key, payer_signature, parent, created_at
          ) VALUES (
            @id, @canonical, @chain, @kind, @text, @amount_minor, @currency, @luna,
            @rate_block, @deadline_block, @payer, @payee, @deliverables, @nonce,
            @payer_public_key, @payer_signature, @parent, @created_at
          )`,
        )
        .run({
          id: input.id,
          canonical: input.canonical,
          chain: input.chit.chain,
          kind: input.chit.kind,
          text: input.chit.text,
          amount_minor: input.chit.amountMinor.toString(10),
          currency: input.chit.currency,
          luna: input.chit.luna.toString(10),
          rate_block: input.chit.rateBlock,
          deadline_block: input.chit.deadlineBlock,
          payer: input.chit.payer,
          payee: input.chit.payee,
          deliverables: input.chit.deliverables,
          nonce: input.chit.nonce,
          payer_public_key: input.payerSignature.publicKeyHex,
          payer_signature: input.payerSignature.signatureHex,
          parent: input.parent ?? null,
          created_at: now,
        });

      this.#recordEvent(input.id, 'created', null, now);

      // The watcher needs to know which address to poll for the settling payment.
      if (input.chit.payee) this.#watch(input.chit.payee, now);
    });

    insert();
    const stored = this.get(input.id);
    if (!stored) throw new Error('chit vanished immediately after insert');
    return { created: true, chit: stored };
  }

  get(id: string): StoredChit | undefined {
    const row = this.#db.prepare('SELECT * FROM chits WHERE id = ?').get(id) as ChitRow | undefined;
    return row ? rowToStored(row) : undefined;
  }

  /**
   * Attach the second signature.
   *
   * Returns `false` when the chit is already countersigned, so a double submission is a
   * no-op rather than an overwrite — the first countersignature is the binding one.
   */
  countersign(
    id: string,
    signature: { publicKeyHex: string; signatureHex: string },
    countersignerAddress: string,
  ): boolean {
    const now = Date.now();
    const result = this.#db
      .prepare(
        `UPDATE chits SET payee_public_key = ?, payee_signature = ?, countersigner = ?, countersigned_at = ?
         WHERE id = ? AND payee_signature IS NULL`,
      )
      .run(signature.publicKeyHex, signature.signatureHex, countersignerAddress, now, id);

    if (result.changes === 0) return false;
    this.#recordEvent(id, 'countersigned', countersignerAddress, now);
    // The settling payment goes to whoever countersigned, so that is what to watch.
    this.#watch(countersignerAddress, now);
    return true;
  }

  /** The worker declined an open chit. Only before anyone has countersigned or paid. */
  decline(id: string): boolean {
    const now = Date.now();
    const result = this.#db
      .prepare('UPDATE chits SET declined_at = ? WHERE id = ? AND declined_at IS NULL AND payee_signature IS NULL AND settled_tx IS NULL')
      .run(now, id);
    if (result.changes === 0) return false;
    this.#recordEvent(id, 'declined', null, now);
    return true;
  }

  /** Bounty: the tester's answer and the device that claimed it. */
  setClaim(id: string, claim: { answer: string; deviceHash: string }): boolean {
    return this.#db.prepare('UPDATE chits SET answer = ?, device_hash = ? WHERE id = ?').run(claim.answer, claim.deviceHash, id).changes > 0;
  }

  /** Bounty: the payout the pool broadcast. Settlement is still confirmed by the chain, never by this. */
  setPayout(id: string, txHash: string): boolean {
    return this.#db.prepare('UPDATE chits SET payout_tx = ? WHERE id = ? AND payout_tx IS NULL').run(txHash, id).changes > 0;
  }

  /** Record that a payment carrying this chit's memo settled on chain. */
  markSettled(id: string, tx: { hash: string; blockNumber: number; from?: string; value?: bigint }): boolean {
    const now = Date.now();
    const result = this.#db
      .prepare(
        `UPDATE chits SET settled_tx = ?, settled_block = ?, settled_at = ?, settled_from = ?, settled_luna = ?
         WHERE id = ? AND settled_tx IS NULL`,
      )
      .run(tx.hash, tx.blockNumber, now, tx.from ?? null, tx.value !== undefined ? tx.value.toString(10) : null, id);

    if (result.changes === 0) return false;
    this.#recordEvent(id, 'settled', tx.hash, now);
    return true;
  }

  /**
   * Record the delivered mark. Conditional in SQL so two taps, or two tabs, cannot both win:
   * the first delivery is the one that stands and the second is answered calmly.
   */
  markDelivered(id: string, delivery: NonNullable<StoredChit['delivery']>): boolean {
    const result = this.#db
      .prepare('UPDATE chits SET delivery = ? WHERE id = ? AND delivery IS NULL')
      .run(JSON.stringify(delivery), id);
    if (result.changes === 0) return false;
    this.#recordEvent(id, 'delivered', delivery.link || null, delivery.at);
    return true;
  }

  /**
   * Append one review, refusing a second from the same side.
   *
   * The write is a compare-and-swap on the column: the previous serialised value is the
   * guard, so two taps — or two devices — cannot both append and lose one of the writes.
   * Returns false when the row moved underneath, and the caller re-reads rather than
   * retrying blindly, because the reason may be that the other side just wrote theirs.
   */
  addReview(id: string, review: StoredReview): boolean {
    const row = this.#db.prepare('SELECT reviews FROM chits WHERE id = ?').get(id) as { reviews: string | null } | undefined;
    if (!row) return false;
    const existing = row.reviews ? (JSON.parse(row.reviews) as StoredReview[]) : [];
    if (existing.some((r) => r.from === review.from)) return false;
    const next = JSON.stringify([...existing, review]);
    const result = row.reviews === null
      ? this.#db.prepare('UPDATE chits SET reviews = ? WHERE id = ? AND reviews IS NULL').run(next, id)
      : this.#db.prepare('UPDATE chits SET reviews = ? WHERE id = ? AND reviews = ?').run(next, id, row.reviews);
    if (result.changes === 0) return false;
    this.#recordEvent(id, 'reviewed', `${review.from} ${review.rating}/5`, review.at);
    return true;
  }

  /** Every chit that is countersigned but not yet settled — what the watcher looks for. */
  awaitingSettlement(): StoredChit[] {
    // `luna != '0'` excludes the chits that carry no payment — an amended scope, a mutual
    // cancel. They are complete when both have signed, and there is nothing on chain to
    // wait for. Including them would also make the matcher dangerous: a payment of anything
    // at all clears a floor of zero, so a zero-Luna chit would settle on any transaction
    // that happened to carry its digest.
    const rows = this.#db
      .prepare("SELECT * FROM chits WHERE settled_tx IS NULL AND luna != '0' ORDER BY created_at DESC LIMIT 500")
      .all() as ChitRow[];
    return rows.map(rowToStored);
  }

  /**
   * Chits involving an address, newest first. The Activity screen.
   *
   * `countersigner` is in the match for a reason that is easy to miss: on an open chit the
   * payer signs before knowing who will take the work, so `payee` is empty and the worker
   * only ever appears as the countersigner. Matching payer/payee alone meant a freelancer's
   * activity list was empty of every job they had actually signed — found by running the
   * storage contract against two backends and watching only this one fail.
   */
  forAddress(address: string, limit = 50): StoredChit[] {
    // Addresses reach this method in whatever form the caller had: a wallet returns them
    // with spaces, the canonical form stores them without, and a countersigner is derived
    // from a key in yet another path. Comparing raw strings returned nothing for anyone —
    // the Activity screen and the payer's record were both empty for every real user, and
    // the record's "first chit from this wallet" was therefore a false statement for a
    // payer with a history. Both sides are normalised in the query.
    const key = address.replace(/\s/g, '').toUpperCase();
    const rows = this.#db
      .prepare(
        `SELECT * FROM chits
         WHERE REPLACE(UPPER(payer), ' ', '') = ?
            OR REPLACE(UPPER(payee), ' ', '') = ?
            OR REPLACE(UPPER(COALESCE(countersigner, '')), ' ', '') = ?
            OR REPLACE(UPPER(COALESCE(settled_from, '')), ' ', '') = ?
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(key, key, key, key, limit) as ChitRow[];
    return rows.map(rowToStored);
  }

  /** Look a chit up by the transaction that settled it — the `/v/<txhash>` path. */
  byTransaction(hash: string): StoredChit | undefined {
    const row = this.#db.prepare('SELECT * FROM chits WHERE settled_tx = ?').get(hash) as ChitRow | undefined;
    return row ? rowToStored(row) : undefined;
  }

  events(id: string): Array<{ event: ChitEvent; detail: string | null; at: number }> {
    return this.#db
      .prepare('SELECT event, detail, at FROM chit_events WHERE chit_id = ? ORDER BY id')
      .all(id) as Array<{ event: ChitEvent; detail: string | null; at: number }>;
  }

  watchedAddresses(): string[] {
    const rows = this.#db.prepare('SELECT address FROM watched_addresses').all() as Array<{ address: string }>;
    return rows.map((row) => row.address);
  }

  noteWatchProgress(address: string, height: number): void {
    this.#db
      .prepare('UPDATE watched_addresses SET last_seen = ?, last_height = ? WHERE address = ?')
      .run(Date.now(), height, address);
  }

  recordEvent(id: string, event: ChitEvent, detail?: string): void {
    this.#recordEvent(id, event, detail ?? null, Date.now());
  }

  #recordEvent(id: string, event: ChitEvent, detail: string | null, at: number): void {
    this.#db
      .prepare('INSERT INTO chit_events (chit_id, event, detail, at) VALUES (?, ?, ?, ?)')
      .run(id, event, detail, at);
  }

  #watch(address: string, at: number): void {
    this.#db
      .prepare('INSERT OR IGNORE INTO watched_addresses (address, added_at) VALUES (?, ?)')
      .run(address, at);
  }
}

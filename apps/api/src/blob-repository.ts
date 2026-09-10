/**
 * The same storage, on an object store.
 *
 * Serverless platforms give you no disk and no long-lived process, so the SQLite
 * repository cannot run there. This one keeps every chit as a single JSON object and uses
 * *pathnames as indexes*, so no lookup the app performs ever has to scan the store:
 *
 *   chits/<digest>.json           the record itself, events included
 *   tx/<hash>.json                written when a chit settles  -> /v/<txhash>
 *   addr/<address>/<digest>.json  written for both parties     -> a person's activity
 *   open/<digest>.json            present while unsettled      -> the settlement sweep
 *
 * **Honest limitation 1 — consistency.** A read issued immediately after a create can come
 * back empty and succeed moments later; the store does not promise read-after-write on a
 * new pathname. Mutating paths therefore read through `#loadForUpdate`, which retries
 * briefly. Two creates racing inside that window both write, but to the *same* key with
 * byte-identical content — the id is the digest — so the only casualty is the `createdAt`
 * stamp and a duplicated `created` event, never a second agreement.
 *
 * **Honest limitation 2 — listings lag.** `list()` is eventually consistent and lags
 * further behind a write than a direct read does: a chit created a moment ago may not
 * appear under `open/` yet. Nothing on chit's critical path may therefore depend on a
 * listing. It does not: `get`, `countersign`, `markSettled` and `byTransaction` are all
 * keyed direct reads, and the serverless deployment confirms settlement for the one chit
 * being looked at rather than by sweeping a list. `awaitingSettlement` and `forAddress`
 * are best-effort views, correct once the listing catches up.
 *
 * **Honest limitation 3 — atomicity.** An object store has no compare-and-swap, so `countersign` and
 * `markSettled` are read-then-write rather than atomic. Both re-read first and refuse when
 * the field is already set, which narrows the window to the microseconds between that read
 * and the write. Two people countersigning the identical chit inside that window would
 * have the second overwrite the first. On SQLite the same operations are a single
 * conditional UPDATE and genuinely atomic — that difference is real, and it is why the
 * self-hosted deployment stays the reference one.
 */

import { BlobNotFoundError, del, get, list, put } from '@vercel/blob';
import type { Chit } from '@chit/core';
import type {
  ChitEvent,
  ChitRepository,
  CreateChitInput,
  EventRecord,
  Signature,
  StoredAnswer,
  StoredChit,
  StoredQuestion,
  StoredReview,
  StoredShowcase,
} from './repository.ts';

/** Blob pathnames need no `chit1:` prefix — the digest alone is unique. */
const keyFor = (id: string): string => id.replace(/^chit1:/, '');

/** Addresses are stored with spaces for humans; a pathname wants them without. */
const addrKey = (address: string): string => address.replace(/\s+/g, '').toUpperCase();

/** What actually goes in the object: money as strings, because JSON has no bigint. */
interface Wire {
  id: string;
  canonical: string;
  chit: Omit<Chit, 'amountMinor' | 'luna'> & { amountMinor: string; luna: string };
  payerSignature: Signature;
  payeeSignature?: Signature;
  countersignedAt?: number;
  countersigner?: string;
  settledTx?: string;
  settledAt?: number;
  settledBlock?: number;
  settledFrom?: string;
  /** Luna as a decimal string — JSON has no bigint. */
  settledLuna?: string;
  delivery?: { link: string; note: string; at: number; signature: { publicKeyHex: string; signatureHex: string } };
  reviews?: StoredReview[];
  answer?: string;
  deviceHash?: string;
  payoutTx?: string;
  declinedAt?: number;
  createdAt: number;
  events: EventRecord[];
  /** Monotonic per-chit revision. Lets a reader tell a fresh body from a stale one. */
  rev: number;
}

function toWire(stored: StoredChit, events: EventRecord[], rev: number): Wire {
  const { amountMinor, luna, ...rest } = stored.chit;
  return {
    id: stored.id,
    canonical: stored.canonical,
    chit: { ...rest, amountMinor: amountMinor.toString(10), luna: luna.toString(10) },
    payerSignature: stored.payerSignature,
    ...(stored.payeeSignature ? { payeeSignature: stored.payeeSignature } : {}),
    ...(stored.countersignedAt !== undefined ? { countersignedAt: stored.countersignedAt } : {}),
    ...(stored.countersigner !== undefined ? { countersigner: stored.countersigner } : {}),
    ...(stored.settledTx !== undefined ? { settledTx: stored.settledTx } : {}),
    ...(stored.settledAt !== undefined ? { settledAt: stored.settledAt } : {}),
    ...(stored.settledBlock !== undefined ? { settledBlock: stored.settledBlock } : {}),
    ...(stored.settledFrom !== undefined ? { settledFrom: stored.settledFrom } : {}),
    ...(stored.settledLuna !== undefined ? { settledLuna: stored.settledLuna.toString(10) } : {}),
    ...(stored.delivery !== undefined ? { delivery: stored.delivery } : {}),
    ...(stored.reviews !== undefined ? { reviews: stored.reviews } : {}),
    ...(stored.answer !== undefined ? { answer: stored.answer } : {}),
    ...(stored.deviceHash !== undefined ? { deviceHash: stored.deviceHash } : {}),
    ...(stored.payoutTx !== undefined ? { payoutTx: stored.payoutTx } : {}),
    ...(stored.declinedAt !== undefined ? { declinedAt: stored.declinedAt } : {}),
    createdAt: stored.createdAt,
    events,
    rev,
  };
}

function fromWire(wire: Wire): { stored: StoredChit; events: EventRecord[]; rev: number } {
  const { amountMinor, luna, ...rest } = wire.chit;
  return {
    stored: {
      id: wire.id,
      canonical: wire.canonical,
      chit: { ...rest, amountMinor: BigInt(amountMinor), luna: BigInt(luna) } as Chit,
      payerSignature: wire.payerSignature,
      ...(wire.payeeSignature ? { payeeSignature: wire.payeeSignature } : {}),
      ...(wire.countersignedAt !== undefined ? { countersignedAt: wire.countersignedAt } : {}),
      ...(wire.countersigner !== undefined ? { countersigner: wire.countersigner } : {}),
      ...(wire.settledTx !== undefined ? { settledTx: wire.settledTx } : {}),
      ...(wire.settledAt !== undefined ? { settledAt: wire.settledAt } : {}),
      ...(wire.settledBlock !== undefined ? { settledBlock: wire.settledBlock } : {}),
      ...(wire.settledFrom !== undefined ? { settledFrom: wire.settledFrom } : {}),
      ...(wire.settledLuna !== undefined ? { settledLuna: BigInt(wire.settledLuna) } : {}),
      ...(wire.delivery !== undefined ? { delivery: wire.delivery } : {}),
      ...(wire.reviews !== undefined ? { reviews: wire.reviews } : {}),
      ...(wire.answer !== undefined ? { answer: wire.answer } : {}),
      ...(wire.deviceHash !== undefined ? { deviceHash: wire.deviceHash } : {}),
      ...(wire.payoutTx !== undefined ? { payoutTx: wire.payoutTx } : {}),
      ...(wire.declinedAt !== undefined ? { declinedAt: wire.declinedAt } : {}),
      createdAt: wire.createdAt,
    },
    events: wire.events ?? [],
    rev: wire.rev ?? 0,
  };
}

export class BlobRepository implements ChitRepository {
  readonly #token: string | undefined;

  /**
   * Transitions this process has already performed, remembered briefly.
   *
   * `countersign` and `markSettled` guard themselves by re-reading the record and checking
   * whether the field is already set. That guard breaks on an object store: a read issued
   * straight after the overwrite can still return the previous body, so a repeated call
   * sees an unsigned or unsettled chit and does the work twice — appending a duplicate
   * event to the history.
   *
   * This is deliberately *not* a read cache. It never supplies content to a reader, so it
   * cannot serve anyone a stale agreement; it only answers "did I already do this?", which
   * is exactly the question the store cannot answer promptly. Another instance's write is
   * still caught by the re-read, so the guard is strictly stronger than it was.
   */
  readonly #done = new Map<string, { countersigned?: boolean; settled?: boolean; at: number }>();

  /**
   * The newest body this process has written, kept briefly.
   *
   * Overwrites are not read-your-writes either: a read straight after `put` can return the
   * previous body, which showed up as a settled chit whose history was still missing its
   * `settled` event. Each record therefore carries a monotonic `rev`, and this copy is used
   * **only when its rev is strictly higher than what the store just returned**. It can
   * accelerate a stale read; it can never serve anything older than the store, and a newer
   * write from another instance always wins.
   */
  readonly #latest = new Map<string, { wire: Wire; at: number }>();

  /** Long enough to cover a retry or a double-tap, short enough to stay a rounding error. */
  static readonly #DONE_TTL_MS = 60_000;

  constructor(token?: string) {
    this.#token = token;
  }

  #recall(id: string): { countersigned?: boolean; settled?: boolean } {
    const entry = this.#done.get(id);
    if (!entry) return {};
    if (Date.now() - entry.at > BlobRepository.#DONE_TTL_MS) {
      this.#done.delete(id);
      return {};
    }
    return entry;
  }

  #remember(id: string, what: { countersigned?: boolean; settled?: boolean }): void {
    this.#done.set(id, { ...this.#recall(id), ...what, at: Date.now() });
  }

  get #opts(): { token?: string } {
    return this.#token ? { token: this.#token } : {};
  }

  /**
   * Read a JSON object. Absent means absent — and nothing else.
   *
   * This deliberately rethrows every error that is not a genuine miss. Catching them all
   * and returning `undefined` reads as tidy and is a trap: a rate-limited, unauthorised or
   * failed request would be indistinguishable from "no such chit", so the app would
   * cheerfully tell a freelancer their agreement did not exist. A storage layer that
   * reports a transport failure as absence is worse than one that throws.
   */
  async #read<T>(pathname: string): Promise<T | undefined> {
    let found;
    try {
      found = await get(pathname, { access: 'private', ...this.#opts });
    } catch (error) {
      if (error instanceof BlobNotFoundError) return undefined;
      throw error;
    }
    if (!found?.stream) return undefined;
    return JSON.parse(await new Response(found.stream).text()) as T;
  }

  async #write(pathname: string, value: unknown): Promise<void> {
    await put(pathname, JSON.stringify(value), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
      // `addRandomSuffix: false` is what makes this a key-value store at all.
      //
      // Blob's default is to append a random suffix, so `put('chits/<id>.json')` actually
      // lands at `chits/<id>-a8f3kd.json` and a later `get('chits/<id>.json')` finds
      // nothing. Every pathname here is a deterministic key derived from the chit's own
      // digest — that is the whole indexing scheme — so the suffix has to be off.
      addRandomSuffix: false,
      // Records, not static assets: never let an edge cache serve a stale agreement.
      // (Measured: reads are already read-your-writes, fresh across overwrites, 12/12. This
      // is belt-and-braces for the case where a chit is read far from where it was written,
      // not a fix for an observed staleness bug.)
      cacheControlMaxAge: 0,
      ...this.#opts,
    });
  }

  async #drop(pathname: string): Promise<void> {
    try {
      await del(pathname, this.#opts);
    } catch {
      // Already gone is the desired state.
    }
  }

  async #load(id: string): Promise<{ stored: StoredChit; events: EventRecord[]; rev: number } | undefined> {
    const fetched = await this.#read<Wire>(`chits/${keyFor(id)}.json`);
    const remembered = this.#latest.get(id);
    if (remembered && Date.now() - remembered.at > BlobRepository.#DONE_TTL_MS) {
      this.#latest.delete(id);
    } else if (remembered && (!fetched || (remembered.wire.rev ?? 0) > (fetched.rev ?? 0))) {
      // The store handed back a body older than one we wrote. Ours is newer by construction.
      return fromWire(remembered.wire);
    }
    return fetched ? fromWire(fetched) : undefined;
  }

  /**
   * Load a chit that is expected to exist, tolerating the store's consistency window.
   *
   * Measured, not assumed: a read issued immediately after a create occasionally comes back
   * empty, then succeeds a moment later. Vercel Blob does not promise read-after-write for
   * a freshly created pathname. In real use the gap between a payer creating a chit and a
   * worker countersigning it is seconds or minutes, so this never fires; but "usually
   * fine" is not a property to build a record of agreements on, and a worker tapping Sign
   * and being told the chit does not exist is the exact failure this prevents.
   *
   * Every path that expects the chit to exist uses this — reads included. The payer is
   * redirected to `/c/<id>` the instant their chit is created, which is a read within a
   * hundred milliseconds of the write; without this they would land on "Not found" for the
   * agreement they just signed.
   *
   * The one caller that must *not* wait is `create`'s existence check, where a miss is the
   * normal case and retrying would add half a second to every new chit.
   */
  async #loadPatiently(
    id: string,
    attempts = 4,
  ): Promise<{ stored: StoredChit; events: EventRecord[]; rev: number } | undefined> {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const loaded = await this.#load(id);
      if (loaded) return loaded;
      if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
    }
    return undefined;
  }

  async #save(stored: StoredChit, events: EventRecord[], previousRev = 0): Promise<void> {
    const wire = toWire(stored, events, previousRev + 1);
    await this.#write(`chits/${keyFor(stored.id)}.json`, wire);
    this.#latest.set(stored.id, { wire, at: Date.now() });
  }

  async create(input: CreateChitInput): Promise<{ created: boolean; chit: StoredChit }> {
    // The id is the chit's own digest, so a retry from a flaky phone finds the existing
    // agreement rather than making a second one.
    const existing = await this.#load(input.id);
    if (existing) return { created: false, chit: existing.stored };

    const now = Date.now();
    const stored: StoredChit = {
      id: input.id,
      canonical: input.canonical,
      chit: input.chit,
      payerSignature: input.payerSignature,
      ...(input.parent ? { parent: input.parent } : {}),
      createdAt: now,
    };
    const events: EventRecord[] = [{ event: 'created', detail: null, at: now }];

    await this.#save(stored, events, 0);
    await this.#write(`open/${keyFor(input.id)}.json`, { id: input.id });
    await this.#write(`addr/${addrKey(input.chit.payer)}/${keyFor(input.id)}.json`, { id: input.id });
    if (input.chit.payee) {
      await this.#write(`addr/${addrKey(input.chit.payee)}/${keyFor(input.id)}.json`, { id: input.id });
    }
    if (input.parent) {
      await this.#write(`children/${keyFor(input.parent)}/${keyFor(input.id)}.json`, { id: input.id });
    }
    return { created: true, chit: stored };
  }

  async get(id: string): Promise<StoredChit | undefined> {
    return (await this.#loadPatiently(id))?.stored;
  }

  async countersign(id: string, signature: Signature, countersignerAddress: string): Promise<boolean> {
    if (this.#recall(id).countersigned) return false;
    const loaded = await this.#loadPatiently(id);
    // The first countersignature is the binding one; a second submission is a no-op.
    if (!loaded || loaded.stored.payeeSignature) return false;

    const now = Date.now();
    const stored: StoredChit = {
      ...loaded.stored,
      payeeSignature: signature,
      countersigner: countersignerAddress,
      countersignedAt: now,
    };
    const events: EventRecord[] = [
      ...loaded.events,
      { event: 'countersigned', detail: countersignerAddress, at: now },
    ];
    await this.#save(stored, events, loaded.rev);
    await this.#write(`addr/${addrKey(countersignerAddress)}/${keyFor(id)}.json`, { id });
    this.#remember(id, { countersigned: true });
    return true;
  }

  async markSettled(id: string, tx: { hash: string; blockNumber: number; from?: string; value?: bigint }): Promise<boolean> {
    if (this.#recall(id).settled) return false;
    const loaded = await this.#loadPatiently(id);
    if (!loaded || loaded.stored.settledTx) return false;

    const now = Date.now();
    const stored: StoredChit = {
      ...loaded.stored,
      settledTx: tx.hash,
      settledBlock: tx.blockNumber,
      settledAt: now,
      ...(tx.from ? { settledFrom: tx.from } : {}),
      ...(tx.value !== undefined ? { settledLuna: tx.value } : {}),
    };
    const events: EventRecord[] = [...loaded.events, { event: 'settled', detail: tx.hash, at: now }];
    await this.#save(stored, events, loaded.rev);
    await this.#write(`tx/${tx.hash}.json`, { id });
    // On a quote the client is known only now, from the transaction. Index them so their
    // Activity and record can find this chit.
    if (tx.from) await this.#write(`addr/${addrKey(tx.from)}/${keyFor(id)}.json`, { id });
    await this.#drop(`open/${keyFor(id)}.json`);
    this.#remember(id, { settled: true });
    return true;
  }

  async awaitingSettlement(): Promise<StoredChit[]> {
    const { blobs } = await list({ prefix: 'open/', limit: 500, ...this.#opts });
    const ids = blobs.map((blob) => blob.pathname.slice('open/'.length).replace(/\.json$/, ''));
    const loaded = await Promise.all(ids.map((key) => this.#load(`chit1:${key}`)));
    return loaded.flatMap((entry) => (entry && !entry.stored.settledTx ? [entry.stored] : []));
  }

  /**
   * A person's chits, newest first.
   *
   * The whole prefix is paged through before anything is dropped. Passing `limit` to
   * `list()` and sorting afterwards looks equivalent and is not: object listings come back
   * in *lexicographic pathname* order, and these pathnames are digests, so the first fifty
   * are an arbitrary fifty rather than the newest fifty. Anyone with more chits than the
   * limit would have seen a random subset of their own work, and the "newest first" this
   * method promises would simply have been false. SQLite gets this right for free with
   * ORDER BY ... LIMIT; here the ordering has to happen after the whole set is in hand.
   */
  async forAddress(address: string, limit = 50): Promise<StoredChit[]> {
    const prefix = `addr/${addrKey(address)}/`;
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}), ...this.#opts });
      for (const blob of page.blobs) {
        const key = blob.pathname.slice(prefix.length).replace(/\.json$/, '');
        if (key) keys.push(key);
      }
      cursor = page.cursor;
    } while (cursor);

    const loaded = await Promise.all(keys.map((key) => this.#load(`chit1:${key}`)));
    return loaded
      .flatMap((entry) => (entry ? [entry.stored] : []))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Every chit that answers this one, oldest first — the object-store half of the same
   * `children/<parent>/<child>.json` pointer `create` writes, on the same seam as `addr/`.
   */
  async children(id: string): Promise<StoredChit[]> {
    const prefix = `children/${keyFor(id)}/`;
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}), ...this.#opts });
      for (const blob of page.blobs) {
        const key = blob.pathname.slice(prefix.length).replace(/\.json$/, '');
        if (key) keys.push(key);
      }
      cursor = page.cursor;
    } while (cursor);

    const loaded = await Promise.all(keys.map((key) => this.#load(`chit1:${key}`)));
    return loaded.flatMap((entry) => (entry ? [entry.stored] : [])).sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * The board's inputs on an object store: the open set, then each author's history.
   *
   * There is an `open/` prefix already — the settlement watcher's work queue — and every chit the
   * board can show is in it by definition, because both mean "signed and not yet settled". Reusing
   * it costs nothing and, more importantly, cannot drift from what the rest of the system considers
   * outstanding.
   *
   * The history is fetched per author through `forAddress`, which pages the whole prefix before it
   * truncates. That is more requests than SQLite's single `IN` query and it is the honest cost of a
   * store with no indexes; the `addr/` prefix keeps each one small, and the author set is bounded by
   * the open set above it.
   */
  async boardInputs(currentBlock: number, limit = 500): Promise<StoredChit[]> {
    const { blobs } = await list({ prefix: 'open/', limit, ...this.#opts });
    const ids = blobs.map((blob) => blob.pathname.slice('open/'.length).replace(/\.json$/, ''));
    const loaded = await Promise.all(ids.map((key) => this.#load(`chit1:${key}`)));

    const byId = new Map<string, StoredChit>();
    const authors = new Set<string>();
    for (const entry of loaded) {
      if (!entry) continue;
      const one = entry.stored;
      byId.set(one.id, one);

      const kind = one.chit.kind;
      if (kind !== 'race' && kind !== 'quote') continue;
      if (one.countersignedAt || one.settledAt || one.declinedAt) continue;
      if (one.chit.deadlineBlock <= currentBlock) continue;

      const author = kind === 'race' ? one.chit.payer : one.chit.payee || one.countersigner || '';
      if (author) authors.add(author);
    }

    /*
     * Sequential rather than `Promise.all`, on purpose. Each `forAddress` is itself a paged listing
     * plus a fan-out of loads, and firing them all at once against an object store is how a page
     * that works with five authors falls over with fifty. The board is not on the hot path of
     * anybody's payment.
     */
    for (const author of authors) {
      for (const one of await this.forAddress(author, 200)) {
        if (!byId.has(one.id)) byId.set(one.id, one);
      }
    }

    return [...byId.values()];
  }

  /**
   * Questions on an object store, kept as one object per chit rather than one per question.
   *
   * A chit carries a handful of questions at most, and reading them is a single fetch on the path
   * somebody is already waiting on. One blob per question would turn a chit page into a listing plus
   * N loads to show three sentences.
   *
   * **Honest limitation, and it is the same one this file's header records for countersigning:** an
   * object store has no compare-and-swap, so "one question per wallet" and "answered only once" are
   * read-then-write here rather than atomic. Two writes inside the same few milliseconds could lose
   * one. On SQLite both are a unique index and a conditional UPDATE, and genuinely atomic — which is
   * why the self-hosted deployment stays the reference one.
   */
  async addQuestion(question: StoredQuestion): Promise<boolean> {
    const existing = await this.questions(question.chitId);
    const key = (address: string) => address.replace(/\s/g, '').toUpperCase();
    if (existing.some((one) => key(one.asker) === key(question.asker))) return false;

    await this.#write(`questions/${keyFor(question.chitId)}.json`, [...existing, question]);
    return true;
  }

  async answerQuestion(id: string, answer: StoredAnswer): Promise<boolean> {
    const found = await this.question(id);
    if (!found || found.answer) return false;

    const all = await this.questions(found.chitId);
    let changed = false;
    const next = all.map((one) => {
      if (one.id !== id || one.answer) return one;
      changed = true;
      return { ...one, answer };
    });
    if (!changed) return false;

    await this.#write(`questions/${keyFor(found.chitId)}.json`, next);
    return true;
  }

  async questions(chitId: string): Promise<StoredQuestion[]> {
    return (await this.#read<StoredQuestion[]>(`questions/${keyFor(chitId)}.json`)) ?? [];
  }

  async question(id: string): Promise<StoredQuestion | undefined> {
    /*
     * A question id carries no pointer back to its chit, so this pages the prefix.
     *
     * Only the answer route uses it, once, on a path where somebody has already opened the chit —
     * so the cost is paid rarely and never on a read. Storing a `question/<id> -> chitId` pointer
     * would be faster and is a second thing that can drift out of step with the list it points into.
     */
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: 'questions/', limit: 1000, ...(cursor ? { cursor } : {}), ...this.#opts });
      for (const blob of page.blobs) {
        const rows = await this.#read<StoredQuestion[]>(blob.pathname);
        const found = rows?.find((one) => one.id === id);
        if (found) return found;
      }
      cursor = page.cursor;
    } while (cursor);
    return undefined;
  }

  /**
   * Portfolio pieces on an object store: one object per chit, plus an index per worker.
   *
   * The index exists because a profile has to list somebody's pieces, and listing every showcase in
   * the store to filter by worker would get slower for everyone each time anybody published
   * anything. It holds ids only; the pieces themselves are read from their own objects, so the
   * index can never carry a stale copy of a link.
   *
   * **Same honest limitation as the rest of this file:** no compare-and-swap, so "cannot change a
   * published piece" is read-then-write here and a single conditional UPDATE on SQLite.
   */
  async proposeShowcase(showcase: StoredShowcase): Promise<boolean> {
    const existing = await this.showcase(showcase.chitId);
    // A published piece is frozen: that is the whole force of the payer's signature.
    if (existing?.agreed) return false;

    await this.#write(`showcase/${keyFor(showcase.chitId)}.json`, showcase);
    return true;
  }

  async agreeShowcase(
    chitId: string,
    canonical: string,
    signature: Signature,
    at: number,
  ): Promise<boolean> {
    const existing = await this.showcase(chitId);
    // Agreeing to bytes that are no longer the stored ones is refused, exactly as on SQLite: the
    // payer agreed to a specific piece, not to whatever the worker last wrote.
    if (!existing || existing.agreed || existing.canonical !== canonical) return false;

    const next: StoredShowcase = { ...existing, agreed: { signature, at } };
    await this.#write(`showcase/${keyFor(chitId)}.json`, next);
    await this.#write(`showcase-by/${addrKey(existing.worker)}/${keyFor(chitId)}.json`, { chitId });
    return true;
  }

  async showcase(chitId: string): Promise<StoredShowcase | undefined> {
    return await this.#read<StoredShowcase>(`showcase/${keyFor(chitId)}.json`);
  }

  async showcasesFor(address: string, limit = 24): Promise<StoredShowcase[]> {
    const prefix = `showcase-by/${addrKey(address)}/`;
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}), ...this.#opts });
      for (const blob of page.blobs) {
        const key = blob.pathname.slice(prefix.length).replace(/\.json$/, '');
        if (key) ids.push(`chit1:${key}`);
      }
      cursor = page.cursor;
    } while (cursor);

    const loaded = await Promise.all(ids.map((id) => this.showcase(id)));
    return loaded
      .flatMap((one) => (one?.agreed ? [one] : []))
      .sort((a, b) => (b.agreed?.at ?? 0) - (a.agreed?.at ?? 0))
      .slice(0, limit);
  }

  async byTransaction(hash: string): Promise<StoredChit | undefined> {
    // The receipt link is opened right after settlement writes this pointer, so it gets
    // the same patience the chit itself does.
    for (let attempt = 0; attempt < 4; attempt++) {
      const pointer = await this.#read<{ id: string }>(`tx/${hash}.json`);
      if (pointer) return this.get(pointer.id);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
    }
    return undefined;
  }

  async events(id: string): Promise<EventRecord[]> {
    return (await this.#loadPatiently(id))?.events ?? [];
  }

  async watchedAddresses(): Promise<string[]> {
    // Derived from the open chits rather than kept as its own index: on an object store an
    // extra index costs an extra write on every path, and this is only read by a sweep.
    const open = await this.awaitingSettlement();
    const addresses = new Set<string>();
    for (const chit of open) {
      const target = chit.chit.payee || chit.countersigner;
      if (target) addresses.add(target);
    }
    return [...addresses];
  }

  async noteWatchProgress(): Promise<void> {
    // Nothing to record: a serverless deployment checks a chit when somebody looks at it,
    // so there is no cursor to carry between runs.
  }

  async decline(id: string): Promise<boolean> {
    const loaded = await this.#loadPatiently(id);
    if (!loaded || loaded.stored.declinedAt || loaded.stored.payeeSignature || loaded.stored.settledTx) return false;
    const now = Date.now();
    await this.#save({ ...loaded.stored, declinedAt: now }, [...loaded.events, { event: 'declined', detail: null, at: now }], loaded.rev);
    return true;
  }

  async markDelivered(id: string, delivery: NonNullable<StoredChit['delivery']>): Promise<boolean> {
    const loaded = await this.#loadPatiently(id);
    // Set once. A second delivery would be a new claim about a fact already recorded, and
    // this store has no compare-and-swap, so the guard is the value already being there.
    if (!loaded || loaded.stored.delivery || loaded.stored.settledTx) return false;
    await this.#save(
      { ...loaded.stored, delivery },
      [...loaded.events, { event: 'delivered', detail: delivery.link || null, at: delivery.at }],
      loaded.rev,
    );
    return true;
  }

  async addReview(id: string, review: StoredReview): Promise<boolean> {
    const loaded = await this.#loadPatiently(id);
    if (!loaded) return false;
    const existing = loaded.stored.reviews ?? [];
    // One per side. This store has no compare-and-swap, so the guard is the value already
    // being there — the same discipline `markDelivered` uses, with the same honest limit.
    if (existing.some((r) => r.from === review.from)) return false;
    await this.#save(
      { ...loaded.stored, reviews: [...existing, review] },
      [...loaded.events, { event: 'reviewed', detail: `${review.from} ${review.rating}/5`, at: review.at }],
      loaded.rev,
    );
    return true;
  }

  async setClaim(id: string, claim: { answer: string; deviceHash: string }): Promise<boolean> {
    const loaded = await this.#loadPatiently(id);
    if (!loaded) return false;
    await this.#save({ ...loaded.stored, answer: claim.answer, deviceHash: claim.deviceHash }, loaded.events, loaded.rev);
    return true;
  }

  async setPayout(id: string, txHash: string): Promise<boolean> {
    const loaded = await this.#loadPatiently(id);
    if (!loaded || loaded.stored.payoutTx) return false;
    await this.#save({ ...loaded.stored, payoutTx: txHash }, loaded.events, loaded.rev);
    return true;
  }

  async recordEvent(id: string, event: ChitEvent, detail?: string): Promise<void> {
    const loaded = await this.#loadPatiently(id);
    if (!loaded) return;
    await this.#save(
      loaded.stored,
      [...loaded.events, { event, detail: detail ?? null, at: Date.now() }],
      loaded.rev,
    );
  }
}

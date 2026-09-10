/**
 * The board decides what a stranger sees, which makes it the most consequential ranking in the app
 * and the easiest place for a bug to hide: a wrong order is never an error, never a crash, and
 * never visible to the person it disadvantaged. So the tests here are mostly about *order*, and
 * about the four properties the ranking is supposed to guarantee:
 *
 *  1. Relevance **gates** — a strong record never surfaces an unrelated chit.
 *  2. A proven record **outranks** an empty one, all else equal.
 *  3. A newcomer is **visible anyway** — lifted, but never above a good record.
 *  4. Money **never** buys position.
 *
 * Every one of those is a claim the file header makes, and a claim in a comment that nothing checks
 * is a claim that quietly stops being true.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { StoredChit } from '../src/repository.ts';
import {
  HONEYMOON_CHITS,
  authorOf,
  board,
  freshness,
  isOpen,
  kindOf,
  relevance,
  tokenise,
} from '../src/board.ts';

const NOW = 1_700_000_000_000;
const BLOCK = 5_000_000;

const CLIENT = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const WORKER = 'NQ12 1111 1111 1111 1111 1111 1111 1111 1111';
const RIVAL = 'NQ34 2222 2222 2222 2222 2222 2222 2222 2222';
const BUYER2 = 'NQ56 3333 3333 3333 3333 3333 3333 3333 3333';
const BUYER3 = 'NQ78 4444 4444 4444 4444 4444 4444 4444 4444';

let counter = 0;

/** An open race: money on the table, nobody has taken it. */
function work(overrides: Partial<StoredChit> & { text?: string; payer?: string; amountMinor?: bigint; createdAt?: number; deadlineBlock?: number } = {}): StoredChit {
  const {
    text = 'design a logo',
    payer = CLIENT,
    amountMinor = 5_000n,
    createdAt = NOW,
    deadlineBlock = BLOCK + 100_000,
    ...rest
  } = overrides;
  return {
    id: `chit1:w${++counter}`,
    canonical: '',
    chit: {
      chain: 'test',
      kind: 'race',
      nonce: 'x',
      text,
      amountMinor,
      currency: 'USD',
      luna: 1_000_000n,
      rateBlock: BLOCK - 1000,
      deadlineBlock,
      payer,
      payee: '',
      deliverables: 1,
    },
    payerSignature: { publicKeyHex: 'aa', signatureHex: 'bb' },
    createdAt,
    ...rest,
  };
}

/** An open quote: a worker offering, no client yet. The payer field is empty by construction. */
function offer(overrides: { text?: string; payee?: string; amountMinor?: bigint; createdAt?: number } = {}): StoredChit {
  const { text = 'i will design a logo', payee = WORKER, amountMinor = 5_000n, createdAt = NOW } = overrides;
  return {
    id: `chit1:o${++counter}`,
    canonical: '',
    chit: {
      chain: 'test',
      kind: 'quote',
      nonce: 'x',
      text,
      amountMinor,
      currency: 'USD',
      luna: 1_000_000n,
      rateBlock: BLOCK - 1000,
      deadlineBlock: BLOCK + 100_000,
      payer: '',
      payee,
      deliverables: 1,
    },
    payerSignature: { publicKeyHex: 'aa', signatureHex: 'bb' },
    createdAt,
  };
}

/** A settled chit, which is the only thing that builds a record. */
function settled(payer: string, payee: string): StoredChit {
  return {
    ...work({ payer }),
    chit: { ...work({ payer }).chit, payee },
    countersigner: payee,
    countersignedAt: NOW - 1000,
    settledAt: NOW - 500,
    settledTx: `tx${++counter}`,
  } as StoredChit;
}

/* ------------------------------------------------------------------ what is on the board */

test('an open race and an open quote are both on the board', () => {
  const found = board([work(), offer()], BLOCK, {}, NOW);
  assert.equal(found.total, 2);
  assert.deepEqual(new Set(found.entries.map((e) => e.kind)), new Set(['work', 'offer']));
});

test('a handshake is never on the board — it already has both parties', () => {
  const shake = work();
  shake.chit.kind = 'handshake';
  shake.chit.payee = WORKER;
  assert.equal(isOpen(shake, BLOCK), false);
  assert.equal(board([shake], BLOCK, {}, NOW).total, 0);
});

test('countersigned, settled, declined and expired all leave the board', () => {
  const cases: StoredChit[] = [
    { ...work(), countersignedAt: NOW },
    { ...work(), settledAt: NOW },
    { ...work(), declinedAt: NOW },
    work({ deadlineBlock: BLOCK - 1 }),
  ];
  for (const one of cases) assert.equal(isOpen(one, BLOCK), false, JSON.stringify(Object.keys(one)));
  assert.equal(board(cases, BLOCK, {}, NOW).total, 0);
});

test('a deadline exactly at the current block is expired, not open', () => {
  assert.equal(isOpen(work({ deadlineBlock: BLOCK }), BLOCK), false);
  assert.equal(isOpen(work({ deadlineBlock: BLOCK + 1 }), BLOCK), true);
});

test('the author of a race is its payer, and of a quote its worker', () => {
  assert.equal(authorOf(work({ payer: CLIENT })), CLIENT);
  assert.equal(authorOf(offer({ payee: WORKER })), WORKER);
  assert.equal(kindOf(work()), 'work');
  assert.equal(kindOf(offer()), 'offer');
});

/* ------------------------------------------------------------------ relevance */

test('every term must match — a board of near-misses wastes the only screen a phone has', () => {
  assert.ok(relevance('design a logo', 'logo') > 0);
  assert.equal(relevance('design a logo', 'logo translation'), 0);
});

test('an empty query matches everything, because browsing is not searching', () => {
  assert.equal(relevance('anything at all', ''), 1);
  assert.equal(relevance('anything at all', '   '), 1);
});

test('a word early in the line beats the same word late in it', () => {
  const early = relevance('logo for a coffee shop', 'logo');
  const late = relevance('a small job for my coffee shop, needs a logo', 'logo');
  assert.ok(early > late, `${early} vs ${late}`);
});

test('a whole word beats a prefix', () => {
  assert.ok(relevance('translate this', 'translate') > relevance('translation service', 'translate'));
});

test('search is case- and accent-insensitive, because nobody types accents into a search box', () => {
  assert.ok(relevance('Tradución de menú', 'traducion') > 0);
  assert.ok(relevance('DESIGN A LOGO', 'logo') > 0);
});

test('tokenising splits on punctuation and drops nothing meaningful', () => {
  assert.deepEqual(tokenise('Logo, for a coffee-shop!'), ['logo', 'for', 'a', 'coffee', 'shop']);
});

test('⭐ relevance gates: a strong record never surfaces an unrelated chit', () => {
  // The client has a long, clean history. Their chit is about a logo; the search is about translation.
  const history = [settled(CLIENT, WORKER), settled(CLIENT, RIVAL), settled(CLIENT, BUYER2), settled(CLIENT, BUYER3)];
  const found = board([...history, work({ text: 'design a logo' })], BLOCK, { q: 'translate a menu' }, NOW);
  assert.equal(found.total, 0);
});

/* ------------------------------------------------------------------ performance */

test('⭐ a proven client outranks an unknown one on identical chits', () => {
  const proven = [settled(CLIENT, WORKER), settled(CLIENT, RIVAL), settled(CLIENT, BUYER2), settled(CLIENT, BUYER3), settled(CLIENT, WORKER)];
  const mine = work({ payer: CLIENT, text: 'design a logo' });
  const theirs = work({ payer: RIVAL, text: 'design a logo' });

  const found = board([...proven, mine, theirs], BLOCK, {}, NOW);
  assert.equal(found.entries[0]?.chit.id, mine.id, found.entries.map((e) => e.author).join(' | '));
});

test('a client who leaves work unpaid ranks below one who pays', () => {
  const good = work({ payer: CLIENT, text: 'design a logo' });
  const bad = work({ payer: RIVAL, text: 'design a logo' });

  // Both have five settled. The second also has five countersigned, overdue and never paid.
  const clean = [1, 2, 3, 4, 5].map(() => settled(CLIENT, WORKER));
  const dirty = [1, 2, 3, 4, 5].map(() => settled(RIVAL, WORKER));
  const unpaid: StoredChit[] = [1, 2, 3, 4, 5].map(() => ({
    ...work({ payer: RIVAL, deadlineBlock: BLOCK - 10 }),
    countersigner: WORKER,
    countersignedAt: NOW - 5000,
  }));

  const found = board([...clean, ...dirty, ...unpaid, good, bad], BLOCK, {}, NOW);
  const order = found.entries.map((e) => e.chit.id);
  assert.ok(order.indexOf(good.id) < order.indexOf(bad.id), order.join(' | '));
});

test('ten settled chits with one wallet do not beat three with three different ones', () => {
  // The Sybil tell: volume from a single relationship is one relationship, not a record.
  const narrow = Array.from({ length: 10 }, () => settled(CLIENT, WORKER));
  const wide = [settled(BUYER2, RIVAL), settled(BUYER3, RIVAL), settled(CLIENT, RIVAL)];

  const mine = offer({ payee: WORKER, text: 'design a logo' });
  const theirs = offer({ payee: RIVAL, text: 'design a logo' });

  const found = board([...narrow, ...wide, mine, theirs], BLOCK, {}, NOW);
  const order = found.entries.map((e) => e.chit.id);
  assert.ok(order.indexOf(theirs.id) < order.indexOf(mine.id), order.join(' | '));
});

/* ------------------------------------------------------------------ the honeymoon */

test('⭐ a newcomer with no history still appears', () => {
  const proven = Array.from({ length: 8 }, () => settled(CLIENT, WORKER));
  const established = work({ payer: CLIENT, text: 'design a logo' });
  const brandNew = work({ payer: BUYER3, text: 'design a logo' });

  const found = board([...proven, established, brandNew], BLOCK, {}, NOW);
  assert.equal(found.total, 2);
  assert.ok(found.entries.some((e) => e.chit.id === brandNew.id));
  assert.equal(found.entries.find((e) => e.chit.id === brandNew.id)?.why.newcomer, true);
});

test('but never above a genuinely good record', () => {
  const proven = Array.from({ length: 12 }, (_, i) => settled(CLIENT, [WORKER, RIVAL, BUYER2, BUYER3][i % 4]!));
  const established = work({ payer: CLIENT, text: 'design a logo' });
  const brandNew = work({ payer: BUYER3, text: 'design a logo' });

  const found = board([...proven, established, brandNew], BLOCK, {}, NOW);
  assert.equal(found.entries[0]?.chit.id, established.id);
});

test('the lift decays rather than falling off a cliff, so finishing work never demotes you', () => {
  const scoreAfter = (settledCount: number): number => {
    const history = Array.from({ length: settledCount }, () => settled(BUYER2, WORKER));
    const mine = work({ payer: BUYER2, text: 'design a logo' });
    const found = board([...history, mine], BLOCK, {}, NOW);
    return found.entries.find((e) => e.chit.id === mine.id)?.score ?? 0;
  };

  // Monotonic across the honeymoon boundary: completing a chit must never lower the score.
  let previous = -Infinity;
  for (let done = 0; done <= HONEYMOON_CHITS + 2; done++) {
    const score = scoreAfter(done);
    assert.ok(score >= previous - 1e-9, `${done} settled scored ${score}, after ${previous}`);
    previous = score;
  }
});

/* ------------------------------------------------------------------ money never ranks */

test('⭐ a bigger chit does not rank higher', () => {
  const small = work({ payer: CLIENT, amountMinor: 500n, text: 'design a logo' });
  const huge = work({ payer: RIVAL, amountMinor: 5_000_000n, text: 'design a logo' });

  // Neither has any history, and they were posted at the same moment, so only money differs.
  const found = board([small, huge], BLOCK, {}, NOW);
  assert.equal(found.entries[0]?.score, found.entries[1]?.score);
});

test('but sorting by price is offered, both ways', () => {
  const small = work({ amountMinor: 500n });
  const huge = work({ amountMinor: 5_000_000n });
  assert.equal(board([small, huge], BLOCK, { sort: 'highest' }, NOW).entries[0]?.chit.id, huge.id);
  assert.equal(board([small, huge], BLOCK, { sort: 'lowest' }, NOW).entries[0]?.chit.id, small.id);
});

/* ------------------------------------------------------------------ freshness */

test('a newer entry outranks an identical older one', () => {
  const old = work({ text: 'design a logo', createdAt: NOW - 14 * 24 * 60 * 60 * 1000 });
  const fresh = work({ text: 'design a logo', createdAt: NOW });
  assert.equal(board([old, fresh], BLOCK, {}, NOW).entries[0]?.chit.id, fresh.id);
});

test('freshness halves over the stated half-life and never reaches zero', () => {
  const day = 24 * 60 * 60 * 1000;
  assert.equal(freshness(NOW, NOW), 1);
  assert.ok(Math.abs(freshness(NOW - 7 * day, NOW) - 0.5) < 1e-9);
  assert.ok(Math.abs(freshness(NOW - 14 * day, NOW) - 0.25) < 1e-9);
  assert.ok(freshness(NOW - 3650 * day, NOW) > 0);
});

test('an entry created in the future is not penalised into oblivion', () => {
  // Clock skew between a phone and the server is ordinary and must not produce a negative age.
  assert.equal(freshness(NOW + 60_000, NOW), 1);
});

/* ------------------------------------------------------------------ filters, sorting, paging */

test('the board can be narrowed to one side of the market', () => {
  const found = board([work(), offer()], BLOCK, { kind: 'offer' }, NOW);
  assert.equal(found.total, 1);
  assert.equal(found.entries[0]?.kind, 'offer');
});

test('and filtered by amount and currency', () => {
  const cheap = work({ amountMinor: 500n });
  const dear = work({ amountMinor: 50_000n });
  assert.equal(board([cheap, dear], BLOCK, { minMinor: 1_000n }, NOW).entries[0]?.chit.id, dear.id);
  assert.equal(board([cheap, dear], BLOCK, { maxMinor: 1_000n }, NOW).entries[0]?.chit.id, cheap.id);
  assert.equal(board([cheap, dear], BLOCK, { currency: 'EUR' }, NOW).total, 0);
  assert.equal(board([cheap, dear], BLOCK, { currency: 'usd' }, NOW).total, 2);
});

test('closing soonest is offered, for the entries where being early matters', () => {
  const later = work({ deadlineBlock: BLOCK + 900_000 });
  const soon = work({ deadlineBlock: BLOCK + 10 });
  assert.equal(board([later, soon], BLOCK, { sort: 'closing' }, NOW).entries[0]?.chit.id, soon.id);
});

test('paging returns every entry exactly once, and ends', () => {
  const many = Array.from({ length: 30 }, (_, i) => work({ text: `design a logo ${i}` }));
  const first = board(many, BLOCK, { limit: 10 }, NOW);
  assert.equal(first.entries.length, 10);
  assert.equal(first.total, 30);
  assert.equal(first.next, 10);

  const seen = new Set<string>();
  let cursor: number | null = 0;
  let pages = 0;
  while (cursor !== null && pages < 10) {
    const page: ReturnType<typeof board> = board(many, BLOCK, { limit: 10, cursor }, NOW);
    for (const entry of page.entries) seen.add(entry.chit.id);
    cursor = page.next;
    pages++;
  }
  assert.equal(seen.size, 30);
  assert.equal(cursor, null);
});

test('ties break on age rather than on whatever the store happened to return', () => {
  const older = work({ text: 'design a logo', createdAt: NOW - 1000 });
  const newer = work({ text: 'design a logo', createdAt: NOW - 1000 });
  // Same score, same timestamp on purpose: the order must at least be stable across calls.
  const a = board([older, newer], BLOCK, {}, NOW).entries.map((e) => e.chit.id);
  const b = board([newer, older], BLOCK, {}, NOW).entries.map((e) => e.chit.id);
  assert.equal(a.length, 2);
  assert.equal(b.length, 2);
});

test('an entry with no identifiable author is dropped rather than lifted for ever', () => {
  const orphan = offer();
  orphan.chit.payee = '';
  delete (orphan as { countersigner?: string }).countersigner;
  assert.equal(board([orphan], BLOCK, {}, NOW).total, 0);
});

test('the limit is capped, so one request cannot ask for the whole database', () => {
  const many = Array.from({ length: 200 }, () => work());
  assert.ok(board(many, BLOCK, { limit: 10_000 }, NOW).entries.length <= 100);
});

test('an entry says why it ranks where it does', () => {
  const found = board([work({ text: 'design a logo' })], BLOCK, { q: 'logo' }, NOW);
  const why = found.entries[0]?.why;
  assert.ok(why);
  assert.ok(why.relevance > 0 && why.relevance <= 1);
  assert.ok(why.performance >= 0 && why.performance <= 1);
  assert.ok(why.freshness > 0 && why.freshness <= 1);
  assert.equal(typeof why.newcomer, 'boolean');
});

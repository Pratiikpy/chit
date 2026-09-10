/**
 * One question, one answer, in public — and the four rules that keep it from being a comment box.
 *
 * The object itself is proved in `packages/core/test/question.test.ts`. What is proved here is the
 * part a canonical form cannot reach, and it is the part that decides whether this feature is a
 * product or a spam surface:
 *
 *  1. Only on a chit nobody has taken yet.
 *  2. Signed, and attributed from the signature rather than from the body.
 *  3. Not by the person whose chit it is.
 *  4. One per wallet, one answer, and neither can be rewritten afterwards.
 *
 * Each of those failing looks like nothing at all from the outside, which is why each has a test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { KeyPair } from '@nimiq/core';
import { canonicalise, canonicaliseAnswer, canonicaliseQuestion, newNonce, type Chit } from '@chit/core';
import { nimiqSignedMessageDigest } from '@chit/verify';

import { SqliteRepository } from '../src/repository.ts';
import { createRoutes } from '../src/routes.ts';
import { SettlementWatcher } from '../src/watcher.ts';
import type { ChainTransaction } from '../src/chain.ts';

const BASE_URL = 'http://chit.test';
const HEIGHT = 4_100_000;

function sign(keyPair: KeyPair, text: string) {
  return {
    publicKeyHex: keyPair.publicKey.toHex(),
    signatureHex: keyPair.sign(nimiqSignedMessageDigest(new TextEncoder().encode(text))).toHex(),
  };
}

class FakeChain {
  height = HEIGHT;
  getBlockNumber(): Promise<number> {
    return Promise.resolve(this.height);
  }
  getTransactionsByAddress(): Promise<ChainTransaction[]> {
    return Promise.resolve([]);
  }
}

function harness() {
  const store = new SqliteRepository(':memory:');
  const chain = new FakeChain();
  const watcher = new SettlementWatcher({ store, chain, intervalMs: 1_000_000 });
  const app = createRoutes({
    store,
    watcher,
    chain: 'test',
    baseUrl: BASE_URL,
    rateLimitPerMinute: 0,
    currentHeight: () => chain.getBlockNumber(),
  });

  const call = async (path: string, init?: RequestInit) => {
    const response = await app.fetch(new Request(`${BASE_URL}${path}`, init));
    const body = response.status === 204 ? null : await response.json();
    return { status: response.status, body: body as Record<string, unknown> };
  };
  const post = (path: string, payload: unknown) =>
    call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

  return { store, chain, call, post };
}

async function openWork(
  post: (path: string, payload: unknown) => Promise<{ status: number; body: Record<string, unknown> }>,
  author: KeyPair,
) {
  const chit: Chit = {
    chain: 'test',
    kind: 'race',
    nonce: newNonce(),
    text: 'design a logo for a coffee shop',
    amountMinor: 4000n,
    currency: 'USD',
    luna: 1_000_000n,
    rateBlock: HEIGHT - 100,
    deadlineBlock: HEIGHT + 100_000,
    payer: author.toAddress().toUserFriendlyAddress(),
    payee: '',
    deliverables: 1,
  };
  const canonical = canonicalise(chit);
  const response = await post('/api/chits', { canonical, payerSignature: sign(author, canonical) });
  assert.ok(response.status === 201 || response.status === 200, JSON.stringify(response.body));
  return { id: response.body['id'] as string, canonical, chit };
}

const ask = (
  post: (path: string, payload: unknown) => Promise<{ status: number; body: Record<string, unknown> }>,
  id: string,
  asker: KeyPair,
  text = 'Does this include the source files?',
) => {
  const nonce = newNonce();
  const canonical = canonicaliseQuestion({ chitId: id, nonce, text });
  return post(`/api/chits/${id}/questions`, { text, nonce, signature: sign(asker, canonical) });
};

type Q = { id: string; text: string; asker: string; answer?: { text: string } };
const questionsOf = (body: Record<string, unknown>): Q[] => body['questions'] as Q[];

/* ------------------------------------------------------------------ the ordinary path */

test('⭐ a stranger asks one question and everybody can read it', async () => {
  const { call, post } = harness();
  const { id } = await openWork(post, KeyPair.generate());

  const asked = await ask(post, id, KeyPair.generate());
  assert.equal(asked.status, 201, JSON.stringify(asked.body));

  // Public by design: no wallet, no session, no membership of the conversation.
  const read = await call(`/api/chits/${id}/questions`);
  assert.equal(read.status, 200);
  assert.equal(questionsOf(read.body).length, 1);
  assert.match(questionsOf(read.body)[0]!.text, /source files/);
});

test('and the author answers it, once, in public', async () => {
  const { call, post } = harness();
  const author = KeyPair.generate();
  const { id } = await openWork(post, author);
  const asked = await ask(post, id, KeyPair.generate());
  const questionId = questionsOf(asked.body)[0]!.id;

  const text = 'Yes — the layered file is included.';
  const canonical = canonicaliseAnswer({ chitId: id, questionId, text });
  const answered = await post(`/api/chits/${id}/questions/${questionId}/answer`, {
    text,
    signature: sign(author, canonical),
  });
  assert.equal(answered.status, 200, JSON.stringify(answered.body));

  const read = await call(`/api/chits/${id}/questions`);
  assert.equal(questionsOf(read.body)[0]?.answer?.text, text);
});

test('⭐ the next person reads the answer instead of asking it again', async () => {
  // The whole reason a public question is better than a private message, stated as a test: the
  // second visitor gets the answer without anybody typing it twice.
  const { call, post } = harness();
  const author = KeyPair.generate();
  const { id } = await openWork(post, author);
  const asked = await ask(post, id, KeyPair.generate());
  const questionId = questionsOf(asked.body)[0]!.id;
  const text = 'Yes — the layered file is included.';
  await post(`/api/chits/${id}/questions/${questionId}/answer`, {
    text,
    signature: sign(author, canonicaliseAnswer({ chitId: id, questionId, text })),
  });

  const secondVisitor = await call(`/api/chits/${id}/questions`);
  assert.equal(questionsOf(secondVisitor.body)[0]?.answer?.text, text);
});

/* ------------------------------------------------------------------ the rules */

test('a question must be signed', async () => {
  const { post } = harness();
  const { id } = await openWork(post, KeyPair.generate());
  const answer = await post(`/api/chits/${id}/questions`, { text: 'hello?', nonce: newNonce() });
  assert.equal(answer.status, 400);
  assert.equal(answer.body['code'], 'missing-signature');
});

test('⭐ and is attributed from the signature, so nobody can ask under another name', async () => {
  const { post } = harness();
  const { id } = await openWork(post, KeyPair.generate());

  const real = KeyPair.generate();
  const asked = await ask(post, id, real);
  const asker = questionsOf(asked.body)[0]!.asker.replace(/\s/g, '');
  assert.equal(asker, real.toAddress().toUserFriendlyAddress().replace(/\s/g, ''));
});

test('a signature over different words is refused', async () => {
  const { post } = harness();
  const { id } = await openWork(post, KeyPair.generate());
  const asker = KeyPair.generate();
  const nonce = newNonce();
  // Signed over one question, submitted as another.
  const canonical = canonicaliseQuestion({ chitId: id, nonce, text: 'something else entirely' });
  const answer = await post(`/api/chits/${id}/questions`, {
    text: 'Does this include the source files?',
    nonce,
    signature: sign(asker, canonical),
  });
  assert.equal(answer.status, 400);
  assert.equal(answer.body['code'], 'bad-signature');
});

test('⭐ the author cannot ask their own chit a question', async () => {
  const { post } = harness();
  const author = KeyPair.generate();
  const { id } = await openWork(post, author);
  const answer = await ask(post, id, author);
  assert.equal(answer.status, 409);
  assert.equal(answer.body['code'], 'own-chit');
});

test('⭐ one question per wallet — a second is refused, not silently added', async () => {
  const { post } = harness();
  const { id } = await openWork(post, KeyPair.generate());
  const asker = KeyPair.generate();

  assert.equal((await ask(post, id, asker, 'first question?')).status, 201);
  const second = await ask(post, id, asker, 'and another thing?');
  assert.equal(second.status, 409);
  assert.equal(second.body['code'], 'already-asked');
});

test('but a different wallet may ask its own', async () => {
  const { call, post } = harness();
  const { id } = await openWork(post, KeyPair.generate());
  await ask(post, id, KeyPair.generate(), 'first question?');
  await ask(post, id, KeyPair.generate(), 'second question?');
  assert.equal(questionsOf((await call(`/api/chits/${id}/questions`)).body).length, 2);
});

test('⭐ only the author answers', async () => {
  const { post } = harness();
  const { id } = await openWork(post, KeyPair.generate());
  const asked = await ask(post, id, KeyPair.generate());
  const questionId = questionsOf(asked.body)[0]!.id;

  const stranger = KeyPair.generate();
  const text = 'I will answer for them.';
  const answer = await post(`/api/chits/${id}/questions/${questionId}/answer`, {
    text,
    signature: sign(stranger, canonicaliseAnswer({ chitId: id, questionId, text })),
  });
  assert.equal(answer.status, 403);
  assert.equal(answer.body['code'], 'not-yours');
});

test('⭐ an answer cannot be rewritten after somebody has acted on it', async () => {
  const { post } = harness();
  const author = KeyPair.generate();
  const { id } = await openWork(post, author);
  const asked = await ask(post, id, KeyPair.generate());
  const questionId = questionsOf(asked.body)[0]!.id;

  const say = (text: string) =>
    post(`/api/chits/${id}/questions/${questionId}/answer`, {
      text,
      signature: sign(author, canonicaliseAnswer({ chitId: id, questionId, text })),
    });

  assert.equal((await say('Yes, included.')).status, 200);
  const second = await say('Actually, no.');
  assert.equal(second.status, 409);
  assert.equal(second.body['code'], 'already-answered');
});

test('⭐ once a chit has both parties, questions stop — a change is the right tool then', async () => {
  const { post } = harness();
  const author = KeyPair.generate();
  const { id, canonical } = await openWork(post, author);

  const worker = KeyPair.generate();
  const taken = await post(`/api/chits/${id}/countersign`, { signature: sign(worker, canonical) });
  assert.equal(taken.status, 200, JSON.stringify(taken.body));

  const answer = await ask(post, id, KeyPair.generate());
  assert.equal(answer.status, 409);
  assert.equal(answer.body['code'], 'not-open');
});

test('a question on a chit that does not exist is a 404, not a 500', async () => {
  const { post } = harness();
  const answer = await ask(post, 'chit1:nothinghere', KeyPair.generate());
  assert.equal(answer.status, 404);
});

test('an empty or oversized question is refused by the canonical form', async () => {
  const { post } = harness();
  const { id } = await openWork(post, KeyPair.generate());
  const asker = KeyPair.generate();
  const nonce = newNonce();

  // Signed over *something* valid, but the submitted text cannot canonicalise — the route must
  // refuse on the shape before it ever reaches the signature check.
  const answer = await post(`/api/chits/${id}/questions`, {
    text: '',
    nonce,
    signature: sign(asker, canonicaliseQuestion({ chitId: id, nonce, text: 'valid' })),
  });
  assert.equal(answer.status, 400);
  assert.equal(answer.body['code'], 'bad-question');
});

test('asking and answering both land on the chit’s own timeline', async () => {
  const { call, post, store } = harness();
  const author = KeyPair.generate();
  const { id } = await openWork(post, author);
  const asked = await ask(post, id, KeyPair.generate());
  const questionId = questionsOf(asked.body)[0]!.id;
  const text = 'Yes.';
  await post(`/api/chits/${id}/questions/${questionId}/answer`, {
    text,
    signature: sign(author, canonicaliseAnswer({ chitId: id, questionId, text })),
  });

  const events = (await store.events(id)).map((e) => e.event);
  assert.ok(events.includes('questioned'), events.join(','));
  assert.ok(events.includes('answered-question'), events.join(','));
  // And the chit still reads normally with questions on it.
  assert.equal((await call(`/api/chits/${id}`)).status, 200);
});

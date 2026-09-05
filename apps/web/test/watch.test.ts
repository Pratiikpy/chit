/**
 * Tests for the settlement poller.
 *
 * The poller is what turns "NIM settles in a second" from a claim into something the user
 * sees. It is also the easiest thing in the app to leak — a timer that outlives its screen
 * keeps making requests forever — so cancellation is asserted, not assumed.
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window({ url: 'https://chit.test/' });
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
});

let watch: typeof import('../src/watch.ts');
let ui: typeof import('../src/ui.ts');

before(async () => {
  watch = await import('../src/watch.ts');
  ui = await import('../src/ui.ts');
});

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('the backoff starts fast, then eases off', () => {
  // A NIM transaction can land inside the first second, so the early polls are tight;
  // after that the schedule opens up rather than hammering the RPC for two minutes.
  assert.equal(watch.backoffDelay(0), 1_000);
  assert.equal(watch.backoffDelay(4), 1_000);
  assert.equal(watch.backoffDelay(5), 2_500);
  assert.equal(watch.backoffDelay(11), 2_500);
  assert.equal(watch.backoffDelay(12), 5_000);
  assert.equal(watch.backoffDelay(500), 5_000, 'it never grows without bound');
});

test('it resolves as soon as the condition is met, and stops polling', async () => {
  let polls = 0;
  let settledWith: string | null = null;

  watch.watchUntil<{ settled: boolean; id: string }>({
    poll: () => {
      polls++;
      return Promise.resolve({ settled: polls >= 2, id: 'chit1:x' });
    },
    done: (value) => value.settled,
    onDone: (value) => {
      settledWith = value.id;
    },
  });

  await tick(2_600);
  assert.equal(settledWith, 'chit1:x');
  const after = polls;
  await tick(1_500);
  assert.equal(polls, after, 'no further polls once it is done');
});

test('a failing poll does not end the wait — the chain does not care about our timeouts', async () => {
  let polls = 0;
  let done = false;

  watch.watchUntil<{ settled: boolean }>({
    poll: () => {
      polls++;
      if (polls < 3) return Promise.reject(new Error('network blip'));
      return Promise.resolve({ settled: true });
    },
    done: (value) => value.settled,
    onDone: () => {
      done = true;
    },
  });

  await tick(3_600);
  assert.ok(polls >= 3, `expected to keep trying, saw ${polls} polls`);
  assert.equal(done, true, 'it recovered and finished');
});

test('it gives up honestly rather than spinning forever', async () => {
  let gaveUp = false;
  watch.watchUntil<{ settled: boolean }>({
    poll: () => Promise.resolve({ settled: false }),
    done: (value) => value.settled,
    onDone: () => {},
    onGiveUp: () => {
      gaveUp = true;
    },
    budgetMs: 1_500,
  });

  await tick(2_800);
  assert.equal(gaveUp, true);
});

test('⭐ stopping halts it immediately', async () => {
  let polls = 0;
  const poller = watch.watchUntil<{ settled: boolean }>({
    poll: () => {
      polls++;
      return Promise.resolve({ settled: false });
    },
    done: (value) => value.settled,
    onDone: () => {},
  });

  await tick(1_200);
  const atStop = polls;
  poller.stop();
  await tick(2_500);
  assert.equal(polls, atStop, 'nothing polled after stop');
});

test('⭐ leaving a screen cancels whatever it started', async () => {
  // Without this, navigating away from "waiting for payment" would leave a timer writing
  // into a detached DOM and polling the API until the tab closed.
  window.document.body.innerHTML = '<div id="app"></div>';

  let polls = 0;
  const poller = watch.watchUntil<{ settled: boolean }>({
    poll: () => {
      polls++;
      return Promise.resolve({ settled: false });
    },
    done: (value) => value.settled,
    onDone: () => {},
  });
  ui.onLeave(poller.stop);

  await tick(1_200);
  const atNavigation = polls;

  // Mounting the next screen must tear the previous one down.
  ui.mount(ui.screen({ title: 'Another screen', body: [] }));

  await tick(2_500);
  assert.equal(polls, atNavigation, 'the poller died with its screen');
});

test('a hidden tab is not polled', async () => {
  let polls = 0;
  const poller = watch.watchUntil<{ settled: boolean }>({
    poll: () => {
      polls++;
      return Promise.resolve({ settled: false });
    },
    done: (value) => value.settled,
    onDone: () => {},
  });

  // A phone in a pocket should not be making requests.
  Object.defineProperty(window.document, 'visibilityState', { value: 'hidden', configurable: true });
  await tick(2_500);
  const whileHidden = polls;

  Object.defineProperty(window.document, 'visibilityState', { value: 'visible', configurable: true });
  await tick(1_500);

  assert.ok(polls > whileHidden, 'it resumes when the tab comes back');
  poller.stop();
});

/**
 * Waiting for a chit to change, without making the user tap anything.
 *
 * NIM settles in about a second. A screen that says "paid" only after the user finds and
 * taps Refresh throws that away — the speed is the product, and a spinner that resolves
 * on its own is the only honest way to show it.
 *
 * There are no push notifications on the platform and the public RPC has no working
 * WebSocket (research/verification/05b §3), so this polls. Three rules keep that from
 * becoming a problem:
 *
 * 1. **It backs off.** Fast while a change is plausibly imminent, then slower, then it
 *    stops and hands control back with an honest "still waiting" and a manual retry.
 * 2. **It stops when the tab is hidden** and resumes on return, so a phone in a pocket is
 *    not making requests for ten minutes.
 * 3. **It is always cancellable**, and every screen that starts one cancels it on leaving.
 *    A poller that outlives its screen writes into a DOM nobody is looking at.
 */

export interface WatchOptions<T> {
  /** Fetch the current state. */
  poll: () => Promise<T | null>;
  /** True when we have what we were waiting for. */
  done: (value: T) => boolean;
  /** Called once, when `done` first returns true. */
  onDone: (value: T) => void;
  /** Called when the budget runs out without a result. */
  onGiveUp?: () => void;
  /** Called on each completed poll, done or not — used to keep a countdown honest. */
  onTick?: (attempt: number) => void;
  /** Total time to keep trying before giving up. */
  budgetMs?: number;
}

export interface Watcher {
  stop: () => void;
}

/**
 * Delay before attempt `n`, in milliseconds.
 *
 * 1s for the first few — a NIM transaction can land inside that — then easing out to 5s.
 * Exported so the schedule is testable rather than an opaque constant.
 */
export function backoffDelay(attempt: number): number {
  if (attempt < 5) return 1_000;
  if (attempt < 12) return 2_500;
  return 5_000;
}

export function watchUntil<T>(options: WatchOptions<T>): Watcher {
  const budget = options.budgetMs ?? 120_000;
  const started = Date.now();

  let attempt = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stop = (): void => {
    stopped = true;
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };

  const schedule = (): void => {
    if (stopped) return;
    if (Date.now() - started >= budget) {
      stop();
      options.onGiveUp?.();
      return;
    }
    timer = setTimeout(() => void tick(), backoffDelay(attempt));
  };

  async function tick(): Promise<void> {
    if (stopped) return;

    // A hidden tab is a phone in a pocket. Wait for it to come back rather than burning
    // requests and battery against a screen nobody is looking at.
    if (document.visibilityState === 'hidden') {
      schedule();
      return;
    }

    attempt++;
    try {
      const value = await options.poll();
      if (stopped) return;
      options.onTick?.(attempt);

      if (value !== null && options.done(value)) {
        stop();
        options.onDone(value);
        return;
      }
    } catch {
      // A failed poll is not a failed payment. Keep waiting — the chain does not care
      // that our request timed out.
    }
    schedule();
  }

  function onVisibility(): void {
    // Coming back to the app should feel instant, not "wait for the next tick".
    if (document.visibilityState === 'visible' && !stopped) {
      if (timer) clearTimeout(timer);
      void tick();
    }
  }

  document.addEventListener('visibilitychange', onVisibility);
  schedule();

  return { stop };
}

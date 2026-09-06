/**
 * Boot and routing.
 *
 * Real paths rather than hashes, because the countersign and verify links are sent to
 * strangers and pasted into accountants' emails — `/v/<txhash>` reads like a receipt,
 * `#/v/<txhash>` reads like a bug.
 *
 * Every route is wrapped so a thrown error becomes a screen with words on it. A blank
 * white page is the single worst outcome for an app a judge may open at random
 * (SIP_AND_SHIP_C2_CALL2_FINDINGS.md §1), and it is what an unhandled rejection produces.
 */

import './styles.css';
import { aboutScreen, activityScreen, bountyBoardScreen, brokenScreen, chitScreen, composeScreen, notFoundScreen, profileScreen, verifyScreen } from './screens.ts';
import { initLanguage } from './i18n.ts';

/*
 * The host's language, loaded before the first screen is built.
 *
 * Awaited on purpose: each dictionary is its own chunk, so five languages are not shipped to
 * every user, and the cost of that is one round trip before the first paint. Rendering first
 * and translating after would flash English at exactly the people who need it least.
 */
const languageReady = initLanguage(new URLSearchParams(window.location.search).get('lang') ?? undefined);

// Stamp the host before anything renders, so safe-area rules apply to the first paint.
if (typeof window !== 'undefined' && (window as { nimiqPay?: unknown }).nimiqPay !== undefined) {
  document.documentElement.classList.add('in-nimiq-pay');
}

function navigate(path: string): void {
  if (path !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.pushState({}, '', path);
  }
  void languageReady.then(route);
}

function fatal(error: unknown): void {
  // Shown instead of a blank page. Deliberately plain: the user cannot fix a bug, so the
  // only useful thing is to say what happened and give them a way back.
  console.error('[chit]', error);
  brokenScreen(navigate, error instanceof Error ? error.message : null);
}

async function route(): Promise<void> {
  const path = window.location.pathname;

  try {
    const chitMatch = /^\/c\/(.+)$/.exec(path);
    if (chitMatch?.[1]) return await chitScreen(decodeURIComponent(chitMatch[1]), navigate);

    const activityMatch = /^\/a\/(.+)$/.exec(path);
    if (activityMatch?.[1]) return await activityScreen(decodeURIComponent(activityMatch[1]), navigate);

    const verifyMatch = /^\/v\/(.+)$/.exec(path);
    if (verifyMatch?.[1]) return await verifyScreen(decodeURIComponent(verifyMatch[1]), navigate);

    // The public record for one wallet. Its own path, not a tab inside Activity: this is the
    // link a freelancer sends to a stranger, and a link that lands on somebody's private
    // list of drafts and unpaid work would be the wrong page for that stranger to open.
    const profileMatch = /^\/p\/(.+)$/.exec(path);
    if (profileMatch?.[1]) return await profileScreen(decodeURIComponent(profileMatch[1]), navigate);

    if (path === '/bounty') return await bountyBoardScreen(navigate);
    if (path === '/about') return aboutScreen(navigate);

    if (path === '/' || path === '') return await composeScreen(navigate);

    return notFoundScreen(navigate);
  } catch (error) {
    fatal(error);
  }
}

window.addEventListener('popstate', () => void route());

// Nothing should reach the console unhandled; if it does, the user still gets a screen.
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  fatal(event.reason);
});
window.addEventListener('error', (event) => fatal(event.error ?? event.message));

// The first screen waits for the dictionary; every later navigation is already loaded.
void languageReady.then(route);

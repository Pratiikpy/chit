/**
 * Getting a stranger from a link into Nimiq Pay.
 *
 * A share link is the whole growth loop, and it used to end at a disabled button: a plain
 * https URL opens in the phone's browser, where there is no wallet, and the person is told
 * to "open this in Nimiq Pay" with no way to do so. These are the two official formats for
 * opening a Mini App inside Nimiq Pay (NIMIQ_DEV_DOCS_FULL_REFERENCE.md §9, verbatim):
 *
 *     nimiqpay://miniapp?url=your-app.com
 *     https://nimpay.app/miniapps/open/your-app.com
 *
 * The documented example is a bare host. Whether a full path and query survive the round
 * trip is NOT VERIFIED on a device; both forms are generated with the full chit URL so that
 * if they do, the person lands on the exact chit, and if they do not, they land in the app
 * with the link still on their clipboard. The https form is the one to put in a message —
 * it degrades to a web page on a desktop instead of an unknown scheme.
 *
 * The docs also say: an app not yet in the Nimiq Pay list, or never opened before, gets a
 * warning on first open. That is real first-tap friction and the copy around these links
 * must not pretend otherwise.
 */

/** Opens the app directly when Nimiq Pay is installed. Unknown scheme otherwise. */
export function nimiqPayDeepLink(url: string): string {
  return `nimiqpay://miniapp?url=${encodeURIComponent(url)}`;
}

/** The web form: opens in Nimiq Pay when installed, a page otherwise. Safe in any message. */
export function nimpayOpenLink(url: string): string {
  return `https://nimpay.app/miniapps/open/${url}`;
}

/** Where to get the wallet. Nimiq Pay is on both stores; the site routes by platform. */
export const NIMIQ_PAY_SITE = 'https://nimpay.app';

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isPhone(): boolean {
  return isAndroid() || isIOS();
}

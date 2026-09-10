/**
 * A real PDF, generated on the device.
 *
 * `window.print()` — chit's only existing "Print / save as PDF" path — does not work inside
 * an embedded mobile WebView. This is not a guess: it is a tracked Chromium defect
 * (issue 40342444, "enable window.print for android webview") and a maintainer-confirmed
 * limitation of react-native-webview ("window.print() is just not supported by WebView for
 * Android"), with no evidence of iOS `WKWebView` support either — in both cases the *host
 * app* has to implement printing itself; a page inside someone else's WebView cannot. Nimiq
 * Pay's embedded WebView is the only way a real user ever opens chit, so the existing button
 * is very likely dead on every phone despite passing every desktop-Chromium test.
 *
 * So this draws the invoice as real PDF text — selectable and searchable, not a rasterised
 * screenshot, which matters for a document meant to sit in someone's tax records — and never
 * touches `window.print()`. jsPDF is loaded with a dynamic `import()` only when this function
 * runs: chit's whole bundle is deliberately small, and a library this size has no business
 * loading for every visitor who never asks for a PDF.
 *
 * The identity fields (name, address, tax id) are typed once into `localStorage` and the app
 * promises they are "never sent to chit". This keeps that promise: the PDF is composed and
 * turned into bytes entirely in the browser. Nothing is sent anywhere to render it.
 */

import type { ApiChit } from './api.ts';
import type { Identity } from './identity.ts';
import { t } from './i18n.ts';
import { moneyLocal } from './ui.ts';

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function shortAddress(address: string): string {
  const clean = address.replace(/\s/g, '');
  return clean.length <= 12 ? clean : `${clean.slice(0, 8)} … ${clean.slice(-6)}`;
}

/**
 * Build the PDF bytes. Exported separately from the save/share step below so a test can
 * assert on the document's structure without needing a browser's file-system or share sheet.
 */
export async function buildInvoicePdf(chit: ApiChit, identity: Identity, isWorker: boolean): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const left = 56;
  const right = 539;
  let y = 64;

  const line = (text: string, size: number, options: { bold?: boolean; gap?: number; x?: number; align?: 'left' | 'right' } = {}): void => {
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, options.x ?? left, y, options.align ? { align: options.align } : undefined);
    y += options.gap ?? size * 1.4;
  };

  // From: the freelancer's own details, typed once on this device.
  if (identity.name) line(identity.name, 12, { bold: true, gap: 16 });
  for (const part of [identity.address, identity.contact, identity.taxId]) {
    if (!part) continue;
    for (const row of part.split('\n')) if (row.trim()) line(row.trim(), 10, { gap: 13 });
  }

  // Invoice meta, right-aligned against the same top.
  let metaY = 64;
  const metaLine = (text: string, size: number, bold = false): void => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, right, metaY, { align: 'right' });
    metaY += size * 1.4;
  };
  metaLine(t('Invoice'), 14, true);
  if (chit.settledAt) metaLine(formatDate(chit.settledAt), 10);
  metaLine(chit.id, 8);

  y = Math.max(y, metaY) + 24;
  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 28;

  // The service: the line both parties signed, not a generic "services rendered".
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const wrapped = doc.splitTextToSize(chit.chit.text, right - left) as string[];
  for (const row of wrapped) line(row, 12, { gap: 17 });
  y += 8;

  // `moneyLocal`, not a division by 100: money never touches a float in this codebase (see
  // README, "Things that are true and easy to get wrong") and a PDF that ends up in someone's
  // tax records is not the place to be the first exception.
  const amount = moneyLocal(chit.chit.amountMinor, chit.chit.currency);
  line(amount, 22, { bold: true, gap: 30 });

  const taxNote = identity.taxNote?.trim();
  if (taxNote) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const taxLines = doc.splitTextToSize(taxNote, right - left) as string[];
    for (const row of taxLines) line(row, 9, { gap: 12 });
    y += 6;
  }

  doc.setDrawColor(200);
  doc.line(left, y, right, y);
  y += 26;

  const paidBy = chit.chit.kind === 'quote' ? chit.settledFrom : chit.chit.payer;
  const paidTo = chit.payTo;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (paidBy) line(`${t('Paid by')}: ${shortAddress(paidBy)}`, 10, { gap: 15 });
  if (paidTo) line(`${t('Paid to')}: ${shortAddress(paidTo)}`, 10, { gap: 15 });
  if (chit.settledTx) line(`${t('Transaction')}: ${chit.settledTx}`, 9, { gap: 15 });
  line(`${t('Reference')}: ${chit.id}`, 9, { gap: 20 });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120);
  line(
    isWorker
      ? t('Settled in NIM on the Nimiq blockchain. Anyone can verify this transaction against the reference above, with no account.')
      : t('Settled in NIM on the Nimiq blockchain. This document was generated on your device; chit never saw the details above the line.'),
    8,
    { gap: 11 },
  );

  return doc.output('blob') as Blob;
}

export type SaveOutcome = { ok: true; via: 'share' | 'navigate' } | { ok: false; error: string };

/**
 * `blob.arrayBuffer()` + `btoa`, not `FileReader` — both are standard in every WebView this
 * needs to run in, but `FileReader` is not a Node global, which is what caught this: the
 * test proving this function's own output decodes correctly could not run against it.
 * Built a byte at a time rather than `String.fromCharCode(...bytes)`, since spreading a
 * large typed array into function arguments has its own stack limit; a PDF this size will
 * never approach it, but the loop costs nothing and never needs revisiting if one someday did.
 *
 * Exported only so a test can prove the encoding round-trips; not used outside this module.
 */
export async function blobToDataUri(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

/**
 * Get the generated PDF onto the user's device.
 *
 * `<a download>` is deliberately not used: the same object-store lesson that put the CSV
 * export behind a plain URL applies here too — a script-triggered file download is not
 * reliably honoured inside a WebView. The Web Share API's file support is the one path
 * built for exactly this (a native app handing a generated file to the OS's own share
 * sheet), so it is tried first — and where the host has not bridged it, `navigator.share`
 * is not a function that exists and fails, it is simply `undefined`, so this check falls
 * through immediately rather than wasting a call.
 *
 * The fallback is a same-window navigation to a base64 `data:` URI, not `window.open` on a
 * `blob:` URL — the first version of this file used exactly that, and both halves of it are
 * documented WebView failures: `window.open` silently does nothing unless the host app
 * implements new-window creation (`WebChromeClient.onCreateWindow` on Android,
 * `WKUIDelegate.createWebViewWith` on iOS) — the same "needs a host bridge" shape as
 * `window.print()` — and a `blob:` URL cannot be resolved inside Android's WebView at all,
 * since it is scoped to the browser process that created it and an embedded WebView is not
 * that process. Plain navigation and a self-contained `data:` URI need neither.
 */
export async function saveInvoicePdf(chit: ApiChit, identity: Identity, isWorker: boolean): Promise<SaveOutcome> {
  let blob: Blob;
  try {
    blob = await buildInvoicePdf(chit, identity, isWorker);
  } catch {
    return { ok: false, error: t('Could not build the PDF. Nothing was sent anywhere — try again.') };
  }

  const filename = `chit-invoice-${chit.id.replace(/^chit1:/, '').slice(0, 12)}.pdf`;
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files: File[]; title?: string }) => Promise<void> };
  if (typeof nav.canShare === 'function' && typeof nav.share === 'function') {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: t('Invoice') });
        return { ok: true, via: 'share' };
      }
    } catch (error) {
      // A user-cancelled share is not a failure — it looks the same as any other abort from
      // here, so it falls through to the tab fallback rather than being reported as broken.
      if (error instanceof Error && error.name === 'AbortError') return { ok: true, via: 'share' };
    }
  }

  try {
    window.location.href = await blobToDataUri(blob);
    return { ok: true, via: 'navigate' };
  } catch {
    return { ok: false, error: t('Could not open the PDF. Nothing was sent anywhere — try again.') };
  }
}

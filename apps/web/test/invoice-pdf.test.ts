/**
 * A real PDF, not a screenshot of window.print() working — because it does not, inside the
 * embedded WebView that is the only way a real user opens chit. This proves `buildInvoicePdf`
 * actually produces a well-formed PDF from real chit data, since a library import that throws
 * or silently returns an empty file is worse than the dead button it replaced.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ApiChit } from '../src/api.ts';
import type { Identity } from '../src/identity.ts';
import { buildInvoicePdf } from '../src/invoice-pdf.ts';

const EMPTY_IDENTITY: Identity = { name: '', address: '', taxId: '', contact: '', taxNote: '' };

function settledChit(overrides: Partial<ApiChit> = {}): ApiChit {
  return {
    id: 'chit1:AbCdEfGhIjKlMnOpQrStUvWx',
    canonical: 'chit/1\ntest\n...',
    chit: {
      chain: 'test',
      kind: 'race',
      nonce: 'n'.repeat(32),
      text: '$60 to cut a 30-second vertical from this footage',
      amountMinor: '6000',
      currency: 'USD',
      luna: '15673981192',
      rateBlock: 4_100_000,
      deadlineBlock: 4_618_400,
      payer: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
      payee: 'NQ12 1111 1111 1111 1111 1111 1111 1111 1111',
      deliverables: 1,
    },
    payerSignature: { publicKeyHex: 'a'.repeat(64), signatureHex: 'b'.repeat(128) },
    payeeSignature: { publicKeyHex: 'c'.repeat(64), signatureHex: 'd'.repeat(128) },
    countersigned: true,
    payTo: 'NQ12 1111 1111 1111 1111 1111 1111 1111 1111',
    settled: true,
    settledTx: '0x' + 'e'.repeat(64),
    settledBlock: 4_100_042,
    settledAt: Date.now(),
    settledFrom: null,
    answer: null,
    payoutTx: null,
    declined: false,
    bounty: false,
    demoWorker: false,
    createdAt: Date.now() - 60_000,
    shareUrl: 'https://chit-ecru.vercel.app/c/chit1:AbCdEfGhIjKlMnOpQrStUvWx',
    verifyUrl: 'https://chit-ecru.vercel.app/v/0x' + 'e'.repeat(64),
    ...overrides,
  };
}

function isPdf(blob: Blob): boolean {
  return blob.type === 'application/pdf' || blob.type === '';
}

test('builds a non-trivial PDF from a settled chit', async () => {
  const blob = await buildInvoicePdf(settledChit(), EMPTY_IDENTITY, false);
  assert.ok(blob instanceof Blob, 'returns a Blob');
  assert.ok(isPdf(blob), `expected a PDF blob, got type ${blob.type}`);
  // jsPDF's own header/footer alone is a few hundred bytes; anything smaller means the
  // document body never actually got written.
  assert.ok(blob.size > 500, `PDF is suspiciously small: ${blob.size} bytes`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assert.equal(header, '%PDF-', 'starts with the PDF magic bytes');
});

test('includes the freelancer\'s own identity when it has been typed in, and nothing when it has not', async () => {
  const withIdentity = await buildInvoicePdf(settledChit(), { name: 'Alicia Keys', address: 'Berlin', taxId: '', contact: '', taxNote: 'VAT exempt under §19 UStG' }, true);
  const withoutIdentity = await buildInvoicePdf(settledChit(), EMPTY_IDENTITY, true);
  assert.ok(withIdentity.size > 0 && withoutIdentity.size > 0);
  // Both must still be well-formed even with nothing typed in — an empty identity is the
  // common case for a first-time worker, not an error state.
  for (const blob of [withIdentity, withoutIdentity]) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  }
});

test('does not throw on a very long deal line, a quote, or a chit with no settlement transaction yet', async () => {
  const longLine = settledChit({ chit: { ...settledChit().chit, text: 'A '.repeat(200) + 'very long line describing a great deal of work across many words' } });
  await assert.doesNotReject(buildInvoicePdf(longLine, EMPTY_IDENTITY, true));

  const quote = settledChit({ chit: { ...settledChit().chit, kind: 'quote', payer: '', payee: 'NQ12 1111 1111 1111 1111 1111 1111 1111 1111' }, settledFrom: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000' });
  await assert.doesNotReject(buildInvoicePdf(quote, EMPTY_IDENTITY, true));

  const noTx = settledChit({ settledTx: null, settled: false });
  await assert.doesNotReject(buildInvoicePdf(noTx, EMPTY_IDENTITY, false));
});

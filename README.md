# chit

**Paste the deal you already agreed. Both sign it. The payment carries the proof.**

**Live: https://chit-ecru.vercel.app**

A Nimiq Mini App for freelancers. You agreed something in a Fiverr message, a Discord DM,
a WhatsApp thread — chit turns that one line into a signed agreement, settles it in NIM,
and leaves a receipt anyone can check without an account and without us.

---

## Why this exists

The loudest complaints in ~600 one-star reviews of Fiverr, Upwork and Freelancer.com are
not about features. They are about money and access: paying to apply, being locked out of
money you already earned, and withdrawal fees eating a small balance.

chit answers those structurally rather than with a policy page:

- **Attempting anything is free.** No credits, no membership, no fee to participate.
- **We never hold the money.** It goes wallet to wallet. There is nothing to freeze, and
  withdrawal does not exist as a concept.
- **There is no login.** No email, no password, no verification code. The wallet is the
  identity.
- **0% commission** on the work — and that is not marketing. A platform that routes a fee
  through an address it controls has a different regulatory position, so keeping revenue
  off the payment path is load-bearing.

The receipt is the contract. `paying is accepting`, atomically: the settling transaction
carries the agreement's digest, so a buyer cannot accept work without the money existing,
and cannot later deny having accepted work they demonstrably paid for.

---

## How it works

```
paste the line  →  check what we understood  →  sign  →  send the link
                                                            ↓
        receipt  ←  payment settles on chain  ←  pay  ←  they countersign
```

**It works in both directions, and the freelancer's is the default.** "I'm getting paid"
makes a *quote*: the worker signs the scope alone, puts the link where the client is, and
whoever pays it first is the client — paying is accepting, there is no countersign step,
and the payer is recorded from the transaction rather than a form. "I'm paying" makes an
open chit the worker countersigns.

**Nobody types an address.** On an open chit the countersignature supplies the worker's
address, derived from the key that signed; on a quote the payment supplies the client's.
Nobody copies an address between apps, and nobody can redirect the payment.

**The record is computed, never written.** Before a worker signs they see the payer's
history — chits paid, how fast, how many signed and left unpaid past the deadline — and a
new wallet reads as new, with the amount attached, never as bad. A worker's page shows what
was paid to them, from how many distinct payers, and *kept*: what a 20% marketplace cut
would have been, always with that literal caption. Every number derives from settled
payments and can be recomputed from the transaction hashes.

**Settlement is observed, never asserted.** A watcher matches the chit's digest *and* the
recipient *and* a floor of 97% of the signed amount against the chain — a memo alone
settles nothing, and a 1-Luna payment carrying the digest is recorded as a mismatch, not a
payment. The client is the party with an interest in claiming a
payment happened, so the client is not asked.

---

## Try it

```bash
npm install

# The API. CHIT_CHAIN is required and has no default — see "the chain trap" below.
CHIT_CHAIN=main npm run start -w @chit/api

# The app. Open the printed LAN address on your phone inside Nimiq Pay.
npm run dev -w @chit/web
```

On a desktop browser there is no wallet, so add `?demo=1` to see the flow with a mock
signer. Demo signatures are structurally valid and cryptographically meaningless — they
will not verify, and the app says so.

Drive the whole flow as two people in two browsers with real keys (screens are written to
`shots/`, and every one is asserted to fit a 390px phone):

```bash
node --experimental-strip-types scripts/user-journey.mjs
```

Drive the whole flow over HTTP against a running server:

```bash
node --experimental-strip-types scripts/live-e2e.mjs http://localhost:8787
```

---

## The bounty

The first card on the home screen is a real chit that chit itself posts and pays: *"Test chit.
Tell us one thing that confused you, in one sentence."* A tester countersigns it with their
answer and the pool pays ~$0.50 in NIM to the wallet they signed with, digest in the memo —
so a person with an empty wallet earns their first NIM by doing the product's core flow once.
It is the organiser's own request for this cycle ("earn NIM by testing Mini Apps"), built as
the app's front door rather than as a faucet, and these are the rules that keep it one:

- **Real work, checked by a machine, no chance anywhere.** An answer must be at least four
  words, carry no links, and be *new* — its character trigrams are compared with every prior
  answer and anything too similar is refused. Order of arrival decides only who got there
  first.
- **Hard limits.** One payout per device per day (Nimiq Pay's device identifier, stable across
  reinstalls), one per wallet per day, and a daily NIM ceiling the key cannot exceed.
- **Everything public.** The pool address, its live balance, every payout with its transaction
  and the line that earned it, and these rules are at `/bounty`.
- **Nothing offered that cannot be paid.** When the pool's balance is below one payout, the
  card says so and no claim is accepted.

**chit pays its own bounty. It never holds anyone else's money.** The pool is a founder-funded
key; a payment is built and signed in Node and broadcast through the public RPC (proven in
`scripts/payout-probe.mjs`). A labelled *demo worker* key exists for the same reason: so one
person — a judge — can create a chit, have it countersigned, pay it and hold a real receipt.

## Where it runs

chit runs in two shapes behind one storage interface, and the routes cannot tell which:

| | Self-hosted | Serverless (the live deployment) |
|---|---|---|
| Storage | SQLite on disk | object store, keyed by digest |
| Settlement | a watcher loop sweeps open chits | confirmed while answering a read of that chit |
| Atomicity | conditional `UPDATE`, genuinely atomic | read-then-write, guarded (see below) |

The serverless settlement check is not a downgrade: during the moment that matters — the
payer has just paid and both screens are polling — it runs every couple of seconds, which
is tighter than any sweep. When nobody is looking, nothing needs to be known.

Both back-ends are held to **one contract**, run as one suite against each
(`apps/api/test/repository.test.ts`), and the object-store half runs against the real
store over the network rather than a fake. That suite immediately paid for itself: it
caught that a freelancer's activity list matched only `payer`/`payee`, so it never showed
the work they had actually countersigned.

## Layout

| Package | What it is |
|---|---|
| `packages/core` | The frozen foundation. Canonical form, digest, signature normaliser, terms parser, wallet tiers. No dependency on a browser, a server or a wallet. |
| `packages/verify` | Real Ed25519 verification and address derivation. Separate because it pulls in a WASM bundle that has no business in a phone. |
| `apps/api` | Chit lifecycle, SQLite storage, settlement watcher, rate quotes, abuse controls. |
| `apps/web` | Seven screens. No framework — **18 kB of JavaScript, gzipped.** |

```bash
npm test          # every suite
npm run typecheck # every package, strict
npm run build     # production bundle
```

---

## Things that are true and easy to get wrong

Each of these cost real time to establish. They are written down so nobody has to find
them twice.

**The chain trap.** Nimiq's `sign()` has no domain separation and no expiry, so a
signature made on testnet verifies byte-for-byte on mainnet. The chain and a nonce are
therefore *inside* the signed bytes, and the service refuses to start with `CHIT_CHAIN=test`
against the default mainnet RPC — a mistake that produced a deadline on the wrong chain
the first time the server was run.

**The byte-length trap.** The signed digest is
`SHA-256("\x16Nimiq Signed Message:\n" ‖ decimal(byteLength) ‖ message)`. That length is
the UTF-8 **byte** length. The Hub's own published snippet uses `message.length` — UTF-16
code units — which is silently correct for ASCII and wrong for `café`, `€40` or any emoji.

**`sign()` frames differently by host.** The SDK forwards it to native code nobody outside
Nimiq has read. Two of the strongest apps in the ecosystem shipped normalisers
independently, so chit normalises hex, base64, base64url, `Uint8Array`, `number[]` and
numeric-keyed objects — using byte length to disambiguate rather than guessing.

**`sign()` and `listAccounts()` resolve with an error object**, they do not only reject.
The docs say the error is thrown. Both paths happen, so both are handled.

**The memo field is 64 bytes**, verified empirically at 64 accepted / 65 `Overflow`. A
`chit1:` tag plus a base64url SHA-256 is 49 bytes. Hex would not have fitted.

**The memo arrives under two different names** — `recipientData` over JSON-RPC and
`data.raw` via the web client. Normalise both, or settlement silently never fires for one
of the two sources.

**Money never touches a float.** Amounts are integer minor units end to end, stored as
TEXT because JavaScript would lose precision reading a large SQLite INTEGER back. Fiat is
converted to Luna in scaled integer arithmetic, rounding **up**, so a chit is never a Luna
short of what was agreed.

**`@nimiq/utils` defaults to a price provider that now requires an API key.** chit uses
CoinGecko, so a fresh deployment needs no credential to obtain, lose or leak.

---

## Things an object store will not do for you

Measured against the real service, not assumed:

- **A write is not immediately readable.** A read straight after a create can come back
  empty and succeed a moment later. Every path that expects a chit to exist retries
  briefly; `create`'s existence check deliberately does not, because there a miss is the
  normal case.
- **Nor is an overwrite.** A read after an update can return the previous body — which
  showed up as a settled chit whose history was missing its `settled` event. Records carry
  a monotonic revision, and a locally-held copy is used **only when strictly newer** than
  what the store returns, so it can accelerate a stale read but never serve a stale one.
- **Listings lag further still**, so nothing on the critical path uses one. `get`,
  `countersign`, `markSettled` and `byTransaction` are all keyed direct reads.
- **`put` renames your file by default.** `addRandomSuffix` is on unless disabled, so
  `put('chits/<id>.json')` lands at `chits/<id>-a8f3kd.json` and the read finds nothing.
  Every pathname here is a deterministic key, so it is off.
- **Two writers still race.** There is no compare-and-swap, so a second countersignature
  arriving inside the read-then-write window could overwrite the first. SQLite does this
  atomically; the self-hosted deployment therefore remains the reference one.

**The wallet is never asked for anything before a tap.** Detection is silent through the
SDK's `init()`; the address is requested when the user taps Sign or Pay; a declined dialog
leaves the button exactly as it was; every provider call is bounded in time; and a wallet
on the wrong network is told so before it signs.

**chit can pay.** A basic transaction with a 49-byte memo was built and signed in Node with
`@nimiq/core` — no consensus, no light client — and broadcast through the public RPC's
`sendRawTransaction`, which accepted it (`scripts/payout-probe.mjs`). That is the whole
path a server-paid flow needs; the last inch, a funded key seeing its transaction mined, is
listed below.

## What is not proven

Honest limits, all of which need a physical device:

- **That a funded key's broadcast is mined.** The probe's unfunded transaction was accepted
  by the node and, having no balance, never mined. Everything chit controls is proven; the
  final confirmation needs a few NIM on a throwaway key.
- **The explorer link format.** Receipts link `nimiq.watch/#<hash>`; the fragment form is
  not verified for Albatross hashes and lives in one function.
- **That Nimiq Pay frames `sign()` the way the four reference implementations do.** The
  scheme is verified against `core-rs-albatross`, the Keyguard, the Hub client and
  `php-utils`; the Nimiq Pay binary itself is closed source and was not read.
- **What `sendBasicTransactionWithData` returns.** Documented as "the serialized
  transaction", not a hash. Nothing in chit treats it as an identifier — settlement is
  confirmed by the watcher matching the memo, which works regardless.
- **The Android file picker and camera**, which are host-gated and needed for door two.
- **Arc mainnet**, for the escrowed tier above the race ceiling. Every reference found was
  testnet, so the word "escrow" does not appear anywhere in the product yet.

The in-memory rate limiter is per-process: it resets on deploy and does not span replicas.
On more than one instance it must move to shared storage or the effective limit multiplies
by the replica count.

---

## Licence

MIT. See `LICENSE`.

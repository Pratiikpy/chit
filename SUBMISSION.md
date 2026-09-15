# chit — Cycle 2 submission

What goes into the submission form at miniappscompetition.com/submit, field by field, so the
form is a five-minute copy-paste rather than a blank page under deadline pressure. The form
generates a PR to `nimiq/miniappscompetition-submissions` with a `submission.yaml` — the exact
schema below was read from a real merged one (`cycle2/xcoder2088`, PR #94).

Every fact here is measured from this repository or the live deployment as of **2026-09-15**.
Nothing below is aspirational — a claim that is not yet true is called out in **What's not
covered** at the bottom instead of quietly rounded up.

---

## The fields, ready to paste

**app_name**
> chit

**category**
> Productivity

**tagline** (their own scored question: *"Does the Mini App look professional and trustworthy
at first glance?"* — so it's the app's own first line, not invented copy)
> Paste the deal you already agreed. Both sign it. The payment carries the proof.

**description**
> You agreed something in a Discord DM, a WhatsApp thread, a Fiverr message. chit turns that
> one line into a signed agreement, settles it in NIM in about a second, and leaves a receipt
> anyone can check — with no account, and without chit. Money attached means "I need this
> done"; empty hands means "I can do this." Everyone whose work was good gets paid, not just
> one winner, and chit never holds the money — there is no balance and no withdrawal to trust
> it with.

**pricing**
> Free

**repo_url**
> https://github.com/Pratiikpy/chit

**demo_url**
> https://chit-ecru.vercel.app

**Supporting material** (not a form field, but worth having on hand)
> - Proof deck, every real screen from a real run: https://chit-ecru.vercel.app/proof.html
> - Full product + proof write-up (Notion, public): https://comfortable-goal-205.notion.site/chit-Product-Proof-Nimiq-Cycle-2-3dc9c0ce787681d587d2e98cddd19d98

**video_url**
> _Not yet — see "What's not covered" below. The file is ready; it needs uploading to YouTube
> first, which needs your account, not mine._

**contact_email**
> prtk8899@gmail.com — **confirm this is the address you want public in the submissions repo**
> before it goes in; it's the only address I have on file for you, not one I've verified you
> want listed.

**team_name** — optional, null unless you want one on record
**team_members** — optional, null for a solo submission
**x_account** — optional, null unless you want a handle credited

**builder_story** (their own ask: *"the why, not the feature list"* — Call #2 [32:43])
> Every freelance platform's worst reviews are the same complaint in different words: locked
> out of an account holding money you earned, a 20% cut, a two-week wait to withdraw, support
> that never answers. None of that is a policy problem — it's what happens when a platform
> holds your money and your identity at the same time. chit doesn't hold either. There's no
> account to be locked out of and no balance to freeze, so the failure modes the whole industry
> apologizes for don't exist here to apologize for. What's left is the smallest possible
> object: one line of text, signed by both sides, paid in NIM the moment it's signed. Building
> it against Nimiq Pay specifically meant the "instant, feeless, works for an empty wallet"
> claim had to be literally true before it could be a selling point — a $3 tip and a $200
> invoice go through the exact same five taps.

**icon**
> `apps/web/public/icon-512.png` (already built)

**thumbnail**
> `apps/web/public/og.png` (already built, 1200×630) — or a frame from the new 4K demo; your
> call on which reads better as a listing card.

**screenshots** (5, picking the ones that carry the most distinct claims rather than 5 similar
compose screens)
> 1. `docs/screens/22-home-with-bounty.png` — first impression, the pitch in one screen
> 2. `docs/screens/06-countersign-dark.png` — the worker's side, dark mode, mobile-native
> 3. `docs/screens/10-paid-worker-dark.png` — settled on chain, the receipt
> 4. A board screenshot showing real open listings (grab a fresh one from `shots/journey/` —
>    the board is the "does this make Nimiq Pay more useful to new users" proof)
> 5. A public profile screenshot with reputation + a showcased piece (same source)

**github_login**
> Whatever account opens the PR — confirm which one before submitting, since prizes go to
> **the submitting GitHub account** (their rule, not a formality).

---

## What's not covered — said plainly, not rounded up

- **No `video_url` yet.** The 4K master (`shots/demo-video/chit-demo-4k.mp4`, 84s, real
  scripted walkthrough — sign, pay, settle on chain, decline, revision, counter-offer,
  reputation, showcase, board, bounty, dark mode, Spanish) exists locally and is finished.
  Uploading it to YouTube needs your account — that's the one step that's genuinely yours,
  not mine, to do. Everything after ("here's the link") I can do.
- **The bounty pool is unfunded.** Chit's own first-screen pitch ("take the bounty on the
  first screen... it's how a person with an empty wallet gets their first NIM") only works
  once real NIM sits in `NQ82 BQM6 9PKL LFGP BAVH GL81 Y0F7 3MQS S5MS`. Unfunded, that screen
  correctly says so and offers nothing rather than failing — but a judge who takes step 2 of
  the README's own "sixty seconds" path gets told there's nothing to claim. This needs your
  wallet and your money; I've said this before and I'm not asking again, just keeping it
  honest here since it directly affects what a judge sees on the very first path the README
  tells them to take.
- **No real third-party usage yet.** Criterion #16 (unique distinct wallets during the
  scoring period) and #17 (promotion beyond submitting) are both at zero — this is the
  "post in two places, get real users" step from their own playbook (Call #2 [21:06],
  [23:42]), not something a build session can manufacture honestly.
- **`nimpay.app/miniapps/open/chit-ecru.vercel.app`-style deep links are unregistered** — see
  the next section. Not required for judging, but worth knowing before assuming a shared link
  "just opens" in Nimiq Pay from a cold link.
- **No independent human tester.** Every flow above is verified by script (402/403 unit
  tests, 259/259 end-to-end checks, 31/31 against the live production deployment) and by me
  reading real screenshots critically. Nobody who has never seen chit before has opened it
  cold on their own phone and been watched doing it. That's the one class of bug this
  process cannot catch on its own.

---

## "Do we need to add the app somewhere?" — the actual answer

**No separate app-store listing or manifest is required to be judged.** The official
checklist (`NIMIQ_OFFICIAL_COMPETITION_SITE_REFERENCE.md` §14) is exactly six things, and
chit already has all six: a working Mini App, built on the Nimiq Pay Mini Apps Framework, a
public GitHub repo under MIT, a live testable demo, a Nimiq wallet for payouts, and NIM
support. Judges open the live URL directly (in a browser or by pasting it into Nimiq Pay's
own "Discover → enter App URL" field) — that route works today, confirmed live.

**One optional registration exists and chit isn't in it**, found by a sibling team's own
testing on a different Cycle 2 app: `https://nimpay.app/miniapps/open/<host>` is a redirector
for Mini Apps that have been registered with Nimiq as a named host, and it 404s
("Unknown mini app host") for anything that hasn't been. This only matters for a *shared
deep link* of that specific shape working as a cold-open — the submission form's `demo_url`
field and the wallet's manual URL entry are unaffected. If you want that link shape to work
too, that's a request to Nimiq (there's no self-serve registration in the docs reviewed), not
something in this repo's control. Not blocking; worth knowing.

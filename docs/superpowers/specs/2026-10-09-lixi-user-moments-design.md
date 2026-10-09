# Lixi user moments: a fast first look, real progress, the opening, the sender's news

**Design spec · 2026-10-09 · Status: approved in chat, pending written-spec review**

**Parent specs:** `docs/superpowers/specs/2026-10-02-lixi-frontend-design.md` (claim moments §6.4, dashboard §6.5, motion §7) and `docs/superpowers/specs/2026-10-07-lixi-ux-polish-design.md`. This spec changes the app only. The contract, the SDK, the colours and the meaning of a light's state stay as they are.

---

## 1. Why

This round makes Lixi better for the people who use it: a sender handing out lì xì, and a recipient who gets a link in a chat app. The Wave 2 demo video is recorded afterwards and shows these changes, but it is a by-product, not the goal. Target: merged by 2026-10-14 (Wave 2 is due 2026-10-17).

A walk through the live site on 2026-10-09 (Playwright, desktop 1280 px and phone 375–390 px, no wallet), plus a read of the code, found six gaps:

1. **A blank first look.** Every page, the home page and claim links included, waits for ~4.8 MB of compressed WASM before it shows anything but "Lighting the lanterns…". Measured with an empty cache: 1.3 s on a fast line, **5.0 s on 10 Mbps 4G**, **14.8 s on 3 Mbps**. A recipient tapping a link sees a dark, empty page.
2. **A bare link in chat.** `app/index.html` has no description and no OpenGraph tags, so a link pasted into Zalo, Messenger or Telegram shows as a bare URL, with no hint that it is a gift.
3. **Copying only the URL.** The Share page copies bare links, so the sender types a greeting around every one.
4. **The 30-second wait.** Seal, Open and Bring home show a static line and a fake progress bar. People cannot tell whether the app is working or stuck, and leave or retry.
5. **The opening.** The amount sits under the envelope, the slip that rises out of it is blank, and the explorer link is small. Nothing tells the recipient what stayed private, which is the reason to use Lixi at all.
6. **The sender's news.** When a recipient opens a lì xì, the sender's dashboard light goes out on the next refresh, and nothing calls attention to it.

The largest gap stays out of scope: recipients on phones (desktop only today; Wave 3 roadmap).

## 2. Decisions (brainstorm, 2026-10-09)

| Question | Choice |
|---|---|
| Goal of this round | A better product for real senders and recipients; the video follows from it |
| Scope | D (a fast first look), E (link previews), F (copy with a greeting), A (real progress), B (the opening and a privacy receipt), C (a toast for the sender) |
| Out of this round | G (naming who each link is for), phones, a fee sponsor |
| Where progress comes from | The app's own providers in `walletChain`. No SDK change |
| Motion rule | Unchanged: nothing loops except the in-flight pulse; reduced motion shows end states |

## 3. Changes

### 3.1 A fast first look (D)

**Goal.** With an empty cache on 10 Mbps 4G, the home page's hero and the claim page's sealed envelope are on screen within 1.5 s (5.0 s today). The WASM still loads, but behind a page the user can already read.

**The shell loads no WASM.** These modules make up the shell: `main.tsx`, `App.tsx`, `Layout`, `Header`, `Footer`, `WalletPanel`, `WalletPanelPresence`, `WalletContext`, `Home`, `NotFound`, `ui`, `Light`, `icons`, `Envelope`, and `lib/` `links`, `reveal`, `units`, `device`, `time`, plus `config`, `services`, `wallet/connector`, `wallet/errors`, `wallet/balances`. None of them may statically import `@lixi/sdk` (its index), `@lixi/contract`, or `chain/midnight.ts`. `@lixi/sdk/network` and type-only imports are fine. Two imports break this today:
- `lib/storage.ts` imports `@lixi/sdk`, and `WalletPanel` uses its `loadProver`/`saveProver`. Those two move to a new `lib/prefs.ts`.
- `WalletContext` imports `userAddressBytes` from `@lixi/sdk`. It is only used after connecting, which is already async, so it is loaded there with a dynamic `import('@lixi/sdk')`.

**Lazy chain.** In `main.tsx`, `services.reader` and `services.openChain` become thin wrappers that load `chain/midnight.ts` with a dynamic import the first time they are called, and reuse it afterwards. `Services` keeps its shape, so pages and tests do not change.

**Lazy pages.** `Create`, `Share`, `Claim` and `Dashboard` load with `React.lazy`. `Home` and `NotFound` stay in the shell. The `Suspense` fallback sits inside `Layout`, so the header and footer show at once:
- On `/c`: the claim page's "checking" look, a sealed `Envelope` and "Looking at the envelope…". The recipient sees the envelope straight away; it is the same view the page shows while it reads the chain.
- Elsewhere: `<Working>Lighting the lanterns…</Working>`.

**Preload.** Once the shell has rendered, it requests the chain module and the four page chunks when the browser is idle (`requestIdleCallback`, or after 1 s where it is missing), so a click on **Fill an envelope** rarely waits.

**Guard.** The Vite build writes its manifest (`build.manifest: true`). A new script, `app/scripts/check-entry.mjs`, runs after `vite build` as part of `npm run build -w @lixi/app`, so CI enforces it. It fails the build when the entry chunk's static imports, followed transitively, reach a `.wasm` file. The vite config comment that says splitting gains nothing is replaced.

**Unchanged.** The pre-JS fallback in `index.html` ("Lighting the lanterns…") stays. The CSP does not change: every chunk is same-origin.

**Risk.** The ledger WASM bindings use top-level await (spike S4). The plan's first task proves that `vite-plugin-wasm` still builds and runs them from a dynamically imported chunk, on the built site with the CSP, before any other D work.

### 3.2 Link previews (E)

**Tags.** `app/index.html` gets, in its `<head>`:
- `<meta name="description">`, `og:type` (`website`), `og:site_name` (`Lixi`), `og:title`, `og:description`, `og:image` with `og:image:width`, `og:image:height` and `og:image:alt`, and `twitter:card` (`summary_large_image`).
- Title: "Lixi: private red envelopes on Midnight". Description: "Red envelopes (lì xì) on Midnight. Open yours with a zero-knowledge proof: only its link knows whose."
- `og:image` must be an absolute URL. It is built from `VITE_SITE_URL` (default `https://lixi-3nv.pages.dev`) by a small Vite HTML transform, next to the existing CSP one.

**The image.** `app/public/og.png`, 1200 × 630, under 300 KB: the night background, one large lit red envelope, and "Every light is one lì xì." in Fraunces. It is rendered once from `app/og/og.html` by a Playwright script (`npm run og -w @lixi/app`), and the PNG is committed. The page itself never loads it.

**Privacy.** Every URL gets the same tags. A crawler never receives the fragment, so a preview says nothing about any envelope or lì xì.

### 3.3 Copy with a greeting (F)

**Greeting field.** At the top of the Share page, under the warning, a text field **Greeting**, default "Chúc mừng năm mới!", at most 120 characters. It is remembered in `localStorage` under `lixi.greeting`, as a per-browser convenience: every read and write sits in `try/catch`, and the page works without it.

**Per link.** Each row's main button becomes **Copy message**, and the existing **Copy link** stays beside it as a quiet button. The message is:

```
{greeting}
A lì xì for you on Lixi. Open it before {expiry}:
{url}
```

- `{expiry}` is the envelope's expiry in the sender's locale, with a short time-zone name, since the recipient may live elsewhere.
- The URL sits alone on the last line, so chat apps turn it into a link (and show the preview from §3.2).
- With an empty greeting, the first line is left out.

**Unchanged.** **Copy all N links** and the "a link is like cash" warning stay as they are.

### 3.4 Real transaction progress (A)

**Stages.** midnight-js runs every call as `proofProvider.proveTx` → `walletProvider.balanceTx` → `midnightProvider.submitTx` → `publicDataProvider.watchForTxData` (checked in `midnight-js-contracts/dist/index.mjs`, `submitTxCore` and `submitTx`). New type in `app/src/chain/port.ts`:

```ts
/** Where a transaction is (user moments spec §3.4). */
export type TxStage = 'proving' | 'confirm' | 'sending' | 'waiting';
export type OnStage = (stage: TxStage) => void;
```

- `LixiChain.create`, `claim` and `refund` each take an optional last argument `onStage?: OnStage`.
- `walletChain` (`app/src/chain/midnight.ts`) wraps its four providers so that each one reports its stage **when it starts**: `proveTx` → `proving`, `balanceTx` → `confirm`, `submitTx` → `sending`, `watchForTxData` → `waiting`. The listener for the current call is held in one variable that each method sets for its duration. Pages already allow only one transaction at a time.
- `rereadingAfter` (`WalletContext.tsx`) passes `onStage` through.
- The connected wallet in `WalletContext` also keeps the `prover` it was opened with, so pages can tell `TxProgress` where the proof is made.
- The flows pass it through as an optional last argument: `createEnvelope`, `claimWithLink` and `refundEnvelope`. A group claim that retries starts again from `proving`.
- The test `simChain` (`app/test/helpers.ts`) reports all four stages in order before it resolves, so page tests see them.

**`TxProgress` component** (`app/src/components/TxProgress.tsx`). Props: `stage: TxStage | undefined` and `prover: ProverChoice`. It lists four rows:

| Stage | Row text |
|---|---|
| `proving` | **Making the zero-knowledge proof**, with the sub-line "In 1AM" or "On this computer" from `prover` |
| `confirm` | **Confirm in 1AM.** Sub-line: "1AM pays the fee." |
| `sending` | **Sending to Midnight** |
| `waiting` | **Waiting for a block** |

- **Before the first stage** (`stage` undefined), the first row is the current one.
- **Row states.** A finished row shows a check mark. The current row shows a small pulsing dot (in flight) and a seconds counter for that row ("12 s"), which restarts at each stage. Later rows are dim.
- The list is `role="status"` with `aria-live="polite"`. Only the current row's label changes the live text; the per-second counter is `aria-hidden`.
- The check mark and dot are drawn in CSS, not with `Light`, so no light state takes on a new meaning.
- Reduced motion: the dot does not pulse; the counter still counts.

**Where it appears.**

| Page | Replaces | Heading kept above it |
|---|---|---|
| Claim, opening | the step line "Proving, then your wallet asks you to confirm." and the fake progress bar | "Opening your lì xì" and its sentence |
| Create, sealing | `<Working>Sealing your envelope. About 30 seconds; keep this tab open.</Working>` | a new line "Sealing your envelope. Keep this tab open." |
| Dashboard, bringing home | `<Working>Bringing it home…</Working>` in that row | none |

Errors are unchanged: a failure shows `friendlyError` as today, and the progress disappears.

### 3.5 The opening and the privacy receipt (B)

**The slip carries the amount.** In the opened state, `Envelope` gets the amount as its child, so it reads on the slip as it rises: the amount in `lantern-deep` Fraunces (large text; 3.92:1 on `paper`) with "tNIGHT" under it in `seal-ink` (13.18:1). `seal` on `paper` is only 1.31:1, so it is not used on the slip. The plan adds both pairs to `app/test/theme.test.ts`, the amount at the AA large-text bar (3:1). The amount must fit the slip's width (about 105 px) for up to 6 decimal places. The large amount heading under the envelope goes, and the greeting "An khang thịnh vượng" stays.

**Count-up.** The amount on the slip counts from 0 to the final value over 900 ms, with an ease-out curve, starting when the slip begins to rise. It keeps the final value's decimal places throughout, so the width does not jump (tabular figures). With reduced motion it shows the final value at once. The accessible label always holds the final amount ("An opened lì xì: 1.277978 tNIGHT").

**Apricot blossoms (hoa mai).** Twelve gold, five-petal blossoms (CSS shapes in `seal`, with a `seal-ink` centre; decoration, not lights) fall once from above the envelope across about 2.4 s, with staggered starts and slight sideways drift, then stay hidden. They are `aria-hidden` and `pointer-events: none`. With reduced motion they are not drawn. The page does not scroll horizontally on a 375-px phone.

**Privacy receipt.** Under the greeting, a two-column block (stacked on phones):

| The chain saw | It never saw |
|---|---|
| X tNIGHT paid to your wallet | which link you opened |
| that this envelope paid out once more | the secret inside your link |
| | what the other lì xì hold |
| | how many lì xì this envelope holds *(personal links only)* |

- The last "never saw" row is left out for group links: a group splits equally, so its first opening reveals the count (README, Limitations).
- Wording must stay consistent with the README's privacy model; the plan checks both.
- The receipt fades in after the count-up ends (300 ms); with reduced motion it is shown at once.

**Explorer.** The text link "View transaction" becomes a quiet button **See it on the explorer** (`txUrl(txHash)`, new tab). When `txHash` is empty (a group claim confirmed by reading the ledger), the button is left out, as today.

The existing line "It is in your wallet. The link's secret never touched the chain." goes, because the receipt says it. **Send lì xì of your own** stays.

### 3.6 The sender's news (C)

**When.** The Dashboard already re-reads the chain every `REFRESH_MS` (20 s) while visible. After each background read, it compares, per envelope in the vault, the set of opened shares (nullifier in the ledger) with the previous read. Newly opened shares make a toast. The first read after the page loads never makes one, and neither do refunds or envelopes that are new to the vault.

**What it says.** The sender's vault knows each share's amount.
- One share: "A lì xì was just opened: 1.277978 tNIGHT."
- Several in one read: "3 lì xì were just opened: 6.5 tNIGHT."
- Several envelopes changing in the same read make one toast each, newest envelope first.

**How it looks.** A small dark card at the bottom centre of the page, with a lit-to-out light beside the text (the same "opened" meaning). It is `role="status"` with `aria-live="polite"`. It goes away after 6 s or when its close button is pressed. At most three show at once; the oldest goes first. Reduced motion: it appears and disappears without sliding.

The light in that envelope's row still animates to `out` as the frontend spec §7 says.

## 4. Testing

- **Fast first look:** `check-entry.mjs` passes on the real build and fails on a fixture manifest whose entry reaches a `.wasm`. The page tests still pass through the lazy routes (they wait for the page, not the fallback). On `/c` the fallback shows the sealed envelope. Manual: the empty-cache Playwright timing from §1, at no throttle and at 10 Mbps, before and after; the target is 1.5 s at 10 Mbps for the home hero and the claim envelope.
- **Link previews:** `index.html` in the build has every tag from §3.2, with an absolute `og:image`; `og.png` exists and its PNG header says 1200 × 630.
- **Copy with a greeting:** the message for a personal and a group link; an empty greeting drops the first line; the greeting is remembered, and the page still works when `localStorage` throws.
- **Stages:** `walletChain` reports `proving`, `confirm`, `sending`, `waiting` in order for a call (in `wallet-chain.test.ts` with stub providers); a failing `balanceTx` stops after `confirm`.
- **TxProgress:** finished, current and dim rows for each stage; the prover sub-line; the live text names only the current stage.
- **Claim page:** the opening shows the four rows as the fake chain reports them; the opened state shows the final amount (reduced motion in jsdom); the receipt has the "how many" row for a personal link and not for a group link; the explorer button appears only with a hash.
- **Create and Dashboard:** sealing and bringing home show `TxProgress`.
- **Toast:** a background read that adds an opened share shows the right text; the first read, a refund and an unchanged read show none; it closes after 6 s (fake timers) and on its close button.
- **Gate:** `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, then a manual run of the built site with 1AM on Preprod: Seal, copy a message, Open from a second wallet while the sender's dashboard is open, and Bring home. Watch the stages, the opening, the receipt and the toast. Paste a link into one chat app and check the preview (after deploying to Cloudflare Pages).

## 5. Out of scope

- Phones and 1AM mobile, QR codes, a fee sponsor, shielded payouts (Wave 3 roadmap).
- Naming who each link is for (G).
- Sound.
- Any change to the contract, the SDK, the CSP or the colour tokens.

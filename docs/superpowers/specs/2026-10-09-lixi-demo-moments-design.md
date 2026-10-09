# Lixi demo moments: real progress, the opening, the sender's news

**Design spec · 2026-10-09 · Status: approved in chat, pending written-spec review**

**Parent specs:** `docs/superpowers/specs/2026-10-02-lixi-frontend-design.md` (claim moments §6.4, dashboard §6.5, motion §7) and `docs/superpowers/specs/2026-10-07-lixi-ux-polish-design.md`. This spec changes the app only. The contract, the SDK, the colours and the meaning of a light's state stay as they are.

---

## 1. Why

The Wave 2 demo video is recorded after this lands (due 2026-10-17; target: merged by 2026-10-14). Three moments in the recorded path are weak today:

1. **The 30-second wait.** Seal, Open and Bring home each show a static line and a fake progress bar. There is nothing to narrate while the zero-knowledge proof is made.
2. **The opening.** The amount sits under the envelope, the slip that rises out of it is blank, and the link to the explorer is a small text link. Nothing on screen says what stayed private.
3. **The sender.** When a recipient opens a lì xì, the sender's dashboard light goes out on the next refresh, but nothing calls attention to it. A split-screen shot loses the cause and effect.

## 2. Decisions (brainstorm, 2026-10-09)

| Question | Choice |
|---|---|
| Goal of this round | An impressive demo video; judges trying the site come second |
| Scope | A (real progress), B (the opening and a privacy receipt), C (a toast for the sender) |
| Where progress comes from | The app's own providers in `walletChain`. No SDK change |
| Motion rule | Unchanged: nothing loops except the in-flight pulse; reduced motion shows end states |

## 3. Changes

### 3.1 Real transaction progress (A)

**Stages.** midnight-js runs every call as `proofProvider.proveTx` → `walletProvider.balanceTx` → `midnightProvider.submitTx` → `publicDataProvider.watchForTxData` (checked in `midnight-js-contracts/dist/index.mjs`, `submitTxCore` and `submitTx`). New type in `app/src/chain/port.ts`:

```ts
/** Where a transaction is (demo moments spec §3.1). */
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

### 3.2 The opening and the privacy receipt (B)

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

### 3.3 The sender's news (C)

**When.** The Dashboard already re-reads the chain every `REFRESH_MS` (20 s) while visible. After each background read, it compares, per envelope in the vault, the set of opened shares (nullifier in the ledger) with the previous read. Newly opened shares make a toast. The first read after the page loads never makes one, and neither do refunds or envelopes that are new to the vault.

**What it says.** The sender's vault knows each share's amount.
- One share: "A lì xì was just opened: 1.277978 tNIGHT."
- Several in one read: "3 lì xì were just opened: 6.5 tNIGHT."
- Several envelopes changing in the same read make one toast each, newest envelope first.

**How it looks.** A small dark card at the bottom centre of the page, with a lit-to-out light beside the text (the same "opened" meaning). It is `role="status"` with `aria-live="polite"`. It goes away after 6 s or when its close button is pressed. At most three show at once; the oldest goes first. Reduced motion: it appears and disappears without sliding.

The light in that envelope's row still animates to `out` as the frontend spec §7 says.

## 4. Testing

- **Stages:** `walletChain` reports `proving`, `confirm`, `sending`, `waiting` in order for a call (in `wallet-chain.test.ts` with stub providers); a failing `balanceTx` stops after `confirm`.
- **TxProgress:** finished, current and dim rows for each stage; the prover sub-line; the live text names only the current stage.
- **Claim page:** the opening shows the four rows as the fake chain reports them; the opened state shows the final amount (reduced motion in jsdom); the receipt has the "how many" row for a personal link and not for a group link; the explorer button appears only with a hash.
- **Create and Dashboard:** sealing and bringing home show `TxProgress`.
- **Toast:** a background read that adds an opened share shows the right text; the first read, a refund and an unchanged read show none; it closes after 6 s (fake timers) and on its close button.
- **Gate:** `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, then a manual run of the built site with 1AM on Preprod: Seal, Open (second wallet) and Bring home, watching the stages and the toast in a split screen.

## 5. Out of scope

- Mobile and 1AM-mobile support, QR codes, a fee sponsor, shielded payouts (Wave 3 roadmap).
- Sound.
- Any change to the contract, the SDK, the CSP or the colour tokens.

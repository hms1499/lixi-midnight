# Lixi UX polish: 1AM only, first-time users first

**Design spec · 2026-10-07 · Status: approved in chat, pending written-spec review**

**Parent specs:** `docs/superpowers/specs/2026-09-30-lixi-design.md` (screens §4.5, errors §4.6, CSP §6) and `docs/superpowers/specs/2026-10-02-lixi-frontend-design.md` (look and motion). This spec changes the wallet support, some copy, and the flow on four pages. It changes nothing in the contract, the SDK, the colours or the motion.

---

## 1. Why

A UX audit on 2026-10-07 walked the built site (`vite preview`, desktop 1280 px and phone 375 px) as a first-time user. Once a wallet is connected, the main path works well: create, share, open and refund each read clearly. The gaps are all for people who arrive without a wallet. Those are most recipients, and the recipient's moment is the centre of the demo video.

The user also decided to drop Lace. It was unstable across every Preprod session:
- `connect()` hung;
- its Authorize button did nothing on 2026-10-06;
- its DUST view froze (lace#2256).

## 2. Decisions (brainstorm, 2026-10-07)

| Question | Choice |
|---|---|
| A phone opens a link | **Desktop only.** Say so, and offer to copy the link. No 1AM-mobile support and no deploy in this spec. |
| How far to drop Lace | **Only 1AM connects.** Other injected wallets are ignored, and every Lace mention goes. |
| The local proof server choice | **Keep it, folded under "Advanced".** H4 (where 1AM proves) is unverified, so this stays as the private option. |
| Scope | Audit items 1–5 and 7–10. Item 6 (Share button, QR code) is out, because it conflicts with desktop only. |

## 3. Changes

### 3.1 Only 1AM connects (audit: Lace dropped)

- **Detection.** `detectWallets` (`app/src/wallet/connector.ts`) keeps only wallets whose `name` or `rdns` matches `/1am/i`. Any other injected wallet is ignored, as if absent.
- **Copy.** Remove every Lace mention:
  - the `lace.io` link in `WalletPanel`;
  - "(in Lace: Midnight Settings, Proof Server, Local)" in the proof-server error (`app/src/wallet/errors.ts`);
  - "(in Lace: NIGHT, then Generate DUST)" in the no-DUST error and in `balances.ts`.
- **No DUST.** The no-DUST error stays, because 1AM's "Pay with my DUST" can still hit it. Its text becomes wallet-neutral: designate NIGHT to generate DUST in the wallet, or let 1AM pay the fee.
- **Fee warnings.** 1AM pays fees through its sponsor. So the 0-DUST warning in `feeWarnings`, and `paysOwnFees`, are dead code: remove them. The "less tNIGHT than the envelope needs" warning stays. The 1AM fee note ("Fees are paid by 1AM…") stays.
- **Connect timeout.** Keep the connect timeout as a general safety net. Reword its comment so it no longer names Lace.
- **CSP.** Drop `http://localhost:6300` from `connect-src`, in both `app/src/csp.ts` and `app/vercel.json`. It was only there because Lace proved via `localhost`. The local proof server stays at `http://127.0.0.1:6300`. `app/test/config.test.ts` must still pass.

### 3.2 A phone without a wallet (audit item 1)

- **Detection.** New `app/src/lib/device.ts` exports `isMobile(nav = navigator)`. It returns true when either holds:
  - `nav.userAgentData?.mobile` is true;
  - the user agent matches `/Android|iPhone|iPad|iPod/i`.

  It also returns true for an iPad that reports a Mac user agent with `maxTouchPoints > 1`.
- **Behaviour.** When `isMobile()` is true **and** no 1AM wallet is detected, `WalletPanel` renders a `DesktopOnly` notice instead of the connect UI:
  > **Open this on a computer.** Lixi needs Chrome on a computer with the 1AM extension. Copy the link and open it there.

  The notice includes a **Copy link** button (`CopyButton` with `location.href`). On the claim page this copies the full link, fragment included, so the secret travels only through the user's own clipboard.
- **What stays visible.** The claim page still shows the amount, the expiry and the "expiring soon" warning above the notice.
- **A wallet is present.** If a phone does have an injected 1AM (for example, inside a wallet's own browser), the normal flow runs.

### 3.3 Fee copy (audit item 2)

| Where | Now | New |
|---|---|---|
| Claim page, under the amount | "Opening it needs a Midnight wallet with a little DUST for the fee." | "Opening it needs the 1AM wallet. 1AM pays the fee, so you need no tNIGHT or DUST." |
| Home FAQ, first answer | "Yes: a Midnight wallet such as 1AM, on Preprod, with a little DUST for the fee. You can see what is inside before you connect." | "Yes: the 1AM wallet, set to Preprod. 1AM pays the fee, so you need no tNIGHT or DUST. You can see what is inside before you connect." |
| Create, next to Seal | "Your wallet pays X tNIGHT plus a small DUST fee." | "Your wallet pays X tNIGHT. 1AM pays the fee." |

### 3.4 Guided install when no wallet is found (audit item 3, desktop)

The "No Midnight wallet found" notice in `WalletPanel` becomes three short steps:
1. **Install 1AM for Chrome:** a link to `LINKS.wallet`.
2. **Create a wallet and set it to Preprod.**
3. **Reload this page:** a button that calls `location.reload()`, labelled **I installed 1AM, reload**.

Each page adds one line, through a new optional `WalletPanel` prop `hint`:
- **Claim:** "Your link stays in the address bar when you reload."
- **Create:** "You need tNIGHT to fill an envelope:" plus a link to `LINKS.faucet`.

### 3.5 Advanced: where proofs are made (audit item 4)

- **Folded away.** The "Where proofs are made" fieldset moves into `<details>` with the summary **Advanced: where proofs are made**. It is closed by default, and open by default when the saved choice is `local`, so a user who chose it can still see that choice.
- **Labels.**
  - "In my wallet" → **In 1AM (default)**.
  - "On this computer, with the local proof server" is unchanged.
- **Unchanged.** The Docker command input still shows when `local` is chosen.

### 3.6 Backup at the first Seal (audit item 5)

- **The form comes first.** `/create` shows the form at once. `BackupGate` no longer replaces the page.
- **First Seal.** The first time the user presses **Seal N lì xì** while `store.backedUp()` is false, the action area shows the backup step inline, below the form. The form stays filled. The step holds:
  - the `BackupString` warning and the string itself;
  - the "I saved my backup string" checkbox;
  - **Saved, seal N lì xì**, enabled only when the box is ticked, plus a quiet **Back** that returns to the form.
- **After the backup.** Pressing it calls `store.setBackedUp(true)`, then runs the same submit as before. Later seals skip the step.
- **Unchanged.** The vault is still created on page load (`loadOrCreateVault`), and its entry is still saved before `createEnvelope` is submitted (CLAUDE.md invariant).

### 3.7 Share page checks again by itself (audit item 7)

- **Polling.** While the envelope is not yet on chain, `Share` reads the ledger again every `SHARE_POLL_MS = 5_000`. It stops once the envelope is found or the page unmounts.
- **A failed read.** A failed background read is ignored, and the next tick tries again. Only the first read's failure shows the `READ_FAILED` notice, as today.
- **After `SHARE_SLOW_MS = 120_000`.** The page adds: "Still not on chain. If your wallet shows the transaction failed or was declined, go back and seal again. Your envelope list keeps this attempt as Not on chain." The **Check again** button stays throughout.

### 3.8 Duplicates (audit items 8–9)

- **Empty dashboard.** With no envelopes:
  - hide the Lights/List toggle;
  - hide the "Your backup string" box;
  - keep the empty state's **Fill an envelope** and **Restore from a backup string** buttons, which open the restore form.
- **An unreadable vault.** The restore form still opens by itself, as today.
- **Header Connect button.** New `WalletPanelPresence` context in `app/src/wallet/`.
  - Each mounted `WalletPanel` outside the header registers itself.
  - `Header` hides **Connect wallet** while any panel is registered.
  - The header's own dropdown panel does not register.
  - The connected-wallet chip and **Disconnect** are unaffected.

### 3.9 View the transaction (audit item 10)

- **Where the link shows.**
  - After a claim succeeds, the opened page shows **View transaction**.
  - After a refund succeeds, the row shows **View transaction** next to "Came home: …", for that page session only. The id is not stored.
- **Which explorer.** `preprod.midnightexplorer.com` opens a transaction at `/transactions/0x<hash>`. That was checked on 2026-10-07 with a Lixi transaction, and its 33-byte identifier gave a 404.
- **How the app gets the hash.** The flows get midnight-js's *identifier*, not the hash. After a claim or refund lands, `walletChain` asks the indexer for the finalized transaction (`publicDataProvider.watchForTxData(identifier)`) and returns its `txHash`. So `LixiChain.claim` and `refund` resolve to the hash. The SDK is unchanged.
- **Fallback.** The lookup gives up after 15 s, and returns `''` on a timeout or an error. An empty hash shows no link, and so does a claim that landed while the wallet call failed. Either way, the transaction itself has already landed.
- **The URL builder.** `txUrl(hash)` goes in `app/src/lib/links.ts`, next to an `EXPLORER` constant. The explorer is not in `LINKS`, because every entry there is a footer icon.
- **CSP.** The link is a navigation, not a fetch, so the CSP is unaffected.

## 4. Out of scope

- QR codes and the Web Share button (audit item 6).
- Any 1AM-mobile path.
- A Vercel deploy (Plan 3 Task 12 stays deferred).
- Copy in Vietnamese.
- Any change to the contract, the SDK or the CLI.

## 5. Testing

App page tests (`// @vitest-environment jsdom`, `app/test/app-harness.tsx`):
- **Detection:** a non-1AM injected wallet is ignored. With only Lace injected, the panel shows the install steps.
- **Phone:** with `isMobile` stubbed true and no wallet, the claim page shows the amount and the desktop-only notice with **Copy link**. With `isMobile` true and a 1AM wallet, the normal connect button shows.
- **Copy:** the claim page and FAQ no longer mention DUST as a need. The rendered home, create, claim and dashboard pages contain no "Lace".
- **Advanced:** the prover choice is inside a closed `<details>`, which is open when `local` is saved.
- **Backup at Seal:**
  - the form shows on first visit;
  - the first Seal shows the backup step;
  - the seal runs only after the box is ticked;
  - a second seal skips it.
- **Share polling (fake timers):** a not-yet-on-chain envelope becomes the links view without a click. The slow message shows after 120 s.
- **Dashboard empty:** there is no view toggle, no backup box, and one restore button.
- **Header:** **Connect wallet** is hidden on `/create` and on a claim link while not connected, and shown on `/`.
- **Transaction link:** the opened page links to `txUrl(hash)`. An empty hash shows no link.
- **CSP:** `config.test.ts` still keeps `csp.ts` and `vercel.json` equal, now without `localhost`.
- **Device:** `isMobile` unit tests cover Android, iPhone, an iPad reporting a Mac UA, and desktop Chrome.

The local gate before merging: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build -w @lixi/app`.

## 6. Docs to update

- **`README.md`:** remove the Lace paragraph. State that Lixi needs Chrome on a computer with 1AM, on Preprod.
- **`docs/superpowers/specs/2026-09-30-lixi-design.md`:**
  - in the architecture and the wallet list, 1AM only;
  - Lace is dropped, with the date and the reason;
  - `/create` asks for the backup at the first Seal.

# Lixi frontend design: “Giao thừa, a field of lights”

**Design spec · 2026-10-02 · Status: approved in chat (brainstorm with mockups), pending written-spec review**

**Parent spec:** `docs/superpowers/specs/2026-09-30-lixi-design.md`. That spec sets the screens (§4.5), the error handling (§4.6) and the CSP (§6, audit L). This spec sets only how the app looks, moves and reads. It changes nothing in the contract, the SDK, the flows, the wallet bridge or the CSP policy.

**Plan affected:** `docs/superpowers/plans/2026-10-02-lixi-plan-3-app.md`. Tasks 1–6 (CI, SDK, workspace, logic, flows, wallet bridge) stay as written. Tasks 7–10 (theme, components, pages) are rewritten from this spec (§11).

The approved mockups are in `.superpowers/brainstorm/73541-1790907082/content/` (gitignored, local only): `giao-thua-directions-v3.html`, `claim-states-v2.html`, `create-share.html`, `home-full-v3.html`.

---

## 1. Why

The first app design in Plan 3 put a red-and-gold lì xì envelope on peach-blossom paper, with Be Vietnam Pro and a single column. The user saw it as a copy of their earlier project `~/Desktop/arc-chain` (Ledgerline), and comparing the two confirmed it. The colours differed, but the structure was the same:
1. **The same hero:** headline, paragraph and button on the left; a paper object on the right (receipt there, envelope here).
2. **The same move:** turn the interface into a paper object.
3. **The same skeleton:** wordmark header with small text nav, one column, thin-bordered panels stacked.
4. **Three numbered “How it works” cards**, which arc-chain’s own design spec lists as a template tell.
5. **The same copy voice.**

So the new direction had to change the composition and the interaction, not the palette.

## 2. Decisions made (brainstorm, 2026-10-02)

| Question | Choice |
|---|---|
| First feeling | **B, mysterious and private:** dark, in Midnight’s spirit |
| How much lì xì | **B1, Giao thừa:** lì xì is given at midnight on New Year’s Eve. The screen is night; the red envelope is the only warm light. |
| What pages are built around | **C, a field of lights:** each lì xì is a small glowing envelope. The lights *are* the data. |
| Home page | A full site: sticky header, hero, five sections, final call to action, footer |
| External links | Shown as icons with tooltips. In-app actions stay as words. |
| Motion on Home | Header links scroll smoothly; each section plays its own short moment once when it enters the screen |

Also from the user: the demo video is recorded by hand (Plan 4 does not script a recording).

## 3. Principles

1. **A light is a lì xì, and its state is real.** On every page a light means exactly one share:
   - **lit** (red glow, gold seal) = not opened yet
   - **out** (dark) = opened
   - **home** (gold) = expired, unopened, and refundable to the sender
   - **ghost** (dashed outline) = the envelope is not on chain
   - **pending** (pulsing) = a transaction is in flight

   The Home hero’s lights are decorative, but they follow the same rules.
2. **Night is the canvas, red is the only warm light.** Gold appears only on seals, greetings, refunds and focus rings. No other accent colours.
3. **Say what is public and what is private, accurately.** Payouts are unshielded: every opening shows its recipient and amount on chain. The copy never implies otherwise (§9).
4. **Motion only where something happens**: a light changing state, an envelope opening, a section arriving once. Nothing loops, except the pending pulse while a transaction is in flight. `prefers-reduced-motion` turns every animation into its end state.
5. **Words for actions, icons for places.** Buttons that do something are words (“Seal 4 lì xì”). Links that go somewhere else are icons, each with a name on hover and focus.
6. **Everything the lights say is also text.** Every light has an accessible name, and the dashboard has a List view.

## 4. Tokens

### 4.1 Colour

| Token | Hex | Role |
|---|---|---|
| `night` | `#0c0a12` | Page background |
| `night-deep` | `#08070c` | Footer |
| `ember` | `#2a0f16` | Bottom glow of hero, claim and CTA backgrounds (radial gradient into `night`) |
| `lantern` | `#ef3346` | Lit lights and glows; red text on `night` at ≥ 18 px only (4.9:1) |
| `lantern-deep` | `#d42a3c` | Primary button fill (white text 5.0:1) and hover of lights |
| `envelope-flap` | `#8f0c1b` | The flap of a large envelope |
| `seal` | `#f2c14e` | Seals, greetings, refund (“home”) lights and buttons, focus ring |
| `seal-ink` | `#2a1a05` | Text on `seal` buttons (10:1) |
| `paper` | `#efe2cf` | Main text (15.4:1 on `night`) |
| `paper-soft` | `#b3a593` | Secondary text (8.2:1) |
| `paper-dim` | `#8c7f8a` | Tertiary text, legal line (5.2:1; never below 12 px) |
| `out` | `#221a21` | A light that went out |
| `line` | `#ffffff14` | Hairlines and dividers |
| `edge` | `#ffffff26` | Borders of quiet buttons, inputs and icon buttons (decorative; inputs also carry a label) |
| `error` | `#ff6b78` | Error text on `night` (7.1:1) |

The first-pass palette (peach-blossom page, Be Vietnam Pro) is gone. The app is dark only; there is no light theme.

### 4.2 Type

- **Fraunces** (variable, `wght` + `opsz`) for all text, self-hosted from `@fontsource-variable/fraunces` (`opsz.css`). It includes a Vietnamese subset. Headings use `opsz` 144 at weight 400; body text uses `opsz` auto at 400; labels and buttons use 600. Amounts use `font-variant-numeric: tabular-nums`.
- **Playwrite VN** (`@fontsource/playwrite-vn`, weight 200) for Vietnamese greetings only: “Chúc mừng năm mới”, “An khang thịnh vượng”, “Chúc may mắn”, “Sealed”. Never for UI text or anything a user must read to act.
- Scale (px): 12 / 13 / 14 / 15 (body) / 18 / 21 / 26 / 30 / 40 (hero). Line length stays under 70 characters for body text.
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows, no monospace (addresses and links show in Fraunces, shortened in the middle).

### 4.3 Shape, space, depth

- Radius: lights 4 px (small) / 8 px (large envelope); buttons and inputs 6 px; panels 8 px; pills 999 px.
- Space: an 8-px base; sections are padded 48 px vertically on desktop and 32 px on phones; the page gutter is 56 px on desktop, 24 px on tablets and 16 px on phones.
- Depth comes only from glow. A lit light has `box-shadow: 0 0 16px 4px lantern/38%, 0 0 44px 10px lantern/12%`; a seal light uses the same shadows in `seal`. Panels get no drop shadows.

## 5. Components

### 5.1 `Light`

One lì xì. Props: `state: 'lit' | 'out' | 'home' | 'ghost' | 'pending'`, `size: 'sm' | 'md' | 'lg' | 'xl'`, `label` (accessible name, for example “Lì xì 2: 1.2 tNIGHT, waiting”).
- Markup: a `span` with `role="img"` and `aria-label`. On the Dashboard it is also focusable (`tabIndex={0}`), and the tooltip shows the same label on hover and focus. It is not a button, because it does nothing.
- The large envelope (`xl`, Claim page) adds a flap and a seal. Opening it hides the flap and seal and lets the slip rise (§7).
- State changes animate background and glow over 500 ms.

### 5.2 Header (all pages)

- Sticky, `night` at 90% opacity with an 8-px backdrop blur and a bottom hairline.
- **Left:** logo (a small lit light, then “Lixi”), which goes to `/`.
- **Centre:** section links “How it works”, “Privacy”, “Built on Midnight”, “FAQ”. On `/` they scroll smoothly to the section. On other pages they go to `/#how`, `/#privacy`, `/#midnight` and `/#faq`. On `/`, the link of the section in view is underlined in `lantern` (scroll spy).
- **Right:** a “Preprod testnet” pill in `seal`, “My envelopes”, and the wallet control. The wallet control is “Connect wallet” when disconnected; when connected it is a chip with the wallet name and a shortened address, plus Disconnect.
- **Under 768 px:** the section links and “My envelopes” fold into a menu button (an icon with the label “Menu”) that opens a panel; the pill and the wallet control stay visible.

### 5.3 Footer (all pages)

- **Column 1:** logo, and “Private red envelopes on Midnight. Built for the Midnight Buildathon.”
- **Column 2, Use Lixi** (words, in-app): Fill an envelope, Open a link, My envelopes.
- **Column 3, Find us** (icon buttons, §5.4): GitHub, Contract on Preprod, Midnight Network, 1AM wallet, Preprod faucet, Design and audit notes.
- **Bottom line:** “Testnet only. tNIGHT has no value.” on the left; “Apache-2.0” on the right.
- On phones the columns stack.

### 5.4 Icon links

- A 38-px square `a` with an `edge` border. The icon is 18 px, stroke 1.8 px.
- Each has `aria-label`, and a tooltip with the same text appears on hover and keyboard focus.
- External links open in a new tab with `rel="noreferrer"`.
- Icons are inline SVG React components in `app/src/components/icons.tsx`, so the CSP is unaffected:
  - GitHub mark: the official mark path
  - contract: a file with code brackets
  - Midnight: a moon (the Midnight logo is not used)
  - 1AM: a wallet
  - faucet: a droplet
  - notes: an open book
  - menu: three lines
  - copy: two squares
  - check: a check mark

  Paths are adapted from Lucide (ISC licence, credited in the README).

| Icon | Target |
|---|---|
| GitHub | `https://github.com/hms1499/lixi-midnight` |
| Contract on Preprod | `https://github.com/hms1499/lixi-midnight/blob/main/deployments/preprod.json` (no public Preprod explorer is assumed) |
| Midnight Network | `https://midnight.network` |
| 1AM wallet | `https://1am.xyz` |
| Preprod faucet | `https://midnight-tmnight-preprod.nethermind.dev/` (listed in docs.midnight.network “Networks and environments”, checked 2026-10-02) |
| Design and audit notes | `https://github.com/hms1499/lixi-midnight/blob/main/docs/superpowers/specs/2026-09-30-lixi-design.md` |

### 5.5 Buttons and controls

- **Primary:** `lantern-deep` fill, white text, 6-px radius. Hover is a slightly darker red; pressed moves it down 1 px.
- **Quiet:** transparent with an `edge` border and `paper` text.
- **Home (refund):** `seal` fill with `seal-ink` text, used only for “Bring … home”.
- **Inputs:** transparent, with a 2-px `lantern` underline (the sentence form) or an `edge` border (paste box, restore). Labels are always present, visually or as `aria-label`.
- **Focus:** a 2-px `seal` outline with a 2-px offset on every focusable element.
- **Notices:** text in the right colour (`error`, `seal` for warnings, `paper-soft` for info) behind a thin left glyph (light out, seal, or light). No coloured left rule and no tinted boxes.
- **FAQ:** native `details` and `summary`; the “+” rotates 45° when open.

## 6. Pages

### 6.1 Home `/`

In order, each section with an `id` for the header links:

1. **Hero.** An `ember` → `night` gradient and a field of 7 decorative lights (5 md, 2 sm; 4 lit, 3 out) above centred text:
   - the greeting “Chúc mừng năm mới”
   - the heading “Every light is one lì xì. / Only its link knows whose.”
   - the line “Put tNIGHT in a red envelope, split it into lì xì and send each person a link. They open it with a zero-knowledge proof; the link’s secret never touches the chain.”
   - buttons **Fill an envelope** (primary) and **Open a link** (quiet)
2. **How it works** (`#how`). The life of one light, as three stages on one line rather than three cards:
   - **Sealed:** “You fill the envelope. The chain keeps a fingerprint of the split, never the split.”
   - **Handed out:** “Each link carries one lì xì’s secret, in the part of the URL no server ever sees.”
   - **Opened:** “A proof says ‘I hold a valid lì xì’ without saying which. What nobody opens comes back to you.”
3. **Privacy, plainly** (`#privacy`). Two columns in one bordered block.
   - **What the chain sees:** that an envelope exists, its total and its expiry; whether it uses a group link; your address, as the sender; each opening (who received, and how much).
   - **What stays in the dark:** how many lì xì, and the size of each; who the links went to; the secrets inside the links; which lì xì are still unopened.
   - A note follows: payouts are unshielded tNIGHT, and a link works like cash.
4. **Built on Midnight** (`#midnight`), written for judges:
   - A four-step line:
     - **The link:** secret and Merkle path, in the URL fragment.
     - **The proof:** made in your wallet or on your machine; it binds the payout to your address.
     - **The contract:** checks the root, spends a one-time nullifier, never sees the secret.
     - **Your wallet:** receives the tNIGHT; the same link cannot pay twice.
   - Three facts:
     - **~30 s** from “Open” to tNIGHT in your wallet, proof included
     - **Up to 16** lì xì per envelope, split equally or at random
     - **No admin key:** the maintenance key was given up at deploy
   - Icon links: GitHub, Contract, Notes.
5. **For every red-envelope moment** (`#moments`). One line, “Personal links for family, one group link for a crowd.”, then chips: Tết (lucky amounts), Weddings (one link each), Birthdays, Team bonuses (equal amounts), Community giveaways (group link, one per wallet).
6. **Questions** (`#faq`), as accordions:
   - Do I need a wallet to open a lì xì?
   - What if a link leaks?
   - Can the sender take a lì xì back early?
   - What happens to lì xì nobody opens?
   - Is this real money?

   The answers follow the parent spec §2.5 and §3.5.
7. **Final call to action:** one light, “Fill your first envelope”, and the two hero buttons.

### 6.2 Create `/create`

- **First visit: the backup step.**
  - Greeting “Before you seal one”, then the heading “Keep your backup string”.
  - Copy: “Your envelopes are rebuilt from this one string. If this browser loses its data, it is the only way to see them again and bring home what nobody opened.”
  - The string sits in a dark field with Copy, behind the private-key warning (Plan 1 carry-over): “Treat this like a private key. Anyone who has it can open every lì xì you have not handed out yet. Keep it where only you can read it, never in a chat.”
  - A checkbox, “I saved my backup string”, then **Continue**.
- **The form is one sentence with inline fields:** “Put [10] tNIGHT into [4] lì xì, [lucky amounts ▾], with [one link each ▾]. What nobody opens comes home after [1 day ▾].”
  - Choices: amounts are “lucky amounts” or “equal amounts”; distribution is “one link each” or “one group link”; expiry is 2 hours, 1 day, 3 days or 7 days.
  - Choosing “one group link” sets “equal amounts” and disables “lucky”, with the hint “A group link gives the same amount to each person, one per wallet.”
  - Each field has an accessible name (“Total tNIGHT”, “Number of lì xì”, “Amounts”, “Links”, “Comes home after”). Validation sits under the sentence (“Enter an amount like 10 or 2.5.” / “Choose 1 to 16.”).
- **Live field (right; above on phones):** one light per lì xì, laid out in a loose cluster.
  - With lucky amounts, each light is scaled by its share of the total (0.8×–1.3×) and labelled with its amount, read from `deriveEnvelope` on the next free index, so the preview is exactly what will be sealed.
  - With a group link, the lights sit in one row, joined by a thin line.
- **Action:**
  - When connected, **Seal 4 lì xì** (the count is live), with “Your wallet pays 10 tNIGHT plus a small DUST fee.” beside it.
  - When disconnected, the wallet panel (§6.6) takes its place.
  - While sealing, the lights pulse in turn and the line reads “Sealing your envelope. About 30 seconds; keep this tab open.” On success, go to `/share/:id`.

### 6.3 Share `/share/:id`

- Greeting “Sealed”, then the heading “N lì xì, ready to hand out”.
- Warning in `seal`: “A link is like cash: whoever opens it first gets the lì xì. Send each one to one person, in a private chat.”
- **Personal links:** one row each with a small lit light, “Lì xì i” with its amount underneath, and a **Copy link** button. After copying, the button reads “Copied” in `seal` with a check icon for the rest of the visit, so the sender can track which links are out.
- **Group link:** one large light, “One link for N people, X tNIGHT each, one per wallet”, and **Copy link**.
- Below the rows: **Copy all N links** (personal links only) and **See them in My envelopes**.
- Before the envelope is on chain: a pending light and “Your envelope is on its way to the chain…”, with **Check again**.

### 6.4 Claim `/c`

The page is one `xl` envelope centred in the night, with text and actions under it. It has four moments (mockup `claim-states-v2.html`):
1. **Arrives** (no wallet yet):
   - greeting “Chúc mừng năm mới”, heading “Someone sent you a lì xì”
   - “X tNIGHT is sealed inside. Open it before ⟨local date and time⟩.”
   - a group link reads “One lì xì from a group envelope, X tNIGHT.”
   - under 10 minutes left adds a warning in `seal`
   - the hint “Opening it needs a Midnight wallet with a little DUST for the fee.”
   - action: when exactly one wallet is detected, **Connect ⟨wallet name⟩ to open it**; otherwise the wallet panel (§6.6). Once connected the action is **Open the lì xì**.
2. **Opening:** the light pulses and a thin `lantern` progress bar creeps along.
   - heading “Opening your lì xì”
   - “Your wallet is proving that you hold this link, without showing the link to anyone.”
   - step line: “Proving, then your wallet asks you to confirm.”
3. **Opened:** the burst (§7).
   - greeting “An khang thịnh vượng”, then the amount in large `seal` Fraunces (“1.5 tNIGHT”)
   - “It is in your wallet. The link’s secret never touched the chain.”
   - quiet button **Send lì xì of your own**, which goes to `/create`
4. **Can’t be opened:** the light is out.
   - The heading says why: “This lì xì was already opened” / “This envelope has expired” / “The sender already took back what nobody opened” / “This wallet already opened one from this group” / “Every lì xì in this envelope has been opened” / “This envelope is not on this network” / “This link is damaged”.
   - One sentence of help follows each, adapted from `REFUSAL_TEXT`.
   - Action: **Open a different link**.

Errors from the wallet or prover (Plan 3 `friendlyError`) show under the envelope in `error`, and the light returns to lit so the user can retry. With no fragment, the page shows a single lit light, the heading “Open a lì xì”, a paste field “Paste the link you were sent”, and **Open link**.

### 6.5 My envelopes `/dashboard`

- **Header row:** the heading “Your envelopes”, a **Lights / List** toggle (remembered in `localStorage`), and **Fill another envelope**.
- **One row per envelope, newest first.** Lights view: the row’s lights (one per lì xì, states from §3), then the summary “10 tNIGHT in 4 lì xì, lucky” and a status line:
  - **open:** “2 opened. Comes home in 21 h if nobody opens the rest.”
  - **refundable:** “Expired yesterday. 1 opened; 2 can come home.” Its unopened lights turn to `home` (gold), with the gold button **Bring X tNIGHT home**.
  - **refunded:** all lights out; “Came home: X tNIGHT.”
  - **empty:** “All opened.”
  - **missing:** ghost lights; “Not on chain. The wallet declined, or it is still on its way.”, with **Remove**.
- **Actions per row:** **Show links** for open and empty envelopes. Refund needs a wallet: the button reads “Connect a wallet to bring it home” until one is connected, and the wallet panel opens above the list.
- **List view:** the same rows as text, with no lights.
- **Lights are focusable:** each shows “Lì xì i: X tNIGHT, waiting/opened/coming home” on hover and focus. The sender sees amounts; recipients never see this page.
- **Backup block at the bottom:** “Your backup string rebuilds every envelope here on another device.”, with **Show** (reveals `BackupString` with the warning) and **Restore** (the field, the “replace” confirmation and the messages from Plan 3).
- **Empty state:** one ghost light and “No envelopes in this browser yet.”, with **Fill an envelope** and **Restore from a backup string**.

### 6.6 Wallet panel (shared)

A dark block:
- “Connect a Midnight wallet ⟨purpose⟩.”
- One quiet button per detected wallet: “Connect 1AM”.
- The prover choice as two radio rows: “In my wallet” / “On this computer, with the local proof server”, plus the Docker command shown in a copyable field.
- Failure messages appear in `error`.
- With no wallet detected: “No Midnight wallet found in this browser. Install 1AM, set it to Preprod, then reload this page.” (1AM is an icon-and-text link here, because it is a step in a sentence).

### 6.7 Not found

A single out light, “Nothing here”, and “If someone sent you a lì xì, open the full link from their message, or paste it here.”

## 7. Motion

| Where | Trigger | What happens | Duration |
|---|---|---|---|
| Home, header links | click | Smooth scroll to the section (`scrollIntoView`), with a 64-px offset for the sticky header | browser default |
| Home, header | scroll | The underline moves to the section in view | 300 ms |
| Home, each section | first time ≥ 35% of it is on screen | The heading and lede rise 14 px and fade in | 600 ms |
| How it works | same | The wire draws left to right; the three lights light in turn; the last goes out | 1.4 s draw; lights 550 ms apart, the last out 700 ms later |
| Privacy | same | A dark veil slides over “What stays in the dark” | 1.2 s, 0.6 s delay |
| Built on Midnight | same | A fuse burns along the four steps, red to gold | 2 s, linear |
| Moments | same | The chips catch the light one by one | 220 ms apart |
| Final CTA | same | Its light switches on | 500 ms |
| Create | field changes | Lights appear, disappear or resize | 300 ms |
| Create, Claim, Dashboard | transaction in flight | Pending lights pulse (glow 60% → 100%) | 1.6 s loop, only while pending |
| Claim | claim succeeds | The flap and seal fade; a gold radial burst blooms; the slip with the amount rises out of the envelope | 900 ms total |
| Dashboard | ledger refresh changes a state | That light animates to its new state | 500 ms |

- Section moments are driven by one `useReveal()` hook (IntersectionObserver). It adds `data-in` once and then disconnects.
- With reduced motion, the hook sets `data-in` immediately and CSS removes every transition; scrolling jumps.
- No motion anywhere else, including no hover lifts on cards.

## 8. Accessibility

- Contrast: every text pair in §4.1 is at least 4.5:1, and red text is used only at ≥ 18 px. A unit test computes these ratios from the token values.
- Every `Light` has an accessible name. The dashboard’s List view and the visually hidden status text give screen-reader users the same information.
- The focus ring is visible everywhere. Icon links show their tooltip on focus. The mobile menu traps focus while open and closes on Escape.
- Greetings in Playwrite VN carry `lang="vi"` and are never the only carrier of meaning.
- The app is usable from a 320-px width up.

## 9. Copy rules

- The UI is in English (parent spec §4.5). Vietnamese appears only in the greetings and the words “lì xì” and “Lộc”.
- Action names stay the same through each flow:
  - **Fill an envelope** → **Seal N lì xì** → “Sealed”
  - **Open a link** → **Open the lì xì** → “You received” / “Opened”
  - **Bring X tNIGHT home** → “Came home”
- Privacy claims stay exact:
  - Never say amounts or recipients are hidden **on payout**; say the *split*, the *count*, the *link secrets* and *who was sent which link* are.
  - Never say “nobody can see” a payout.
- No arrows on buttons, no middle-dot metadata strings, no exclamation marks except in the Vietnamese greeting.

## 10. CSP and build impact

- Fonts are self-hosted through `@fontsource-variable/fraunces` and `@fontsource/playwrite-vn` (both 5.3.0, OFL-1.1, exact pins); `@fontsource/be-vietnam-pro` is removed. `font-src` stays `'self'` (covered by `default-src 'self'`).
- Icons are inline SVG elements rendered by React; no icon font, no external sprite.
- Layout positions set from React (`style` props for the hero and live-field light positions) go through the CSSOM, which CSP allows; nothing writes a `style` attribute into HTML.
- `scroll-behavior` and IntersectionObserver are plain browser APIs in our own bundle. Nothing changes in `csp.ts` or `vercel.json`.

## 11. Plan 3 changes

Tasks 1–6 are unchanged. Tasks 7–10 are rewritten:
- **Task 7, theme and shell:**
  - tokens in `index.css`, the fonts, and `Light`, `icons.tsx`, `Header` (with mobile menu and scroll spy), `Footer`, `Button`/`Notice` restyled, `useReveal`
  - the full Home page
  - tests: home sections and anchors render; every icon link has an accessible name and a URL; the contrast test; `useReveal` marks sections immediately under reduced motion
  - the build and browser check, at 1280 px and 390 px
- **Task 8, Create and Share:** the backup step, the sentence form with the live field (from `deriveEnvelope` on the next free index), sealing state, the Share rows with copied state. Page tests use the new labels.
- **Task 9, Claim:** the four moments, the paste box and the refusal headings. Tests are as before, plus “shows the amount sealed inside” and the opened state.
- **Task 10, My envelopes:** rows of lights with states and actions, the Lights/List toggle, backup and restore. Tests are as before, plus the List view and refund wording (“Bring 1 tNIGHT home” → “Came home”).

Three small additions land in Task 5, with tests, because the pages need them:
- `envelopeView` also returns `shares: { amount: bigint; opened: boolean }[]` for the envelope's real shares, so each light can show its own state.
- `create.ts` exports `freeIndex(vault, ledger)`, so the Create preview derives exactly the index that `createEnvelope` will use.
- The Home page scrolls to `location.hash` on mount, so header links from other pages (`/#faq`) land on their section.

Everything else (the wallet bridge, the storage, the error mapping and their tests) is reused unchanged. Only page-level text expectations change.

## 12. Out of scope

- A light theme or theme toggle.
- A Vietnamese UI.
- QR codes.
- Animated hero lights beyond their static glow.
- A mobile wallet flow.
- Brand logos of Midnight or 1AM.

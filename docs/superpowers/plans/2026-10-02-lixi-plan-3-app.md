# Lixi Plan 3 (App: create, share, claim, dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Lixi web app on Preprod, in the approved “Giao thừa, a field of lights” design. A sender fills an envelope with a browser wallet, shares claim links, watches them being opened and brings the rest home after expiry. A recipient opens a link and claims with a zero-knowledge proof. The app has a strict CSP, a tested sender vault, and a CI that no longer spends 8 minutes on every push.

**Architecture:**
- A new `@lixi/app` workspace: React 19 + Vite 8 + Tailwind 4, one SPA with routes `/`, `/create`, `/share/:id`, `/c`, `/dashboard` (spec §4.5).
- The app is layered so that almost everything is tested against the real compiled contract (`LixiSimulator`):
  - `lib/`: pure helpers (tNIGHT units, times, vault storage, dashboard status)
  - `flows/`: create, claim, refund, restore, written against a small `LixiChain` port
  - `chain/midnight.ts`: the only code that talks to midnight-js and the browser wallet (the S4 spike, productized)
  - `wallet/`: wallet detection, connect with timeout, 1AM retry quirk, user-facing error text
  - `pages/` and `components/`: React. Pages get the outside world only through `Services` (`services.tsx`), so page tests run the whole app against the simulator and a fake wallet.
- The look follows the frontend design spec: a dark night page where every lì xì is a light (lit = waiting, out = opened, gold = coming home, dashed = not on chain, pulsing = in flight), a full home page with a sticky header and footer, and one short moment per home section.
- One Content-Security-Policy for the whole site, built from `NETWORKS` (`csp.ts`): injected as a `<meta>` tag into the built page and sent as a header by Vercel (`vercel.json`). A test keeps the two equal.

**Tech Stack:** React 19.3, react-router 8.4 (declarative mode), Vite 8.3.1 + `@vitejs/plugin-react` 6.1.1 + `vite-plugin-wasm` 3.6.0, Tailwind CSS 4.3.3 (`@tailwindcss/vite`), Fraunces (`@fontsource-variable/fraunces`) and a vendored Playwrite VN (both self-hosted, CSP-safe), Vitest 4.1.11 + jsdom 30 + Testing Library, midnight-js 4.1.1, dapp-connector-api 4.0.1.

**Spec:** `docs/superpowers/specs/2026-09-30-lixi-design.md` (product, screens, errors, CSP) and `docs/superpowers/specs/2026-10-02-lixi-frontend-design.md` (how the app looks, moves and reads; approved 2026-10-02). The spike decisions this plan builds on are in `docs/superpowers/spikes/2026-10-01-chain-spikes.md`. Plans 1 and 2 built the contract, the SDK and the CLI.

**Scope:** This is plan 3 of 4. It covers spec tasks T7–T12 and T14, part of T19, and these carry-overs:

| Carry-over | Where |
|---|---|
| Plan 1: prove locally or in the wallet, never through a shared server (H4) | Prover choice in Task 6/7; DevTools check in Task 11 |
| Plan 1: strict CSP on the claim page | Whole-site CSP in Tasks 3 and 7; header in Task 12 |
| Plan 1: show the backup string like a private key | Task 8 (`BackupString`) |
| Plan 1 minor: `decodeLink(group)` accepts total < count | Task 2 |
| Plan 1 minor: `deserializeVault` does no validation | Task 2 (the app now loads it from `localStorage`) |
| Plan 1 minor: `recoverVault` skips unmatched envelopes; duplicate share secrets | **Not done.** The app only creates the three modes `recoverVault` scans, and duplicate secrets only hurt the sender. |
| Spike findings: bundling, assets, pre-checks, 1AM quirks, one wallet per key, sync | Tasks 3, 6, 7, 9, 11 |
| User request (2026-10-02): CI takes too long | Task 1 |

Spec items handled only partly:
- **T12, second wallet:** the connector accepts any wallet with DApp Connector API 4.x and falls back to the local proof server when a wallet cannot prove (Lace). Lace still cannot connect on Preprod (spike S4), so only 1AM is tested end to end.
- **T19, Could tier:** the envelope-opening animation (Task 7) and restoring on another device (Task 10) are in; QR codes are not.

Plan 4 does the README, slides and submission; the user records the demo video by hand. This plan only adds a short "Run the app" section to the README.

**Decisions this plan makes** (the reviewer should check that each one fits the spec):
1. **Reads use the network's public indexer, not the wallet's.** The spike suggested reading the indexer from `getConfiguration()`. The public Preprod indexer allows CORS (checked 2026-10-02: `access-control-allow-origin: *`). Using it means two things: the claim page can show the envelope before any wallet connects, and the CSP can name every host the page talks to.
2. **The default prover is the wallet; a local proof server is one click away.** Recipients cannot be expected to run Docker. Task 11 checks in DevTools where 1AM proves (H4) and applies the decision rule there.
3. **No automatic resubmission after a DUST-reuse rejection.** The spike's "retry once after a block" is replaced by an error that says to wait ~30 s and try again. The rejection text from 1AM is unknown, and 1AM keeps such transactions "pending" anyway.
4. **The sender vault lives in `localStorage`**, saved *before* `createEnvelope` is submitted, so a closed tab never loses an envelope. A vault that does not parse is never overwritten except by an explicit restore.
5. **Expiry presets are 2 h, 1 day, 3 days and 7 days.** Preprod's `minDuration` is 1 h; the flow refuses anything within 10 min of either contract bound, because the block time can drift from the browser clock.
6. **The S4 spike page is deleted** (Task 13). The app replaces it, and it stays in git history.
7. **The look comes from the frontend spec.** The first design in this plan (red and gold envelope on peach-blossom paper) was replaced after the user found it too close to their earlier project; the brainstorm, mockups and decisions are in that spec.

**Verification note:** On 2026-10-02, Tasks 1–10 were built in a scratch worktree of `feat/app` at `d993bbf` (the frontend spec commit). Every file block below was extracted from that worktree after it passed. What was run:
- The full CI sequence passed: `format:check`, `lint`, `typecheck`, `npm test` (contract 32, SDK 37, CLI 12, app 49 tests), `npm run compact`, and the app build.
- The Task 7 intermediate state (only Home and NotFound routed) passed typecheck, lint, its 38 app tests and the build. The Task 8 and 9 states were not run separately; they differ only in `App.tsx` and the files each task adds.
- The built app was served with `vite preview` and driven in Chromium (Playwright):
  - Home at 1280 px: the hero greeting rendered with every Vietnamese mark, and the header’s “Built on Midnight” link scrolled smoothly to its section, underlined it and played its moment.
  - Home at 390 px: the menu button opened the section list.
  - Create rendered the sentence form with four lucky lights.
  - The claim page, given a random link, read the real Preprod indexer under the CSP and said the envelope is not on this network.
  - My envelopes rendered its empty state.
  - There were no console errors and no CSP violations.

Not run: the GitHub workflows (Tasks 1, 13), real wallets (Task 11), Vercel (Task 12) and the spike removal (Task 13).

## Global Constraints

- Everything from Plans 1 and 2 still holds:
  - Node 24, compiler 0.31.1, `compact-runtime` 0.16.0, midnight-js 4.1.1, dapp-connector-api 4.0.1
  - MAX_SHARES 16, depth 4; hashing only through the compiled `pureCircuits`
  - unix seconds; `bigint` base units; **1 tNIGHT = 1,000,000 base units**
  - one copy of `@midnight-ntwrk/onchain-runtime-v3` (3.0.0). After any install, `npm ls @midnight-ntwrk/onchain-runtime-v3` shows no `invalid` line; run `npm dedupe` if it does.
  - `memoryPrivateStateProvider` only; the vault is the source of truth for shares.
- **Install with `--save-exact`.** App versions: `react`/`react-dom` 19.3.0, `react-router` 8.4.0, `vite` 8.3.1 (the version the spike workspace already pins, so there is one copy), `@vitejs/plugin-react` 6.1.1, `vite-plugin-wasm` 3.6.0, `tailwindcss` and `@tailwindcss/vite` 4.3.3, `vitest` 4.1.11, `jsdom` 30.1.1, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.7, `@types/react` and `@types/react-dom` 19.3.0, `typescript` 5.9.3, `@fontsource-variable/fraunces` 5.3.0, `buffer` 6.0.3. Playwrite VN is vendored as one file (Task 7), because its npm package has no Vietnamese letters.
- **Secrets never reach a log, an error message or a server.** Claim links carry their secret in the URL fragment, which browsers never send. The backup string is shown only on screen. No `console.log` of links, shares, seeds or the vault.
- **CSP:** no inline scripts or styles, no third-party scripts, styles or fonts. `connect-src` is our origin, the network's indexer (HTTP and WS) and `http://127.0.0.1:6300`. A new host the page must reach goes into `csp.ts` **and** `vercel.json`; the config test fails until both match.
- **Proving (audit H4):** the page never sends a proof request to a remote prover. The only provers are the wallet's `getProvingProvider` and the local proof server at `NETWORKS[*].proofServer`.
- **Look:** dark only. Colours come only from the tokens in `app/src/theme.ts` / `index.css` (frontend spec §4.1); text is Fraunces, and Playwrite VN is only for Vietnamese greetings. A light’s state always means the same thing (frontend spec §3).
- **Copy:** the UI is in English (spec §4.5), with "lì xì" for a share and "envelope" for the whole. Write sentence case, use plain verbs, put no arrows on buttons, and keep one name per action through a flow: **Fill an envelope** → **Seal N lì xì** → “Sealed”; **Open a link** → **Open the lì xì** → “It is in your wallet”; **Bring X tNIGHT home** → “Came home” (frontend spec §9).
- **Prettier** (single quotes, trailing commas, width 120) and **ESLint** run in CI; the project hook formats edited files. `app/public/keys/`, `app/public/zkir/` and `app/dist/` are generated and gitignored.

## Review Focus

These are failure modes the spec implies that no feature test covers by itself. Each one has a pinning test or check in the task that owns it.

1. **The strict CSP blocks the wallet.** If 1AM injects `window.midnight` with an inline script, or proves from the page context against a remote host, the built site finds no wallet or fails to prove, while the dev server (no CSP) works. Task 11, Step 3 checks the built site with the real extension and records any violation.
2. **1AM proves on a remote server (H4).** `getConfiguration()` returns `api-preprod.1am.xyz` as the prover. Task 11, Step 4 watches the extension's network traffic during a claim, and applies the decision rule.
3. **A recipient's wallet is on another network.** The address decode must fail loudly with a "switch to Preprod" message, never pay to wrong bytes. Task 9: "tells a recipient whose wallet is on another network".
4. **A pasted link arrives wrapped in chat text** ("Here: https://…/c#v1.…)."). The claim page's paste box must still open it, and must reject plain text with a clear message. Task 9: "opens a pasted link even with chat punctuation around it".
5. **The create transaction fails or the tab closes mid-flight.** The vault entry must survive, the dashboard must show it as "Not on chain" with Remove, and a lost-but-landed index must not be reused. Task 5: "keeps the vault entry when the transaction fails…" and "skips an index whose envelope is already on chain…".

## File Structure

| Path | Responsibility |
|---|---|
| `.github/workflows/ci.yml` | Every push: format, lint, typecheck, unit tests, full compile, app build |
| `.github/workflows/devnet.yml` | Devnet E2E, only when chain code changes or by hand |
| `sdk/src/vault.ts`, `sdk/src/link.ts` | Validated vault parsing; group links checked against `equalSplit` |
| `sdk/package.json` | New `@lixi/sdk/network` export (Node-free, for `vite.config.ts`) |
| `app/package.json`, `app/tsconfig.json`, `app/vite.config.ts`, `app/vitest.config.ts` | Workspace and build config |
| `app/scripts/zk-assets.ts` | Copies `keys/` and `zkir/` into `app/public/` (compiles keys if missing) |
| `app/vercel.json` | SPA rewrite and security headers for the deployment |
| `app/index.html`, `app/public/favicon.svg` | Page shell |
| `app/src/config.ts` | Network and contract address from env or `deployments/preprod.json` |
| `app/src/csp.ts` | The CSP string per network |
| `app/src/lib/units.ts`, `lib/time.ts` | tNIGHT parsing and formatting; expiry presets, relative times |
| `app/src/lib/storage.ts` | `VaultStore` over `localStorage`; prover preference |
| `app/src/lib/status.ts` | Dashboard row state from public nullifiers |
| `app/src/chain/port.ts` | `LixiReader`, `LixiChain`, `ProverChoice` types |
| `app/src/chain/midnight.ts` | Public indexer reader; wallet-backed `LixiChain` |
| `app/src/flows/create.ts`, `flows/claim.ts`, `flows/manage.ts` | Create, preview/claim, refund/forget/restore |
| `app/src/wallet/connector.ts`, `wallet/errors.ts`, `wallet/WalletContext.tsx` | Detection, connection, errors, React wallet state |
| `app/src/services.tsx` | Dependency injection for pages |
| `app/src/theme.ts`, `app/src/index.css` | Colour tokens and contrast; Tailwind theme, fonts, light and envelope styles, section moments |
| `app/src/assets/fonts/` | Vendored Playwrite VN (OFL-1.1) |
| `app/src/lib/links.ts`, `app/src/lib/reveal.ts` | External places for icon links; the once-per-section reveal hook |
| `app/src/components/*` | Light, Envelope, icons, UI primitives, wallet panel, header, footer, backup, copy button, layout |
| `app/src/pages/*` | Home, Create, Share, Claim, Dashboard, NotFound |
| `app/test/*` | Logic tests (Node) and page tests (jsdom) on the simulator |

## Execution Order

Run the tasks in order: 1 → 10 are code and need nobody. Task 11 needs the user and three 1AM wallets. Task 12 needs the user's go-ahead and Vercel login. Task 13 comes last.

All work happens on branch `feat/app`:
```bash
git switch main && git pull --ff-only && git switch -c feat/app
source ~/.nvm/nvm.sh && nvm use 24
```

---

### Task 1: CI that only runs the devnet suite when chain code changes

The `test` job takes ~1 min; the `devnet` job takes ~8 min (run 36886048569) and ran on every push to every branch, then again on `main` after the fast-forward merge. App work never touches the chain code, so the devnet suite moves to its own workflow with path filters and a manual trigger. Superseded runs on the same branch are cancelled. The unused `pull_request` trigger goes (this repo merges without PRs).

**Files:**
- Modify: `.github/workflows/ci.yml` (whole file)
- Create: `.github/workflows/devnet.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `ci.yml` with one `test` job (Task 7 appends an app build step to it); `devnet.yml`.

- [ ] **Step 1: Replace `.github/workflows/ci.yml`**

```yaml
name: CI

# Every push: format, lint, typecheck, unit tests and the full compile (~1 min).
# The slow devnet suite lives in devnet.yml.
on:
  push:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - name: Install Compact toolchain
        run: |
          curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.3/compact-installer.sh | COMPACT_NO_MODIFY_PATH=1 sh
          echo "$HOME/.local/bin" >> "$GITHUB_PATH"
          echo "$HOME/.compact/bin" >> "$GITHUB_PATH"
      - run: compact update 0.31.1
      - run: compact compile --version
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - name: Full compile with proving keys
        run: npm run compact
```

- [ ] **Step 2: Create `.github/workflows/devnet.yml`**

```yaml
name: Devnet

# The devnet end-to-end suite takes ~8 minutes, so it runs only when chain code changes, or by hand
# (Actions → Devnet → Run workflow).
on:
  push:
    paths:
      - 'contract/**'
      - 'sdk/**'
      - 'cli/**'
      - 'devnet/**'
      - 'package-lock.json'
      - '.github/workflows/devnet.yml'
  workflow_dispatch:

concurrency:
  group: devnet-${{ github.ref }}
  cancel-in-progress: true

jobs:
  devnet:
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - name: Install Compact toolchain
        run: |
          curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.3/compact-installer.sh | COMPACT_NO_MODIFY_PATH=1 sh
          echo "$HOME/.local/bin" >> "$GITHUB_PATH"
          echo "$HOME/.compact/bin" >> "$GITHUB_PATH"
      - run: compact update 0.31.1
      - run: npm ci
      - name: Start the local devnet
        run: docker compose -f devnet/compose.yml up -d --wait
      - name: Devnet end-to-end (deploy, relinquish, create, concurrent and sponsored claims, refund)
        run: npm run test:devnet -w @lixi/cli
      - name: Devnet logs on failure
        if: failure()
        run: docker compose -f devnet/compose.yml logs --tail 200
```

- [ ] **Step 3: Check and commit**

Run: `npx prettier --check .github`
Expected: `All matched files use Prettier code style!`

```bash
git add .github/workflows
git commit -m "ci: run the devnet suite only when chain code changes, cancel superseded runs"
```

The workflows are exercised when the branch is pushed in Task 13.

---

### Task 2: SDK carry-overs: validated vaults, group link totals, network export

The app keeps the vault in `localStorage`, so `deserializeVault` must reject anything damaged instead of half-reading it. A group link whose total cannot give every share one unit (or whose shares overflow `Uint<64>`) must be an invalid link, not a crash inside `resolveClaim`. `vite.config.ts` needs `NETWORKS` without pulling in the WASM-backed SDK, so `network.ts` gets its own export.

**Files:**
- Modify: `sdk/src/vault.ts` (imports; `deserializeVault`)
- Modify: `sdk/src/link.ts` (imports; group branch of `decodeLink`)
- Modify: `sdk/package.json` (`exports`)
- Create: `sdk/test/vault.test.ts`
- Modify: `sdk/test/link.test.ts` (one new test)

**Interfaces:**
- Consumes: `MAX_SHARES` from `@lixi/contract`; `equalSplit` from `sdk/src/split.ts`.
- Produces: `deserializeVault(json): SenderVault` throws `Error('invalid vault')` on any malformed input; `decodeLink` throws `Error('invalid link')` for a group link with `total < count` or a share above `2^64 − 1`; `@lixi/sdk/network` exports `NETWORKS`, `NetworkConfig`, `NetworkName`.

- [ ] **Step 1: Write the failing vault tests**

Create `sdk/test/vault.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { addEnvelope, deserializeVault, newVault, serializeVault } from '../src/vault.js';

const saved = addEnvelope(newVault(), {
  index: 0,
  total: 3_000_000n,
  count: 3,
  kind: 'group',
  split: 'equal',
  expiry: 1_800_007_200n,
  labels: ['for Mom'],
});
const json = serializeVault(saved);
const tamper = (edit: (raw: { seed: string; envelopes: Record<string, unknown>[] }) => void): string => {
  const raw = JSON.parse(json);
  edit(raw);
  return JSON.stringify(raw);
};

describe('deserializeVault', () => {
  it('round-trips', () => {
    expect(deserializeVault(json)).toEqual(saved);
  });

  it('rejects anything that is not a whole, valid vault', () => {
    const bad = [
      '',
      'null',
      '{not json',
      '[]',
      tamper((r) => (r.seed = 'AAAA')),
      tamper((r) => (r.seed = '!!')),
      tamper((r) => ((r as Record<string, unknown>).envelopes = 7)),
      tamper((r) => ((r.envelopes as unknown[])[0] = null)),
      tamper((r) => (r.envelopes[0].count = 17)),
      tamper((r) => (r.envelopes[0].count = 0)),
      tamper((r) => (r.envelopes[0].index = -1)),
      tamper((r) => (r.envelopes[0].total = '2')),
      tamper((r) => (r.envelopes[0].total = 3_000_000)),
      tamper((r) => (r.envelopes[0].expiry = 'soon')),
      tamper((r) => (r.envelopes[0].kind = 'secret')),
      tamper((r) => (r.envelopes[0].split = 'random')),
      tamper((r) => (r.envelopes[0].labels = [1])),
    ];
    for (const text of bad) expect(() => deserializeVault(text), text).toThrow('invalid vault');
  });

  it('accepts a vault saved before labels existed', () => {
    expect(deserializeVault(tamper((r) => delete r.envelopes[0].labels)).envelopes[0].labels).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing link test**

In `sdk/test/link.test.ts`, insert before `it('accepts pasted URLs with whitespace and trailing punctuation', …`:
```ts
  it('rejects group links whose total cannot give every share a unit', () => {
    const d = deriveEnvelope(seed, { index: 4, total: 900n, count: 3, kind: 'group', split: 'equal' });
    const [link] = linksFor(d);
    if (link.kind !== 'group') throw new Error('expected a group link');
    expect(() => decodeLink(encodeLink({ ...link, total: 2n }))).toThrow(/invalid link/);
    expect(() => decodeLink(encodeLink({ ...link, count: 1, total: 1n << 64n }))).toThrow(/invalid link/);
    expect(decodeLink(encodeLink({ ...link, total: 3n }))).toMatchObject({ count: 3, total: 3n });
  });

```

- [ ] **Step 3: Run them to see them fail**

Run: `npm run compact:fast && npm test -w @lixi/sdk`
Expected: FAIL. `rejects anything that is not a whole, valid vault` fails (for example on `''` with a `SyntaxError`, not `invalid vault`), and `rejects group links whose total…` fails because `decodeLink` returns the link.

- [ ] **Step 4: Validate the vault**

In `sdk/src/vault.ts`, change the first import to:
```ts
import { MAX_SHARES, emptyPrivateState, withEnvelopeShares, type LixiPrivateState } from '@lixi/contract';
```
Replace the whole `export const deserializeVault = …` function with:
```ts
const invalid = (): never => {
  throw new Error('invalid vault');
};
const int = (v: unknown, min: number, max: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : invalid();
const uint = (v: unknown): bigint => (typeof v === 'string' && /^\d{1,40}$/.test(v) ? BigInt(v) : invalid());
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T =>
  options.includes(v as T) ? (v as T) : invalid();
const strings = (v: unknown): string[] => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : invalid());

/** Parses `serializeVault` output. Throws 'invalid vault' on anything else, so a damaged vault is never half-read. */
export const deserializeVault = (json: string): SenderVault => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return invalid();
  }
  const { seed, envelopes } = (raw ?? {}) as Record<string, unknown>;
  if (typeof seed !== 'string' || !Array.isArray(envelopes)) return invalid();
  let seedBytes: Uint8Array;
  try {
    seedBytes = fromBase64Url(seed);
  } catch {
    return invalid();
  }
  if (seedBytes.length !== 32) return invalid();
  return {
    seed: seedBytes,
    envelopes: envelopes.map((item: unknown) => {
      const e = (item ?? {}) as Record<string, unknown>;
      const kind = oneOf(e.kind, ['personal', 'group'] as const);
      const split = oneOf(e.split, ['equal', 'random'] as const);
      const count = int(e.count, 1, MAX_SHARES);
      const total = uint(e.total);
      if (kind === 'group' && split !== 'equal') invalid();
      if (total < BigInt(count)) invalid();
      return {
        index: int(e.index, 0, 2 ** 31),
        total,
        count,
        kind,
        split,
        expiry: uint(e.expiry),
        labels: strings(e.labels ?? []),
      };
    }),
  };
};
```

- [ ] **Step 5: Check group link totals**

In `sdk/src/link.ts`, add after the `./bytes.js` import:
```ts
import { equalSplit } from './split.js';
```
In `decodeLink`, replace the group branch's body after the length check, from `const count = body[64];` through its `return { … };`, with:
```ts
    const count = body[64];
    const total = bytesToBigint(body.slice(65));
    if (count < 1 || count > MAX_SHARES) throw new Error('invalid link');
    try {
      equalSplit(total, count); // at least one unit per share, and each share fits Uint<64>
    } catch {
      throw new Error('invalid link');
    }
    return { kind: 'group', id: body.slice(0, 32), groupSecret: body.slice(32, 64), count, total };
```

- [ ] **Step 6: Export the network config on its own**

In `sdk/package.json`, set:
```json
  "exports": {
    ".": "./src/index.ts",
    "./network": "./src/network.ts"
  },
```

- [ ] **Step 7: Run the SDK suite**

Run: `npm test -w @lixi/sdk && npm run typecheck -w @lixi/sdk`
Expected: PASS, 37 tests (33 before, plus 3 vault tests and 1 link test).

- [ ] **Step 8: Commit**

```bash
git add sdk
git commit -m "fix(sdk): validate saved vaults and group link totals; export the network config"
```

---

### Task 3: App workspace, config and the CSP

**Files:**
- Create: `app/package.json`, `app/tsconfig.json`, `app/vitest.config.ts`, `app/vite.config.ts`, `app/scripts/zk-assets.ts`
- Create: `app/src/config.ts`, `app/src/csp.ts`, `app/vercel.json`
- Create: `app/test/config.test.ts`
- Modify: `package.json` (workspaces), `.gitignore`, `package-lock.json` (by npm)

**Interfaces:**
- Consumes: `NETWORKS`, `NetworkName` from `@lixi/sdk/network` (Task 2); `deployments/preprod.json`.
- Produces:
  - `appConfig(env: Record<string, string | undefined>): AppConfig` with `AppConfig = { network: NetworkName; contractAddress: string }`
  - `cspFor(network: NetworkName): string`
  - `npm run zk -w @lixi/app` copies `keys/` and `zkir/` into `app/public/`

- [ ] **Step 1: Create the workspace**

Create `app/package.json`:
```json
{
  "name": "@lixi/app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "scripts": {
    "zk": "node scripts/zk-assets.ts",
    "predev": "npm run zk",
    "dev": "vite",
    "prebuild": "npm run zk",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```
In the root `package.json`, add `"app"` to `workspaces` after `"cli"` (keep `"spikes/s4-wallet"` until Task 13).

Append to `.gitignore`:
```
app/public/keys/
app/public/zkir/
.vercel/
```

- [ ] **Step 2: Install the dependencies**

```bash
npm install --save-exact -w @lixi/app react@19.3.0 react-dom@19.3.0 react-router@8.4.0 @lixi/contract@0.1.0 @lixi/sdk@0.1.0 @fontsource-variable/fraunces@5.3.0 buffer@6.0.3 @midnight-ntwrk/dapp-connector-api@4.0.1 @midnight-ntwrk/midnight-js-fetch-zk-config-provider@4.1.1 @midnight-ntwrk/midnight-js-http-client-proof-provider@4.1.1 @midnight-ntwrk/midnight-js-indexer-public-data-provider@4.1.1 @midnight-ntwrk/midnight-js-network-id@4.1.1 @midnight-ntwrk/midnight-js-protocol@4.1.1 @midnight-ntwrk/midnight-js-types@4.1.1 @midnight-ntwrk/midnight-js-utils@4.1.1
npm install --save-exact --save-dev -w @lixi/app vite@8.3.1 @vitejs/plugin-react@6.1.1 vite-plugin-wasm@3.6.0 tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 typescript@5.9.3 vitest@4.1.11 jsdom@30.1.1 @testing-library/react@16.3.3 @testing-library/dom@10.4.2 @testing-library/user-event@14.6.7 @types/react@19.3.0 @types/react-dom@19.3.0
npm ls @midnight-ntwrk/onchain-runtime-v3 | grep -c invalid
```
Expected: the last command prints `0`. If it prints more, run `npm dedupe` and check again.

The resulting `app/package.json` is:
```json
{
  "name": "@lixi/app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "scripts": {
    "zk": "node scripts/zk-assets.ts",
    "predev": "npm run zk",
    "dev": "vite",
    "prebuild": "npm run zk",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fontsource-variable/fraunces": "5.3.0",
    "@lixi/contract": "0.1.0",
    "@lixi/sdk": "0.1.0",
    "@midnight-ntwrk/dapp-connector-api": "4.0.1",
    "@midnight-ntwrk/midnight-js-fetch-zk-config-provider": "4.1.1",
    "@midnight-ntwrk/midnight-js-http-client-proof-provider": "4.1.1",
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider": "4.1.1",
    "@midnight-ntwrk/midnight-js-network-id": "4.1.1",
    "@midnight-ntwrk/midnight-js-protocol": "4.1.1",
    "@midnight-ntwrk/midnight-js-types": "4.1.1",
    "@midnight-ntwrk/midnight-js-utils": "4.1.1",
    "buffer": "6.0.3",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-router": "8.4.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "4.3.3",
    "@testing-library/dom": "10.4.2",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.7",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "jsdom": "30.1.1",
    "tailwindcss": "4.3.3",
    "typescript": "5.9.3",
    "vite": "8.3.1",
    "vite-plugin-wasm": "3.6.0",
    "vitest": "4.1.11"
  }
}
```

- [ ] **Step 3: TypeScript and Vitest config**

Create `app/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "resolveJsonModule": true,
    "types": ["vite/client"],
    "allowImportingTsExtensions": true
  },
  "include": ["src", "test", "vite.config.ts", "vitest.config.ts"]
}
```
Create `app/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Logic tests run in Node; page tests opt into jsdom with `// @vitest-environment jsdom`.
export default defineConfig({
  plugins: [react()],
  test: { include: ['test/**/*.test.{ts,tsx}'] },
});
```

- [ ] **Step 4: Write the failing config and CSP tests**

Create `app/test/config.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { appConfig } from '../src/config';
import { cspFor } from '../src/csp';

describe('appConfig', () => {
  it('defaults to Preprod and the committed deployment', () => {
    const deployment = JSON.parse(readFileSync(new URL('../../deployments/preprod.json', import.meta.url), 'utf8'));
    expect(appConfig({})).toEqual({ network: 'preprod', contractAddress: deployment.contractAddress });
  });

  it('needs an explicit contract address for a local devnet build', () => {
    expect(() => appConfig({ VITE_LIXI_NETWORK: 'undeployed' })).toThrow(/VITE_LIXI_CONTRACT/);
    expect(appConfig({ VITE_LIXI_NETWORK: 'undeployed', VITE_LIXI_CONTRACT: 'ab'.repeat(32) }).network).toBe(
      'undeployed',
    );
    expect(() => appConfig({ VITE_LIXI_NETWORK: 'mainnet' })).toThrow(/unknown network/);
  });
});

describe('CSP', () => {
  it('allows only our origin, the public indexer and the local proof server', () => {
    const policy = cspFor('preprod');
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).toContain(
      "connect-src 'self' https://indexer.preprod.midnight.network wss://indexer.preprod.midnight.network http://127.0.0.1:6300",
    );
    expect(policy).not.toMatch(/'unsafe-inline'|'unsafe-eval'|\*/);
  });

  it('is the same policy the Vercel deployment sends as a header, plus frame-ancestors', () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const header = vercel.headers[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy');
    expect(header.value).toBe(`${cspFor('preprod')}; frame-ancestors 'none'`);
  });
});
```
Run: `npm test -w @lixi/app`
Expected: FAIL, because `../src/config` and `../src/csp` do not exist.

- [ ] **Step 5: Implement config, CSP and the Vercel headers**

Create `app/src/config.ts`:
```ts
import { NETWORKS, type NetworkName } from '@lixi/sdk/network';
import preprod from '../../deployments/preprod.json';

export type AppConfig = { readonly network: NetworkName; readonly contractAddress: string };

/**
 * Build-time config. Preprod by default, using the committed deployment record; a local devnet
 * build sets VITE_LIXI_NETWORK=undeployed and VITE_LIXI_CONTRACT.
 */
export const appConfig = (env: Record<string, string | undefined>): AppConfig => {
  const network = env.VITE_LIXI_NETWORK ?? 'preprod';
  if (!(network in NETWORKS)) throw new Error(`unknown network ${network}`);
  const contractAddress = env.VITE_LIXI_CONTRACT ?? (network === 'preprod' ? preprod.contractAddress : '');
  if (!/^[0-9a-f]{64}$/.test(contractAddress)) throw new Error(`set VITE_LIXI_CONTRACT for ${network}`);
  return { network: network as NetworkName, contractAddress };
};
```
Create `app/src/csp.ts`:
```ts
import { NETWORKS, type NetworkName } from '@lixi/sdk/network';

/**
 * Content-Security-Policy for every page (spec §4.5, audit Low). Scripts and styles come only from
 * our origin, WebAssembly may compile (the ledger runtime), and the page may only talk to our origin,
 * the network's public indexer and the local proof server (audit H4).
 */
export const cspFor = (network: NetworkName): string => {
  const n = NETWORKS[network];
  const connect = [n.indexer, n.indexerWS, n.proofServer].map((url) => new URL(url).origin);
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self'",
    "img-src 'self' data:",
    `connect-src 'self' ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
};
```
Create `app/vercel.json`. The deployment is built locally and uploaded prebuilt (Task 12), because the proving keys need the Compact compiler, so `installCommand` does nothing:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "true",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://indexer.preprod.midnight.network wss://indexer.preprod.midnight.network http://127.0.0.1:6300; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test -w @lixi/app`
Expected: PASS, 4 tests.

- [ ] **Step 7: Vite config and the ZK asset script**

Create `app/vite.config.ts`. The CSP goes into the built page only, because the dev server injects inline scripts for hot reload:
```ts
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import type { NetworkName } from '@lixi/sdk/network';
import { cspFor } from './src/csp.ts';

/** Adds the CSP meta tag to the built page only: the dev server needs inline scripts for hot reload. */
const csp = (policy: string): Plugin => ({
  name: 'lixi-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
  ],
});

// Target esnext keeps top-level await native, which the ledger WASM bindings need (spike S4).
export default defineConfig(({ mode }) => {
  const network = (loadEnv(mode, process.cwd(), 'VITE_').VITE_LIXI_NETWORK ?? 'preprod') as NetworkName;
  return {
    plugins: [react(), tailwindcss(), wasm(), csp(cspFor(network))],
    // The Midnight libraries make one ~1 MB chunk (plus ~11 MB of WASM); nothing to gain from splitting it.
    build: { target: 'esnext', chunkSizeWarningLimit: 1500 },
    optimizeDeps: { exclude: ['@midnight-ntwrk/onchain-runtime-v3'] },
  };
});
```
Create `app/scripts/zk-assets.ts` (Node 24 runs TypeScript directly):
```ts
// Copies the proving keys and ZKIR of the compiled contract into public/, where
// FetchZkConfigProvider fetches them. Compiles the keys first if `npm test` deleted them.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';

const managed = new URL('../../contract/src/managed/lixi/', import.meta.url);
const pub = new URL('../public/', import.meta.url);

if (!existsSync(new URL('keys/claim.prover', managed))) {
  console.log('proving keys missing: compiling the contract (~1–2 min)...');
  execSync('npm run compact -w @lixi/contract', { stdio: 'inherit', cwd: new URL('../../', import.meta.url) });
}
for (const dir of ['keys', 'zkir']) {
  rmSync(new URL(dir, pub), { recursive: true, force: true });
  cpSync(new URL(dir, managed), new URL(dir, pub), { recursive: true });
}
console.log('copied keys/ and zkir/ into app/public');
```
Run: `npm run zk -w @lixi/app && ls app/public/keys app/public/zkir`
Expected: `copied keys/ and zkir/ into app/public`, then `claim.prover … refund.verifier` and the six ZKIR files. If the keys were missing, it first compiles for ~1–2 min.

The build itself runs in Task 7, once `index.html` and `main.tsx` exist.

- [ ] **Step 8: Typecheck and lint**

Run: `npm run typecheck -w @lixi/app && npx eslint app`
Expected: no output from `tsc`, no ESLint problems.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore app
git commit -m "feat(app): workspace, build config, network config and the site CSP"
```

---

### Task 4: tNIGHT units, times, vault storage and the chain port

**Files:**
- Create: `app/src/lib/units.ts`, `app/src/lib/time.ts`, `app/src/lib/storage.ts`, `app/src/chain/port.ts`
- Create: `app/test/helpers.ts`, `app/test/units.test.ts`, `app/test/storage.test.ts`

**Interfaces:**
- Consumes: `serializeVault`, `deserializeVault` (Task 2), `ClaimTxArgs`, `CreateArgs` from `@lixi/sdk`; `Ledger`, `LixiPrivateState` from `@lixi/contract`; `LixiSimulator`, `T0` from `@lixi/contract/testing`.
- Produces:
  - `parseNight(text): bigint` (throws `'invalid amount'`), `formatNight(units): string`, `NIGHT_DECIMALS = 6`
  - `EXPIRY_PRESETS`, `DURATION_MARGIN_SECONDS = 600`, `formatRelative(secondsFromNow): string`, `nowSeconds(): number`
  - `VaultStore` (`load()` throws `'corrupt vault'`, `save`, `backedUp`, `setBackedUp`), `localVaultStore(storage)`, `VAULT_KEY`, `BACKED_UP_KEY`, `loadProver(storage)`, `saveProver(storage, p)`, `PROVER_KEY`
  - `LixiReader = { readLedger(): Promise<Ledger> }`, `LixiChain` (adds `create`, `claim`, `refund`), `ProverChoice = 'wallet' | 'local'`
  - Test helpers: `simChain(sim)` (a `LixiChain` on the simulator that records `calls`), `MemoryStorage`, `rnd()`, `HOUR`, re-exported `T0` and `LixiSimulator`

- [ ] **Step 1: Write the failing tests**

Create `app/test/units.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatNight, parseNight } from '../src/lib/units';
import { formatRelative } from '../src/lib/time';

describe('tNIGHT units', () => {
  it('parses whole and fractional amounts into base units', () => {
    expect(parseNight('2')).toBe(2_000_000n);
    expect(parseNight(' 1.5 ')).toBe(1_500_000n);
    expect(parseNight('0.000001')).toBe(1n);
  });

  it('rejects anything that is not a plain non-negative decimal with at most 6 places', () => {
    for (const bad of ['', '-1', '1.2345678', '1,5', 'abc', '1e3', '.5']) {
      expect(() => parseNight(bad), bad).toThrow('invalid amount');
    }
  });

  it('formats base units without trailing zeros', () => {
    expect(formatNight(2_000_000n)).toBe('2');
    expect(formatNight(1_059_505n)).toBe('1.059505');
    expect(formatNight(1n)).toBe('0.000001');
    expect(formatNight(parseNight('12.34'))).toBe('12.34');
  });
});

describe('formatRelative', () => {
  it('is coarse and says which way', () => {
    expect(formatRelative(90)).toBe('in 1 min');
    expect(formatRelative(2 * 3600 + 300)).toBe('in 2 h 5 min');
    expect(formatRelative(-3 * 86400)).toBe('3 days ago');
  });
});
```
Create `app/test/storage.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newVault, serializeVault } from '@lixi/sdk';
import { VAULT_KEY, loadProver, localVaultStore, saveProver } from '../src/lib/storage';
import { MemoryStorage } from './helpers';

describe('localVaultStore', () => {
  it('round-trips a vault and the backed-up flag', () => {
    const store = localVaultStore(new MemoryStorage());
    expect(store.load()).toBeUndefined();
    const vault = newVault();
    store.save(vault);
    expect(store.load()?.seed).toEqual(vault.seed);
    expect(store.backedUp()).toBe(false);
    store.setBackedUp(true);
    expect(store.backedUp()).toBe(true);
  });

  it('reports unreadable data as a corrupt vault and leaves it in place', () => {
    const storage = new MemoryStorage();
    const store = localVaultStore(storage);
    for (const bad of [
      '{not json',
      '{"seed":"AAAA","envelopes":[]}',
      serializeVault(newVault()).replace('"envelopes":[]', '"envelopes":7'),
    ]) {
      storage.setItem(VAULT_KEY, bad);
      expect(() => store.load(), bad).toThrow('corrupt vault');
      expect(storage.getItem(VAULT_KEY)).toBe(bad);
    }
  });

  it('remembers where proofs are made, defaulting to the wallet', () => {
    const storage = new MemoryStorage();
    expect(loadProver(storage)).toBe('wallet');
    saveProver(storage, 'local');
    expect(loadProver(storage)).toBe('local');
  });
});
```
Run: `npm test -w @lixi/app`
Expected: FAIL, modules not found.

- [ ] **Step 2: Implement units and times**

Create `app/src/lib/units.ts`:
```ts
/** tNIGHT has 6 decimals: 1 tNIGHT = 1,000,000 base units. */
export const NIGHT_DECIMALS = 6;
const SCALE = 10n ** BigInt(NIGHT_DECIMALS);

/** Parses a user-typed tNIGHT amount ("1.5") into base units. Throws 'invalid amount'. */
export const parseNight = (text: string): bigint => {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim());
  if (!m) throw new Error('invalid amount');
  return BigInt(m[1]) * SCALE + BigInt((m[2] ?? '').padEnd(NIGHT_DECIMALS, '0'));
};

/** Formats base units as tNIGHT without trailing zeros: 1500000n → "1.5". */
export const formatNight = (units: bigint): string => {
  const whole = units / SCALE;
  const frac = (units % SCALE).toString().padStart(NIGHT_DECIMALS, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
};
```
Create `app/src/lib/time.ts`:
```ts
/** Expiry choices offered when creating an envelope, in seconds from now. */
export const EXPIRY_PRESETS = [
  { label: '2 hours', seconds: 2 * 3600 },
  { label: '1 day', seconds: 86400 },
  { label: '3 days', seconds: 3 * 86400 },
  { label: '7 days', seconds: 7 * 86400 },
] as const;

/**
 * Margin kept from the contract's duration bounds, so block time drifting from the
 * browser clock while the transaction is proved and included cannot break them.
 */
export const DURATION_MARGIN_SECONDS = 600;

/** "in 2 h 5 min", "3 days ago": coarse, for envelope lists. */
export const formatRelative = (secondsFromNow: number): string => {
  const abs = Math.abs(secondsFromNow);
  const text =
    abs >= 2 * 86400
      ? `${Math.floor(abs / 86400)} days`
      : abs >= 3600
        ? `${Math.floor(abs / 3600)} h ${Math.floor((abs % 3600) / 60)} min`
        : `${Math.max(1, Math.floor(abs / 60))} min`;
  return secondsFromNow >= 0 ? `in ${text}` : `${text} ago`;
};

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);
```

- [ ] **Step 3: Implement the chain port and vault storage**

Create `app/src/chain/port.ts`:
```ts
import type { Ledger, LixiPrivateState } from '@lixi/contract';
import type { ClaimTxArgs, CreateArgs } from '@lixi/sdk';

/** Read access to the deployed contract's public ledger. */
export type LixiReader = { readLedger(): Promise<Ledger> };

/** A wallet-backed handle on the deployed contract: each call proves, balances and submits a transaction. */
export type LixiChain = LixiReader & {
  create(privateState: LixiPrivateState, args: CreateArgs): Promise<{ id: Uint8Array; txId: string }>;
  claim(args: ClaimTxArgs): Promise<string>;
  refund(privateState: LixiPrivateState, id: Uint8Array): Promise<string>;
};

/** Where proofs are made (audit H4): in the wallet (1AM), or by the proof server on this machine. */
export type ProverChoice = 'wallet' | 'local';
```
Create `app/src/lib/storage.ts`:
```ts
import { deserializeVault, serializeVault, type SenderVault } from '@lixi/sdk';
import type { ProverChoice } from '../chain/port';

export const VAULT_KEY = 'lixi.vault.v1';
export const BACKED_UP_KEY = 'lixi.vault.backedUp';

/** Where the sender's vault lives between visits. */
export type VaultStore = {
  /** The saved vault, or undefined if there is none. Throws 'corrupt vault' if the saved data cannot be read. */
  load(): SenderVault | undefined;
  save(vault: SenderVault): void;
  /** Whether the user confirmed saving the backup string of the current vault. */
  backedUp(): boolean;
  setBackedUp(done: boolean): void;
};

/**
 * Vault in localStorage. A vault that fails to parse is never overwritten here: the only way
 * past 'corrupt vault' is an explicit restore from the backup string.
 */
export const localVaultStore = (storage: Storage): VaultStore => ({
  load() {
    const raw = storage.getItem(VAULT_KEY);
    if (raw === null) return undefined;
    try {
      return deserializeVault(raw);
    } catch {
      throw new Error('corrupt vault');
    }
  },
  save(vault) {
    storage.setItem(VAULT_KEY, serializeVault(vault));
  },
  backedUp: () => storage.getItem(BACKED_UP_KEY) === 'yes',
  setBackedUp(done) {
    storage.setItem(BACKED_UP_KEY, done ? 'yes' : 'no');
  },
});

export const PROVER_KEY = 'lixi.prover';

/** Proving in the wallet is the default; 'local' needs the Docker proof server (audit H4). */
export const loadProver = (storage: Storage): ProverChoice =>
  storage.getItem(PROVER_KEY) === 'local' ? 'local' : 'wallet';

export const saveProver = (storage: Storage, prover: ProverChoice): void => storage.setItem(PROVER_KEY, prover);
```

- [ ] **Step 4: Add the test helpers**

Create `app/test/helpers.ts`. `simChain` is what lets every flow and page test run the real compiled contract:
```ts
import { LixiSimulator, T0 } from '@lixi/contract/testing';
import type { LixiChain } from '../src/chain/port';

export { T0 };
export const HOUR = 3600;
export const rnd = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32));

/** A LixiChain backed by the real compiled contract running in-process. */
export const simChain = (sim: LixiSimulator): LixiChain & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    readLedger: async () => sim.ledger(),
    create: async (privateState, a) => {
      calls.push('create');
      sim.privateState = privateState;
      return { id: sim.create(a.nonce, a.expiry, a.refundAddress, a.onePerAddress), txId: `tx${calls.length}` };
    },
    claim: async (a) => {
      calls.push('claim');
      sim.claim(a.id, a.share, a.path, a.recipient);
      return `tx${calls.length}`;
    },
    refund: async (privateState, id) => {
      calls.push('refund');
      sim.privateState = privateState;
      sim.refund(id);
      return `tx${calls.length}`;
    },
  };
};

/** In-memory Web Storage, for tests that run outside a browser. */
export class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

export { LixiSimulator };
```

- [ ] **Step 5: Run the tests**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat(app): tNIGHT units, expiry presets, vault storage and the chain port"
```

---

### Task 5: Create, claim, refund and restore flows, and dashboard status

All the app's decisions live here, as plain functions over `LixiChain` and `VaultStore`, tested against the real contract.

**Files:**
- Create: `app/src/lib/status.ts`, `app/src/flows/create.ts`, `app/src/flows/claim.ts`, `app/src/flows/manage.ts`
- Create: `app/test/flows.test.ts`

**Interfaces:**
- Consumes: Task 4 (`LixiChain`, `LixiReader`, `VaultStore`, `DURATION_MARGIN_SECONDS`, helpers); SDK `deriveEnvelope`, `addEnvelope`, `nextIndex`, `newVault`, `kdf`, `privateStateOf`, `resolveClaim`, `checkClaim`, `checkRefund`, `recoverVault`, `seedFromBackup`, `EXPIRY_WARNING_SECONDS`; `pureCircuits`, `toHex` from `@lixi/contract`.
- Produces:
  - `envelopeView(ledger, seed, saved, now): EnvelopeView` with `state: 'missing' | 'open' | 'empty' | 'refundable' | 'refunded'`, `claimed`, `unclaimedAmount`, `idHex`, and `shares: { amount: bigint; opened: boolean }[]` (one per real share, for the dashboard lights; frontend spec §11)
  - `CreateForm`, `loadOrCreateVault(store)`, `freeIndex(vault, ledger): number` (the index the next envelope will use; the Create preview needs it), `createEnvelope(chain, store, form, refundAddress, now): Promise<{ id; txId }>` (throws `'expiry out of range'`, or the SDK's split errors)
  - `ClaimRefusal`, `ClaimPreview`, `ClaimResult`, `previewClaim(ledger, link, now)`, `claimWithLink(chain, link, recipient, now: () => number, tries = 3)`
  - `RefundResult`, `refundEnvelope(chain, vault, index, now)`, `forgetEnvelope(store, index)`, `RestoreResult`, `restoreVault(reader, store, backup, { replaceDifferent })`

- [ ] **Step 1: Write the failing tests**

Create `app/test/flows.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { deriveEnvelope, linksFor, type ClaimLink } from '@lixi/sdk';
import { createEnvelope, freeIndex, type CreateForm } from '../src/flows/create';
import { claimWithLink, previewClaim } from '../src/flows/claim';
import { forgetEnvelope, refundEnvelope, restoreVault } from '../src/flows/manage';
import { envelopeView } from '../src/lib/status';
import { localVaultStore } from '../src/lib/storage';
import { HOUR, LixiSimulator, MemoryStorage, T0, rnd, simChain } from './helpers';

const form = (over: Partial<CreateForm> = {}): CreateForm => ({
  total: 3_000_000n,
  count: 3,
  split: 'equal',
  kind: 'personal',
  durationSeconds: 2 * HOUR,
  ...over,
});

const setup = () => {
  const sim = new LixiSimulator(BigInt(HOUR));
  const chain = simChain(sim);
  const store = localVaultStore(new MemoryStorage());
  const refundAddress = rnd();
  const create = (over: Partial<CreateForm> = {}) => createEnvelope(chain, store, form(over), refundAddress, sim.now);
  const linksOf = (index: number): ClaimLink[] => {
    const vault = store.load()!;
    return linksFor(
      deriveEnvelope(
        vault.seed,
        vault.envelopes.find((e) => e.index === index)!,
      ),
    );
  };
  return { sim, chain, store, refundAddress, create, linksOf, now: () => sim.now };
};

describe('createEnvelope', () => {
  it('saves the vault entry, then creates the envelope on chain', async () => {
    const { sim, store, create } = setup();
    const { id } = await create();
    const vault = store.load()!;
    expect(vault.envelopes).toHaveLength(1);
    expect(vault.envelopes[0]).toMatchObject({ index: 0, total: 3_000_000n, count: 3, expiry: BigInt(T0 + 2 * HOUR) });
    expect(sim.ledger().envelopes.member(id)).toBe(true);
    expect(store.backedUp()).toBe(false);
  });

  it('keeps the vault entry when the transaction fails, and the dashboard shows it as missing', async () => {
    const { sim, chain, store, create } = setup();
    chain.create = async () => {
      throw new Error('Rejected');
    };
    await expect(create()).rejects.toThrow('Rejected');
    const vault = store.load()!;
    expect(envelopeView(sim.ledger(), vault.seed, vault.envelopes[0], sim.now).state).toBe('missing');
    forgetEnvelope(store, 0);
    expect(store.load()!.envelopes).toHaveLength(0);
  });

  it('skips an index whose envelope is already on chain but missing from the vault', async () => {
    const { store, create } = setup();
    await create();
    forgetEnvelope(store, 0); // the vault lost it, the chain did not
    await create();
    expect(store.load()!.envelopes.map((e) => e.index)).toEqual([1]);
  });

  it('previews the amounts of exactly the index it will seal', async () => {
    const { sim, store, create } = setup();
    await create();
    forgetEnvelope(store, 0); // index 0 is on chain but no longer in the vault
    const vault = store.load()!;
    const index = freeIndex(vault, sim.ledger());
    expect(index).toBe(1);
    const preview = deriveEnvelope(vault.seed, {
      index,
      total: 5_000_000n,
      count: 4,
      kind: 'personal',
      split: 'random',
    });
    await create({ total: 5_000_000n, count: 4, split: 'random' });
    const sealed = store.load()!.envelopes.find((e) => e.index === index)!;
    expect(deriveEnvelope(store.load()!.seed, sealed).shares).toEqual(preview.shares);
  });

  it('refuses expiries outside the contract bounds before touching the vault', async () => {
    const { store, create } = setup();
    await expect(create({ durationSeconds: HOUR })).rejects.toThrow('expiry out of range');
    await expect(create({ durationSeconds: 30 * 86400 })).rejects.toThrow('expiry out of range');
    expect(store.load()).toBeUndefined();
  });

  it('rejects a random split for a group link', async () => {
    const { create } = setup();
    await expect(create({ kind: 'group', split: 'random' })).rejects.toThrow(/equal split/);
  });
});

describe('claim', () => {
  it('previews, claims and pays the exact share', async () => {
    const { sim, chain, create, linksOf, now } = setup();
    await create({ split: 'random' });
    const [link] = linksOf(0);
    const preview = previewClaim(sim.ledger(), link, sim.now);
    expect(preview).toMatchObject({ ok: true, expiringSoon: false });
    const who = rnd();
    const result = await claimWithLink(chain, link, who, now);
    expect(result).toEqual({ ok: true, amount: preview.ok && preview.amount, txId: 'tx2' });
    expect(previewClaim(sim.ledger(), link, sim.now)).toEqual({ ok: false, reason: 'already claimed' });
    expect(await claimWithLink(chain, link, rnd(), now)).toEqual({ ok: false, reason: 'already claimed' });
  });

  it('warns when less than 10 minutes are left, and refuses after expiry', async () => {
    const { sim, create, linksOf } = setup();
    await create();
    const [link] = linksOf(0);
    sim.now = T0 + 2 * HOUR - 300;
    expect(previewClaim(sim.ledger(), link, sim.now)).toMatchObject({ ok: true, expiringSoon: true });
    sim.now = T0 + 2 * HOUR;
    expect(previewClaim(sim.ledger(), link, sim.now)).toEqual({ ok: false, reason: 'expired' });
  });

  it('says "no envelope" for a link from another deployment', async () => {
    const { sim, linksOf, create } = setup();
    await create();
    const [link] = linksOf(0);
    const other = new LixiSimulator(BigInt(HOUR));
    expect(previewClaim(other.ledger(), link, sim.now)).toEqual({ ok: false, reason: 'no envelope' });
  });

  it('a group link pays each wallet once and retries when another claimer takes its share', async () => {
    const { sim, chain, create, linksOf, now } = setup();
    await create({ kind: 'group', count: 2, total: 2_000_000n });
    const [link] = linksOf(0);
    const alice = rnd();
    expect(await claimWithLink(chain, link, alice, now)).toMatchObject({ ok: true, amount: 1_000_000n });
    expect(await claimWithLink(chain, link, alice, now)).toEqual({ ok: false, reason: 'address already claimed' });

    // Bob's first submission loses a race: someone claims the last share first.
    const realClaim = chain.claim;
    let raced = false;
    chain.claim = async (args) => {
      if (!raced) {
        raced = true;
        await realClaim(args); // the other claimer lands first...
        throw new Error('nullifier already used'); // ...so Bob's transaction fails
      }
      return realClaim(args);
    };
    expect(await claimWithLink(chain, link, rnd(), now)).toEqual({ ok: false, reason: 'all shares claimed' });
    expect(previewClaim(sim.ledger(), link, sim.now)).toEqual({ ok: false, reason: 'all shares claimed' });
  });

  it('rethrows a failure that is not a lost race, such as the user declining in the wallet', async () => {
    const { chain, create, linksOf, now } = setup();
    await create();
    chain.claim = async () => {
      throw new Error('Rejected');
    };
    await expect(claimWithLink(chain, linksOf(0)[0], rnd(), now)).rejects.toThrow('Rejected');
  });

  it('prefers "refunded" over "already claimed"', async () => {
    const { sim, chain, store, create, linksOf, now } = setup();
    await create({ count: 1, total: 1_000_000n });
    const [link] = linksOf(0);
    sim.now = T0 + 2 * HOUR;
    expect(await refundEnvelope(chain, store.load()!, 0, sim.now)).toMatchObject({ ok: true });
    expect(await claimWithLink(chain, link, rnd(), now)).toEqual({ ok: false, reason: 'refunded' });
  });
});

describe('dashboard state and refund', () => {
  it('tracks claims, offers refund only after expiry, and refunds exactly the unclaimed rest', async () => {
    const { sim, chain, store, refundAddress, create, linksOf, now } = setup();
    await create({ count: 3, total: 3_000_000n });
    const vault = () => store.load()!;
    const view = () => envelopeView(sim.ledger(), vault().seed, vault().envelopes[0], sim.now);
    expect(view()).toMatchObject({ state: 'open', claimed: 0, unclaimedAmount: 3_000_000n });

    await claimWithLink(chain, linksOf(0)[1], rnd(), now);
    expect(view()).toMatchObject({ state: 'open', claimed: 1, unclaimedAmount: 2_000_000n });
    expect(view().shares.map((s) => s.opened)).toEqual([false, true, false]);
    expect(await refundEnvelope(chain, vault(), 0, sim.now)).toEqual({ ok: false, reason: 'not expired' });

    sim.now = T0 + 2 * HOUR;
    expect(view().state).toBe('refundable');
    expect(await refundEnvelope(chain, vault(), 0, sim.now)).toMatchObject({ ok: true });
    expect(sim.lastPayouts().get(Buffer.from(refundAddress).toString('hex'))).toBe(2_000_000n);
    expect(view().state).toBe('refunded');
    expect(await refundEnvelope(chain, vault(), 0, sim.now)).toEqual({ ok: false, reason: 'refunded' });
  });

  it('shows a fully claimed envelope as empty', async () => {
    const { sim, chain, store, create, linksOf, now } = setup();
    await create({ count: 2, total: 2_000_000n });
    for (const link of linksOf(0)) await claimWithLink(chain, link, rnd(), now);
    const vault = store.load()!;
    expect(envelopeView(sim.ledger(), vault.seed, vault.envelopes[0], sim.now)).toMatchObject({
      state: 'empty',
      claimed: 2,
    });
  });
});

describe('restoreVault', () => {
  it('rebuilds every envelope from the backup string alone', async () => {
    const { chain, store, create } = setup();
    await create({ split: 'random', count: 5, total: 5_000_000n });
    await create({ kind: 'group', count: 4, total: 4_000_000n });
    const { backupString } = await import('@lixi/sdk');
    const backup = backupString(store.load()!);
    const fresh = localVaultStore(new MemoryStorage());
    expect(await restoreVault(chain, fresh, `  ${backup}\n`, { replaceDifferent: false })).toEqual({
      ok: true,
      found: 2,
    });
    expect(fresh.load()!.envelopes.map(({ index, count, kind, split }) => ({ index, count, kind, split }))).toEqual(
      store.load()!.envelopes.map(({ index, count, kind, split }) => ({ index, count, kind, split })),
    );
    expect(fresh.backedUp()).toBe(true);
  });

  it('will not silently replace a vault that holds envelopes under another seed', async () => {
    const a = setup();
    await a.create();
    const b = setup();
    await b.create();
    const { backupString } = await import('@lixi/sdk');
    const backupB = backupString(b.store.load()!);
    expect(await restoreVault(a.chain, a.store, backupB, { replaceDifferent: false })).toEqual({
      ok: false,
      reason: 'different seed',
    });
    expect(await restoreVault(a.chain, a.store, 'hello', { replaceDifferent: true })).toEqual({
      ok: false,
      reason: 'not a backup',
    });
    expect(await restoreVault(a.chain, a.store, backupB, { replaceDifferent: true })).toMatchObject({ ok: true });
  });
});
```
Run: `npm test -w @lixi/app`
Expected: FAIL, modules not found.

- [ ] **Step 2: Dashboard status**

Create `app/src/lib/status.ts`:
```ts
import { pureCircuits, toHex, type Ledger } from '@lixi/contract';
import { deriveEnvelope, type SavedEnvelope } from '@lixi/sdk';

export type EnvelopeState =
  /** Not found on chain: the create transaction failed, was declined, or is still in flight. */
  | 'missing'
  | 'open'
  /** Every share was claimed. */
  | 'empty'
  /** Expired with unclaimed shares, so the sender can refund. */
  | 'refundable'
  | 'refunded';

/** One real share of an envelope, as its light shows it. */
export type ShareView = { readonly amount: bigint; readonly opened: boolean };

export type EnvelopeView = {
  readonly saved: SavedEnvelope;
  readonly idHex: string;
  readonly state: EnvelopeState;
  readonly claimed: number;
  readonly unclaimedAmount: bigint;
  /** The envelope's real shares in link order; `opened` once its nullifier is on chain. */
  readonly shares: readonly ShareView[];
};

/** The dashboard row for one vault envelope, computed locally from public nullifiers. */
export const envelopeView = (
  ledger: Pick<Ledger, 'envelopes' | 'nullifiers'>,
  seed: Uint8Array,
  saved: SavedEnvelope,
  now: number,
): EnvelopeView => {
  const d = deriveEnvelope(seed, saved);
  const idHex = toHex(d.id);
  const real = d.shares.slice(0, saved.count);
  if (!ledger.envelopes.member(d.id)) {
    const shares = real.map((s) => ({ amount: s.amount, opened: false }));
    return { saved, idHex, state: 'missing', claimed: 0, unclaimedAmount: 0n, shares };
  }
  const env = ledger.envelopes.lookup(d.id);
  const shares = real.map((s) => ({
    amount: s.amount,
    opened: ledger.nullifiers.member(pureCircuits.nullifierOf(d.id, s.secret)),
  }));
  const open = shares.filter((s) => !s.opened);
  const unclaimedAmount = open.reduce((sum, s) => sum + s.amount, 0n);
  const claimed = saved.count - open.length;
  const state: EnvelopeState = env.refunded
    ? 'refunded'
    : open.length === 0
      ? 'empty'
      : now >= Number(env.expiry)
        ? 'refundable'
        : 'open';
  return { saved, idHex, state, claimed, unclaimedAmount, shares };
};
```

- [ ] **Step 3: Create flow**

Create `app/src/flows/create.ts`. The vault entry is saved before the transaction. `freeIndex` skips an index whose envelope is already on chain (an entry the vault lost), and is exported so the Create page previews exactly that index:
```ts
import { pureCircuits } from '@lixi/contract';
import {
  addEnvelope,
  deriveEnvelope,
  kdf,
  newVault,
  nextIndex,
  privateStateOf,
  type EnvelopeKind,
  type SenderVault,
  type SplitMode,
} from '@lixi/sdk';
import type { Ledger } from '@lixi/contract';
import type { LixiChain } from '../chain/port';
import { DURATION_MARGIN_SECONDS } from '../lib/time';
import type { VaultStore } from '../lib/storage';

export type CreateForm = {
  readonly total: bigint;
  readonly count: number;
  readonly split: SplitMode;
  readonly kind: EnvelopeKind;
  readonly durationSeconds: number;
};

/** The vault to create into: the saved one, or a fresh one that is saved right away. */
export const loadOrCreateVault = (store: VaultStore): SenderVault => {
  const saved = store.load();
  if (saved) return saved;
  const vault = newVault();
  store.save(vault);
  store.setBackedUp(false);
  return vault;
};

/**
 * First index at or after `nextIndex` whose envelope id is not on chain yet (skips orphans of lost
 * vault entries). The Create page previews the amounts at this index, so the preview is what gets sealed.
 */
export const freeIndex = (vault: SenderVault, ledger: Pick<Ledger, 'envelopes'>): number => {
  let index = nextIndex(vault);
  while (ledger.envelopes.member(pureCircuits.envelopeId(kdf(vault.seed, 'nonce', index)))) index++;
  return index;
};

/**
 * Creates an envelope. The vault entry is saved *before* the transaction, so a closed tab or a
 * failed submission never loses the record of what was (maybe) put on chain.
 */
export const createEnvelope = async (
  chain: LixiChain,
  store: VaultStore,
  form: CreateForm,
  refundAddress: Uint8Array,
  now: number,
): Promise<{ id: Uint8Array; txId: string }> => {
  const ledger = await chain.readLedger();
  const min = Number(ledger.minDuration) + DURATION_MARGIN_SECONDS;
  const max = Number(ledger.maxDuration) - DURATION_MARGIN_SECONDS;
  if (form.durationSeconds < min || form.durationSeconds > max) throw new Error('expiry out of range');
  const vault = loadOrCreateVault(store);
  const spec = {
    index: freeIndex(vault, ledger),
    total: form.total,
    count: form.count,
    kind: form.kind,
    split: form.split,
  };
  const d = deriveEnvelope(vault.seed, spec); // throws on a bad count, total or group + random
  const expiry = BigInt(now + form.durationSeconds);
  const next = addEnvelope(vault, { ...spec, expiry, labels: [] });
  store.save(next);
  return chain.create(privateStateOf(next), {
    nonce: d.nonce,
    expiry,
    refundAddress,
    onePerAddress: form.kind === 'group',
  });
};
```

- [ ] **Step 4: Claim flow**

Create `app/src/flows/claim.ts`. Envelope-level refusals come first, every attempt re-runs the contract's checks before proving, and only a lost race on a group link is retried:
```ts
import { pureCircuits, type Ledger } from '@lixi/contract';
import {
  EXPIRY_WARNING_SECONDS,
  checkClaim,
  resolveClaim,
  type ClaimArgs,
  type ClaimLink,
  type ClaimRejection,
} from '@lixi/sdk';
import type { LixiChain } from '../chain/port';

export type ClaimRefusal = ClaimRejection | 'all shares claimed';

type Ready = { readonly ok: true; readonly args: ClaimArgs; readonly amount: bigint; readonly secondsLeft: number };
type Refused = { readonly ok: false; readonly reason: ClaimRefusal };

export type ClaimPreview =
  | { readonly ok: true; readonly amount: bigint; readonly secondsLeft: number; readonly expiringSoon: boolean }
  | Refused;

export type ClaimResult = { readonly ok: true; readonly amount: bigint; readonly txId: string } | Refused;

/** Any address will do before a wallet is connected: only group envelopes look at it. */
const NO_ADDRESS = new Uint8Array(32);

const prepare = (ledger: Ledger, link: ClaimLink, recipient: Uint8Array, now: number): Ready | Refused => {
  // Envelope-level refusals first: "expired" or "refunded" explain more than "claimed".
  if (!ledger.envelopes.member(link.id)) return { ok: false, reason: 'no envelope' };
  const env = ledger.envelopes.lookup(link.id);
  if (env.refunded) return { ok: false, reason: 'refunded' };
  if (now >= Number(env.expiry)) return { ok: false, reason: 'expired' };
  let args: ClaimArgs;
  try {
    args = resolveClaim(link, (nf) => ledger.nullifiers.member(nf));
  } catch {
    return { ok: false, reason: link.kind === 'group' ? 'all shares claimed' : 'already claimed' };
  }
  const check = checkClaim(ledger, args, recipient, now);
  return check.ok ? { ok: true, args, amount: check.amount, secondsLeft: check.secondsLeft } : check;
};

/** What the recipient sees before connecting a wallet. */
export const previewClaim = (ledger: Ledger, link: ClaimLink, now: number): ClaimPreview => {
  const ready = prepare(ledger, link, NO_ADDRESS, now);
  if (!ready.ok) return ready;
  return {
    ok: true,
    amount: ready.amount,
    secondsLeft: ready.secondsLeft,
    expiringSoon: ready.secondsLeft < EXPIRY_WARNING_SECONDS,
  };
};

/**
 * Claims one share for `recipient`. Every attempt re-runs the contract's checks first (spec §4.6), so
 * a doomed claim costs no proof. If a submission fails because someone else took the share meanwhile,
 * a personal link reports "already claimed" and a group link retries with another share (spec §4.6:
 * at most `tries` attempts). Any other failure is rethrown for the page to explain.
 */
export const claimWithLink = async (
  chain: LixiChain,
  link: ClaimLink,
  recipient: Uint8Array,
  now: () => number,
  tries = 3,
): Promise<ClaimResult> => {
  for (let attempt = 1; ; attempt++) {
    const ready = prepare(await chain.readLedger(), link, recipient, now());
    if (!ready.ok) return ready;
    try {
      const txId = await chain.claim({ ...ready.args, recipient });
      return { ok: true, amount: ready.amount, txId };
    } catch (error) {
      const ledger = await chain.readLedger().catch(() => undefined);
      if (!ledger) throw error;
      const taken = ledger.nullifiers.member(pureCircuits.nullifierOf(ready.args.id, ready.args.share.secret));
      if (taken && link.kind === 'group' && attempt < tries) continue;
      const again = prepare(ledger, link, recipient, now());
      if (!again.ok) return again;
      throw error;
    }
  }
};
```

- [ ] **Step 5: Refund, forget and restore**

Create `app/src/flows/manage.ts`:
```ts
import {
  checkRefund,
  deriveEnvelope,
  privateStateOf,
  recoverVault,
  seedFromBackup,
  type RefundCheck,
  type SenderVault,
} from '@lixi/sdk';
import type { LixiChain, LixiReader } from '../chain/port';
import type { VaultStore } from '../lib/storage';

export type RefundResult = { readonly ok: true; readonly txId: string } | Extract<RefundCheck, { ok: false }>;

/** Refunds the unclaimed rest of a vault envelope to its refund address, after the same checks the contract runs. */
export const refundEnvelope = async (
  chain: LixiChain,
  vault: SenderVault,
  index: number,
  now: number,
): Promise<RefundResult> => {
  const saved = vault.envelopes.find((e) => e.index === index);
  if (!saved) throw new Error('unknown envelope');
  const { id } = deriveEnvelope(vault.seed, saved);
  const check = checkRefund(await chain.readLedger(), id, now);
  if (!check.ok) return check;
  return { ok: true, txId: await chain.refund(privateStateOf(vault), id) };
};

/** Drops a vault entry whose envelope never reached the chain. */
export const forgetEnvelope = (store: VaultStore, index: number): void => {
  const vault = store.load();
  if (vault) store.save({ ...vault, envelopes: vault.envelopes.filter((e) => e.index !== index) });
};

export type RestoreResult =
  | { readonly ok: true; readonly found: number }
  | { readonly ok: false; readonly reason: 'not a backup' | 'different seed' };

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Rebuilds the vault from a backup string by scanning the chain (spec §4.4). Replacing a vault that
 * holds envelopes under a *different* seed needs `replaceDifferent`, because that seed is then gone.
 * An unreadable saved vault may always be replaced: restoring is the way out of 'corrupt vault'.
 */
export const restoreVault = async (
  reader: LixiReader,
  store: VaultStore,
  backup: string,
  options: { readonly replaceDifferent: boolean },
): Promise<RestoreResult> => {
  let seed: Uint8Array;
  try {
    seed = seedFromBackup(backup);
  } catch {
    return { ok: false, reason: 'not a backup' };
  }
  let current: SenderVault | undefined;
  try {
    current = store.load();
  } catch {
    current = undefined;
  }
  if (current && current.envelopes.length > 0 && !sameBytes(current.seed, seed) && !options.replaceDifferent) {
    return { ok: false, reason: 'different seed' };
  }
  const ledger = await reader.readLedger();
  const vault = recoverVault(seed, (id) => (ledger.envelopes.member(id) ? ledger.envelopes.lookup(id) : undefined));
  store.save(vault);
  store.setBackedUp(true);
  return { ok: true, found: vault.envelopes.length };
};
```

- [ ] **Step 6: Run the tests**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app`
Expected: PASS, 27 tests.

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "feat(app): create, claim, refund and restore flows with dashboard status"
```

---

### Task 6: Wallet bridge, Midnight providers and services

This productizes the S4 spike page. `chain/midnight.ts` cannot be unit-tested without a wallet; Task 11 exercises it on Preprod. Everything around it is tested.

**Files:**
- Create: `app/src/wallet/errors.ts`, `app/src/wallet/connector.ts`, `app/src/chain/midnight.ts`, `app/src/services.tsx`, `app/src/wallet/WalletContext.tsx`
- Create: `app/test/wallet.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5; SDK `NETWORKS`, `readLedger`, `createEnvelopeTx`, `claimTx`, `refundTx`, `memoryPrivateStateProvider`, `userAddressBytes`, `LixiCircuit`, `LixiProviders`; dapp-connector-api types.
- Produces:
  - `messageOf(e)`, `friendlyError(e): string`, `PROOF_SERVER_COMMAND` (the claim page words its own refusals, Task 9)
  - `detectWallets(injected)`, `retryingOnce(api)`, `connectWallet(wallet, networkId, timeoutMs = 60_000)` (rejects with `'connect timed out'`), `CONNECT_TIMEOUT_MS`
  - `publicReader(config): LixiReader`, `walletChain(api, config, prover): Promise<LixiChain>` (a local prover failure becomes `'proof server unreachable'`)
  - `Services` (`config`, `reader`, `storage`, `now`, `origin`, `detectWallets`, `openChain`), `ServicesProvider`, `useServices()`
  - `WalletProvider`, `useWallet()` → `{ state: WalletState; connect(wallet, prover); disconnect() }`, `ConnectedWallet` (`name`, `address`, `recipient`, `chain`), `useDetectedWallets()`. An address that does not decode for the app's network becomes `'wrong network'`.

- [ ] **Step 1: Write the failing tests**

Create `app/test/wallet.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { connectWallet, detectWallets, retryingOnce } from '../src/wallet/connector';
import { friendlyError } from '../src/wallet/errors';

const initial = (over: Partial<InitialAPI> = {}): InitialAPI => ({
  rdns: 'xyz.1am',
  name: '1AM',
  icon: '',
  apiVersion: '4.0.1',
  connect: async () => ({}) as ConnectedAPI,
  ...over,
});

describe('detectWallets', () => {
  it('keeps one compatible API per wallet', () => {
    const found = detectWallets({
      a: initial(),
      b: initial({ apiVersion: '4.1.0' }),
      c: initial({ rdns: 'io.lace', name: 'Lace', apiVersion: '3.0.0' }),
      d: { name: 'junk' } as unknown as InitialAPI,
    });
    expect(found.map((w) => `${w.name} ${w.apiVersion}`)).toEqual(['1AM 4.0.1']);
    expect(detectWallets(undefined)).toEqual([]);
  });
});

describe('retryingOnce', () => {
  it('retries a call once after the idle "Request failed" error, and nothing else', async () => {
    let calls = 0;
    const api = retryingOnce({
      getDustBalance: async () => {
        calls++;
        if (calls === 1) throw new Error('Request failed');
        return { cap: 0n, balance: 5n };
      },
      submitTransaction: async () => {
        throw new Error('Rejected');
      },
    } as unknown as ConnectedAPI);
    expect(await api.getDustBalance()).toEqual({ cap: 0n, balance: 5n });
    expect(calls).toBe(2);
    await expect(api.submitTransaction('00')).rejects.toThrow('Rejected');
  });
});

describe('connectWallet', () => {
  it('gives up on a wallet that never answers', async () => {
    vi.useFakeTimers();
    const pending = connectWallet(initial({ connect: () => new Promise(() => {}) }), 'preprod', 60_000);
    const outcome = expect(pending).rejects.toThrow('connect timed out');
    await vi.advanceTimersByTimeAsync(60_000);
    await outcome;
    vi.useRealTimers();
  });
});

describe('friendlyError', () => {
  it('turns connector, prover and wallet errors into instructions', () => {
    const connectorError = (code: string) => ({ type: 'DAppConnectorAPIError', code, reason: 'x', message: 'x' });
    expect(friendlyError(connectorError('Rejected'))).toBe('You declined the request in your wallet.');
    expect(friendlyError(new Error('connect timed out'))).toMatch(/extensions menu/);
    expect(friendlyError(new Error('Wallet is syncing — open 1AM and wait for sync to finish'))).toMatch(
      /still syncing/,
    );
    expect(friendlyError(new Error('proof server unreachable'))).toMatch(/docker run/);
    const pending = 'A transaction is already pending. Wait for it to confirm or expire before requesting another.';
    expect(friendlyError(new Error(pending))).toBe(pending);
    expect(friendlyError(new Error('boom'))).toBe(
      'boom. If your wallet just sent another transaction, wait about 30 seconds and try again.',
    );
  });
});
```
Run: `npm test -w @lixi/app`
Expected: FAIL, modules not found.

- [ ] **Step 2: Error text**

Create `app/src/wallet/errors.ts`:
```ts
export const messageOf = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error);

/** DApp Connector errors are plain objects tagged with `type`, not Error subclasses. */
const connectorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && (error as { type?: unknown }).type === 'DAppConnectorAPIError'
    ? String((error as { code?: unknown }).code)
    : undefined;

export const PROOF_SERVER_COMMAND =
  'docker run -p 127.0.0.1:6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server';

/**
 * One sentence for the user about a failed wallet, prover or chain call (spec §4.6). Error messages
 * from these layers never contain link secrets, so passing the text through is safe.
 */
export const friendlyError = (error: unknown): string => {
  const code = connectorCode(error);
  const text = messageOf(error);
  if (code === 'Rejected' || code === 'PermissionRejected') return 'You declined the request in your wallet.';
  if (code === 'Disconnected') return 'Your wallet disconnected. Connect it again.';
  if (text === 'connect timed out')
    return 'Your wallet did not answer. Open it from the browser’s extensions menu, approve the connection, then try again.';
  if (text === 'wrong network') return 'Your wallet is on another network. Switch it to Preprod, then connect again.';
  if (text === 'proof server unreachable')
    return `The local proof server is not running. Start it with “${PROOF_SERVER_COMMAND}”, or prove in your wallet instead.`;
  if (text === 'corrupt vault')
    return 'Your saved Lixi data cannot be read. Restore it from your backup string on the Dashboard.';
  if (text === 'expiry out of range') return 'That expiry is outside what the contract allows. Pick another one.';
  if (/syncing/i.test(text))
    return 'Your wallet is still syncing with the network. Open it, wait until the sync finishes (a new wallet can take a while), then try again.';
  // 1AM allows one pending transaction at a time; its own message says what to do (spike S4).
  if (/already pending/i.test(text)) return text;
  return `${text.replace(/\.$/, '')}. If your wallet just sent another transaction, wait about 30 seconds and try again.`;
};
```

- [ ] **Step 3: Connector**

Create `app/src/wallet/connector.ts`:
```ts
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { messageOf } from './errors';

/** Lace's connect() can hang without an error (spike S4), so connecting gives up after this long. */
export const CONNECT_TIMEOUT_MS = 60_000;

/** The DApp Connector API major version this app is built against (4.0.1). */
const API_MAJOR = '4.';

/** Wallets that injected a compatible DApp Connector API into `window.midnight`, one per wallet. */
export const detectWallets = (injected: Record<string, InitialAPI> | undefined): InitialAPI[] => {
  const byRdns = new Map<string, InitialAPI>();
  for (const w of Object.values(injected ?? {})) {
    const compatible = typeof w?.connect === 'function' && String(w.apiVersion).startsWith(API_MAJOR);
    if (compatible && !byRdns.has(w.rdns)) byRdns.set(w.rdns, w);
  }
  return [...byRdns.values()];
};

/**
 * 1AM fails the first call after ~1 min idle with "Request failed", and an immediate retry
 * succeeds (spike S4). Every connector call therefore gets one retry on exactly that error.
 */
export const retryingOnce = (api: ConnectedAPI): ConnectedAPI =>
  new Proxy(api, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        try {
          return await value.apply(target, args);
        } catch (error) {
          if (!messageOf(error).includes('Request failed')) throw error;
          return value.apply(target, args);
        }
      };
    },
  });

/** Connects to `wallet` for `networkId`, giving up with 'connect timed out' after `timeoutMs`. */
export const connectWallet = async (
  wallet: InitialAPI,
  networkId: string,
  timeoutMs = CONNECT_TIMEOUT_MS,
): Promise<ConnectedAPI> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('connect timed out')), timeoutMs);
  });
  try {
    return retryingOnce(await Promise.race([wallet.connect(networkId), timedOut]));
  } finally {
    clearTimeout(timer);
  }
};
```

- [ ] **Step 4: Run the tests**

Run: `npm test -w @lixi/app`
Expected: PASS, 31 tests.

- [ ] **Step 5: Midnight providers**

Create `app/src/chain/midnight.ts`. It follows `spikes/s4-wallet/src/main.ts`, minus the tracing and the sponsor path:
```ts
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { createProofProvider, type ProofProvider } from '@midnight-ntwrk/midnight-js-types';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  NETWORKS,
  claimTx,
  createEnvelopeTx,
  memoryPrivateStateProvider,
  readLedger,
  refundTx,
  type LixiCircuit,
  type LixiProviders,
} from '@lixi/sdk';
import type { AppConfig } from '../config';
import type { LixiChain, LixiReader, ProverChoice } from './port';

type WebSocketCtor = Parameters<typeof indexerPublicDataProvider>[2];

/**
 * Reads go to the network's public indexer, not the wallet's: the page can show an envelope before
 * any wallet connects, and the CSP can name every host the page talks to.
 */
const publicData = (config: AppConfig) => {
  const n = NETWORKS[config.network];
  // The provider is typed against the `ws` package; the browser's WebSocket is what it needs here.
  return indexerPublicDataProvider(n.indexer, n.indexerWS, WebSocket as unknown as WebSocketCtor);
};

export const publicReader = (config: AppConfig): LixiReader => {
  const provider = publicData(config);
  return { readLedger: () => readLedger(provider, config.contractAddress) };
};

/** The local proof server, with "not running" reported as such rather than as a bare fetch error. */
const localProver = (url: string, zk: FetchZkConfigProvider<LixiCircuit>): ProofProvider => {
  const inner = httpClientProofProvider(url, zk);
  return {
    proveTx: async (tx, cfg) => {
      try {
        return await inner.proveTx(tx, cfg);
      } catch (error) {
        throw error instanceof TypeError ? new Error('proof server unreachable') : error;
      }
    },
  };
};

/** A LixiChain whose transactions the connected browser wallet balances, pays for and submits (spike S4). */
export const walletChain = async (api: ConnectedAPI, config: AppConfig, prover: ProverChoice): Promise<LixiChain> => {
  const zk = new FetchZkConfigProvider<LixiCircuit>(window.location.origin, fetch.bind(window));
  const shielded = await api.getShieldedAddresses();
  const publicDataProvider = publicData(config);
  const providers: LixiProviders = {
    privateStateProvider: memoryPrivateStateProvider(),
    publicDataProvider,
    zkConfigProvider: zk,
    proofProvider:
      prover === 'wallet' && typeof api.getProvingProvider === 'function'
        ? createProofProvider(await api.getProvingProvider(zk))
        : localProver(NETWORKS[config.network].proofServer, zk),
    walletProvider: {
      getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
      balanceTx: async (tx) => {
        const { tx: balanced } = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced));
      },
    },
    midnightProvider: {
      submitTx: async (tx) => {
        await api.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };
  const address = config.contractAddress;
  return {
    readLedger: () => readLedger(publicDataProvider, address),
    create: (privateState, args) => createEnvelopeTx(providers, address, privateState, args),
    claim: (args) => claimTx(providers, address, args),
    refund: (privateState, id) => refundTx(providers, address, privateState, id),
  };
};
```

- [ ] **Step 6: Services and wallet state**

Create `app/src/services.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { AppConfig } from './config';
import type { LixiChain, LixiReader, ProverChoice } from './chain/port';

/** Everything the pages need from the outside world, injected so tests can run pages against the simulator. */
export type Services = {
  readonly config: AppConfig;
  readonly reader: LixiReader;
  readonly storage: Storage;
  /** Unix seconds. */
  readonly now: () => number;
  /** Origin that claim links point to. */
  readonly origin: string;
  readonly detectWallets: () => InitialAPI[];
  readonly openChain: (api: ConnectedAPI, prover: ProverChoice) => Promise<LixiChain>;
};

const ServicesContext = createContext<Services | null>(null);

export const ServicesProvider = ({ services, children }: { services: Services; children: ReactNode }) => (
  <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
);

export const useServices = (): Services => {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('ServicesProvider missing');
  return services;
};
```
Create `app/src/wallet/WalletContext.tsx`:
```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { userAddressBytes } from '@lixi/sdk';
import type { LixiChain, ProverChoice } from '../chain/port';
import { useServices } from '../services';
import { connectWallet } from './connector';
import { friendlyError } from './errors';

export type ConnectedWallet = {
  readonly name: string;
  /** Bech32m unshielded address, for display. */
  readonly address: string;
  /** The same address as contract `UserAddress` bytes: where claims pay and refunds go. */
  readonly recipient: Uint8Array;
  readonly chain: LixiChain;
};

export type WalletState =
  | { readonly status: 'idle' }
  | { readonly status: 'connecting'; readonly name: string }
  | { readonly status: 'connected'; readonly wallet: ConnectedWallet }
  | { readonly status: 'failed'; readonly message: string };

type WalletContextValue = {
  readonly state: WalletState;
  connect(wallet: InitialAPI, prover: ProverChoice): Promise<void>;
  disconnect(): void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const services = useServices();
  const [state, setState] = useState<WalletState>({ status: 'idle' });

  const connect = useCallback(
    async (initial: InitialAPI, prover: ProverChoice) => {
      setState({ status: 'connecting', name: initial.name });
      try {
        const api = await connectWallet(initial, services.config.network);
        const { unshieldedAddress } = await api.getUnshieldedAddress();
        let recipient: Uint8Array;
        try {
          recipient = userAddressBytes(unshieldedAddress, services.config.network);
        } catch {
          throw new Error('wrong network');
        }
        const chain = await services.openChain(api, prover);
        setState({ status: 'connected', wallet: { name: initial.name, address: unshieldedAddress, recipient, chain } });
      } catch (error) {
        setState({ status: 'failed', message: friendlyError(error) });
      }
    },
    [services],
  );

  const value = useMemo(() => ({ state, connect, disconnect: () => setState({ status: 'idle' }) }), [state, connect]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = (): WalletContextValue => {
  const value = useContext(WalletContext);
  if (!value) throw new Error('WalletProvider missing');
  return value;
};

/** Injected wallets. Extensions can inject a moment after page load, so look again for a few seconds. */
export const useDetectedWallets = (): InitialAPI[] => {
  const { detectWallets } = useServices();
  const [wallets, setWallets] = useState(detectWallets);
  useEffect(() => {
    if (wallets.length > 0) return;
    let tries = 0;
    const timer = setInterval(() => {
      const found = detectWallets();
      if (found.length > 0 || ++tries >= 6) clearInterval(timer);
      if (found.length > 0) setWallets(found);
    }, 500);
    return () => clearInterval(timer);
  }, [detectWallets, wallets.length]);
  return wallets;
};
```

- [ ] **Step 7: Typecheck, lint, test**

Run: `npm run typecheck -w @lixi/app && npx eslint app && npm test -w @lixi/app`
Expected: no type or lint errors; 31 tests pass.

- [ ] **Step 8: Commit**

```bash
git add app
git commit -m "feat(app): wallet detection and connection, Midnight providers, error text"
```

---

### Task 7: Theme, site shell and the full home page

Implements frontend spec §3–§5, §6.1, §7, §8 and §10: the night palette, Fraunces and Playwrite VN, the `Light` component, icon links, the sticky header with scroll spy and mobile menu, the footer, and the home page with its section moments.

**Files:**
- Create: `app/index.html`, `app/public/favicon.svg`, `app/src/polyfills.ts`, `app/src/index.css`, `app/src/theme.ts`
- Create: `app/src/assets/fonts/playwrite-vn-200.woff2`, `app/src/assets/fonts/OFL-playwrite-vn.txt` (downloaded)
- Create: `app/src/lib/links.ts`, `app/src/lib/reveal.ts`
- Create: `app/src/components/icons.tsx`, `app/src/components/Light.tsx`, `app/src/components/ui.tsx`, `app/src/components/WalletPanel.tsx`, `app/src/components/Header.tsx`, `app/src/components/Footer.tsx`, `app/src/components/Layout.tsx`
- Create: `app/src/pages/Home.tsx`, `app/src/pages/NotFound.tsx`, `app/src/App.tsx`, `app/src/main.tsx`
- Create: `app/test/theme.test.ts`, `app/test/app-harness.tsx`, `app/test/shell.test.tsx`
- Modify: `.github/workflows/ci.yml` (app build step)

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces:
  - `TOKENS` (colour name → hex) and `contrast(fg, bg)` in `theme.ts`; Tailwind colours `night`, `night-deep`, `ember`, `lantern`, `lantern-deep`, `envelope-flap`, `seal`, `seal-ink`, `paper`, `paper-soft`, `paper-dim`, `out`, `error`; fonts `font-display` (Fraunces Variable) and `font-hand` (Playwrite VN)
  - `LINKS` (`github`, `contract`, `midnight`, `wallet`, `faucet`, `notes`, each `{ label, href }`), `useReveal(rootRef)`
  - Icons: `GitHubIcon`, `ContractIcon`, `MoonIcon`, `WalletIcon`, `DropletIcon`, `BookIcon`, `MenuIcon`, `CopyIcon`, `CheckIcon`
  - `Light({ state: 'lit' | 'out' | 'home' | 'ghost' | 'pending', size?, label?, focusable?, className?, style? })`, `LightState`
  - `Button`, `ButtonLink` (`tone: 'primary' | 'quiet' | 'home'`), `buttonClass`, `Notice` (`tone: 'info' | 'warn' | 'error'`), `Working`, `Greeting`, `IconLink({ label, href, children })`
  - `WalletPanel({ purpose, cta? })`, `RequireWallet({ purpose, cta?, children: (wallet) => ReactNode })`
  - `Header` (with `SECTIONS`), `Footer`, `Layout`, `Page` (the width and gutters app pages use)
  - `App` (routes; Tasks 8–10 add theirs). The test harness has `setup(overrides?: Partial<Services>)` → `{ sim, chain, storage, store, show(path), create(form?) }` and `ORIGIN`.

- [ ] **Step 1: Write the failing theme test**

Create `app/test/theme.test.ts`. It keeps `theme.ts` and `index.css` equal and checks spec §4.1’s contrast claims:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOKENS, contrast, type Token } from '../src/theme';

describe('colour tokens', () => {
  it('are the same values index.css gives Tailwind', () => {
    const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
    for (const [name, hex] of Object.entries(TOKENS)) expect(css, name).toContain(`--color-${name}: ${hex};`);
  });

  it('keep every text pair at WCAG AA (4.5:1), and red text for large type at 3:1', () => {
    const pairs: Array<[Token | '#ffffff', Token]> = [
      ['paper', 'night'],
      ['paper-soft', 'night'],
      ['paper-dim', 'night'],
      ['paper-dim', 'night-deep'],
      ['seal', 'night'],
      ['error', 'night'],
      ['paper', 'ember'],
      ['paper-soft', 'ember'],
      ['seal-ink', 'seal'],
      ['#ffffff', 'lantern-deep'],
    ];
    const hex = (t: Token | '#ffffff') => (t.startsWith('#') ? t : TOKENS[t as Token]);
    for (const [fg, bg] of pairs) expect(contrast(hex(fg), TOKENS[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOKENS.lantern, TOKENS.night)).toBeGreaterThanOrEqual(3);
  });
});
```
Run: `npm test -w @lixi/app`
Expected: FAIL, `../src/theme` not found.

- [ ] **Step 2: Tokens, fonts and the stylesheet**

Create `app/src/theme.ts`:
```ts
/**
 * Colour tokens (frontend spec §4.1). `index.css` declares the same values as Tailwind theme
 * colours; `test/theme.test.ts` keeps the two equal and checks every text pair's contrast.
 */
export const TOKENS = {
  night: '#0c0a12',
  'night-deep': '#08070c',
  ember: '#2a0f16',
  lantern: '#ef3346',
  'lantern-deep': '#d42a3c',
  'envelope-flap': '#8f0c1b',
  seal: '#f2c14e',
  'seal-ink': '#2a1a05',
  paper: '#efe2cf',
  'paper-soft': '#b3a593',
  'paper-dim': '#8c7f8a',
  out: '#221a21',
  error: '#ff6b78',
} as const;

export type Token = keyof typeof TOKENS;

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2 contrast ratio between two `#rrggbb` colours. */
export const contrast = (fg: string, bg: string): number => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};
```
Vendor Playwrite VN. The npm package ships only a Latin subset, without the Vietnamese letters the greetings need; Google’s own file has them all (44 KB, OFL-1.1):
```bash
mkdir -p app/src/assets/fonts
curl -L -o app/src/assets/fonts/playwrite-vn-200.woff2 "https://fonts.gstatic.com/s/playwritevn/v11/mtGo4_hXJqPSu8nf5RBY5i0q0yxCxtP-9TFBNcI9E-pHPWIRvD0.woff2"
curl -L -o app/src/assets/fonts/OFL-playwrite-vn.txt https://raw.githubusercontent.com/google/fonts/main/ofl/playwritevn/OFL.txt
file app/src/assets/fonts/playwrite-vn-200.woff2
```
Expected: `Web Open Font Format (Version 2), TrueType, length 44284`. If Google has moved the file, get the current URL from `curl -A "Mozilla/5.0 Chrome/130" "https://fonts.googleapis.com/css2?family=Playwrite+VN:wght@200"` (its single `src: url(…)`).

Create `app/src/index.css`. Component styles sit in `@layer components`, so Tailwind utilities such as `md:hidden` can still override them:
```css
@import 'tailwindcss';

/* Playwrite VN, the full font with Vietnamese (the npm package ships Latin only). OFL-1.1. */
@font-face {
  font-family: 'Playwrite VN';
  font-style: normal;
  font-weight: 200;
  font-display: swap;
  src: url('./assets/fonts/playwrite-vn-200.woff2') format('woff2');
}

/* Frontend spec §4. The colour values must match src/theme.ts (test/theme.test.ts). */
@theme {
  --font-display: 'Fraunces Variable', ui-serif, Georgia, serif;
  --font-hand: 'Playwrite VN', cursive;
  --color-night: #0c0a12;
  --color-night-deep: #08070c;
  --color-ember: #2a0f16;
  --color-lantern: #ef3346;
  --color-lantern-deep: #d42a3c;
  --color-envelope-flap: #8f0c1b;
  --color-seal: #f2c14e;
  --color-seal-ink: #2a1a05;
  --color-paper: #efe2cf;
  --color-paper-soft: #b3a593;
  --color-paper-dim: #8c7f8a;
  --color-out: #221a21;
  --color-error: #ff6b78;
}

@layer base {
  html {
    scroll-behavior: smooth;
    color-scheme: dark;
  }
  body {
    @apply bg-night font-display text-paper antialiased;
    font-variant-numeric: tabular-nums;
  }
  :focus-visible {
    outline: 2px solid var(--color-seal);
    outline-offset: 2px;
  }
  /* Sections sit under the sticky header when a link scrolls to them. */
  section[id] {
    scroll-margin-top: 72px;
  }
}

/* Components sit in a layer so Tailwind utilities (md:hidden, etc.) can override them. */
@layer components {
  /* ── A light: one lì xì (spec §5.1). ::before is the glow layer, ::after the seal. ── */
  .light {
    position: relative;
    display: inline-block;
    flex: none;
    width: 26px;
    height: 34px;
    border-radius: 4px;
    background: var(--color-out);
  }
  .light[data-size='sm'] {
    width: 14px;
    height: 18px;
    border-radius: 3px;
  }
  .light[data-size='lg'] {
    width: 40px;
    height: 52px;
    border-radius: 6px;
  }
  .light::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(160deg, var(--color-lantern), #b0101f);
    box-shadow:
      0 0 16px 4px rgb(239 51 70 / 0.38),
      0 0 44px 10px rgb(239 51 70 / 0.12);
    opacity: 0;
    transition: opacity 0.5s ease;
  }
  .light::after {
    content: '';
    position: absolute;
    top: 30%;
    left: 50%;
    width: 22%;
    aspect-ratio: 1;
    translate: -50% 0;
    border-radius: 999px;
    background: #3a2f36;
    transition: background-color 0.5s ease;
  }
  .light[data-state='lit']::before,
  .light[data-state='pending']::before,
  .light[data-state='home']::before {
    opacity: 1;
  }
  .light[data-state='lit']::after,
  .light[data-state='pending']::after {
    background: var(--color-seal);
  }
  .light[data-state='home']::before {
    background: linear-gradient(160deg, #f6cf62, #d39b1f);
    box-shadow:
      0 0 16px 4px rgb(242 193 78 / 0.34),
      0 0 44px 10px rgb(242 193 78 / 0.11);
  }
  .light[data-state='home']::after {
    background: #fff4d6;
  }
  .light[data-state='ghost'] {
    background: transparent;
    outline: 1px dashed var(--color-paper-dim);
  }
  .light[data-state='ghost']::after {
    background: transparent;
  }
  .light[data-state='pending']::before {
    animation: pulse 1.6s ease-in-out infinite;
  }
  .light .tip,
  .icon-link .tip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    z-index: 10;
    translate: -50% 4px;
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--color-paper);
    color: var(--color-night);
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.15s,
      translate 0.15s;
  }
  .light:hover .tip,
  .light:focus-visible .tip,
  .icon-link:hover .tip,
  .icon-link:focus-visible .tip {
    opacity: 1;
    translate: -50% 0;
  }

  /* ── The large envelope on the Claim page (spec §6.4, §7). ── */
  .envelope-xl {
    position: relative;
    width: 132px;
    height: 172px;
    margin-inline: auto;
    transition: margin-top 0.6s ease;
  }
  .envelope-xl::before {
    content: '';
    position: absolute;
    inset: -90px -110px;
    background: radial-gradient(circle at 50% 45%, rgb(242 193 78 / 0.35), rgb(239 51 70 / 0.18) 35%, transparent 65%);
    opacity: 0;
    scale: 0.4;
    transition:
      opacity 0.9s ease,
      scale 0.9s ease;
    pointer-events: none;
  }
  .envelope-xl > span {
    position: absolute;
  }
  .envelope-xl .slip {
    inset: 10% 10% auto;
    height: 66%;
    border-radius: 6px;
    background: var(--color-paper);
    transition: translate 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s;
  }
  .envelope-xl .body {
    inset: 0;
    border-radius: 10px;
    background: linear-gradient(160deg, var(--color-lantern), #b0101f);
    box-shadow:
      0 0 34px 8px rgb(239 51 70 / 0.44),
      0 0 110px 30px rgb(239 51 70 / 0.15);
    transition:
      background 0.5s,
      box-shadow 0.5s;
  }
  .envelope-xl .flap {
    inset: 0 0 auto;
    height: 40%;
    border-radius: 10px 10px 0 0;
    background: var(--color-envelope-flap);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    transition: opacity 0.4s;
  }
  .envelope-xl .seal {
    top: 33%;
    left: 50%;
    width: 22px;
    height: 22px;
    translate: -50% 0;
    border-radius: 999px;
    background: var(--color-seal);
    box-shadow: 0 0 10px var(--color-seal);
    transition: opacity 0.4s;
  }
  .envelope-xl[data-state='opening'] .body {
    animation: pulse-big 1.6s ease-in-out infinite;
  }
  .envelope-xl[data-state='opened'] {
    margin-top: 96px;
  }
  .envelope-xl[data-state='opened']::before {
    opacity: 1;
    scale: 1;
  }
  .envelope-xl[data-state='opened'] .slip {
    translate: 0 -70%;
  }
  .envelope-xl[data-state='opened'] .flap,
  .envelope-xl[data-state='opened'] .seal {
    opacity: 0;
  }
  .envelope-xl[data-state='out'] .body {
    background: var(--color-out);
    box-shadow: none;
  }
  .envelope-xl[data-state='out'] .flap {
    background: #1a1319;
  }
  .envelope-xl[data-state='out'] .seal {
    background: #3a2f36;
    box-shadow: none;
  }

  /* ── Icon links (spec §5.4). ── */
  .icon-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    border: 1px solid rgb(255 255 255 / 0.15);
    color: var(--color-paper);
    transition:
      border-color 0.2s,
      background-color 0.2s;
  }
  .icon-link:hover,
  .icon-link:focus-visible {
    border-color: var(--color-lantern);
    background: rgb(239 51 70 / 0.1);
  }

  /* ── Home: each section's one moment, once (spec §7). ── */
  [data-reveal] .reveal-head {
    opacity: 0;
    translate: 0 14px;
    transition:
      opacity 0.6s ease,
      translate 0.6s ease;
  }
  [data-reveal][data-in] .reveal-head {
    opacity: 1;
    translate: 0 0;
  }
  .journey .wire {
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 1.4s ease 0.2s;
  }
  [data-in] .journey .wire {
    transform: scaleX(1);
  }
  [data-in] .journey .light::before {
    opacity: 1;
    transition-delay: calc(0.3s + var(--i) * 0.55s);
  }
  [data-in] .journey .light::after {
    background: var(--color-seal);
    transition-delay: calc(0.3s + var(--i) * 0.55s);
  }
  [data-in] .journey .light.last::before {
    animation: lit-then-out 2.6s ease forwards 0.9s;
  }
  [data-in] .journey .light.last::after {
    animation: seal-then-out 2.6s ease forwards 0.9s;
  }
  .veil::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgb(12 10 18 / 0), rgb(12 10 18 / 0.82));
    transform: translateX(-100%);
    transition: transform 1.2s ease 0.6s;
    pointer-events: none;
  }
  [data-in] .veil::after {
    transform: translateX(0);
  }
  .fuse {
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 2s linear 0.3s;
  }
  [data-in] .fuse {
    transform: scaleX(1);
  }
  .chip {
    transition:
      border-color 0.5s,
      box-shadow 0.5s;
  }
  [data-in] .chip {
    border-color: rgb(239 51 70 / 0.6);
    box-shadow: 0 0 18px rgb(239 51 70 / 0.19);
    transition-delay: calc(0.25s + var(--i) * 0.22s);
  }
  [data-in] .cta-light::before {
    opacity: 1;
    transition-delay: 0.4s;
  }
  [data-in] .cta-light::after {
    background: var(--color-seal);
    transition-delay: 0.4s;
  }

  details > summary {
    list-style: none;
  }
  details > summary::-webkit-details-marker {
    display: none;
  }
  details > summary .plus {
    transition: rotate 0.2s;
  }
  details[open] > summary .plus {
    rotate: 45deg;
  }
}

@keyframes pulse {
  50% {
    box-shadow:
      0 0 26px 8px rgb(239 51 70 / 0.6),
      0 0 70px 20px rgb(239 51 70 / 0.25);
  }
}
@keyframes pulse-big {
  50% {
    box-shadow:
      0 0 54px 16px rgb(239 51 70 / 0.6),
      0 0 160px 50px rgb(239 51 70 / 0.26);
  }
}
@keyframes lit-then-out {
  0%,
  100% {
    opacity: 0;
  }
  25%,
  70% {
    opacity: 1;
  }
}
@keyframes seal-then-out {
  0%,
  100% {
    background: #3a2f36;
  }
  25%,
  70% {
    background: var(--color-seal);
  }
}

/* Reduced motion: every animation lands on its end state at once. */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0s !important;
  }
}
```
Create `app/src/polyfills.ts`:
```ts
// The wallet SDK address codec uses Node's Buffer; browsers need the `buffer` package.
import { Buffer } from 'buffer';

globalThis.Buffer ??= Buffer;
```

- [ ] **Step 3: Run the theme test**

Run: `npm test -w @lixi/app -- test/theme.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 4: Links, icons, light, primitives, reveal**

Create `app/src/lib/links.ts`. The faucet URL comes from docs.midnight.network, “Networks and environments” (checked 2026-10-02):
```ts
/** Places outside the app, shown as icon links (frontend spec §5.4). */
export const LINKS = {
  github: { label: 'Source on GitHub', href: 'https://github.com/hms1499/lixi-midnight' },
  contract: {
    label: 'Contract on Preprod',
    href: 'https://github.com/hms1499/lixi-midnight/blob/main/deployments/preprod.json',
  },
  midnight: { label: 'Midnight Network', href: 'https://midnight.network' },
  wallet: { label: '1AM wallet', href: 'https://1am.xyz' },
  faucet: { label: 'Preprod faucet', href: 'https://midnight-tmnight-preprod.nethermind.dev/' },
  notes: {
    label: 'Design and audit notes',
    href: 'https://github.com/hms1499/lixi-midnight/blob/main/docs/superpowers/specs/2026-09-30-lixi-design.md',
  },
} as const;

export type LinkKey = keyof typeof LINKS;
```
Create `app/src/components/icons.tsx`:
```tsx
import type { ReactNode } from 'react';

// Stroke icons adapted from Lucide (ISC licence); the GitHub mark is GitHub's own.
const Stroke = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
  </svg>
);

export const ContractIcon = () => (
  <Stroke>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="m10 13-2 2 2 2" />
    <path d="m14 17 2-2-2-2" />
  </Stroke>
);

export const MoonIcon = () => (
  <Stroke>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </Stroke>
);

export const WalletIcon = () => (
  <Stroke>
    <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3h-4a2 2 0 0 0 0 4h4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
  </Stroke>
);

export const DropletIcon = () => (
  <Stroke>
    <path d="M12 21a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 4.5 12 2c-.5 2.5-2 4.9-4 6.5S5 12 5 14a7 7 0 0 0 7 7Z" />
  </Stroke>
);

export const BookIcon = () => (
  <Stroke>
    <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
    <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
  </Stroke>
);

export const MenuIcon = () => (
  <Stroke>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Stroke>
);

export const CopyIcon = () => (
  <Stroke>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Stroke>
);

export const CheckIcon = () => (
  <Stroke>
    <path d="M20 6 9 17l-5-5" />
  </Stroke>
);
```
Create `app/src/components/Light.tsx`:
```tsx
import type { CSSProperties } from 'react';

/** What a light says about its lì xì (frontend spec §3). */
export type LightState = 'lit' | 'out' | 'home' | 'ghost' | 'pending';

type LightProps = {
  readonly state: LightState;
  readonly size?: 'sm' | 'md' | 'lg';
  /** Accessible name, for example "Lì xì 2: 1.2 tNIGHT, waiting". Without one the light is decoration. */
  readonly label?: string;
  /** Focusable with a tooltip (Dashboard). */
  readonly focusable?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
};

/** One lì xì as a small glowing envelope. */
export const Light = ({ state, size = 'md', label, focusable = false, className = '', style }: LightProps) => (
  <span
    className={`light ${className}`}
    data-state={state}
    data-size={size}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    tabIndex={focusable ? 0 : undefined}
    style={style}
  >
    {focusable && label && (
      <span className="tip" aria-hidden="true">
        {label}
      </span>
    )}
  </span>
);
```
Create `app/src/components/ui.tsx`:
```tsx
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Light } from './Light';

export type Tone = 'primary' | 'quiet' | 'home';

const TONES: Record<Tone, string> = {
  primary: 'bg-lantern-deep text-white hover:bg-[#bd2334]',
  quiet: 'border border-white/15 text-paper hover:border-lantern',
  home: 'bg-seal text-seal-ink hover:bg-[#e7b53d]',
};

export const buttonClass = (tone: Tone = 'primary', extra = '') =>
  `inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 font-semibold transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 ${TONES[tone]} ${extra}`;

export const Button = ({
  tone = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) => (
  <button {...props} className={buttonClass(tone, className)} />
);

/** A react-router link that looks like a button. */
export const ButtonLink = ({ tone = 'primary', className = '', ...props }: LinkProps & { tone?: Tone }) => (
  <Link {...props} className={buttonClass(tone, className)} />
);

const NOTICE: Record<'info' | 'warn' | 'error', { light: 'lit' | 'home' | 'out'; text: string }> = {
  info: { light: 'lit', text: 'text-paper-soft' },
  warn: { light: 'home', text: 'text-seal' },
  error: { light: 'out', text: 'text-error' },
};

/** A message with a small light as its glyph: no boxes, no coloured rules (spec §5.5). */
export const Notice = ({ tone = 'info', children }: { tone?: keyof typeof NOTICE; children: ReactNode }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 ${NOTICE[tone].text}`}>
    <Light state={NOTICE[tone].light} size="sm" className="mt-1" />
    <div>{children}</div>
  </div>
);

export const Working = ({ children }: { children: ReactNode }) => (
  <p role="status" className="flex items-center gap-3 text-paper-soft">
    <Light state="pending" size="sm" />
    {children}
  </p>
);

/** A Vietnamese greeting in Playwrite VN (spec §4.2). */
export const Greeting = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <p lang="vi" className={`font-hand text-lg font-extralight text-seal ${className}`}>
    {children}
  </p>
);

/** An external place as an icon with its name on hover and focus (spec §5.4). */
export const IconLink = ({
  label,
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { label: string; href: string; children: ReactNode }) => (
  <a {...rest} href={href} target="_blank" rel="noreferrer" aria-label={label} className="icon-link">
    {children}
    <span className="tip" aria-hidden="true">
      {label}
    </span>
  </a>
);
```
Create `app/src/lib/reveal.ts`:
```ts
import { useEffect, type RefObject } from 'react';

/**
 * Marks each `[data-reveal]` element inside `root` with `data-in` the first time 35% of it is on
 * screen; CSS plays that section's moment from there (frontend spec §7). Without IntersectionObserver,
 * or with reduced motion, every section is marked at once and shows its end state.
 */
export const useReveal = (root: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      for (const t of targets) t.dataset.in = '';
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.in = '';
          io.unobserve(e.target);
        }
      },
      { threshold: 0.35 },
    );
    for (const t of targets) io.observe(t);
    return () => io.disconnect();
  }, [root]);
};
```

- [ ] **Step 5: Wallet panel, header, footer, layout**

Create `app/src/components/WalletPanel.tsx`:
```tsx
import { useState, type ReactNode } from 'react';
import type { ProverChoice } from '../chain/port';
import { LINKS } from '../lib/links';
import { loadProver, saveProver } from '../lib/storage';
import { useServices } from '../services';
import { PROOF_SERVER_COMMAND } from '../wallet/errors';
import { useDetectedWallets, useWallet, type ConnectedWallet } from '../wallet/WalletContext';
import { Button, Notice, Working } from './ui';

type PanelProps = {
  /** Completes "Connect a Midnight wallet …", for example "to open it". */
  readonly purpose: string;
  /** The connect button's text for a wallet; defaults to "Connect <name>". */
  readonly cta?: (walletName: string) => string;
};

/** Lists injected wallets, lets the user choose where proofs are made, and connects (spec §6.6). */
export const WalletPanel = ({ purpose, cta = (name) => `Connect ${name}` }: PanelProps) => {
  const { storage } = useServices();
  const { state, connect } = useWallet();
  const wallets = useDetectedWallets();
  const [prover, setProver] = useState<ProverChoice>(() => loadProver(storage));
  const choose = (p: ProverChoice) => {
    setProver(p);
    saveProver(storage, p);
  };

  if (state.status === 'connecting') return <Working>Approve the connection in {state.name}…</Working>;
  return (
    <div className="space-y-4">
      <p className="text-paper-soft">Connect a Midnight wallet {purpose}.</p>
      {state.status === 'failed' && <Notice tone="error">{state.message}</Notice>}
      {wallets.length === 0 ? (
        <Notice tone="warn">
          No Midnight wallet found in this browser. Install{' '}
          <a className="underline underline-offset-4" href={LINKS.wallet.href} target="_blank" rel="noreferrer">
            1AM
          </a>
          , set it to Preprod, then reload this page.
        </Notice>
      ) : (
        <div className="flex flex-wrap gap-3">
          {wallets.map((w) => (
            <Button key={w.rdns} type="button" onClick={() => connect(w, prover)}>
              {cta(w.name)}
            </Button>
          ))}
        </div>
      )}
      <fieldset className="space-y-1 text-sm text-paper-soft">
        <legend className="mb-1 font-semibold text-paper">Where proofs are made</legend>
        <label className="flex gap-2">
          <input type="radio" name="prover" checked={prover === 'wallet'} onChange={() => choose('wallet')} />
          In my wallet
        </label>
        <label className="flex gap-2">
          <input type="radio" name="prover" checked={prover === 'local'} onChange={() => choose('local')} />
          On this computer, with the local proof server
        </label>
        {prover === 'local' && (
          <input
            readOnly
            aria-label="Command that starts the proof server"
            value={PROOF_SERVER_COMMAND}
            className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-xs text-paper"
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
      </fieldset>
    </div>
  );
};

/** Renders `children` with the connected wallet, or the wallet panel until there is one. */
export const RequireWallet = ({
  purpose,
  cta,
  children,
}: PanelProps & { children: (wallet: ConnectedWallet) => ReactNode }) => {
  const { state } = useWallet();
  return state.status === 'connected' ? <>{children(state.wallet)}</> : <WalletPanel purpose={purpose} cta={cta} />;
};
```
Create `app/src/components/Header.tsx`. On the home page an IntersectionObserver underlines the section in view; under 768 px the links fold into a menu that keeps Tab inside it and closes on Escape:
```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { useWallet } from '../wallet/WalletContext';
import { MenuIcon } from './icons';
import { Light } from './Light';
import { Button } from './ui';
import { WalletPanel } from './WalletPanel';

export const SECTIONS = [
  ['how', 'How it works'],
  ['privacy', 'Privacy'],
  ['midnight', 'Built on Midnight'],
  ['faq', 'FAQ'],
] as const;

/** On the home page, the id of the section in view (scroll spy). */
const useActiveSection = (onHome: boolean): string | undefined => {
  const [active, setActive] = useState<string>();
  useEffect(() => {
    setActive(undefined);
    if (!onHome || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-40% 0px -55% 0px' },
    );
    for (const [id] of SECTIONS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [onHome]);
  return active;
};

const WalletControl = () => {
  const { state, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state.status === 'connected') setOpen(false);
  }, [state.status]);
  if (state.status === 'connected') {
    const a = state.wallet.address;
    return (
      <span className="flex items-center gap-2 text-sm">
        <span title={a} className="rounded-full border border-white/15 px-3 py-1.5">
          {state.wallet.name}: {a.slice(0, 12)}…{a.slice(-4)}
        </span>
        <button type="button" className="text-paper-soft underline-offset-4 hover:underline" onClick={disconnect}>
          Disconnect
        </button>
      </span>
    );
  }
  return (
    <span className="relative">
      <Button tone="quiet" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Connect wallet
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-white/10 bg-night p-5 shadow-2xl">
          <WalletPanel purpose="to use Lixi" />
        </div>
      )}
    </span>
  );
};

/** Sticky site header shared by every page (frontend spec §5.2). */
export const Header = () => {
  const { pathname } = useLocation();
  const active = useActiveSection(pathname === '/');
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (menu) panel.current?.querySelector<HTMLElement>('a')?.focus();
  }, [menu]);

  // The open menu keeps Tab inside it and closes on Escape.
  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setMenu(false);
      menuButton.current?.focus();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>('a'));
    const [first, last] = [items[0], items.at(-1)];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  const links = (
    <>
      {SECTIONS.map(([id, label]) => (
        <Link
          key={id}
          to={{ pathname: '/', hash: `#${id}` }}
          className={`border-b py-1 transition-colors ${active === id ? 'border-lantern text-paper' : 'border-transparent text-paper-soft hover:text-paper'}`}
        >
          {label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-night/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6 lg:px-14">
        <Link to="/" className="flex items-center gap-2.5 text-xl font-bold">
          <Light state="lit" size="sm" />
          Lixi
        </Link>
        <nav aria-label="Sections" className="hidden gap-5 text-sm md:flex">
          {links}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden rounded-full border border-seal/40 px-2.5 py-1 text-xs text-seal sm:inline">
            Preprod testnet
          </span>
          <Link to="/dashboard" className="hidden hover:text-paper md:inline">
            My envelopes
          </Link>
          <WalletControl />
          <button
            ref={menuButton}
            type="button"
            className="icon-link md:hidden"
            aria-label="Menu"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <MenuIcon />
          </button>
        </div>
      </div>
      {menu && (
        <div ref={panel} onKeyDown={onMenuKey} className="border-t border-white/10 px-4 py-4 md:hidden">
          <nav aria-label="Menu" className="flex flex-col gap-3 text-base">
            {links}
            <Link to="/dashboard" className="py-1">
              My envelopes
            </Link>
          </nav>
          <p className="mt-3 text-xs text-seal sm:hidden">Preprod testnet</p>
        </div>
      )}
    </header>
  );
};
```
Create `app/src/components/Footer.tsx`:
```tsx
import { Link } from 'react-router';
import { LINKS } from '../lib/links';
import { BookIcon, ContractIcon, DropletIcon, GitHubIcon, MoonIcon, WalletIcon } from './icons';
import { Light } from './Light';
import { IconLink } from './ui';

/** Shared site footer (frontend spec §5.3): words for in-app actions, icons for places elsewhere. */
export const Footer = () => (
  <footer className="border-t border-white/10 bg-night-deep">
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:grid-cols-[1.3fr_1fr_1.2fr] sm:px-6 lg:px-14">
      <div className="space-y-3">
        <Link to="/" className="flex items-center gap-2.5 text-xl font-bold">
          <Light state="lit" size="sm" />
          Lixi
        </Link>
        <p className="max-w-64 text-sm text-paper-dim">
          Private red envelopes on Midnight. Built for the Midnight Buildathon.
        </p>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold">Use Lixi</h2>
        <ul className="space-y-2 text-sm text-paper-soft">
          <li>
            <Link to="/create" className="hover:text-paper">
              Fill an envelope
            </Link>
          </li>
          <li>
            <Link to="/c" className="hover:text-paper">
              Open a link
            </Link>
          </li>
          <li>
            <Link to="/dashboard" className="hover:text-paper">
              My envelopes
            </Link>
          </li>
        </ul>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold">Find us</h2>
        <div className="flex flex-wrap gap-2.5">
          <IconLink {...LINKS.github}>
            <GitHubIcon />
          </IconLink>
          <IconLink {...LINKS.contract}>
            <ContractIcon />
          </IconLink>
          <IconLink {...LINKS.midnight}>
            <MoonIcon />
          </IconLink>
          <IconLink {...LINKS.wallet}>
            <WalletIcon />
          </IconLink>
          <IconLink {...LINKS.faucet}>
            <DropletIcon />
          </IconLink>
          <IconLink {...LINKS.notes}>
            <BookIcon />
          </IconLink>
        </div>
      </div>
    </div>
    <div className="border-t border-white/5">
      <div className="mx-auto flex max-w-6xl justify-between gap-4 px-4 py-4 text-xs text-paper-dim sm:px-6 lg:px-14">
        <span>Testnet only. tNIGHT has no value.</span>
        <span>Apache-2.0</span>
      </div>
    </div>
  </footer>
);
```
Create `app/src/components/Layout.tsx`:
```tsx
import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { Footer } from './Footer';
import { Header } from './Header';

export const Layout = () => (
  <div className="flex min-h-dvh flex-col">
    <Header />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
  </div>
);

/** The width and gutters app pages use; Home lays out its own full-width sections. */
export const Page = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-14">{children}</div>
);
```

- [ ] **Step 6: Write the failing shell tests and the harness**

Create `app/test/app-harness.tsx`:
```tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { deriveEnvelope, linksFor } from '@lixi/sdk';
import { App } from '../src/App';
import { createEnvelope, type CreateForm } from '../src/flows/create';
import { localVaultStore } from '../src/lib/storage';
import { ServicesProvider, type Services } from '../src/services';
import { WalletProvider } from '../src/wallet/WalletContext';
import { HOUR, LixiSimulator, MemoryStorage, rnd, simChain } from './helpers';

// An undeployed-network unshielded address (from sdk/test/address.test.ts).
const ADDRESS = 'mn_addr_undeployed1c5c054q33elswjfesnhcccjcsrvckauhdv9fv5wfze0v42nkdfzskcza5a';
export const ORIGIN = 'https://lixi.test';

const fakeWallet = (): InitialAPI => ({
  rdns: 'test.wallet',
  name: 'Test Wallet',
  icon: '',
  apiVersion: '4.0.1',
  connect: async () =>
    ({ getUnshieldedAddress: async () => ({ unshieldedAddress: ADDRESS }) }) as unknown as ConnectedAPI,
});

/** The whole app on a MemoryRouter, wired to the simulator and a fake wallet. */
export const setup = (overrides: Partial<Services> = {}) => {
  const sim = new LixiSimulator(BigInt(HOUR));
  const chain = simChain(sim);
  const storage = new MemoryStorage();
  const store = localVaultStore(storage);
  const services: Services = {
    config: { network: 'undeployed', contractAddress: 'ab'.repeat(32) },
    reader: chain,
    storage,
    now: () => sim.now,
    origin: ORIGIN,
    detectWallets: () => [fakeWallet()],
    openChain: async () => chain,
    ...overrides,
  };
  const show = (path: string) =>
    render(
      <ServicesProvider services={services}>
        <WalletProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </WalletProvider>
      </ServicesProvider>,
    );
  const create = async (form: Partial<CreateForm> = {}) => {
    await createEnvelope(
      chain,
      store,
      { total: 2_000_000n, count: 2, split: 'equal', kind: 'personal', durationSeconds: 2 * HOUR, ...form },
      rnd(),
      sim.now,
    );
    store.setBackedUp(true);
    const vault = store.load()!;
    return linksFor(deriveEnvelope(vault.seed, vault.envelopes.at(-1)!));
  };
  return { sim, chain, storage, store, show, create };
};
```
Create `app/test/shell.test.tsx`. jsdom has no IntersectionObserver, which is exactly the “cannot watch scrolling” case `useReveal` must handle:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { LINKS } from '../src/lib/links';
import { setup } from './app-harness';

afterEach(cleanup);

describe('site shell and home page', () => {
  it('has a header that links to every home section, and a footer', async () => {
    const { show } = setup();
    show('/');
    await screen.findByRole('heading', { name: /Every light is one lì xì/ });
    const sections = screen.getByRole('navigation', { name: 'Sections' });
    for (const [name, hash] of [
      ['How it works', '#how'],
      ['Privacy', '#privacy'],
      ['Built on Midnight', '#midnight'],
      ['FAQ', '#faq'],
    ]) {
      expect(within(sections).getByRole('link', { name }).getAttribute('href')).toBe(`/${hash}`);
      expect(document.getElementById(hash.slice(1))).not.toBeNull();
    }
    expect(screen.getByText('Preprod testnet')).toBeTruthy();
    expect(screen.getByRole('contentinfo').textContent).toContain('Testnet only. tNIGHT has no value.');
  });

  it('shows places outside the app as named icon links', async () => {
    const { show } = setup();
    show('/');
    await screen.findByRole('heading', { name: /Every light is one lì xì/ });
    for (const { label, href } of Object.values(LINKS)) {
      const links = screen.getAllByRole('link', { name: label });
      expect(links.length, label).toBeGreaterThan(0);
      for (const a of links) {
        expect(a.getAttribute('href')).toBe(href);
        expect(a.getAttribute('rel')).toBe('noreferrer');
      }
    }
  });

  it('shows every section at once when it cannot watch scrolling (no IntersectionObserver)', async () => {
    const { show } = setup();
    show('/');
    await screen.findByRole('heading', { name: /Every light is one lì xì/ });
    const revealed = document.querySelectorAll('[data-reveal]');
    expect(revealed.length).toBe(6);
    for (const s of Array.from(revealed)) expect(s.hasAttribute('data-in')).toBe(true);
  });

  it('answers the questions a first visitor has', async () => {
    const { show } = setup();
    show('/');
    for (const q of ['Do I need a wallet to open a lì xì?', 'What if a link leaks?', 'Is this real money?'])
      expect(await screen.findByText(q)).toBeTruthy();
  });

  it('has a friendly not-found page', async () => {
    const { show } = setup();
    show('/nope');
    await screen.findByRole('heading', { name: 'Nothing here' });
  });
});
```
Run: `npm test -w @lixi/app`
Expected: FAIL, `../src/App` not found.

- [ ] **Step 7: Home, not found, routes and the page shell**

Create `app/src/pages/Home.tsx`:
```tsx
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { BookIcon, ContractIcon, GitHubIcon } from '../components/icons';
import { Light, type LightState } from '../components/Light';
import { ButtonLink, Greeting, IconLink } from '../components/ui';
import { LINKS } from '../lib/links';
import { useReveal } from '../lib/reveal';

/** Decorative hero lights: [left %, top px, state, size, scale]. */
const HERO_LIGHTS: Array<[number, number, LightState, 'sm' | 'md', number]> = [
  [14, 44, 'lit', 'md', 1],
  [29, 84, 'out', 'md', 1],
  [47, 30, 'lit', 'md', 1.45],
  [66, 86, 'lit', 'md', 1],
  [82, 48, 'out', 'md', 1],
  [39, 112, 'lit', 'sm', 1],
  [58, 126, 'out', 'sm', 1],
];

const JOURNEY = [
  ['Sealed', 'You fill the envelope. The chain keeps a fingerprint of the split, never the split.'],
  ['Handed out', 'Each link carries one lì xì’s secret, in the part of the URL no server ever sees.'],
  ['Opened', 'A proof says “I hold a valid lì xì” without saying which. What nobody opens comes back to you.'],
] as const;

const SEEN = [
  'that an envelope exists, its total and its expiry',
  'whether it uses a group link',
  'your address, as the sender',
  'each opening: who received, and how much',
];
const DARK = [
  'how many lì xì, and the size of each',
  'who the links went to',
  'the secrets inside the links',
  'which lì xì are still unopened',
];

const FLOW = [
  ['The link', 'Secret and Merkle path, in the URL fragment.'],
  ['The proof', 'Made in your wallet or on your machine. It binds the payout to your address.'],
  ['The contract', 'Checks the root, spends a one-time nullifier, never sees the secret.'],
  ['Your wallet', 'Receives the tNIGHT. The same link cannot pay twice.'],
] as const;

const FACTS = [
  ['~30 s', 'from “Open” to tNIGHT in your wallet, proof included'],
  ['Up to 16', 'lì xì per envelope, split equally or at random'],
  ['No admin key', 'the contract’s maintenance key was given up at deploy, so nobody can change it'],
] as const;

const MOMENTS = [
  ['Tết', 'lucky amounts'],
  ['Weddings', 'one link each'],
  ['Birthdays', ''],
  ['Team bonuses', 'equal amounts'],
  ['Community giveaways', 'group link, one per wallet'],
] as const;

const FAQ = [
  [
    'Do I need a wallet to open a lì xì?',
    'Yes: a Midnight wallet such as 1AM, on Preprod, with a little DUST for the fee. You can see what is inside before you connect.',
  ],
  [
    'What if a link leaks?',
    'Whoever opens it first gets that lì xì, like cash. Send each link to one person, privately.',
  ],
  [
    'Can the sender take a lì xì back early?',
    'No. Before expiry, money only leaves through valid links. After expiry, what nobody opened goes back to the sender’s address, and nowhere else.',
  ],
  [
    'What happens to lì xì nobody opens?',
    'After the expiry the sender chose, the sender can bring them home in one transaction. Until then they wait for their links.',
  ],
  ['Is this real money?', 'No. Lixi runs on the Preprod test network; tNIGHT has no value.'],
] as const;

const Section = ({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) => (
  <section id={id} data-reveal className="border-t border-white/10">
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-14 lg:py-14">
      <div className="reveal-head mb-6">
        <h2 className="text-3xl">{title}</h2>
        {lede && <p className="mt-1.5 max-w-xl text-paper-soft">{lede}</p>}
      </div>
      {children}
    </div>
  </section>
);

const i = (n: number) => ({ '--i': n }) as CSSProperties;

export const Home = () => {
  const root = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  useReveal(root);
  // Header links from any page land on their section (`/#faq`).
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div ref={root}>
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_130%,var(--color-ember)_0%,var(--color-night)_62%)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40">
          {HERO_LIGHTS.map(([left, top, state, size, scale], n) => (
            <Light
              key={n}
              state={state}
              size={size}
              className="absolute"
              style={{ left: `${left}%`, top, transform: `scale(${scale})` }}
            />
          ))}
        </div>
        <div className="relative mx-auto max-w-3xl px-4 pt-44 pb-16 text-center">
          <Greeting>Chúc mừng năm mới</Greeting>
          <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">
            Every light is one lì xì.
            <br />
            Only its link knows whose.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-paper-soft">
            Put tNIGHT in a red envelope, split it into lì xì and send each person a link. They open it with a
            zero-knowledge proof; the link’s secret never touches the chain.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/create">Fill an envelope</ButtonLink>
            <ButtonLink to="/c" tone="quiet">
              Open a link
            </ButtonLink>
          </div>
        </div>
      </section>

      <Section id="how" title="How it works" lede="One lì xì, from your wallet to theirs.">
        <ol className="journey relative grid gap-8 sm:grid-cols-3 sm:gap-0">
          <span className="wire absolute top-4 right-[16%] left-[16%] hidden h-px bg-lantern/50 sm:block" />
          {JOURNEY.map(([title, text], n) => (
            <li key={title} className="relative px-4 text-center">
              <Light state="out" className={n === JOURNEY.length - 1 ? 'last' : ''} style={i(n)} />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-paper-soft">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="privacy" title="Privacy, plainly" lede="What a red envelope on Midnight shows, and what it keeps.">
        <div className="grid overflow-hidden rounded-lg border border-white/10 sm:grid-cols-2">
          <div className="p-5">
            <h3 className="mb-2 font-semibold">What the chain sees</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-paper-soft">
              {SEEN.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="veil relative border-t border-white/10 p-5 sm:border-t-0 sm:border-l">
            <h3 className="relative z-10 mb-2 font-semibold text-seal">What stays in the dark</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-paper-soft">
              {DARK.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-sm text-paper-dim">
          Payouts are unshielded tNIGHT, so each opening is public. A link works like cash: whoever opens it first gets
          the lì xì.
        </p>
      </Section>

      <Section
        id="midnight"
        title="Built on Midnight"
        lede="A Compact contract holds every envelope. Your browser and wallet do the private work."
      >
        <div className="relative">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-white/10" />
          <span className="fuse absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-lantern via-lantern to-seal" />
          <ol className="grid gap-6 pt-4 sm:grid-cols-4 sm:gap-0">
            {FLOW.map(([title, text]) => (
              <li key={title} className="text-sm text-paper-soft sm:px-4">
                <span className="mb-1 block font-semibold text-paper">{title}</span>
                {text}
              </li>
            ))}
          </ol>
        </div>
        <dl className="mt-8 grid gap-6 sm:grid-cols-3">
          {FACTS.map(([value, text]) => (
            <div key={value}>
              <dt className="text-2xl">{value}</dt>
              <dd className="mt-1 text-sm text-paper-soft">{text}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex gap-2.5">
          <IconLink {...LINKS.github}>
            <GitHubIcon />
          </IconLink>
          <IconLink {...LINKS.contract}>
            <ContractIcon />
          </IconLink>
          <IconLink {...LINKS.notes}>
            <BookIcon />
          </IconLink>
        </div>
      </Section>

      <Section
        id="moments"
        title="For every red-envelope moment"
        lede="Personal links for family, one group link for a crowd."
      >
        <ul className="flex flex-wrap gap-2.5">
          {MOMENTS.map(([name, hint], n) => (
            <li key={name} className="chip rounded-full border border-white/10 px-3.5 py-2 text-sm" style={i(n)}>
              {name}
              {hint && <span className="ml-1.5 text-xs text-paper-dim">{hint}</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="faq" title="Questions">
        <div className="max-w-3xl">
          {FAQ.map(([q, a], n) => (
            <details key={q} open={n === 0} className="border-t border-white/10 py-4">
              <summary className="flex cursor-pointer justify-between gap-4">
                {q}
                <span className="plus text-paper-dim" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-paper-soft">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section
        data-reveal
        className="border-t border-white/10 bg-[radial-gradient(ellipse_at_50%_100%,var(--color-ember)_0%,var(--color-night)_70%)] px-4 py-16 text-center"
      >
        <Light state="out" className="cta-light" />
        <h2 className="reveal-head mt-3 mb-5 text-3xl">Fill your first envelope</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink to="/create">Fill an envelope</ButtonLink>
          <ButtonLink to="/c" tone="quiet">
            Open a link
          </ButtonLink>
        </div>
      </section>
    </div>
  );
};
```
Create `app/src/pages/NotFound.tsx`:
```tsx
import { Link } from 'react-router';
import { Page } from '../components/Layout';
import { Light } from '../components/Light';

export const NotFound = () => (
  <Page>
    <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
      <Light state="out" size="lg" />
      <h1 className="text-3xl">Nothing here</h1>
      <p className="text-paper-soft">
        If someone sent you a lì xì, open the full link from their message, or{' '}
        <Link to="/c" className="underline underline-offset-4 hover:text-paper">
          paste it here
        </Link>
        .
      </p>
    </div>
  </Page>
);
```
Create `app/src/App.tsx`:
```tsx
import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
```
Create `app/src/main.tsx`. `setNetworkId` runs before any provider exists:
```tsx
import './polyfills';
import '@fontsource-variable/fraunces/opsz.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { App } from './App';
import { walletChain, publicReader } from './chain/midnight';
import { appConfig } from './config';
import { nowSeconds } from './lib/time';
import { ServicesProvider, type Services } from './services';
import { detectWallets } from './wallet/connector';
import { WalletProvider } from './wallet/WalletContext';

const config = appConfig(import.meta.env);
setNetworkId(config.network); // before any provider is created

const services: Services = {
  config,
  reader: publicReader(config),
  storage: window.localStorage,
  now: nowSeconds,
  origin: window.location.origin,
  detectWallets: () => detectWallets(window.midnight),
  openChain: (api, prover) => walletChain(api, config, prover),
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <WalletProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </WalletProvider>
    </ServicesProvider>
  </StrictMode>,
);
```
Create `app/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <meta name="theme-color" content="#0c0a12" />
    <title>Lixi: private red envelopes on Midnight</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <div id="root"><p class="p-10 text-center text-paper-dim">Lighting the lanterns…</p></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
Create `app/public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0c0a12"/><rect x="9" y="6" width="14" height="20" rx="2.5" fill="#ef3346"/><path d="M9 8.5 16 15l7-6.5" fill="none" stroke="#8f0c1b" stroke-width="1.6"/><circle cx="16" cy="14.5" r="2.4" fill="#f2c14e"/></svg>
```

- [ ] **Step 8: Run the tests**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app && npx eslint app`
Expected: PASS, 38 tests; no type or lint errors.

- [ ] **Step 9: Build and check the site in a browser**

Run: `npm run build -w @lixi/app`
Expected: `✓ built`. `app/dist/` holds `index.html`, plus `assets/`: one ~1 MB JS chunk, two WASM files (~10 MB and ~1.4 MB), the Fraunces and Playwrite VN fonts. `keys/` and `zkir/` sit next to it. Two `IMPORT_IS_UNDEFINED … isomorphic-ws` warnings from the indexer provider are expected, because the app passes the browser `WebSocket` explicitly.

Run: `head -c 700 app/dist/index.html`
Expected: the first tag in `<head>` is the `Content-Security-Policy` meta tag.

Run `npm run preview -w @lixi/app` in the background and open `http://localhost:4173/` in Chromium (the Playwright MCP tools work):
- At 1280 px, the hero shows the greeting in handwriting with every Vietnamese mark (“Chúc mừng năm mới”), the field of lights and both buttons. The menu button is hidden, and the console has no errors and no CSP violations.
- Click “Built on Midnight” in the header. The page scrolls smoothly, the section sits below the header, the link is underlined, the fuse line is full, and the moment chips are lit.
- At 390 × 844, the nav folds into the menu button. Opening it lists the four sections, My envelopes and “Preprod testnet”, and nothing overflows horizontally.

Stop the preview server afterwards.

- [ ] **Step 10: Build the app in CI**

In `.github/workflows/ci.yml`, change the comment line to `# Every push: format, lint, typecheck, unit tests, full compile and the app build (~1–2 min).` and append after the `Full compile with proving keys` step:
```yaml
      - name: Build the app
        run: npm run build -w @lixi/app
```

- [ ] **Step 11: Commit**

```bash
git add app .github/workflows/ci.yml
git commit -m "feat(app): night theme, lights, site header and footer, and the full home page"
```

---

### Task 8: Create and share

Frontend spec §6.2 and §6.3: the backup step, the sentence form with the live field of lights, sealing, and the share rows.

**Files:**
- Create: `app/src/components/CopyButton.tsx`, `app/src/components/BackupPanel.tsx`
- Create: `app/src/pages/Create.tsx`, `app/src/pages/Share.tsx`
- Modify: `app/src/App.tsx`
- Create: `app/test/create-page.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–7, including `freeIndex` (Task 5); SDK `backupString`, `claimUrl`, `deriveEnvelope`, `linksFor`, `nextIndex`; `MAX_SHARES`, `toHex`.
- Produces:
  - `CopyButton({ text, label?, name? })`, which stays “Copied” for the visit; with `name`, its accessible name is “Copy link: Lì xì 2”, then “Copied: Lì xì 2”
  - `BackupString({ vault })` (with the private-key warning), `BackupGate({ vault, onDone })`
  - the `Create` page at `/create` and the `Share` page at `/share/:id`

- [ ] **Step 1: Write the failing page tests**

Create `app/test/create-page.test.tsx`. user-event’s `setup()` installs a clipboard stub, so the test can read what Copy wrote:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { backupString, deriveEnvelope } from '@lixi/sdk';
import { formatNight } from '../src/lib/units';
import { ORIGIN, setup } from './app-harness';

afterEach(cleanup);

describe('create and share', () => {
  it('asks for the backup first, then seals the envelope and lists one link per lì xì', async () => {
    const user = userEvent.setup();
    const { show, store } = setup();
    show('/create');
    await screen.findByRole('heading', { name: 'Keep your backup string' });
    expect((screen.getByLabelText('Backup string') as HTMLInputElement).value).toBe(backupString(store.load()!));
    await user.click(screen.getByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const total = await screen.findByLabelText('Total tNIGHT');
    await user.clear(total);
    await user.type(total, '3');
    const count = screen.getByLabelText('Number of lì xì');
    await user.clear(count);
    await user.type(count, '3');
    await user.selectOptions(screen.getByLabelText('Amounts'), 'equal');
    await user.click(screen.getByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 3 lì xì' }));

    await screen.findByRole('heading', { name: '3 lì xì, ready to hand out' });
    expect(screen.getAllByText('1 tNIGHT')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Copy link: Lì xì 2' }));
    expect(await navigator.clipboard.readText()).toMatch(new RegExp(`^${ORIGIN}/c#v1\\.`));
    expect(screen.getByRole('button', { name: 'Copied: Lì xì 2' })).toBeTruthy();
  });

  it('previews the lucky amounts it will seal, and they add up to the total', async () => {
    const user = userEvent.setup();
    const { show, store } = setup();
    store.save({ seed: new Uint8Array(32).fill(7), envelopes: [] });
    store.setBackedUp(true);
    show('/create');
    const total = await screen.findByLabelText('Total tNIGHT');
    await user.clear(total);
    await user.type(total, '10');
    const field = await screen.findByRole('img', { name: '4 lì xì' });
    const shown = Array.from(field.querySelectorAll('span.block')).map((s) => s.textContent);
    const expected = deriveEnvelope(store.load()!.seed, {
      index: 0,
      total: 10_000_000n,
      count: 4,
      kind: 'personal',
      split: 'random',
    })
      .shares.slice(0, 4)
      .map((s) => s.amount);
    expect(expected.reduce((a, b) => a + b, 0n)).toBe(10_000_000n);
    expect(shown).toEqual(expected.map(formatNight));
  });

  it('a group link forces equal amounts', async () => {
    const user = userEvent.setup();
    const { show, store } = setup();
    store.save({ seed: new Uint8Array(32).fill(9), envelopes: [] });
    store.setBackedUp(true);
    show('/create');
    await user.selectOptions(await screen.findByLabelText('Links'), 'group');
    const amounts = screen.getByLabelText('Amounts') as HTMLSelectElement;
    expect(amounts.disabled).toBe(true);
    expect(amounts.value).toBe('equal');
    expect(screen.getByText('A group link gives the same amount to each person, one per wallet.')).toBeTruthy();
  });
});
```
Run: `npm test -w @lixi/app`
Expected: FAIL, because `/create` renders “Nothing here” until the route exists.

- [ ] **Step 2: Copy button and backup panel**

Create `app/src/components/CopyButton.tsx`:
```tsx
import { useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';

/** Copies `text`; once copied it stays "Copied" for the visit, so a sender can see which links are out. */
export const CopyButton = ({ text, label = 'Copy', name }: { text: string; label?: string; name?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={name ? `${copied ? 'Copied' : label}: ${name}` : undefined}
      className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
        copied ? 'border-seal/60 text-seal' : 'border-white/15 text-paper hover:border-lantern'
      }`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied' : label}
    </button>
  );
};
```
Create `app/src/components/BackupPanel.tsx`:
```tsx
import { useState } from 'react';
import { backupString, type SenderVault } from '@lixi/sdk';
import { CopyButton } from './CopyButton';
import { Button, Greeting, Notice } from './ui';

/** The vault's backup string, presented like a private key (Plan 1 carry-over). */
export const BackupString = ({ vault }: { vault: SenderVault }) => {
  const text = backupString(vault);
  return (
    <div className="space-y-3">
      <Notice tone="warn">
        Treat this like a private key. Anyone who has it can open every lì xì you have not handed out yet. Keep it where
        only you can read it, never in a chat.
      </Notice>
      <div className="flex items-center gap-2">
        <input
          readOnly
          aria-label="Backup string"
          value={text}
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton text={text} />
      </div>
    </div>
  );
};

/** First visit to Create: the user must keep the backup string before sealing anything (spec §6.2). */
export const BackupGate = ({ vault, onDone }: { vault: SenderVault; onDone: () => void }) => {
  const [saved, setSaved] = useState(false);
  return (
    <div className="max-w-2xl space-y-5">
      <Greeting>Before you seal one</Greeting>
      <h1 className="text-4xl">Keep your backup string</h1>
      <p className="text-paper-soft">
        Your envelopes are rebuilt from this one string. If this browser loses its data, it is the only way to see them
        again and bring home what nobody opened.
      </p>
      <BackupString vault={vault} />
      <label className="flex gap-2">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I saved my backup string
      </label>
      <Button type="button" disabled={!saved} onClick={onDone}>
        Continue
      </Button>
    </div>
  );
};
```

- [ ] **Step 3: Create and Share pages**

Create `app/src/pages/Create.tsx`. The preview derives the amounts at `freeIndex`, the same index `createEnvelope` will use, so the lights show exactly what gets sealed:
```tsx
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { MAX_SHARES, toHex } from '@lixi/contract';
import { deriveEnvelope, nextIndex, type EnvelopeKind, type SenderVault, type SplitMode } from '@lixi/sdk';
import { BackupGate } from '../components/BackupPanel';
import { Page } from '../components/Layout';
import { Light } from '../components/Light';
import { WalletPanel } from '../components/WalletPanel';
import { Button, Notice, Working } from '../components/ui';
import { createEnvelope, freeIndex, loadOrCreateVault } from '../flows/create';
import { localVaultStore } from '../lib/storage';
import { EXPIRY_PRESETS } from '../lib/time';
import { formatNight, parseNight } from '../lib/units';
import { useServices } from '../services';
import { friendlyError } from '../wallet/errors';
import { useWallet } from '../wallet/WalletContext';

/** Where the live field places up to 16 lights: [left %, top %]. */
const SLOTS: Array<[number, number]> = [
  [14, 18],
  [42, 6],
  [68, 22],
  [88, 8],
  [26, 46],
  [54, 36],
  [80, 50],
  [8, 72],
  [36, 70],
  [62, 80],
  [90, 76],
  [18, 92],
  [48, 96],
  [74, 98],
  [4, 40],
  [96, 34],
];

const fill = 'ml-1.5 inline-block border-b-2 border-lantern bg-transparent px-0.5 text-center font-semibold text-white';

type Preview = { readonly amounts: bigint[] } | undefined;

/** The envelope taking shape: one light per lì xì, sized by its share when amounts are lucky (spec §6.2). */
const LiveField = ({
  preview,
  count,
  kind,
  sealing,
}: {
  preview: Preview;
  count?: number;
  kind: EnvelopeKind;
  sealing: boolean;
}) => {
  const n = preview?.amounts.length ?? count ?? 0;
  if (n === 0) return <div className="h-64" aria-hidden="true" />;
  const amounts = preview?.amounts ?? [];
  const [min, max] = amounts.length
    ? [amounts.reduce((a, b) => (a < b ? a : b)), amounts.reduce((a, b) => (a > b ? a : b))]
    : [0n, 0n];
  const scale = (a: bigint) => (max === min ? 1 : 0.8 + (0.5 * Number(a - min)) / Number(max - min));
  const state = sealing ? 'pending' : preview ? 'lit' : 'ghost';
  if (kind === 'group')
    return (
      <div
        className="relative flex h-64 items-center justify-center gap-4"
        aria-label={`${n} lì xì, one group link`}
        role="img"
      >
        <span className="absolute inset-x-6 top-1/2 h-px bg-lantern/40" />
        {Array.from({ length: n }, (_, k) => (
          <Light key={k} state={state} className="relative" />
        ))}
      </div>
    );
  return (
    <div className="relative h-64" role="img" aria-label={`${n} lì xì`}>
      {Array.from({ length: n }, (_, k) => {
        const [left, top] = SLOTS[k];
        const s = amounts[k] !== undefined ? scale(amounts[k]) : 1;
        return (
          <span
            key={k}
            className="absolute -translate-x-1/2 text-center"
            style={{ left: `${left}%`, top: `${top * 0.78}%` } as CSSProperties}
          >
            <Light state={state} style={{ transform: `scale(${s})`, transition: 'transform .3s' }} />
            {amounts[k] !== undefined && (
              <span className="block pt-1.5 text-xs text-paper-soft">{formatNight(amounts[k])}</span>
            )}
          </span>
        );
      })}
    </div>
  );
};

export const Create = () => {
  const services = useServices();
  const store = localVaultStore(services.storage);
  const navigate = useNavigate();
  const { state } = useWallet();
  const wallet = state.status === 'connected' ? state.wallet : undefined;
  const [vault] = useState<{ ok: true; vault: SenderVault } | { ok: false; message: string }>(() => {
    try {
      return { ok: true, vault: loadOrCreateVault(store) };
    } catch (error) {
      return { ok: false, message: friendlyError(error) };
    }
  });
  const [index, setIndex] = useState(() => (vault.ok ? nextIndex(vault.vault) : 0));
  const [backedUp, setBackedUp] = useState(() => store.backedUp());
  const [amount, setAmount] = useState('10');
  const [countText, setCountText] = useState('4');
  const [kind, setKind] = useState<EnvelopeKind>('personal');
  const [split, setSplit] = useState<SplitMode>('random');
  const [duration, setDuration] = useState<number>(EXPIRY_PRESETS[1].seconds);
  const [status, setStatus] = useState<{ sealing: boolean; error?: string }>({ sealing: false });

  // Preview the index createEnvelope will use, skipping any already on chain.
  useEffect(() => {
    if (!vault.ok) return;
    services.reader
      .readLedger()
      .then((ledger) => setIndex(freeIndex(vault.vault, ledger)))
      .catch(() => undefined);
  }, [services.reader, vault]);

  if (!vault.ok)
    return (
      <Page>
        <Notice tone="error">{vault.message}</Notice>
      </Page>
    );
  if (!backedUp)
    return (
      <Page>
        <BackupGate
          vault={vault.vault}
          onDone={() => {
            store.setBackedUp(true);
            setBackedUp(true);
          }}
        />
      </Page>
    );

  let total: bigint | undefined;
  try {
    total = parseNight(amount);
  } catch {
    total = undefined;
  }
  const count = /^\d+$/.test(countText) && +countText >= 1 && +countText <= MAX_SHARES ? +countText : undefined;
  const amountError = amount !== '' && (total === undefined || total < BigInt(count ?? 1));
  const effectiveSplit: SplitMode = kind === 'group' ? 'equal' : split;
  let preview: Preview;
  try {
    preview =
      total !== undefined && count !== undefined
        ? {
            amounts: deriveEnvelope(vault.vault.seed, { index, total, count, kind, split: effectiveSplit })
              .shares.slice(0, count)
              .map((s) => s.amount),
          }
        : undefined;
  } catch {
    preview = undefined;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!wallet || total === undefined || count === undefined) return;
    setStatus({ sealing: true });
    try {
      const form = { total, count, kind, split: effectiveSplit, durationSeconds: duration };
      const { id } = await createEnvelope(wallet.chain, store, form, wallet.recipient, services.now());
      navigate(`/share/${toHex(id)}`);
    } catch (error) {
      setStatus({ sealing: false, error: friendlyError(error) });
    }
  };

  // field-sizing keeps each choice as wide as its text, so the sentence reads without gaps (Chromium; others fall back).
  const select = `${fill} cursor-pointer appearance-none [field-sizing:content]`;
  return (
    <Page>
      <form onSubmit={submit} className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
        <div className="order-2 space-y-5 md:order-1">
          <h1 className="sr-only">Fill an envelope</h1>
          <p className="text-2xl leading-[2.1] font-light sm:text-[1.7rem]">
            Put
            <input
              aria-label="Total tNIGHT"
              inputMode="decimal"
              className={fill}
              style={{ width: `${Math.max(2, amount.length + 1)}ch` }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={amountError}
            />
            tNIGHT into
            <input
              aria-label="Number of lì xì"
              inputMode="numeric"
              className={fill}
              style={{ width: `${Math.max(2, countText.length + 1)}ch` }}
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              aria-invalid={count === undefined}
            />
            lì xì,
            <select
              aria-label="Amounts"
              className={select}
              value={effectiveSplit}
              disabled={kind === 'group'}
              onChange={(e) => setSplit(e.target.value as SplitMode)}
            >
              <option value="random">lucky amounts</option>
              <option value="equal">equal amounts</option>
            </select>
            , with
            <select
              aria-label="Links"
              className={select}
              value={kind}
              onChange={(e) => setKind(e.target.value as EnvelopeKind)}
            >
              <option value="personal">one link each</option>
              <option value="group">one group link</option>
            </select>
            . What nobody opens comes home after
            <select
              aria-label="Comes home after"
              className={select}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {EXPIRY_PRESETS.map((p) => (
                <option key={p.seconds} value={p.seconds}>
                  {p.label}
                </option>
              ))}
            </select>
            .
          </p>
          {amountError && <p className="text-sm text-error">Enter an amount like 10 or 2.5.</p>}
          {count === undefined && <p className="text-sm text-error">Choose 1 to {MAX_SHARES}.</p>}
          <p className="text-sm text-paper-soft">
            {kind === 'group'
              ? 'A group link gives the same amount to each person, one per wallet.'
              : 'Lucky amounts are random; everyone gets at least a little.'}
          </p>
          {status.error && <Notice tone="error">{status.error}</Notice>}
          {!wallet ? (
            <WalletPanel purpose="to fund the envelope" />
          ) : status.sealing ? (
            <Working>Sealing your envelope. About 30 seconds; keep this tab open.</Working>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={total === undefined || count === undefined || amountError}>
                Seal {count ?? ''} lì xì
              </Button>
              {total !== undefined && (
                <span className="text-sm text-paper-dim">
                  Your wallet pays {formatNight(total)} tNIGHT plus a small DUST fee.
                </span>
              )}
            </div>
          )}
        </div>
        <div className="order-1 md:order-2">
          <LiveField preview={preview} count={count} kind={kind} sealing={status.sealing} />
        </div>
      </form>
    </Page>
  );
};
```
Create `app/src/pages/Share.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { toHex } from '@lixi/contract';
import { claimUrl, deriveEnvelope, linksFor } from '@lixi/sdk';
import { CopyButton } from '../components/CopyButton';
import { Page } from '../components/Layout';
import { Light } from '../components/Light';
import { Button, ButtonLink, Greeting, Notice, Working } from '../components/ui';
import { localVaultStore } from '../lib/storage';
import { formatNight } from '../lib/units';
import { useServices } from '../services';
import { friendlyError } from '../wallet/errors';

/** Links for one envelope, shown only once the envelope is on chain (spec §6.3). */
export const Share = () => {
  const { id } = useParams();
  const services = useServices();
  const [onChain, setOnChain] = useState<boolean | string>();
  const [attempt, setAttempt] = useState(0);

  let found: ReturnType<typeof deriveEnvelope> | undefined;
  try {
    const vault = localVaultStore(services.storage).load();
    const saved = vault?.envelopes.find((e) => toHex(deriveEnvelope(vault.seed, e).id) === id);
    found = saved && vault ? deriveEnvelope(vault.seed, saved) : undefined;
  } catch {
    found = undefined;
  }
  const envelopeId = found?.id;

  useEffect(() => {
    if (!envelopeId) return;
    let live = true;
    services.reader
      .readLedger()
      .then((ledger) => live && setOnChain(ledger.envelopes.member(envelopeId)))
      .catch((error) => live && setOnChain(friendlyError(error)));
    return () => {
      live = false;
    };
  }, [services.reader, envelopeId, attempt]);

  if (!found)
    return (
      <Page>
        <Notice tone="error">This envelope is not in this browser’s saved envelopes.</Notice>
      </Page>
    );
  if (onChain === undefined)
    return (
      <Page>
        <Working>Looking for your envelope on chain…</Working>
      </Page>
    );
  if (typeof onChain === 'string')
    return (
      <Page>
        <Notice tone="error">{onChain}</Notice>
      </Page>
    );
  if (!onChain)
    return (
      <Page>
        <div className="space-y-4">
          <Working>Your envelope is on its way to the chain…</Working>
          <Button tone="quiet" type="button" onClick={() => setAttempt((n) => n + 1)}>
            Check again
          </Button>
        </div>
      </Page>
    );

  const { spec } = found;
  const links = linksFor(found).map((link) => ({ link, url: claimUrl(services.origin, link) }));
  return (
    <Page>
      <div className="max-w-3xl space-y-6">
        <div>
          <Greeting>Sealed</Greeting>
          <h1 className="mt-1 text-4xl">{spec.count} lì xì, ready to hand out</h1>
        </div>
        <Notice tone="warn">
          A link is like cash: whoever opens it first gets the lì xì. Send each one to one person, in a private chat.
        </Notice>
        <ul>
          {links.map(({ link, url }, n) => {
            const name =
              link.kind === 'group'
                ? `One link for ${spec.count} people, ${formatNight(spec.total / BigInt(spec.count))} tNIGHT each, one per wallet`
                : `Lì xì ${n + 1}`;
            return (
              <li key={url} className="flex items-center gap-4 border-t border-white/10 py-3">
                <Light state="lit" size={link.kind === 'group' ? 'lg' : 'md'} />
                <span className="flex-1">
                  {name}
                  {link.kind === 'personal' && (
                    <span className="block text-sm text-paper-dim">{formatNight(link.share.amount)} tNIGHT</span>
                  )}
                </span>
                <CopyButton text={url} label="Copy link" name={name} />
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-3">
          {links.length > 1 && (
            <CopyButton text={links.map((l) => l.url).join('\n')} label={`Copy all ${links.length} links`} />
          )}
          <ButtonLink to="/dashboard" tone="quiet">
            See them in My envelopes
          </ButtonLink>
        </div>
      </div>
    </Page>
  );
};
```
Replace `app/src/App.tsx` with:
```tsx
import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Create } from './pages/Create';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { Share } from './pages/Share';

export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="create" element={<Create />} />
      <Route path="share/:id" element={<Share />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
```

- [ ] **Step 4: Run the tests**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app && npx eslint app`
Expected: PASS, 41 tests.

- [ ] **Step 5: Look at it**

Build, preview, and open `/create` at 1280 px. The backup step comes first; after Continue, the sentence reads without gaps around its choices, the four lights carry amounts that add up to 10, and the wallet panel stands where the Seal button will be. Then check `/create` at 390 px: the lights sit above the sentence.

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat(app): fill an envelope with a live field of lights, and share its links"
```

---

### Task 9: Claim page

Frontend spec §6.4: one envelope in the night, in four moments.

**Files:**
- Create: `app/src/components/Envelope.tsx`, `app/src/pages/Claim.tsx`
- Modify: `app/src/App.tsx`
- Create: `app/test/claim-page.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–8; SDK `parseClaimInput`, `encodeLink`, `ClaimLink`.
- Produces: `Envelope({ state: 'sealed' | 'opening' | 'opened' | 'out', label, children? })` and the `Claim` page at `/c`. Without a fragment the page shows a paste box; otherwise it goes from arrives to opening to opened, or to can’t be opened. Each `ClaimRefusal` has a heading and one line of help.

- [ ] **Step 1: Write the failing page tests**

Create `app/test/claim-page.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { claimUrl } from '@lixi/sdk';
import { setup } from './app-harness';
import { rnd } from './helpers';

afterEach(cleanup);

describe('claim page', () => {
  it('shows what is sealed inside before connecting, then opens the lì xì', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    await user.click(screen.getByRole('button', { name: 'Connect Test Wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    await screen.findByText('It is in your wallet. The link’s secret never touched the chain.');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('1 tNIGHT');
    expect(screen.getByRole('img', { name: 'An opened lì xì' })).toBeTruthy();
  });

  it('says why a lì xì cannot be opened', async () => {
    const { show, create, chain } = setup();
    const [link] = await create();
    if (link.kind !== 'personal') throw new Error('expected a personal link');
    await chain.claim({ ...link, recipient: rnd() });
    show(claimUrl('', link));
    await screen.findByRole('heading', { name: 'This lì xì was already opened' });
    expect(screen.getByRole('link', { name: 'Open a different link' }).getAttribute('href')).toBe('/c');
    cleanup();
    show('/c#v1.AAAA');
    await screen.findByRole('heading', { name: 'This link is damaged' });
  });

  it('opens a pasted link even with chat punctuation around it', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    const [link] = await create();
    show('/c');
    await user.type(
      screen.getByLabelText('Paste the link you were sent'),
      `Here: ${claimUrl('https://lixi.test', link)}).`,
    );
    await user.click(screen.getByRole('button', { name: 'Open link' }));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    cleanup();
    show('/c');
    await user.type(screen.getByLabelText('Paste the link you were sent'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Open link' }));
    await screen.findByText(/not a Lixi link/);
  });

  it('tells a recipient whose wallet is on another network', async () => {
    const user = userEvent.setup();
    const { show, create } = setup({ config: { network: 'preprod', contractAddress: 'ab'.repeat(32) } });
    const [link] = await create();
    show(claimUrl('', link));
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet to open it' }));
    await screen.findByText(/Your wallet is on another network/);
  });
});
```
Run: `npm test -w @lixi/app`
Expected: FAIL, because `/c` renders “Nothing here”.

- [ ] **Step 2: The envelope and the page**

Create `app/src/components/Envelope.tsx`:
```tsx
import type { ReactNode } from 'react';

export type EnvelopeState = 'sealed' | 'opening' | 'opened' | 'out';

/** The large envelope on the Claim page. `opened` fades the flap and seal and lifts the slip out. */
export const Envelope = ({ state, label, children }: { state: EnvelopeState; label: string; children?: ReactNode }) => (
  <div className="envelope-xl" data-state={state} role="img" aria-label={label}>
    <span className="slip" aria-hidden="true">
      {children}
    </span>
    <span className="body" aria-hidden="true" />
    <span className="flap" aria-hidden="true" />
    <span className="seal" aria-hidden="true" />
  </div>
);
```
Create `app/src/pages/Claim.tsx`:
```tsx
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { encodeLink, parseClaimInput, type ClaimLink } from '@lixi/sdk';
import { Envelope, type EnvelopeState } from '../components/Envelope';
import { Page } from '../components/Layout';
import { Light } from '../components/Light';
import { RequireWallet } from '../components/WalletPanel';
import { Button, ButtonLink, Greeting, Notice } from '../components/ui';
import { claimWithLink, previewClaim, type ClaimPreview, type ClaimRefusal } from '../flows/claim';
import { formatNight } from '../lib/units';
import { useServices } from '../services';
import { friendlyError } from '../wallet/errors';
import { useDetectedWallets } from '../wallet/WalletContext';

/** Why a lì xì can’t be opened, and what to do about it (spec §6.4, moment 4). */
const REFUSAL: Record<ClaimRefusal, { heading: string; help: string }> = {
  'already claimed': {
    heading: 'This lì xì was already opened',
    help: 'Each link opens once. If you did not open it, the link reached someone else first; ask the sender.',
  },
  expired: {
    heading: 'This envelope has expired',
    help: 'Unopened lì xì go back to the sender after the expiry they chose.',
  },
  refunded: {
    heading: 'The sender already took back what nobody opened',
    help: 'The envelope expired, and its unopened lì xì went back to the sender.',
  },
  'address already claimed': {
    heading: 'This wallet already opened one from this group',
    help: 'A group link gives one lì xì per wallet.',
  },
  'all shares claimed': {
    heading: 'Every lì xì in this envelope has been opened',
    help: 'Others opened them all before this link reached you.',
  },
  'no envelope': {
    heading: 'This envelope is not on this network',
    help: 'The link may belong to another Lixi deployment or another network.',
  },
  'invalid link': {
    heading: 'This link is damaged',
    help: 'Part of it is missing. Ask the sender to send it again, and copy the whole link.',
  },
};

const Centre = ({ children }: { children: ReactNode }) => (
  <Page>
    <div className="mx-auto max-w-xl space-y-5 text-center">{children}</div>
  </Page>
);

const Refused = ({ reason }: { reason: ClaimRefusal }) => (
  <Centre>
    <Envelope state="out" label="An envelope that cannot be opened" />
    <h1 className="pt-4 text-3xl">{REFUSAL[reason].heading}</h1>
    <p className="text-paper-soft">{REFUSAL[reason].help}</p>
    <ButtonLink to="/c" tone="quiet">
      Open a different link
    </ButtonLink>
  </Centre>
);

/** No fragment: the recipient pastes the link they were sent. */
const PasteLink = () => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const open = (e: FormEvent) => {
    e.preventDefault();
    try {
      navigate(`/c#${encodeLink(parseClaimInput(text))}`);
    } catch {
      setError(true);
    }
  };
  return (
    <Centre>
      <Light state="lit" size="lg" />
      <h1 className="text-3xl">Open a lì xì</h1>
      <form onSubmit={open} className="space-y-4 text-left">
        <label className="block space-y-1">
          <span className="text-sm text-paper-soft">Paste the link you were sent</span>
          <input
            className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2.5"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(false);
            }}
          />
        </label>
        {error && (
          <Notice tone="error">That is not a Lixi link. Copy the whole link from the message and try again.</Notice>
        )}
        <Button type="submit" disabled={text.trim() === ''}>
          Open link
        </Button>
      </form>
    </Centre>
  );
};

type Phase =
  | { readonly step: 'checking' }
  | { readonly step: 'ready'; readonly preview: Extract<ClaimPreview, { ok: true }>; readonly error?: string }
  | { readonly step: 'opening' }
  | { readonly step: 'opened'; readonly amount: bigint }
  | { readonly step: 'refused'; readonly reason: ClaimRefusal }
  | { readonly step: 'failed'; readonly message: string };

const Claimer = ({ link }: { link: ClaimLink }) => {
  const services = useServices();
  const wallets = useDetectedWallets();
  const [phase, setPhase] = useState<Phase>({ step: 'checking' });

  useEffect(() => {
    let live = true;
    services.reader
      .readLedger()
      .then((ledger) => {
        if (!live) return;
        const preview = previewClaim(ledger, link, services.now());
        setPhase(preview.ok ? { step: 'ready', preview } : { step: 'refused', reason: preview.reason });
      })
      .catch((error) => live && setPhase({ step: 'failed', message: friendlyError(error) }));
    return () => {
      live = false;
    };
  }, [services, link]);

  if (phase.step === 'refused') return <Refused reason={phase.reason} />;
  if (phase.step === 'checking')
    return (
      <Centre>
        <Envelope state="sealed" label="A sealed lì xì" />
        <p className="pt-4 text-paper-soft">Looking at the envelope…</p>
      </Centre>
    );
  if (phase.step === 'failed')
    return (
      <Centre>
        <Envelope state="out" label="An envelope that could not be read" />
        <Notice tone="error">{phase.message}</Notice>
      </Centre>
    );
  if (phase.step === 'opened')
    return (
      <Centre>
        <Envelope state="opened" label="An opened lì xì" />
        <Greeting className="pt-4">An khang thịnh vượng</Greeting>
        <h1 className="text-5xl font-bold text-seal">
          {formatNight(phase.amount)} <span className="text-xl font-normal text-paper">tNIGHT</span>
        </h1>
        <p className="text-paper-soft">It is in your wallet. The link’s secret never touched the chain.</p>
        <ButtonLink to="/create" tone="quiet">
          Send lì xì of your own
        </ButtonLink>
      </Centre>
    );

  const opening = phase.step === 'opening';
  const preview = phase.step === 'ready' ? phase.preview : undefined;
  const expires = preview ? new Date((services.now() + preview.secondsLeft) * 1000) : undefined;
  const envelopeState: EnvelopeState = opening ? 'opening' : 'sealed';
  const open = async (chain: Parameters<typeof claimWithLink>[0], recipient: Uint8Array) => {
    const before = phase;
    setPhase({ step: 'opening' });
    try {
      const result = await claimWithLink(chain, link, recipient, services.now);
      setPhase(result.ok ? { step: 'opened', amount: result.amount } : { step: 'refused', reason: result.reason });
    } catch (error) {
      if (before.step === 'ready') setPhase({ ...before, error: friendlyError(error) });
    }
  };

  return (
    <Centre>
      <Envelope state={envelopeState} label="A sealed lì xì" />
      <Greeting className="pt-4">Chúc mừng năm mới</Greeting>
      {opening ? (
        <>
          <h1 className="text-3xl">Opening your lì xì</h1>
          <p className="text-paper-soft">
            Your wallet is proving that you hold this link, without showing the link to anyone.
          </p>
          <p role="status" className="text-sm text-paper-dim">
            Proving, then your wallet asks you to confirm.
          </p>
          <div className="mx-auto h-0.5 w-56 overflow-hidden rounded bg-white/10">
            <div className="h-full w-1/2 animate-pulse bg-lantern motion-reduce:animate-none" />
          </div>
        </>
      ) : (
        preview && (
          <>
            <h1 className="text-3xl">Someone sent you a lì xì</h1>
            <p className="text-paper-soft">
              {link.kind === 'group' ? 'One lì xì from a group envelope, ' : ''}
              {formatNight(preview.amount)} tNIGHT is sealed inside. Open it before{' '}
              {expires?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.
            </p>
            {preview.expiringSoon && (
              <Notice tone="warn">Less than 10 minutes are left. Opening takes about 30 seconds, so start now.</Notice>
            )}
            {phase.step === 'ready' && phase.error && <Notice tone="error">{phase.error}</Notice>}
            <p className="text-sm text-paper-dim">Opening it needs a Midnight wallet with a little DUST for the fee.</p>
            <div className="flex justify-center text-left">
              <RequireWallet
                purpose="to open it"
                cta={(name) => (wallets.length === 1 ? `Connect ${name} to open it` : `Connect ${name}`)}
              >
                {(wallet) => (
                  <Button type="button" onClick={() => open(wallet.chain, wallet.recipient)}>
                    Open the lì xì
                  </Button>
                )}
              </RequireWallet>
            </div>
          </>
        )
      )}
    </Centre>
  );
};

export const Claim = () => {
  const { hash } = useLocation();
  const fragment = hash.slice(1);
  if (fragment === '') return <PasteLink />;
  let link: ClaimLink;
  try {
    link = parseClaimInput(fragment);
  } catch {
    return <Refused reason="invalid link" />;
  }
  return <Claimer key={fragment} link={link} />;
};
```
Replace `app/src/App.tsx` with:
```tsx
import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Claim } from './pages/Claim';
import { Create } from './pages/Create';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { Share } from './pages/Share';

export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="create" element={<Create />} />
      <Route path="share/:id" element={<Share />} />
      <Route path="c" element={<Claim />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
```

- [ ] **Step 3: Run the tests**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app && npx eslint app`
Expected: PASS, 45 tests.

- [ ] **Step 4: Check the claim page against the real indexer**

Make a link to an envelope that does not exist:
```bash
node -e "const b=require('crypto').randomBytes(204);b.writeBigUInt64BE(1500000n,64);for(let d=0;d<4;d++){b[72+d*33]=0;b[72+d*33+32]=0}console.log('v1.'+b.toString('base64url'))"
```
Build, preview, and open `http://localhost:4173/c#<output>`.

Expected: the sealed envelope with “Looking at the envelope…”, then the dark envelope, the heading “This envelope is not on this network” and **Open a different link**. That proves the WASM runtime and the Preprod indexer read both work under the CSP. The console shows no CSP violation. `http://localhost:4173/c` shows the paste box.

- [ ] **Step 5: Commit**

```bash
git add app
git commit -m "feat(app): claim page with a sealed envelope that opens"
```

---

### Task 10: My envelopes

Frontend spec §6.5: your envelopes as rows of lights, with a List view, refund (“Bring … home”), backup and restore.

**Files:**
- Create: `app/src/pages/Dashboard.tsx`
- Modify: `app/src/App.tsx`
- Create: `app/test/dashboard-page.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–9, including `envelopeView(...).shares` (Task 5).
- Produces:
  - the `Dashboard` page at `/dashboard`
  - `VIEW_KEY = 'lixi.dashboard.view'`: the Lights/List choice, kept in storage
  - each light is focusable and named “Lì xì i: X tNIGHT, waiting | opened | coming home | came home | not on chain”

- [ ] **Step 1: Write the failing page tests**

Create `app/test/dashboard-page.test.tsx`:
```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { backupString, newVault } from '@lixi/sdk';
import { VAULT_KEY } from '../src/lib/storage';
import { setup } from './app-harness';
import { HOUR, T0, rnd } from './helpers';

afterEach(cleanup);

describe('my envelopes', () => {
  it('shows each lì xì as a light, and brings the unopened rest home after expiry', async () => {
    const user = userEvent.setup();
    const { sim, show, create, chain } = setup();
    const [first] = await create();
    if (first.kind !== 'personal') throw new Error('expected a personal link');
    await chain.claim({ ...first, recipient: rnd() });
    sim.now = T0 + 2 * HOUR;
    show('/dashboard');
    await screen.findByText(/1 opened; 1 can come home/);
    expect(screen.getByRole('img', { name: 'Lì xì 1: 1 tNIGHT, opened' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Lì xì 2: 1 tNIGHT, coming home' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Connect a wallet to bring it home' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Bring 1 tNIGHT home' }));
    await screen.findByText('Came home: 1 tNIGHT.');
  });

  it('the List view says the same thing as text', async () => {
    const user = userEvent.setup();
    const { show, create, storage } = setup();
    await create();
    show('/dashboard');
    await screen.findByText(/0 opened. Comes home in/);
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.queryAllByRole('img', { name: /^Lì xì/ })).toHaveLength(0);
    expect(screen.getByText('Lì xì 1: 1 tNIGHT, waiting. Lì xì 2: 1 tNIGHT, waiting.')).toBeTruthy();
    expect(storage.getItem('lixi.dashboard.view')).toBe('list');
  });

  it('never overwrites an unreadable vault, and restores from the backup string', async () => {
    const user = userEvent.setup();
    const { storage, show, create, store } = setup();
    await create();
    const backup = backupString(store.load()!);
    storage.setItem(VAULT_KEY, 'garbage');
    show('/dashboard');
    await screen.findByText(/cannot be read/);
    expect(storage.getItem(VAULT_KEY)).toBe('garbage');
    await user.type(screen.getByLabelText('Restore from a backup string'), backup);
    await user.click(screen.getByRole('button', { name: 'Restore envelopes' }));
    await screen.findByText('Restored 1 envelope(s).');
    await screen.findByText(/0 opened. Comes home in/);
  });

  it('a backup from another browser does not silently replace this one', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    await create();
    show('/dashboard');
    await screen.findByText(/0 opened/);
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    await user.type(screen.getByLabelText('Restore from a backup string'), backupString(newVault()));
    await user.click(screen.getByRole('button', { name: 'Restore envelopes' }));
    await screen.findByText(/different backup string/);
  });
});
```
Run: `npm test -w @lixi/app`
Expected: FAIL, because `/dashboard` renders “Nothing here”.

- [ ] **Step 2: The page**

Create `app/src/pages/Dashboard.tsx`. An unreadable vault opens the restore form by itself, because restoring is the only way past it:
```tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Ledger } from '@lixi/contract';
import type { SenderVault } from '@lixi/sdk';
import { BackupString } from '../components/BackupPanel';
import { Page } from '../components/Layout';
import { Light, type LightState } from '../components/Light';
import { WalletPanel } from '../components/WalletPanel';
import { Button, ButtonLink, Notice, Working } from '../components/ui';
import { forgetEnvelope, refundEnvelope, restoreVault } from '../flows/manage';
import { envelopeView, type EnvelopeView } from '../lib/status';
import { localVaultStore } from '../lib/storage';
import { formatRelative } from '../lib/time';
import { formatNight } from '../lib/units';
import { useServices } from '../services';
import { friendlyError } from '../wallet/errors';
import { useWallet } from '../wallet/WalletContext';

export const VIEW_KEY = 'lixi.dashboard.view';
type View = 'lights' | 'list';

/** What each light of a row shows (spec §3, §6.5). */
const lightOf = (view: EnvelopeView, opened: boolean): { state: LightState; word: string } => {
  if (view.state === 'missing') return { state: 'ghost', word: 'not on chain' };
  if (opened) return { state: 'out', word: 'opened' };
  if (view.state === 'refundable') return { state: 'home', word: 'coming home' };
  if (view.state === 'refunded') return { state: 'out', word: 'came home' };
  return { state: 'lit', word: 'waiting' };
};

const summary = ({ saved }: EnvelopeView) =>
  `${formatNight(saved.total)} tNIGHT in ${saved.count} lì xì, ${
    saved.kind === 'group' ? 'group link' : saved.split === 'random' ? 'lucky' : 'equal'
  }`;

const statusLine = (view: EnvelopeView, now: number): string => {
  const left = Number(view.saved.expiry) - now;
  const waiting = view.saved.count - view.claimed;
  switch (view.state) {
    case 'open':
      return `${view.claimed} opened. Comes home ${formatRelative(left)} if nobody opens the rest.`;
    case 'refundable':
      return `Expired ${formatRelative(left)}. ${view.claimed} opened; ${waiting} can come home.`;
    case 'refunded':
      return `Came home: ${formatNight(view.unclaimedAmount)} tNIGHT.`;
    case 'empty':
      return 'All opened.';
    case 'missing':
      return 'Not on chain. The wallet declined, or it is still on its way.';
  }
};

const Row = ({
  view,
  mode,
  now,
  onChanged,
}: {
  view: EnvelopeView;
  mode: View;
  now: number;
  onChanged: () => void;
}) => {
  const services = useServices();
  const { state } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { saved } = view;
  const labels = view.shares.map((s, n) => {
    const { state: light, word } = lightOf(view, s.opened);
    return { light, text: `Lì xì ${n + 1}: ${formatNight(s.amount)} tNIGHT, ${word}` };
  });

  const bringHome = async () => {
    const vault = localVaultStore(services.storage).load();
    if (state.status !== 'connected' || !vault) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await refundEnvelope(state.wallet.chain, vault, saved.index, services.now());
      if (!result.ok) setError(`It cannot come home yet: ${result.reason}.`);
      onChanged();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!window.confirm('This envelope is not on chain. Remove it from this browser?')) return;
    forgetEnvelope(localVaultStore(services.storage), saved.index);
    onChanged();
  };

  return (
    <li className="grid gap-x-6 gap-y-3 border-t border-white/10 py-5 sm:grid-cols-[1fr_auto]">
      <div className="space-y-3">
        {mode === 'lights' ? (
          <div className="flex flex-wrap items-center gap-3">
            {labels.map(({ light, text }) => (
              <Light key={text} state={busy ? 'pending' : light} label={text} focusable />
            ))}
          </div>
        ) : (
          <p className="text-sm text-paper-soft">{labels.map((l) => l.text).join('. ')}.</p>
        )}
        <div>
          <p className={view.state === 'empty' ? 'text-paper-dim' : ''}>{summary(view)}</p>
          <p className="text-sm text-paper-dim">{statusLine(view, now)}</p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
      <div className="flex items-start gap-3 sm:justify-end">
        {busy && <Working>Bringing it home…</Working>}
        {!busy && (view.state === 'open' || view.state === 'empty') && (
          <ButtonLink to={`/share/${view.idHex}`} tone="quiet">
            Show links
          </ButtonLink>
        )}
        {!busy && view.state === 'refundable' && (
          <Button tone="home" type="button" onClick={bringHome} disabled={state.status !== 'connected'}>
            {state.status === 'connected'
              ? `Bring ${formatNight(view.unclaimedAmount)} tNIGHT home`
              : 'Connect a wallet to bring it home'}
          </Button>
        )}
        {!busy && view.state === 'missing' && (
          <Button tone="quiet" type="button" onClick={remove}>
            Remove
          </Button>
        )}
      </div>
    </li>
  );
};

const Restore = ({ onRestored }: { onRestored: () => void }) => {
  const services = useServices();
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(false);
  const [needsReplace, setNeedsReplace] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string }>();
  const [busy, setBusy] = useState(false);

  const restore = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await restoreVault(services.reader, localVaultStore(services.storage), text, {
        replaceDifferent: replace,
      });
      if (result.ok) {
        setMessage({ tone: 'info', text: `Restored ${result.found} envelope(s).` });
        setText('');
        setNeedsReplace(false);
        onRestored();
      } else if (result.reason === 'different seed') {
        setNeedsReplace(true);
        setMessage({
          tone: 'error',
          text: 'This browser holds envelopes from a different backup string. Restoring replaces them.',
        });
      } else {
        setMessage({ tone: 'error', text: 'That is not a Lixi backup string. It starts with “lixi_”.' });
      }
    } catch (error) {
      setMessage({ tone: 'error', text: friendlyError(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={restore} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm text-paper-soft">Restore from a backup string</span>
        <input
          className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2.5"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
        />
      </label>
      {needsReplace && (
        <label className="flex gap-2 text-sm">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />I saved the backup
          string of the envelopes in this browser; replace them
        </label>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {busy ? (
        <Working>Looking for your envelopes on chain…</Working>
      ) : (
        <Button tone="quiet" type="submit" disabled={text.trim() === ''}>
          Restore envelopes
        </Button>
      )}
    </form>
  );
};

export const Dashboard = () => {
  const services = useServices();
  const { state } = useWallet();
  const [vault, setVault] = useState<{ vault?: SenderVault; error?: string }>({});
  const [ledger, setLedger] = useState<Ledger | string>();
  const [show, setShow] = useState<'none' | 'backup' | 'restore'>('none');
  const [mode, setMode] = useState<View>(() => (services.storage.getItem(VIEW_KEY) === 'list' ? 'list' : 'lights'));
  const choose = (m: View) => {
    setMode(m);
    services.storage.setItem(VIEW_KEY, m);
  };

  const reload = useCallback(() => {
    try {
      setVault({ vault: localVaultStore(services.storage).load() });
    } catch (error) {
      setVault({ error: friendlyError(error) });
      setShow('restore'); // the only way past an unreadable vault
    }
    services.reader
      .readLedger()
      .then(setLedger)
      .catch((error) => setLedger(friendlyError(error)));
  }, [services]);
  useEffect(reload, [reload]);

  const now = services.now();
  const envelopes = vault.vault?.envelopes ?? [];
  const views =
    vault.vault && ledger && typeof ledger !== 'string'
      ? [...envelopes].sort((a, b) => b.index - a.index).map((e) => envelopeView(ledger, vault.vault!.seed, e, now))
      : [];

  return (
    <Page>
      <div className="max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="mr-auto text-4xl">Your envelopes</h1>
          <div
            role="group"
            aria-label="View"
            className="flex overflow-hidden rounded-md border border-white/15 text-sm"
          >
            {(['lights', 'list'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => choose(m)}
                className={`px-3 py-1.5 ${mode === m ? 'bg-white/10 text-paper' : 'text-paper-soft'}`}
              >
                {m === 'lights' ? 'Lights' : 'List'}
              </button>
            ))}
          </div>
          {envelopes.length > 0 && <ButtonLink to="/create">Fill another envelope</ButtonLink>}
        </div>

        {vault.error && <Notice tone="error">{vault.error}</Notice>}
        {typeof ledger === 'string' && <Notice tone="error">{ledger}</Notice>}
        {envelopes.length > 0 && ledger === undefined && <Working>Reading the chain…</Working>}
        {!vault.error && envelopes.length === 0 && (
          <div className="space-y-4 py-6 text-center">
            <Light state="ghost" size="lg" />
            <p className="text-paper-soft">No envelopes in this browser yet.</p>
            <div className="flex justify-center gap-3">
              <ButtonLink to="/create">Fill an envelope</ButtonLink>
              <Button tone="quiet" type="button" onClick={() => setShow('restore')}>
                Restore from a backup string
              </Button>
            </div>
          </div>
        )}
        {views.some((v) => v.state === 'refundable') && state.status !== 'connected' && (
          <div className="rounded-lg border border-white/10 p-5">
            <WalletPanel purpose="to bring unopened lì xì home" />
          </div>
        )}
        {views.length > 0 && (
          <ul>
            {views.map((v) => (
              <Row key={v.idHex} view={v} mode={mode} now={now} onChanged={reload} />
            ))}
          </ul>
        )}

        <div className="space-y-5 rounded-lg border border-white/10 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="mr-auto text-sm text-paper-soft">
              <span className="font-semibold text-paper">Your backup string</span> rebuilds every envelope here on
              another device.
            </p>
            {vault.vault && (
              <Button tone="quiet" type="button" onClick={() => setShow(show === 'backup' ? 'none' : 'backup')}>
                Show
              </Button>
            )}
            <Button tone="quiet" type="button" onClick={() => setShow(show === 'restore' ? 'none' : 'restore')}>
              Restore
            </Button>
          </div>
          {show === 'backup' && vault.vault && <BackupString vault={vault.vault} />}
          {show === 'restore' && <Restore onRestored={reload} />}
        </div>
      </div>
    </Page>
  );
};
```
Replace `app/src/App.tsx` with:
```tsx
import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Claim } from './pages/Claim';
import { Create } from './pages/Create';
import { Dashboard } from './pages/Dashboard';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { Share } from './pages/Share';

export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="create" element={<Create />} />
      <Route path="share/:id" element={<Share />} />
      <Route path="c" element={<Claim />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
```

- [ ] **Step 3: Full verification**

Run:
```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run compact && npm run build -w @lixi/app
```
Expected: everything passes. `npm test` reports contract 32, SDK 37, CLI 12 and app 49 tests.

Build, preview, and open `/dashboard`: the empty state shows one dashed light, “No envelopes in this browser yet.”, **Fill an envelope** and **Restore from a backup string**.

- [ ] **Step 4: Commit**

```bash
git add app
git commit -m "feat(app): my envelopes as lights, with list view, bring-home refunds, backup and restore"
```

---

### Task 11: Preprod run with real wallets (needs the user)

The spec's acceptance criterion 2 is: on Preprod, create an envelope, claim it from two different wallets, and refund it after expiry. This task does that with the built site (CSP on), and answers the two open questions from the Review Focus.

**Files:**
- Modify: `docs/superpowers/spikes/2026-10-01-chain-spikes.md` (new section)
- Modify: app files only if a check fails

**Interfaces:**
- Consumes: the whole app; `deployments/preprod.json`.
- Produces: the recorded Preprod run, the H4 answer for 1AM, and the CSP-with-real-wallet answer.

- [ ] **Step 1: The user prepares three wallets**

Ask the user for this setup (spike finding: one wallet per key):
- **Sender**: 1AM on Preprod with tNIGHT and DUST, with its own recovery phrase. Not the deployer phrase in `cli/.env`.
- **Recipient B** and **Recipient C**: 1AM on Preprod, each with its own phrase, in separate Chrome profiles, each with a little tNIGHT registered for DUST (claim fees).
- All three fully synced in 1AM before starting.

- [ ] **Step 2: Serve the built site**

```bash
npm run build -w @lixi/app && npm run preview -w @lixi/app
```
The user opens `http://localhost:4173` in each profile.

- [ ] **Step 3: CSP against the real extension**

In the sender profile, open DevTools → Console, then load `/create`. Check:
- the wallet panel lists 1AM (so `window.midnight` was injected despite the CSP);
- the console shows no `Content-Security-Policy` violation, before or during the steps below.

If 1AM is not listed, or a violation names a blocked source, record the exact message. Then fix it in `app/src/csp.ts` **and** `app/vercel.json`, allowing the narrowest source that works (for example, the extension's origin in `script-src`). Rerun `npm test -w @lixi/app`, because the config test must still pass.

- [ ] **Step 4: Where 1AM proves (audit H4)**

With "Where proofs are made: In my wallet" selected, open the 1AM extension's own DevTools: `chrome://extensions` → 1AM → "Inspect views: service worker" (or its offscreen document), Network tab. Keep it open during the claims in Step 6, and note every request made while the claim proves (before the balance prompt).
- If no request carries the proof (no POST to a `/prove`-like endpoint on `api-preprod.1am.xyz`), **1AM proves locally.** Record that.
- If such a request exists, **1AM proves remotely.** Record the host. Decision rule:
  - keep `wallet` as the default, because recipients cannot run Docker, and the wallet that already holds the user's keys is inside their trust boundary;
  - add to the Plan 4 README limitations that 1AM's prover sees the claim secret, and that "On this computer" avoids it;
  - change `WalletPanel`'s first option text to `In my wallet (1AM proves on its servers)`.

- [ ] **Step 5: Create**

As the sender:
1. Fill the sentence as “Put 3 tNIGHT into 3 lì xì, lucky amounts, with one link each … 2 hours” and press **Seal 3 lì xì**. The three lights should show the same amounts the share page later lists.
2. Note how long “Sealing your envelope” takes (spike: ~20–30 s).
3. On the share page, copy links 1 and 2 (their buttons turn “Copied”).
4. Fill a second envelope: 2 tNIGHT into 2 lì xì, with one group link.

- [ ] **Step 6: Claim from two wallets**

1. Recipient B opens link 1; Recipient C opens link 2. Each sees “… tNIGHT is sealed inside” before connecting, presses **Connect 1AM to open it**, then **Open the lì xì**, and watches the envelope open to the amount.
2. Recipient B opens the group link and claims; then opens it again and must see “This wallet already opened one from this group”.
3. Check each payout on the Preprod indexer or in 1AM.
4. On the sender’s My envelopes page, the first envelope shows two dark lights and one lit (“2 opened. Comes home in …”), and the group envelope one dark and one lit.

- [ ] **Step 7: Refund after expiry**

After the 2 h expiry, the sender opens My envelopes: the first envelope’s unopened light turns gold, the status reads “… 1 can come home”, and the gold button reads **Bring X tNIGHT home**. Press it, then check that the sender’s balance grows by exactly X and the row says “Came home: X tNIGHT.” Bring the group envelope home the same way.

- [ ] **Step 8: Record the run**

Append to `docs/superpowers/spikes/2026-10-01-chain-spikes.md`:
```markdown
## Plan 3 app run (Preprod, <date>)

Built site (`vite preview`, CSP on), contract `971f70ae…1f61`, three 1AM wallets with separate phrases.

| Step | Result | Tx / note |
|---|---|---|
| CSP with the 1AM extension | <wallet listed? violations?> | |
| Where 1AM proves (H4) | <local / remote host> | <decision applied> |
| Create personal 3 × lucky, 3 tNIGHT | <ok, seconds> | <tx> |
| Create group 2 × 2 tNIGHT | <ok> | <tx> |
| Claim B (link 1), C (link 2) | <amounts> | <txs> |
| Group: B claims, B again | <ok / "already claimed from this group"> | <tx> |
| Bring home after expiry | <amount = unopened> | <tx> |

Issues found and fixed: <list, or none>.
```

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/spikes app
git commit -m "docs: Preprod app run with three wallets; H4 and CSP answers"
```

---

### Task 12: Deploy to Vercel (needs the user's go-ahead)

Spec §5.2: the static build goes on Vercel, confirmed with the user first. The build needs the Compact compiler for the proving keys, so it runs locally and is uploaded prebuilt.

**Files:**
- Modify: `README.md` (live URL, in Task 13)
- Modify: `app/vercel.json` only if Vercel rejects it

**Interfaces:**
- Consumes: `app/vercel.json` (Task 3), the build (Task 7).
- Produces: a production URL serving the app with the CSP header.

- [ ] **Step 1: Ask the user**

Ask: deploy to Vercel now, under which account or scope, and with which project name (suggest `lixi`)? Wait for an explicit yes. Use the `vercel:deploy` skill for the CLI details.

- [ ] **Step 2: Link and build**

```bash
cd app
npx vercel link            # the user picks the scope and project; creates app/.vercel (gitignored)
npx vercel build --prod    # runs `npm run build` locally into app/.vercel/output
npx vercel deploy --prebuilt --prod
cd ..
```
Expected: a production URL. If `vercel build` complains about the install step or the workspace, run `npm run build -w @lixi/app` from the repo root first. Then rerun with `--yes` and read the error before changing `vercel.json`.

- [ ] **Step 3: Check the headers and routes**

```bash
URL=https://<production host>
curl -sI "$URL/c" | grep -iE "content-security-policy|referrer-policy|x-content-type-options"
curl -s -o /dev/null -w "%{http_code}\n" "$URL/dashboard"
curl -sI "$URL/keys/claim.prover" | head -1
```
Expected: the three headers, with `frame-ancestors 'none'` in the CSP; `200` for `/dashboard` (the SPA rewrite); `HTTP/2 200` for the key.

- [ ] **Step 4: Smoke test with a wallet**

On the production URL, the user creates a 1-lì-xì envelope (1 tNIGHT, 2 hours) and claims it from Recipient B. Links now point to the production host, because they use `window.location.origin`.

---

### Task 13: Docs, spike cleanup, CI and merge

**Files:**
- Delete: `spikes/s4-wallet/` (whole folder)
- Modify: `package.json` (workspaces), `package-lock.json`, `README.md`, `CLAUDE.md`, `docs/superpowers/spikes/2026-10-01-chain-spikes.md`

**Interfaces:**
- Consumes: everything above.
- Produces: `main` with the app, green CI.

- [ ] **Step 1: Remove the S4 spike page**

```bash
git rm -r spikes/s4-wallet
```
In the root `package.json`, remove `"spikes/s4-wallet"` from `workspaces`. Then:
```bash
npm install && npm ls @midnight-ntwrk/onchain-runtime-v3 | grep -c invalid
```
Expected: `0`.

In `docs/superpowers/spikes/2026-10-01-chain-spikes.md`, change "using the throwaway page in `spikes/s4-wallet`" to "using the throwaway page in `spikes/s4-wallet` (removed in Plan 3; see git history; `app/src/chain/midnight.ts` is its successor)".

- [ ] **Step 2: README**

In `README.md`, add after the Develop section's chain block:
````markdown
## Run the app

The app is a static React site. It talks to the Preprod contract in `deployments/preprod.json` through your browser wallet.

```bash
npm run build -w @lixi/app && npm run preview -w @lixi/app   # http://localhost:4173, with the production CSP
npm run dev -w @lixi/app                                     # dev server with hot reload (no CSP)
```

You need the [1AM](https://1am.xyz) wallet on Preprod, with tNIGHT from the faucet registered for DUST. To prove on your own machine instead of in the wallet, start the proof server (`docker run -p 127.0.0.1:6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server`) and choose "On this computer" when connecting.
````
If Task 12 deployed, add the live URL as the first line of that section: `Live on Preprod: <URL>`.

Add a credits line at the end of that section:
```markdown
Fonts: Fraunces and Playwrite VN (SIL Open Font License 1.1). Icons adapted from Lucide (ISC).
```

In the package table, add this row after `cli/`:
```markdown
| `app/` | React app: create and share envelopes, claim links, dashboard with refund and backup |
```

- [ ] **Step 3: CLAUDE.md**

Under **Commands**, add:
```markdown
- App: `npm run dev -w @lixi/app` (no CSP), or `npm run build -w @lixi/app && npm run preview -w @lixi/app` for the built site with the CSP on http://localhost:4173. Both first copy `keys/` and `zkir/` into `app/public/` (`npm run zk -w @lixi/app`), compiling the keys if `npm test` deleted them.
- CI: `ci.yml` runs on every push (~2 min). `devnet.yml` runs only when `contract/`, `sdk/`, `cli/`, `devnet/` or the lockfile change, or by hand: `gh workflow run devnet.yml --ref <branch>`.
```
Under **Invariants**, add:
```markdown
- The CSP is defined twice: `app/src/csp.ts` (meta tag in the built page) and `app/vercel.json` (header). `app/test/config.test.ts` keeps them equal; a new host the page talks to goes into both.
- App reads use the network's public indexer (`NETWORKS`), never the wallet's, so the CSP can list every host.
- The sender vault lives in `localStorage` (`app/src/lib/storage.ts`). Its entry is saved before `createEnvelope` is submitted, and a vault that fails to parse is only replaced by an explicit restore.
- Pages reach the outside world only through `Services` (`app/src/services.tsx`).
- The look is set by `docs/superpowers/specs/2026-10-02-lixi-frontend-design.md`. Colours live in `app/src/theme.ts` and `app/src/index.css`, and `app/test/theme.test.ts` keeps them equal and above WCAG AA. A light’s state always means the same thing: lit = waiting, out = opened, gold = coming home, dashed = not on chain, pulsing = in flight.
```
Under **Testing quirks**, add:
```markdown
- App page tests run the whole app in jsdom (`// @vitest-environment jsdom`) through `app/test/app-harness.tsx`: the real contract via `LixiSimulator`, a fake wallet, in-memory storage.
```

- [ ] **Step 4: Verify everything**

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run compact && npm run build -w @lixi/app
```
Expected: all pass; app 49 tests.

- [ ] **Step 5: Commit and push**

```bash
git add -A spikes package.json package-lock.json README.md CLAUDE.md docs
git commit -m "docs: run-the-app instructions; chore: remove the S4 spike page"
git push -u origin feat/app
```

- [ ] **Step 6: Watch CI**

```bash
gh run list --branch feat/app --limit 4
gh run watch --exit-status $(gh run list --branch feat/app --workflow CI --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch --exit-status $(gh run list --branch feat/app --workflow Devnet --limit 1 --json databaseId --jq '.[0].databaseId')
```
Expected: `CI` succeeds in ~2 min. `Devnet` runs too, because this branch changed `sdk/` and the lockfile, and succeeds in ~10 min. A later push that touches only `app/` or docs starts `CI` alone.

If a job fails, read `gh run view --log-failed` and use superpowers:systematic-debugging.

- [ ] **Step 7: Merge**

When both workflows are green:
```bash
git switch main && git merge --ff-only feat/app && git push origin main
git push origin --delete feat/app && git branch -d feat/app
```

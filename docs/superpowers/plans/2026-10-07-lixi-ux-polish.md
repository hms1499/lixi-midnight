# Lixi UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app work for a first-time recipient or sender without a wallet. Only 1AM connects.

**Architecture:**
- **Pages and the wallet panel.** Every change sits in the React app (`app/`), on top of the existing `Services` injection, the wallet context and the jsdom page tests. `WalletPanel` becomes the one place that decides what a visitor without a wallet sees: the desktop-only notice, the install steps or the connect button.
- **Small new modules:**
  - `lib/device.ts`, for phone detection;
  - `wallet/WalletPanelPresence.tsx`, which hides the header's Connect button;
  - `chain/tx-hash.ts`, which turns an identifier into the hash the explorer needs.

**Tech Stack:** React 19, react-router 7, Vite 8, Tailwind 4, Vitest + Testing Library (jsdom), midnight-js 4.x.

**Spec:** `docs/superpowers/specs/2026-10-07-lixi-ux-polish-design.md`

## Global Constraints

- **Node and the contract.** Node 24: run `source ~/.nvm/nvm.sh && nvm use 24` in each new shell before any npm command. Run every command from the repo root.
- **Single test runs.** `npm test -w @lixi/app -- -t "<test name>"` runs one test. It skips the root contract compile, so run `npm run compact:fast` once first if `contract/src/managed/` is missing.
- **Formatting.** Prettier uses single quotes, trailing commas and width 120. Project hooks auto-format edited TS files.
- **Services.** Pages reach the outside world only through `Services` (`app/src/services.tsx`). That covers `navigator`, `location.reload` and the clipboard. `CopyButton` already uses the clipboard, so it stays as it is.
- **The CSP is defined twice:** in `app/src/csp.ts` and in `app/vercel.json`. `app/test/config.test.ts` keeps them equal.
- **Secrets.** Link secrets and the seed never appear in logs or error text.
- **Unchanged layers.** No change to `contract/`, `sdk/` or `cli/`. (Amended by the final review: `claimTx` and `refundTx` return the hash; see spec §3.9.)
- **Copy.** Copy is English. Wallet text names 1AM only, and the word "Lace" must not appear in any rendered page.
- **Branch.** Work on `feat/ux-polish`, which already holds the spec commit `fd1c652`.
- **Commits.** Use conventional commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Merging (user's rule).** Merge once the local gate passes:
  1. run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build -w @lixi/app`;
  2. fast-forward `main`, push it, and delete the branch.

  Do not wait for CI, and do not run the devnet suite.

## Review Focus

1. **1AM injects a moment after page load.** The install steps may show first. They must give way to the **Connect 1AM** button without a reload. Task 3 pins this.
2. **The wallet declines the first seal after the backup step.** The error shows, the form and Seal come back, and the next Seal does not ask for the backup again. Task 5 pins this.
3. **The Share page's background reads keep failing.** No error flashes; the page stays "on its way" with **Check again**. Task 6 pins this.
4. **The indexer never answers the hash lookup.** The claim still ends on the opened amount within 15 s, just without a link. Task 8 pins this.
5. **A phone has no Clipboard API** (an insecure origin, an old browser). The desktop-only notice also shows the link in a read-only field, so it can be copied by hand. Task 2 pins this.

---

### Task 1: Only 1AM connects

**Files:**
- Modify:
  - `app/src/wallet/connector.ts`
  - `app/src/wallet/balances.ts`
  - `app/src/wallet/errors.ts`
  - `app/src/components/FeeHint.tsx`
  - `app/src/components/Header.tsx`
  - `app/src/components/WalletPanel.tsx`
  - `app/src/csp.ts`
  - `app/vercel.json`
- Test:
  - `app/test/wallet.test.ts`
  - `app/test/config.test.ts`
  - `app/test/claim-page.test.tsx`
  - `app/test/create-page.test.tsx`

**Interfaces:**
- Produces:
  - `detectWallets(injected)` returns only 1AM APIs.
  - `feeNote(walletName: string): string` always returns a note.
  - `feeWarnings(wallet: { balances?: Balances }, needNight?: bigint): string[]` warns about tNIGHT only.
  - `paysOwnFees` is deleted.

- [ ] **Step 1: Write the failing tests**

In `app/test/wallet.test.ts`, replace the `describe('detectWallets', …)` block with:

```ts
describe('detectWallets', () => {
  it('keeps one compatible 1AM API, and ignores every other wallet', () => {
    const found = detectWallets({
      a: initial(),
      b: initial({ apiVersion: '4.1.0' }),
      c: initial({ rdns: 'io.lace', name: 'Lace', apiVersion: '4.0.1' }),
      d: { name: 'junk' } as unknown as InitialAPI,
      e: initial({ rdns: 'xyz.1am.old', apiVersion: '3.0.0' }),
    });
    expect(found.map((w) => `${w.name} ${w.apiVersion}`)).toEqual(['1AM 4.0.1']);
    expect(detectWallets(undefined)).toEqual([]);
  });
});
```

Replace the whole `describe('feeWarnings', …)` block, which starts at `describe('feeWarnings', () => {` and ends before `describe('friendlyError'`, with:

```ts
describe('feeWarnings', () => {
  const wallet = (night: bigint, dust: bigint) => ({ balances: { night, dust } });

  it('never warns about DUST, because 1AM pays the fee', () => {
    expect(feeWarnings(wallet(10_000_000n, 0n))).toEqual([]);
  });

  it('warns when the wallet shows less tNIGHT than the envelope needs', () => {
    expect(feeWarnings(wallet(2_500_000n, 0n), 3_000_000n)).toEqual([
      'Your wallet shows 2.5 tNIGHT, less than the 3 tNIGHT this envelope needs.',
    ]);
    expect(feeWarnings(wallet(3_000_000n, 0n), 3_000_000n)).toEqual([]);
  });

  it('says nothing when the balances are unknown', () => {
    expect(feeWarnings({}, 3_000_000n)).toEqual([]);
  });

  it('tells the user who pays the fee', () => {
    expect(feeNote('1AM')).toBe('Fees are paid by 1AM, so your wallet needs no DUST.');
  });
});
```

In the same file, update three tests:
- **Rename one.** `'reports "no dust" when a wallet with no DUST fails to balance (Lace throws a bare Error)'` becomes `'reports "no dust" when a wallet with no DUST fails to balance with a bare Error'`.
- **The no-DUST test.** Replace the body of `'says how to get DUST when the wallet has none to pay the fee'` with:

```ts
    const wrapped = "Unexpected error submitting scoped transaction '<unnamed>': Error: no dust";
    expect(friendlyError(new Error(wrapped))).toMatch(/^Your wallet has no DUST to pay the fee\. Nothing was sent\./);
    expect(friendlyError(new Error(wrapped))).toMatch(/let 1AM pay the fee/);
    expect(friendlyError(new Error(wrapped))).not.toMatch(/Lace/);
```

- **The proof-server test.** In `'says how to start a proof server when proving could not reach one'`, replace the line `expect(friendlyError(new Error(blocked))).toMatch(/Proof Server, Local/);` with:

```ts
    expect(friendlyError(new Error(blocked))).toMatch(/In 1AM under Advanced/);
    expect(friendlyError(new Error(blocked))).not.toMatch(/Lace/);
```

In `app/test/config.test.ts`, replace the first CSP test with:

```ts
  it('allows only our origin, the Blockfrost indexer and the local proof server', () => {
    const policy = cspFor('preprod');
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).toContain(
      "connect-src 'self' https://midnight-preprod.blockfrost.io wss://midnight-preprod.blockfrost.io http://127.0.0.1:6300;",
    );
    expect(policy).not.toContain('localhost');
    expect(policy).not.toMatch(/'unsafe-inline'|'unsafe-eval'|\*|project_id/);
  });
```

In `app/test/claim-page.test.tsx`:
- Replace the test `'shows the wallet’s balances once connected, warns about 0 DUST, and reads them again after opening'` with:

```ts
  it('shows the wallet’s balances once connected, and reads them again after opening', async () => {
    const user = userEvent.setup();
    let dust = 0n;
    const wallet = fakeWallet({ name: '1AM', balances: () => ({ night: 4_996_000_000n, dust }) });
    const { show, create } = setup({ detectWallets: () => [wallet] });
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    await user.click(screen.getByRole('button', { name: 'Connect 1AM to open it' }));
    await screen.findByText('4,996 tNIGHT · 0 DUST');
    dust = 2n * 10n ** 15n;
    await user.click(screen.getByRole('button', { name: 'Open the lì xì' }));
    await screen.findByText('It is in your wallet. The link’s secret never touched the chain.');
    await screen.findByText('4,996 tNIGHT · 2 DUST');
  });
```

- In `'names both wallets that work when none is installed'`, rename the test to `'names 1AM, and no other wallet, when none is installed'`. Replace its `Lace` line with:

```ts
    expect(screen.queryByRole('link', { name: 'Lace' })).toBeNull();
```

In `app/test/create-page.test.tsx`, in `'warns before sealing when the wallet shows less tNIGHT than the envelope, without blocking'`:
- change `fakeWallet({ name: 'Lace', …` to `fakeWallet({ name: '1AM', …`;
- change `{ name: 'Connect Lace' }` to `{ name: 'Connect 1AM' }`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run compact:fast && npm test -w @lixi/app -- test/wallet.test.ts test/config.test.ts test/claim-page.test.tsx test/create-page.test.tsx`

Expected: FAIL.
- **detectWallets:** it also returns Lace.
- **feeWarnings:** it still warns about 0 DUST.
- **Copy:** the no-DUST and proof-server texts mention Lace.
- **CSP:** the policy still has `localhost`.
- **Claim page:** the Lace link is still present.

- [ ] **Step 3: Implement**

`app/src/wallet/connector.ts`:
- replace the `CONNECT_TIMEOUT_MS` doc comment;
- add `SUPPORTED`;
- filter in `detectWallets`;
- reword the `balanceOrExplain` comment.

```ts
/** A wallet that never answers connect() would leave the page waiting, so connecting gives up after this long. */
export const CONNECT_TIMEOUT_MS = 60_000;

/** The DApp Connector API major version this app is built against (4.0.1). */
const API_MAJOR = '4.';

/** Lixi connects 1AM only (UX polish spec §3.1): Lace proved unstable on Preprod. */
const SUPPORTED = /1am/i;

/** 1AM wallets that injected a compatible DApp Connector API into `window.midnight`, one per wallet. */
export const detectWallets = (injected: Record<string, InitialAPI> | undefined): InitialAPI[] => {
  const byRdns = new Map<string, InitialAPI>();
  for (const w of Object.values(injected ?? {})) {
    const compatible = typeof w?.connect === 'function' && String(w.apiVersion).startsWith(API_MAJOR);
    const supported = SUPPORTED.test(String(w?.name)) || SUPPORTED.test(String(w?.rdns));
    if (compatible && supported && !byRdns.has(w.rdns)) byRdns.set(w.rdns, w);
  }
  return [...byRdns.values()];
};
```

The new `balanceOrExplain` doc comment:

```ts
/**
 * Has the wallet add the DUST fee to `tx`. A wallet paying with its own DUST and holding none fails
 * here with a bare Error (spike S4 retest), so a failure asks the wallet for its DUST and reports
 * 'no dust' when there is none. It asks only after a failure: 1AM normally pays through its sponsor.
 */
```

`app/src/wallet/balances.ts`: replace everything from the `paysOwnFees` comment to the end of the file with:

```ts
/** 1AM pays fees through its own sponsor (spike S4), so the wallet's DUST says nothing about fees. */
export const feeNote = (walletName: string): string => `Fees are paid by ${walletName}, so your wallet needs no DUST.`;

/**
 * Early warnings to show above a button that sends a transaction. They never block it: a wallet's
 * balances can lag the chain.
 */
export const feeWarnings = (wallet: { readonly balances?: Balances }, needNight?: bigint): string[] => {
  const { balances } = wallet;
  if (!balances || needNight === undefined || balances.night >= needNight) return [];
  return [
    `Your wallet shows ${formatBalanceNight(balances.night)} tNIGHT, less than the ${formatNight(needNight)} tNIGHT this envelope needs.`,
  ];
};
```

`app/src/components/FeeHint.tsx`, the whole file:

```tsx
import { feeNote, feeWarnings } from '../wallet/balances';
import type { ConnectedWallet } from '../wallet/WalletContext';
import { Notice } from './ui';

/** Above a button that sends a transaction: who pays the fee, then warnings from the wallet's last known balances. */
export const FeeHint = ({ wallet, needNight }: { readonly wallet: ConnectedWallet; readonly needNight?: bigint }) => (
  <>
    <Notice>{feeNote(wallet.name)}</Notice>
    {feeWarnings(wallet, needNight).map((warning) => (
      <Notice key={warning} tone="warn">
        {warning}
      </Notice>
    ))}
  </>
);
```

`app/src/components/Header.tsx`:
- delete the line `import { paysOwnFees } from '../wallet/balances';`;
- change the chip's `title` to:

```tsx
          title={`${name}: ${a}${balances ? ` (fees paid by ${name})` : ''}`}
```

`app/src/wallet/errors.ts`:
- **Locked-wallet comment.** Replace `// Lace reports a locked wallet with the same code as a declined request.` with `// A wallet can report a locked wallet with the same code as a declined request.`
- **Failed-fetch return.** Replace the return of the `/returned an error: TypeError: Failed to fetch/` branch with:

```ts
    return `A proof server could not be reached. Start the local one with “${PROOF_SERVER_COMMAND}”, or choose In 1AM under Advanced.`;
```

- **No-DUST return.** Replace the `said === 'no dust'` return with:

```ts
    return 'Your wallet has no DUST to pay the fee. Nothing was sent. In 1AM, let 1AM pay the fee instead of paying with your own DUST, or generate DUST from your NIGHT and wait until it is above zero, then try again.';
```

`app/src/components/WalletPanel.tsx`:
- delete the `LACE_HREF` constant and its comment;
- replace the no-wallet `Notice` with:

```tsx
        <Notice tone="warn">
          No Midnight wallet found in this browser. Install{' '}
          <a className="underline underline-offset-4" href={LINKS.wallet.href} target="_blank" rel="noreferrer">
            1AM
          </a>
          , set it to Preprod, then reload this page.
        </Notice>
```

`app/src/csp.ts`: replace the second paragraph of the doc comment and the `connect` line. The comment now ends after "(audit H4)." Then:

```ts
  const connect = [n.indexer, n.indexerWS, n.proofServer].map((url) => new URL(url).origin);
```

In the same file, delete the now-unused `const prover = new URL(n.proofServer);`.

`app/vercel.json`: in the CSP header value, delete ` http://localhost:6300` (keep `http://127.0.0.1:6300`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app`

Expected: PASS. The typecheck has no errors, and no file still imports `paysOwnFees`.

- [ ] **Step 5: Commit**

```bash
git add app/src app/vercel.json app/test
git commit -m "feat(app): connect 1AM only; drop Lace copy, its DUST warning and localhost from the CSP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: A phone without a wallet sees "open this on a computer"

**Files:**
- Create:
  - `app/src/lib/device.ts`
  - `app/test/device.test.ts`
- Modify:
  - `app/src/services.tsx`
  - `app/src/main.tsx`
  - `app/test/app-harness.tsx`
  - `app/src/components/WalletPanel.tsx`
- Test: `app/test/claim-page.test.tsx`

**Interfaces:**
- Produces:
  - `isMobile(nav: NavigatorLike): boolean`;
  - `Services.isMobile: () => boolean`;
  - `Services.reload: () => void`, which Task 3 uses;
  - `DesktopOnly`, a component inside `WalletPanel.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `app/test/device.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isMobile } from '../src/lib/device';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('isMobile', () => {
  it('is false for desktop Chrome', () => {
    expect(isMobile({ userAgent: CHROME_MAC, maxTouchPoints: 0 })).toBe(false);
    expect(isMobile({ userAgent: CHROME_MAC, userAgentData: { mobile: false } })).toBe(false);
  });

  it('is true for Android and iPhone', () => {
    expect(
      isMobile({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
      }),
    ).toBe(true);
    expect(
      isMobile({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      }),
    ).toBe(true);
  });

  it('is true when the browser says it is mobile', () => {
    expect(isMobile({ userAgent: 'x', userAgentData: { mobile: true } })).toBe(true);
  });

  it('is true for an iPad that reports a Mac user agent', () => {
    expect(
      isMobile({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });
});
```

Append to the `describe('claim page', …)` block in `app/test/claim-page.test.tsx` (`ORIGIN` comes from `./app-harness`, so add it to that import):

```ts
  it('on a phone with no wallet, still shows what is inside and offers the link for a computer', async () => {
    const user = userEvent.setup();
    const { show, create } = setup({ detectWallets: () => [], isMobile: () => true });
    const [link] = await create();
    const path = claimUrl('', link);
    show(path);
    await screen.findByText(/1 tNIGHT is sealed inside/);
    expect(screen.getByText('Open this on a computer.')).toBeTruthy();
    expect(screen.queryByText(/No Midnight wallet found/)).toBeNull();
    // Without a Clipboard API the link can still be copied by hand (Review Focus 5).
    expect((screen.getByLabelText('Link to open on a computer') as HTMLInputElement).value).toBe(`${ORIGIN}${path}`);
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await navigator.clipboard.readText()).toBe(`${ORIGIN}${path}`);
  });

  it('on a phone that does have 1AM, connects as usual', async () => {
    const { show, create } = setup({ detectWallets: () => [fakeWallet({ name: '1AM' })], isMobile: () => true });
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByRole('button', { name: 'Connect 1AM to open it' });
    expect(screen.queryByText('Open this on a computer.')).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @lixi/app -- test/device.test.ts test/claim-page.test.tsx`

Expected: FAIL. `../src/lib/device` does not exist, and `isMobile` is not a key of `Services`.

- [ ] **Step 3: Implement**

Create `app/src/lib/device.ts`:

```ts
/** The parts of `navigator` that tell a phone or tablet apart. `userAgentData` is Chromium-only. */
export type NavigatorLike = {
  readonly userAgent: string;
  readonly maxTouchPoints?: number;
  readonly userAgentData?: { readonly mobile?: boolean };
};

/** True on a phone or tablet. Lixi needs the 1AM extension, which runs only in a desktop browser (§3.2). */
export const isMobile = (nav: NavigatorLike): boolean => {
  if (nav.userAgentData?.mobile) return true;
  if (/Android|iPhone|iPad|iPod/i.test(nav.userAgent)) return true;
  // iPadOS reports a Mac user agent; only the touch screen gives it away.
  return /Macintosh/.test(nav.userAgent) && (nav.maxTouchPoints ?? 0) > 1;
};
```

In `app/src/services.tsx`, add to `Services` after `detectWallets`:

```ts
  /** True on a phone or tablet, where no Midnight wallet extension runs (UX polish spec §3.2). */
  readonly isMobile: () => boolean;
  /** Reloads the page, so a wallet extension installed meanwhile can inject itself. */
  readonly reload: () => void;
```

In `app/src/main.tsx`, add `import { isMobile } from './lib/device';`. Add to `services` after `detectWallets`:

```ts
  isMobile: () => isMobile(navigator),
  reload: () => window.location.reload(),
```

In `app/test/app-harness.tsx`, add to the default `services` after `detectWallets`:

```ts
    isMobile: () => false,
    reload: () => undefined,
```

In `app/src/components/WalletPanel.tsx`:
- add the imports `import { useLocation } from 'react-router';` and `import { CopyButton } from './CopyButton';`;
- add this component above `WalletPanel`:

```tsx
/** A phone with no wallet: Lixi needs the 1AM extension, so the link goes to a computer (UX polish spec §3.2). */
const DesktopOnly = () => {
  const { origin } = useServices();
  const { pathname, search, hash } = useLocation();
  const url = `${origin}${pathname}${search}${hash}`;
  return (
    <div className="space-y-3">
      <p className="font-semibold text-paper">Open this on a computer.</p>
      <p className="text-paper-soft">
        Lixi needs Chrome on a computer with the 1AM extension. Copy the link and open it there.
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          aria-label="Link to open on a computer"
          value={url}
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton text={url} label="Copy link" />
      </div>
    </div>
  );
};
```

In `WalletPanel`:
- change `const { storage } = useServices();` to `const { storage, isMobile } = useServices();`;
- add, right after the `connecting` early return:

```tsx
  if (wallets.length === 0 && isMobile()) return <DesktopOnly />;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src app/test
git commit -m "feat(app): on a phone with no wallet, say Lixi needs a computer and offer the link

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Install steps, the Advanced prover choice, and the fee copy

**Files:**
- Modify:
  - `app/src/components/WalletPanel.tsx` (whole file)
  - `app/src/pages/Claim.tsx`
  - `app/src/pages/Create.tsx`
  - `app/src/pages/Home.tsx`
- Test:
  - `app/test/claim-page.test.tsx`
  - `app/test/create-page.test.tsx`
  - `app/test/shell.test.tsx`

**Interfaces:**
- Consumes: `Services.reload` and `Services.isMobile` (Task 2), and `detectWallets` (Task 1).
- Produces: `WalletPanel` and `RequireWallet` accept `hint?: ReactNode`. Task 4 adds `inHeader?: boolean`.

- [ ] **Step 1: Write the failing tests**

In `app/test/claim-page.test.tsx`:
- **Imports.** Add `vi` to the vitest import, `within` to the testing-library import, and these two lines:

```ts
import { PROVER_KEY } from '../src/lib/storage';
import { detectWallets } from '../src/wallet/connector';
```

- **Install steps.** Replace the test `'names 1AM, and no other wallet, when none is installed'` with:

```ts
  it('lists the steps to get 1AM when no wallet is installed, and reloads', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const { show, create } = setup({ detectWallets: () => [], reload });
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText('No 1AM wallet found in this browser.');
    expect(screen.getByRole('link', { name: 'Install 1AM for Chrome' }).getAttribute('href')).toBe('https://1am.xyz');
    expect(screen.getByText('Your link stays in the address bar when you reload.')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Lace/);
    await user.click(screen.getByRole('button', { name: 'I installed 1AM, reload' }));
    expect(reload).toHaveBeenCalledOnce();
  });
```

- **Append** these tests:

```ts
  it('ignores a wallet that is not 1AM, as if none were installed', async () => {
    const { show, create } = setup({
      detectWallets: () => detectWallets({ lace: fakeWallet({ name: 'Lace' }) }),
    });
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText('No 1AM wallet found in this browser.');
  });

  it('swaps the install steps for the Connect button when 1AM injects a moment late', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let injected = false;
      const { show, create } = setup({ detectWallets: () => (injected ? [fakeWallet({ name: '1AM' })] : []) });
      const [link] = await create();
      show(claimUrl('', link));
      await screen.findByText('No 1AM wallet found in this browser.');
      injected = true;
      await act(() => vi.advanceTimersByTimeAsync(600));
      await screen.findByRole('button', { name: 'Connect 1AM to open it' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('says 1AM pays the fee, so opening needs no tNIGHT or DUST', async () => {
    const { show, create } = setup();
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText('Opening it needs the 1AM wallet. 1AM pays the fee, so you need no tNIGHT or DUST.');
    expect(screen.queryByText(/a little DUST/)).toBeNull();
  });

  it('folds where proofs are made under Advanced, open only when the local proof server was chosen', async () => {
    const { show, create, storage } = setup();
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    const details = screen.getByText('Advanced: where proofs are made').closest('details')!;
    expect(details.open).toBe(false);
    expect(
      (within(details).getByRole('radio', { name: 'In 1AM (default)', hidden: true }) as HTMLInputElement).checked,
    ).toBe(true);
    cleanup();
    storage.setItem(PROVER_KEY, 'local');
    show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    expect(screen.getByText('Advanced: where proofs are made').closest('details')!.open).toBe(true);
  });
```

Add `act` to the `@testing-library/react` import.

- **Both panels.** In `'shows the same choice of where proofs are made in both wallet panels'`, change the radio query to:

```ts
    const radios = screen.getAllByRole('radio', { name: 'In 1AM (default)', hidden: true }) as HTMLInputElement[];
```

(Task 4 replaces this test.)

In `app/test/create-page.test.tsx`, add:

```ts
  it('points a sender with no wallet to the faucet, and says 1AM pays the fee', async () => {
    const user = userEvent.setup();
    const { show, store } = setup({ detectWallets: () => [] });
    store.save({ seed: new Uint8Array(32).fill(7), envelopes: [] });
    store.setBackedUp(true);
    show('/create');
    await screen.findByText('No 1AM wallet found in this browser.');
    // The footer has a faucet icon link too, so look inside the hint.
    const hint = screen.getByText(/You need tNIGHT to fill an envelope/);
    expect(within(hint).getByRole('link', { name: 'Preprod faucet' }).getAttribute('href')).toBe(
      'https://midnight-tmnight-preprod.nethermind.dev/',
    );
    cleanup();
    const withWallet = setup();
    withWallet.store.save({ seed: new Uint8Array(32).fill(7), envelopes: [] });
    withWallet.store.setBackedUp(true);
    withWallet.show('/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await screen.findByText('Your wallet pays 10 tNIGHT. 1AM pays the fee.');
  });
```

In `app/test/create-page.test.tsx`, add `within` to the `@testing-library/react` import.

In `app/test/shell.test.tsx`, add to `'answers the questions a first visitor has'`:

```ts
    expect(
      screen.getByText(
        'Yes: the 1AM wallet, set to Preprod. 1AM pays the fee, so you need no tNIGHT or DUST. You can see what is inside before you connect.',
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Lace/);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @lixi/app -- test/claim-page.test.tsx test/create-page.test.tsx test/shell.test.tsx`

Expected: FAIL. The new texts, the install steps and `<details>` are missing.

- [ ] **Step 3: Implement**

Replace `app/src/components/WalletPanel.tsx` with:

```tsx
import { useId, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import type { ProverChoice } from '../chain/port';
import { LINKS } from '../lib/links';
import { loadProver, saveProver } from '../lib/storage';
import { useServices } from '../services';
import { PROOF_SERVER_COMMAND } from '../wallet/errors';
import { useDetectedWallets, useWallet, type ConnectedWallet } from '../wallet/WalletContext';
import { CopyButton } from './CopyButton';
import { Button, Notice, Working } from './ui';

type PanelProps = {
  /** Completes "Connect your 1AM wallet …", for example "to open it". */
  readonly purpose: string;
  /** The connect button's text for a wallet; defaults to "Connect <name>". */
  readonly cta?: (walletName: string) => string;
  /** One more line under the install steps, for this page (UX polish spec §3.4). */
  readonly hint?: ReactNode;
};

/** A phone with no wallet: Lixi needs the 1AM extension, so the link goes to a computer (UX polish spec §3.2). */
const DesktopOnly = () => {
  const { origin } = useServices();
  const { pathname, search, hash } = useLocation();
  const url = `${origin}${pathname}${search}${hash}`;
  return (
    <div className="space-y-3">
      <p className="font-semibold text-paper">Open this on a computer.</p>
      <p className="text-paper-soft">
        Lixi needs Chrome on a computer with the 1AM extension. Copy the link and open it there.
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          aria-label="Link to open on a computer"
          value={url}
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton text={url} label="Copy link" />
      </div>
    </div>
  );
};

/** No wallet in a desktop browser: how to get 1AM, then a reload so it can inject itself (UX polish spec §3.4). */
const InstallSteps = ({ hint }: { hint?: ReactNode }) => {
  const { reload } = useServices();
  return (
    <div className="space-y-3">
      <Notice tone="warn">No 1AM wallet found in this browser.</Notice>
      <ol className="list-decimal space-y-1 pl-5 text-paper-soft">
        <li>
          <a className="underline underline-offset-4" href={LINKS.wallet.href} target="_blank" rel="noreferrer">
            Install 1AM for Chrome
          </a>
          .
        </li>
        <li>Create a wallet and set it to Preprod.</li>
        <li>Reload this page.</li>
      </ol>
      {hint && <p className="text-sm text-paper-soft">{hint}</p>}
      <Button tone="quiet" type="button" onClick={reload}>
        I installed 1AM, reload
      </Button>
    </div>
  );
};

/** Lists the 1AM wallet, folds away where proofs are made, and connects (spec §6.6, UX polish spec §3). */
export const WalletPanel = ({ purpose, cta = (name) => `Connect ${name}`, hint }: PanelProps) => {
  const { storage, isMobile } = useServices();
  const { state, connect } = useWallet();
  const wallets = useDetectedWallets();
  const [prover, setProver] = useState<ProverChoice>(() => loadProver(storage));
  // Open at first only for someone who chose the local proof server; after that the user opens and closes it.
  const [advancedOpen] = useState(() => loadProver(storage) === 'local');
  // The header and a page can both show a panel; each needs its own radio group.
  const group = useId();
  const choose = (p: ProverChoice) => {
    setProver(p);
    saveProver(storage, p);
  };

  if (state.status === 'connecting') return <Working>Approve the connection in {state.name}…</Working>;
  if (wallets.length === 0 && isMobile()) return <DesktopOnly />;
  if (wallets.length === 0) return <InstallSteps hint={hint} />;
  return (
    <div className="space-y-4">
      <p className="text-paper-soft">Connect your 1AM wallet {purpose}.</p>
      {state.status === 'failed' && <Notice tone="error">{state.message}</Notice>}
      <div className="flex flex-wrap gap-3">
        {wallets.map((w) => (
          <Button key={w.rdns} type="button" onClick={() => connect(w, prover)}>
            {cta(w.name)}
          </Button>
        ))}
      </div>
      <details open={advancedOpen} className="text-sm text-paper-soft">
        <summary className="cursor-pointer">Advanced: where proofs are made</summary>
        <fieldset className="mt-2 space-y-1">
          <legend className="sr-only">Where proofs are made</legend>
          <label className="flex gap-2">
            <input type="radio" name={group} checked={prover === 'wallet'} onChange={() => choose('wallet')} />
            In 1AM (default)
          </label>
          <label className="flex gap-2">
            <input type="radio" name={group} checked={prover === 'local'} onChange={() => choose('local')} />
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
      </details>
    </div>
  );
};

/** Renders `children` with the connected wallet, or the wallet panel until there is one. */
export const RequireWallet = ({
  purpose,
  cta,
  hint,
  children,
}: PanelProps & { children: (wallet: ConnectedWallet) => ReactNode }) => {
  const { state } = useWallet();
  return state.status === 'connected' ? (
    <>{children(state.wallet)}</>
  ) : (
    <WalletPanel purpose={purpose} cta={cta} hint={hint} />
  );
};
```

In `app/src/pages/Claim.tsx`:
- **The fee line.** Replace `<p className="text-sm text-paper-dim">Opening it needs a Midnight wallet with a little DUST for the fee.</p>` with:

```tsx
            <p className="text-sm text-paper-dim">
              Opening it needs the 1AM wallet. 1AM pays the fee, so you need no tNIGHT or DUST.
            </p>
```

- **The hint.** Add to the `<RequireWallet …>` props:

```tsx
                hint="Your link stays in the address bar when you reload."
```

In `app/src/pages/Create.tsx`:
- **Import.** Add `import { LINKS } from '../lib/links';`.
- **The panel.** Replace `<WalletPanel purpose="to fund the envelope" />` with:

```tsx
            <WalletPanel
              purpose="to fund the envelope"
              hint={
                <>
                  You need tNIGHT to fill an envelope:{' '}
                  <a className="underline underline-offset-4" href={LINKS.faucet.href} target="_blank" rel="noreferrer">
                    {LINKS.faucet.label}
                  </a>
                  .
                </>
              }
            />
```

- **The fee text.** Replace `Your wallet pays {formatNight(total)} tNIGHT plus a small DUST fee.` with `Your wallet pays {formatNight(total)} tNIGHT. 1AM pays the fee.`

In `app/src/pages/Home.tsx`, replace the first `FAQ` answer string with:

```ts
    'Yes: the 1AM wallet, set to Preprod. 1AM pays the fee, so you need no tNIGHT or DUST. You can see what is inside before you connect.',
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app`

Expected: PASS. If the late-injection test fails because the faucet test's `cleanup()` left wallets detected, check that each test calls its own `setup()`.

- [ ] **Step 5: Commit**

```bash
git add app/src app/test
git commit -m "feat(app): guide a visitor without 1AM; fold the prover choice under Advanced; 1AM pays the fee

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The header hides Connect wallet while the page shows its own panel

**Files:**
- Create: `app/src/wallet/WalletPanelPresence.tsx`
- Modify:
  - `app/src/components/Layout.tsx`
  - `app/src/components/WalletPanel.tsx`
  - `app/src/components/Header.tsx`
- Test: `app/test/claim-page.test.tsx`

**Interfaces:**
- Produces:
  - `WalletPanelPresenceProvider`;
  - `useRegisterWalletPanel(active: boolean): void`;
  - `usePagePanelShown(): boolean`;
  - `WalletPanel` accepts `inHeader?: boolean`.

- [ ] **Step 1: Write the failing tests**

In `app/test/claim-page.test.tsx`, replace the test `'shows the same choice of where proofs are made in both wallet panels'` with these two tests:

```ts
  it('hides the header’s Connect wallet while the page shows its own wallet panel', async () => {
    const { show, create, store } = setup();
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByRole('button', { name: 'Connect Test Wallet to open it' });
    expect(screen.queryByRole('button', { name: 'Connect wallet' })).toBeNull();
    cleanup();
    store.setBackedUp(true);
    show('/create');
    await screen.findByRole('button', { name: 'Connect Test Wallet' });
    expect(screen.queryByRole('button', { name: 'Connect wallet' })).toBeNull();
    cleanup();
    show('/');
    await screen.findByRole('heading', { name: /Every light is one lì xì/ });
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeTruthy();
  });

  it('remembers a prover chosen in the header panel on the page panel', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    const [link] = await create();
    show('/');
    await user.click(await screen.findByRole('button', { name: 'Connect wallet' }));
    fireEvent.click(screen.getByRole('radio', { name: 'On this computer, with the local proof server', hidden: true }));
    cleanup();
    show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    const local = screen.getByRole('radio', {
      name: 'On this computer, with the local proof server',
      hidden: true,
    }) as HTMLInputElement;
    expect(local.checked).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @lixi/app -- -t "hides the header"`

Expected: FAIL, because **Connect wallet** is still in the header on the claim page.

- [ ] **Step 3: Implement**

Create `app/src/wallet/WalletPanelPresence.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Presence = { readonly count: number; register(): () => void };

const PresenceContext = createContext<Presence | null>(null);

/** Counts the wallet panels a page shows, so the header can drop its own Connect button (UX polish spec §3.8). */
export const WalletPanelPresenceProvider = ({ children }: { children: ReactNode }) => {
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => n - 1);
  }, []);
  const value = useMemo(() => ({ count, register }), [count, register]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

/** Counts the calling panel while it is mounted and `active`. */
export const useRegisterWalletPanel = (active: boolean): void => {
  const register = useContext(PresenceContext)?.register;
  useEffect(() => (active && register ? register() : undefined), [active, register]);
};

/** True while the page shows a wallet panel of its own. */
export const usePagePanelShown = (): boolean => (useContext(PresenceContext)?.count ?? 0) > 0;
```

`app/src/components/Layout.tsx`: wrap the layout in the provider.

```tsx
import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { WalletPanelPresenceProvider } from '../wallet/WalletPanelPresence';
import { Footer } from './Footer';
import { Header } from './Header';

export const Layout = () => (
  <WalletPanelPresenceProvider>
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  </WalletPanelPresenceProvider>
);
```

(Keep the existing `Page` export below it unchanged.)

In `app/src/components/WalletPanel.tsx`:
- **Import.** Add `import { useRegisterWalletPanel } from '../wallet/WalletPanelPresence';`.
- **The prop.** Add to `PanelProps`:

```ts
  /** The header's own dropdown panel, which does not hide the header's Connect button. */
  readonly inHeader?: boolean;
```

- **The signature.** Change it to `export const WalletPanel = ({ purpose, cta = (name) => `Connect ${name}`, hint, inHeader = false }: PanelProps) => {`.
- **Registering.** Add `useRegisterWalletPanel(!inHeader);` right after `const group = useId();`, before any early return.

In `app/src/components/Header.tsx`:
- **Import.** Add `import { usePagePanelShown } from '../wallet/WalletPanelPresence';`.
- **Hooks.** In `WalletControl`, add `const pagePanel = usePagePanelShown();` as the second hook line.
- **Hiding.** Right after the `if (state.status === 'connected') { … }` block, add:

```tsx
  // The page shows its own wallet panel; a second Connect button would only compete with it (§3.8).
  if (pagePanel) return null;
```

- **The header panel.** Change `<WalletPanel purpose="to use Lixi" />` to `<WalletPanel purpose="to use Lixi" inHeader />`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app`

Expected: PASS. The dashboard test `'shows each lì xì as a light…'` still finds **Connect Test Wallet** in the page panel.

- [ ] **Step 5: Commit**

```bash
git add app/src app/test
git commit -m "feat(app): hide the header's Connect wallet while the page shows its own wallet panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ask for the backup at the first Seal, not before the form

**Files:**
- Modify:
  - `app/src/components/BackupPanel.tsx`
  - `app/src/pages/Create.tsx`
- Test: `app/test/create-page.test.tsx`

**Interfaces:**
- Produces: `BackupStep({ vault, count, onSaved, onBack })` in `BackupPanel.tsx`. `BackupGate` is deleted.

- [ ] **Step 1: Write the failing tests**

In `app/test/create-page.test.tsx`, replace the test `'asks for the backup first, then seals the envelope and lists one link per lì xì'` with:

```ts
  it('shows the form at once, asks for the backup at the first Seal, then lists one link per lì xì', async () => {
    const user = userEvent.setup();
    const { show, store } = setup();
    show('/create');
    const total = await screen.findByLabelText('Total tNIGHT');
    expect(screen.queryByRole('heading', { name: 'Keep your backup string' })).toBeNull();
    await user.clear(total);
    await user.type(total, '3');
    const count = screen.getByLabelText('Number of lì xì');
    await user.clear(count);
    await user.type(count, '3');
    await user.selectOptions(screen.getByLabelText('Amounts'), 'equal');
    await user.click(screen.getByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 3 lì xì' }));

    await screen.findByRole('heading', { name: 'Keep your backup string' });
    expect((screen.getByLabelText('Backup string') as HTMLInputElement).value).toBe(backupString(store.load()!));
    expect(store.load()!.envelopes).toHaveLength(0);
    expect((screen.getByRole('button', { name: 'Saved, seal 3 lì xì' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Saved, seal 3 lì xì' }));

    await screen.findByRole('heading', { name: '3 lì xì, ready to hand out' });
    expect(store.backedUp()).toBe(true);
    expect(screen.getAllByText('1 tNIGHT')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Copy link: Lì xì 2' }));
    expect(await navigator.clipboard.readText()).toMatch(new RegExp(`^${ORIGIN}/c#v1\\.`));
    expect(screen.getByRole('button', { name: 'Copied: Lì xì 2' })).toBeTruthy();
  });

  it('Back leaves the backup step, and a later seal skips it', async () => {
    const user = userEvent.setup();
    const { show } = setup();
    show('/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 4 lì xì' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Seal 4 lì xì' }));
    await user.click(await screen.findByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Saved, seal 4 lì xì' }));
    await screen.findByRole('heading', { name: '4 lì xì, ready to hand out' });
    cleanup();
    show('/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 4 lì xì' }));
    await screen.findByRole('heading', { name: '4 lì xì, ready to hand out' });
  });

  it('keeps the backup done when the wallet declines the first seal (Review Focus 2)', async () => {
    const user = userEvent.setup();
    const { show, chain, store } = setup();
    const realCreate = chain.create;
    chain.create = async () => {
      chain.create = realCreate;
      throw new Error('Rejected');
    };
    show('/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 4 lì xì' }));
    await user.click(await screen.findByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Saved, seal 4 lì xì' }));
    await screen.findByText(/^Rejected/);
    expect(store.backedUp()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Seal 4 lì xì' }));
    await screen.findByRole('heading', { name: '4 lì xì, ready to hand out' });
  });
```

In `'warns before sealing when the wallet shows less tNIGHT than the envelope, without blocking'`, delete these two lines:

```ts
    await user.click(await screen.findByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
```

Then change the next line's `await screen.findByLabelText('Total tNIGHT')` so it is still awaited. It already is: `const total = await screen.findByLabelText('Total tNIGHT');`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @lixi/app -- test/create-page.test.tsx`

Expected: FAIL. `/create` still shows "Keep your backup string" before the form.

- [ ] **Step 3: Implement**

In `app/src/components/BackupPanel.tsx`:
- replace `BackupGate` and its doc comment with the code below;
- change the import line to `import { Button, Notice } from './ui';` (`Greeting` is no longer used).

```tsx
/** The first Seal asks for the backup string before anything is sealed (UX polish spec §3.6). */
export const BackupStep = ({
  vault,
  count,
  onSaved,
  onBack,
}: {
  vault: SenderVault;
  count?: number;
  onSaved: () => void;
  onBack: () => void;
}) => {
  const [saved, setSaved] = useState(false);
  return (
    <div className="w-full space-y-4 rounded-lg border border-white/10 p-5">
      <h2 className="text-2xl">Keep your backup string</h2>
      <p className="text-paper-soft">
        Your envelopes are rebuilt from this one string. If this browser loses its data, it is the only way to see them
        again and bring home what nobody opened.
      </p>
      <BackupString vault={vault} />
      <label className="flex gap-2">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I saved my backup string
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={!saved} onClick={onSaved}>
          Saved, seal {count ?? ''} lì xì
        </Button>
        <Button tone="quiet" type="button" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
};
```

In `app/src/pages/Create.tsx`:
- **Import.** Change `import { BackupGate } from '../components/BackupPanel';` to `import { BackupStep } from '../components/BackupPanel';`.
- **State.** After the `status` state, add `const [askBackup, setAskBackup] = useState(false);`.
- **Drop the gate.** Delete the whole `if (!backedUp) return ( <Page><BackupGate … /></Page> );` block.
- **Submit and seal.** Replace the `submit` function with:

```tsx
  const seal = async () => {
    if (!wallet || total === undefined || count === undefined) return;
    setStatus({ sealing: true });
    try {
      const form = { total, count, kind, split: effectiveSplit, durationSeconds: duration };
      const { id } = await createEnvelope(wallet.chain, store, form, wallet.recipient, services.now(), index);
      navigate(`/share/${toHex(id)}`);
    } catch (error) {
      setStatus({ sealing: false, error: friendlyError(error) });
      // A failed seal keeps its vault entry and its index, so the preview moves on to the next free one.
      services.reader
        .readLedger()
        .then((ledger) => setIndex(freeIndex(store.load() ?? vault.vault, ledger, store.floor())))
        .catch(() => undefined);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // The first seal asks for the backup string first (UX polish spec §3.6).
    if (!backedUp) setAskBackup(true);
    else void seal();
  };
```

- **The action area.** Replace the chain `{!wallet ? ( … ) : status.sealing ? ( … ) : ( … )}` with:

```tsx
          {!wallet ? (
            <WalletPanel
              purpose="to fund the envelope"
              hint={
                <>
                  You need tNIGHT to fill an envelope:{' '}
                  <a className="underline underline-offset-4" href={LINKS.faucet.href} target="_blank" rel="noreferrer">
                    {LINKS.faucet.label}
                  </a>
                  .
                </>
              }
            />
          ) : status.sealing ? (
            <Working>Sealing your envelope. About 30 seconds; keep this tab open.</Working>
          ) : askBackup ? (
            <BackupStep
              vault={vault.vault}
              count={count}
              onBack={() => setAskBackup(false)}
              onSaved={() => {
                store.setBackedUp(true);
                setBackedUp(true);
                setAskBackup(false);
                void seal();
              }}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-full space-y-3 empty:hidden">
                <FeeHint wallet={wallet} needNight={total} />
              </div>
              <Button type="submit" disabled={total === undefined || count === undefined || amountError}>
                Seal {count ?? ''} lì xì
              </Button>
              {total !== undefined && (
                <span className="text-sm text-paper-dim">Your wallet pays {formatNight(total)} tNIGHT. 1AM pays the fee.</span>
              )}
            </div>
          )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app && npm run lint`

Expected: PASS, with no lint error for an unused `BackupGate` or `Greeting`.

- [ ] **Step 5: Commit**

```bash
git add app/src app/test
git commit -m "feat(app): show the envelope form at once; ask for the backup string at the first Seal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The Share page looks for the envelope again by itself

**Files:**
- Modify: `app/src/pages/Share.tsx`
- Test: `app/test/create-page.test.tsx`

**Interfaces:**
- Produces: `SHARE_POLL_MS = 5_000` and `SHARE_SLOW_MS = 120_000`, exported from `Share.tsx`.

- [ ] **Step 1: Write the failing tests**

In `app/test/create-page.test.tsx`:
- add `act` to the testing-library import and `vi` to the vitest import;
- add these imports:

```ts
import { toHex, type Ledger } from '@lixi/contract';
import { SHARE_POLL_MS, SHARE_SLOW_MS } from '../src/pages/Share';
```

Add these tests:

```ts
  it('looks for an envelope on its way by itself, and says so when it takes long', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let landed = false;
      const notYet = { envelopes: { member: () => false } } as unknown as Ledger;
      let read: () => Promise<Ledger> = async () => notYet;
      const { show, create, chain, store } = setup({
        reader: { readLedger: () => (landed ? read() : Promise.resolve(notYet)) },
      });
      read = () => chain.readLedger();
      await create();
      const vault = store.load()!;
      show(`/share/${toHex(deriveEnvelope(vault.seed, vault.envelopes[0]).id)}`);
      await screen.findByText('Your envelope is on its way to the chain…');
      await act(() => vi.advanceTimersByTimeAsync(SHARE_SLOW_MS));
      await screen.findByText(/^Still not on chain\./);
      landed = true;
      await act(() => vi.advanceTimersByTimeAsync(SHARE_POLL_MS));
      await screen.findByRole('heading', { name: '2 lì xì, ready to hand out' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays on its way, without an error, while background reads fail (Review Focus 3)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let reads = 0;
      const notYet = { envelopes: { member: () => false } } as unknown as Ledger;
      const { show, create, store } = setup({
        reader: {
          readLedger: async () => {
            if (reads++ === 0) return notYet;
            throw new TypeError('Failed to fetch');
          },
        },
      });
      await create();
      const vault = store.load()!;
      show(`/share/${toHex(deriveEnvelope(vault.seed, vault.envelopes[0]).id)}`);
      await screen.findByText('Your envelope is on its way to the chain…');
      await act(() => vi.advanceTimersByTimeAsync(3 * SHARE_POLL_MS));
      expect(reads).toBeGreaterThan(1);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @lixi/app -- -t "on its way"`

Expected: FAIL. `SHARE_POLL_MS` is not exported, and the page never reads again.

- [ ] **Step 3: Implement**

In `app/src/pages/Share.tsx`, add below the imports:

```ts
/** While the envelope is on its way, how often the page looks again, and when it says it is taking long (§3.7). */
export const SHARE_POLL_MS = 5_000;
export const SHARE_SLOW_MS = 120_000;
```

In `Share`, after the `attempt` state, add `const [slow, setSlow] = useState(false);`. After the existing `useEffect`, add:

```tsx
  // Not on chain yet: look again every few seconds. A failed background read waits for the next tick.
  useEffect(() => {
    if (!envelopeId || onChain !== false) return;
    const poll = setInterval(() => {
      services.reader
        .readLedger()
        .then((ledger) => {
          if (ledger.envelopes.member(envelopeId)) setOnChain(true);
        })
        .catch(() => undefined);
    }, SHARE_POLL_MS);
    const late = setTimeout(() => setSlow(true), SHARE_SLOW_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(late);
    };
  }, [services.reader, envelopeId, onChain]);
```

Replace the `if (!onChain)` return with:

```tsx
  if (!onChain)
    return (
      <Page>
        <div className="space-y-4">
          <Working>Your envelope is on its way to the chain…</Working>
          {slow && (
            <Notice tone="warn">
              Still not on chain. If your wallet shows the transaction failed or was declined, go back and seal again.
              Your envelope list keeps this attempt as Not on chain.
            </Notice>
          )}
          <Button tone="quiet" type="button" onClick={() => setAttempt((n) => n + 1)}>
            Check again
          </Button>
        </div>
      </Page>
    );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src app/test
git commit -m "feat(app): the share page looks for a sealing envelope again by itself

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: An empty dashboard shows only how to start

**Files:**
- Modify: `app/src/pages/Dashboard.tsx`
- Test: `app/test/dashboard-page.test.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing test**

Add to `app/test/dashboard-page.test.tsx`:

```ts
  it('an empty list shows only how to start: no view toggle, no backup box, one way to restore', async () => {
    const user = userEvent.setup();
    const { show } = setup();
    show('/dashboard');
    await screen.findByText('No envelopes in this browser yet.');
    expect(screen.queryByRole('group', { name: 'View' })).toBeNull();
    expect(screen.queryByText('Your backup string')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Restore/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Restore from a backup string' }));
    expect(screen.getByLabelText('Restore from a backup string')).toBeTruthy();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @lixi/app -- -t "an empty list shows only how to start"`

Expected: FAIL. The View group and the backup box both render.

- [ ] **Step 3: Implement**

In `app/src/pages/Dashboard.tsx`, in `Dashboard`'s JSX:
- **The view toggle.** Wrap the `<div role="group" aria-label="View" …>…</div>` in `{envelopes.length > 0 && ( … )}`.
- **The backup box.** Replace the whole backup box `<div className="space-y-5 rounded-lg border border-white/10 p-5">…</div>` with:

```tsx
        {envelopes.length > 0 ? (
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
        ) : (
          // Empty: the empty state's button (or an unreadable vault) opens restoring on its own.
          show === 'restore' && (
            <div className="rounded-lg border border-white/10 p-5">
              <Restore onRestored={reload} />
            </div>
          )
        )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @lixi/app -- test/dashboard-page.test.tsx`

Expected: PASS. That includes `'never overwrites an unreadable vault, and restores from the backup string'`, whose unreadable vault sets `show` to `'restore'`.

- [ ] **Step 5: Commit**

```bash
git add app/src app/test
git commit -m "feat(app): an empty dashboard drops the view toggle and the duplicate restore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: View the transaction after a claim or a refund

`preprod.midnightexplorer.com/transactions/0x<hash>` was checked on 2026-10-07: it shows Lixi tx `8f23cd17…a6a5b6` (block 2,870,283, SUCCESS). The same transaction's identifier `00609e5f…` gives a 404. So the link needs the hash.

**Files:**
- Create:
  - `app/src/chain/tx-hash.ts`
  - `app/test/tx-hash.test.ts`
- Modify:
  - `app/src/chain/port.ts`
  - `app/src/chain/midnight.ts`
  - `app/src/flows/claim.ts`
  - `app/src/flows/manage.ts`
  - `app/src/lib/links.ts`
  - `app/src/pages/Claim.tsx`
  - `app/src/pages/Dashboard.tsx`
- Test:
  - `app/test/flows.test.ts`
  - `app/test/claim-page.test.tsx`
  - `app/test/dashboard-page.test.tsx`

**Interfaces:**
- Produces:
  - `lookupTxHash(watch: (id: string) => Promise<{ txHash: string }>, id: string, timeoutMs?: number): Promise<string>`;
  - `TX_HASH_TIMEOUT_MS = 15_000`;
  - `EXPLORER` and `txUrl(hash: string): string` in `lib/links.ts`.
- Renames:
  - `LixiChain.claim` and `LixiChain.refund` now resolve to the hash, or `''`;
  - `ClaimResult` `{ ok: true; amount; txHash }`;
  - `RefundResult` `{ ok: true; txHash }`.

- [ ] **Step 1: Write the failing tests**

Create `app/test/tx-hash.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { TX_HASH_TIMEOUT_MS, lookupTxHash } from '../src/chain/tx-hash';
import { txUrl } from '../src/lib/links';

describe('lookupTxHash', () => {
  it('returns the hash the indexer reports for an identifier', async () => {
    expect(await lookupTxHash(async (id) => ({ txHash: `hash-of-${id}` }), 'abc')).toBe('hash-of-abc');
  });

  it('returns nothing when the lookup fails', async () => {
    expect(await lookupTxHash(() => Promise.reject(new Error('indexer down')), 'abc')).toBe('');
  });

  it('gives up after the timeout when the indexer never answers (Review Focus 4)', async () => {
    vi.useFakeTimers();
    try {
      const found = lookupTxHash(() => new Promise(() => undefined), 'abc');
      await vi.advanceTimersByTimeAsync(TX_HASH_TIMEOUT_MS);
      expect(await found).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('txUrl', () => {
  it('links a hash on the Preprod explorer, with or without 0x', () => {
    expect(txUrl('ab12')).toBe('https://preprod.midnightexplorer.com/transactions/0xab12');
    expect(txUrl('0xab12')).toBe('https://preprod.midnightexplorer.com/transactions/0xab12');
  });
});
```

In `app/test/flows.test.ts`, line 129: change `txId: 'tx2'` to `txHash: 'tx2'`.

In `app/test/claim-page.test.tsx`:
- add `import { txUrl } from '../src/lib/links';`;
- at the end of the first test, `'shows what is sealed inside before connecting, then opens the lì xì'`, add:

```ts
    expect(screen.getByRole('link', { name: 'View transaction' }).getAttribute('href')).toBe(txUrl('tx2'));
```

Add this test:

```ts
  it('shows no transaction link when the hash could not be looked up', async () => {
    const user = userEvent.setup();
    const { show, create, chain } = setup();
    const [link] = await create();
    const realClaim = chain.claim;
    chain.claim = async (args) => {
      await realClaim(args);
      return '';
    };
    show(claimUrl('', link));
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    await screen.findByText('It is in your wallet. The link’s secret never touched the chain.');
    expect(screen.queryByRole('link', { name: 'View transaction' })).toBeNull();
  });
```

In `app/test/dashboard-page.test.tsx`:
- add `import { txUrl } from '../src/lib/links';`;
- at the end of `'shows each lì xì as a light, and brings the unopened rest home after expiry'`, add:

```ts
    expect(screen.getByRole('link', { name: 'View transaction' }).getAttribute('href')).toBe(txUrl('tx3'));
```

(The simulator chain names transactions `tx<n>` by call count: create 1, claim 2, refund 3.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @lixi/app -- test/tx-hash.test.ts test/flows.test.ts test/claim-page.test.tsx test/dashboard-page.test.tsx`

Expected: FAIL. `tx-hash` and `txUrl` do not exist, flows still return `txId`, and there is no link.

- [ ] **Step 3: Implement**

Create `app/src/chain/tx-hash.ts`:

```ts
/** How long to wait for the indexer to name a landed transaction's hash before giving up on the link. */
export const TX_HASH_TIMEOUT_MS = 15_000;

/**
 * The hash explorers look a transaction up by (midnight-js hands back its identifier). It returns ''
 * on an error or after the timeout: the transaction has landed, and only the explorer link is lost.
 */
export const lookupTxHash = async (
  watch: (id: string) => Promise<{ readonly txHash: string }>,
  id: string,
  timeoutMs = TX_HASH_TIMEOUT_MS,
): Promise<string> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(''), timeoutMs);
  });
  try {
    return await Promise.race([watch(id).then((data) => data.txHash), timedOut]);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
};
```

In `app/src/lib/links.ts`, append:

```ts
/** The Preprod explorer. It is not in LINKS, because every entry there is a footer icon. */
export const EXPLORER = 'https://preprod.midnightexplorer.com';

/** A transaction on the explorer, which looks transactions up by hash (UX polish spec §3.9). */
export const txUrl = (hash: string): string => `${EXPLORER}/transactions/0x${hash.replace(/^0x/, '')}`;
```

In `app/src/chain/port.ts`, replace the `claim` and `refund` lines with:

```ts
  /** Resolves to the transaction hash, or '' when it could not be looked up (UX polish spec §3.9). */
  claim(args: ClaimTxArgs): Promise<string>;
  /** Resolves to the transaction hash, or '' when it could not be looked up. */
  refund(privateState: LixiPrivateState, id: Uint8Array): Promise<string>;
```

In `app/src/chain/midnight.ts`:
- add `import { lookupTxHash } from './tx-hash';`;
- in `walletChain`'s returned object, replace the `claim` and `refund` lines with:

```ts
    claim: async (args) =>
      lookupTxHash((id) => publicDataProvider.watchForTxData(id), await claimTx(providers, address, args)),
    refund: async (privateState, id) =>
      lookupTxHash(
        (txId) => publicDataProvider.watchForTxData(txId),
        await refundTx(providers, address, privateState, id),
      ),
```

In `app/src/flows/claim.ts`:
- change the `ClaimResult` type to `{ readonly ok: true; readonly amount: bigint; readonly txHash: string } | Refused`;
- in `claimWithLink`, rename `txId` to `txHash` in both returns:

```ts
      const txHash = await chain.claim({ ...ready.args, recipient });
      return { ok: true, amount: ready.amount, txHash };
```

and

```ts
        return { ok: true, amount: ready.amount, txHash: '' };
```

In `app/src/flows/manage.ts`:
- change `RefundResult` to `{ readonly ok: true; readonly txHash: string } | Extract<RefundCheck, { ok: false }>`;
- change line 28 to `return { ok: true, txHash: await chain.refund(privateStateOf(vault), id) };`.

In `app/src/pages/Claim.tsx`:
- **Import.** Add `import { txUrl } from '../lib/links';`.
- **The phase type.** Change the `opened` member to `| { readonly step: 'opened'; readonly amount: bigint; readonly txHash: string }`.
- **Setting it.** In `open`, change the success `setPhase` to:

```tsx
      setPhase(
        result.ok
          ? { step: 'opened', amount: result.amount, txHash: result.txHash }
          : { step: 'refused', reason: result.reason },
      );
```

- **The link.** In the `opened` render, add between the "It is in your wallet…" paragraph and the **Send lì xì of your own** link:

```tsx
        {phase.txHash && (
          <a
            className="block text-sm underline underline-offset-4"
            href={txUrl(phase.txHash)}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        )}
```

In `app/src/pages/Dashboard.tsx`:
- **Import.** Add `import { txUrl } from '../lib/links';`.
- **Row state.** In `Row`, add `const [txHash, setTxHash] = useState<string>();` next to `error`.
- **Bringing home.** In `bringHome`, replace `if (!result.ok) setError(NOT_HOME[result.reason]);` with:

```tsx
      if (result.ok) setTxHash(result.txHash);
      else setError(NOT_HOME[result.reason]);
```

- **The link.** Below `<p className="text-sm text-paper-dim">{statusLine(view, now)}</p>`, add:

```tsx
          {view.state === 'refunded' && txHash && (
            <a
              className="text-sm underline underline-offset-4"
              href={txUrl(txHash)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
          )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @lixi/app && npm run typecheck -w @lixi/app`

Expected: PASS. The typecheck also confirms nothing reads `.txId` from a claim or a refund result anymore. `create` keeps its `txId`.

- [ ] **Step 5: Commit**

```bash
git add app/src app/test
git commit -m "feat(app): link a claim or refund to the Preprod explorer by its transaction hash

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Docs, the local gate, a browser check, and the merge

**Files:**
- Modify:
  - `README.md`
  - `docs/superpowers/specs/2026-09-30-lixi-design.md`

- [ ] **Step 1: Update the README**

In `README.md`, replace the two paragraphs that start "You need the [1AM]…" and "[Lace](https://www.lace.io) 2.4.2 also works…" with:

```markdown
Lixi needs Chrome on a computer with the [1AM](https://1am.xyz) wallet extension, set to Preprod. 1AM pays the fees, so recipients need no tNIGHT or DUST; senders need tNIGHT from the faucet. A phone shows the envelope and offers to copy the link for a computer. To prove on your own machine instead of in 1AM, start the proof server (`docker run -p 127.0.0.1:6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server`) and choose "On this computer" under "Advanced" when connecting.

Lace was dropped on 2026-10-07: on Preprod its connect hung, its Authorize button stopped responding, and its DUST balance froze ([lace#2256](https://github.com/input-output-hk/lace/issues/2256)).
```

- [ ] **Step 2: Update the design spec**

In `docs/superpowers/specs/2026-09-30-lixi-design.md`:
- **The Lace finding.** Line `- **Lace needs Docker.** Lace requires a local proof server. 1AM proves in the browser.` gets this sentence appended: ` **Dropped 2026-10-07:** Lace was unstable on Preprod, so the app connects 1AM only (spec 2026-10-07-lixi-ux-polish-design.md).`
- **The architecture.** Line `app/        React + Vite + Tailwind; wallet bridge (1AM via getProvingProvider, Lace via local proof server)` becomes `app/        React + Vite + Tailwind; wallet bridge (1AM, proving in 1AM or with the local proof server)`.
- **Proving.** Line `          │ proving: 1AM WASM in-tab, or Lace + local proof server (never a shared server; audit H4)` becomes `          │ proving: in 1AM, or with the local proof server (never a shared server; audit H4)`.
- **The `/create` row.** `| `/create` | Envelope form and seed backup prompt |` becomes `| `/create` | Envelope form; the seed backup prompt at the first Seal |`.
- **The proof-server error.** `- **Proof server unreachable (Lace):** explain how to start the Docker proof server.` becomes `- **Proof server unreachable:** explain how to start the Docker proof server, or prove in 1AM.`

- [ ] **Step 3: Run the local gate**

Run:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build -w @lixi/app
```

Expected:
- every command exits 0;
- the test summary shows no failures;
- the build prints `dist/index.html`.

- [ ] **Step 4: Check the built site in a browser**

1. Run `npm run preview -w @lixi/app` in the background.
2. Open http://localhost:4173 with Playwright, at 1280×800, and check that:
   - `/c` with a damaged link (`/c#broken`) shows "This link is damaged";
   - `/create` shows the form at once, and, with no extension, the install steps and the faucet link;
   - `/dashboard` with no envelopes shows no Lights/List toggle;
   - the header has no **Connect wallet** on `/create`.
3. At 375×812, check that `/create` shows "Open this on a computer." with the link field.
4. Check that the console shows no CSP violation.
5. Stop the preview, and delete any `.playwright-mcp/` files the run created.

- [ ] **Step 5: Commit the docs and merge**

```bash
git add README.md docs/superpowers/specs/2026-09-30-lixi-design.md
git commit -m "docs: 1AM only, guided first-time users; Lace dropped

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git switch main
git merge --ff-only feat/ux-polish
git push origin main
git branch -d feat/ux-polish
```

Expected: the fast-forward succeeds, the push succeeds, and the branch is deleted. CI starts on the push; do not wait for it.

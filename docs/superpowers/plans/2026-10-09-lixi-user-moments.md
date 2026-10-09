# Lixi User Moments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live Lixi app better for real senders and recipients: pages paint at once, links preview well in chat, messages copy with a greeting, transactions show real progress, the opening shows the amount and a privacy receipt, and senders hear when a lì xì is opened.

**Architecture:** App-only changes in `app/`. The shell stops importing the WASM-backed SDK, and the four SDK pages load lazily. Transaction stages come from wrapping the four midnight-js providers that `walletChain` already builds. Each new behaviour lives in a small module (`lib/prefs.ts`, `lib/greeting.ts`, `lib/countup.ts`, `lib/news.ts`, `chain/stages.ts`, `components/TxProgress.tsx`, `components/Opened.tsx`, `components/Toasts.tsx`) with its own tests.

**Tech Stack:** React 19, react-router 8, Vite 8 + vite-plugin-wasm, Tailwind 4, Vitest 4 + Testing Library (jsdom), Node 24 (runs `.ts` scripts directly).

**Spec:** `docs/superpowers/specs/2026-10-09-lixi-user-moments-design.md`

## Global Constraints

- Run `source ~/.nvm/nvm.sh && nvm use 24` before any npm command. Work on branch `feat/user-moments`.
- No change to `contract/`, `sdk/`, the CSP (`app/src/csp.ts`, `app/public/_headers`) or the colour tokens (`app/src/theme.ts`, `@theme` in `app/src/index.css`).
- A light's state keeps its meaning: lit = waiting, out = opened, gold = coming home, dashed = not on chain, pulsing = in flight.
- Nothing loops except the in-flight pulse; under `prefers-reduced-motion` every animation shows its end state (the global rule at the end of `index.css` already does this).
- Secrets never appear in logs or errors; link secrets live only in the URL fragment.
- Pages reach the outside world only through `Services` (`app/src/services.tsx`).
- Times are unix seconds; amounts are `bigint` base units (1 tNIGHT = 1,000,000).
- Prettier: single quotes, trailing commas, width 120. Conventional commits (`feat(app): …`). End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Test commands: `npm test -w @lixi/app` (all app tests; needs `contract/src/managed/`, run `npm run compact:fast` first if missing), one file with `npm test -w @lixi/app -- test/<file>`.

## Review Focus

1. **A tab left open across a redeploy:** a lazy page's chunk 404s. The page must show "This page could not load…" with a **Reload** button, not a blank screen (Task 1, `lazy-pages.test.tsx`).
2. **A group claim that loses a race and retries:** progress must restart at "Making the zero-knowledge proof" instead of leaving later rows ticked (Task 5, `flows.test.ts`).
3. **Very small and very large amounts on the slip:** 0.000001 and 12345.123456 must show their exact final digits and fit the slip (Task 7, `units.test.ts` and the font-size rule).
4. **Reads that change an envelope without an opening:** a refund, a restore that adds envelopes, or an unchanged read must make no toast; openings while the tab was hidden are announced on the next read (Task 8, `news.test.ts`).
5. **Storage that throws** (private mode, blocked site data) on the Share page: the greeting falls back to the default and copying still works (Task 4, `greeting.test.ts`).

---

### Task 1: The shell paints without WASM (spec §3.1)

**Files:**
- Create: `app/src/lib/prefs.ts`, `app/src/components/LoadBoundary.tsx`, `app/test/lazy-pages.test.tsx`
- Modify: `app/src/lib/storage.ts`, `app/src/components/WalletPanel.tsx:5`, `app/src/wallet/WalletContext.tsx`, `app/src/main.tsx`, `app/src/App.tsx`, `app/src/components/Envelope.tsx`, `app/src/pages/Claim.tsx`, `app/test/storage.test.ts:3`, `app/test/claim-page.test.tsx:7,101`

**Interfaces:**
- Produces: `loadProver`, `saveProver`, `PROVER_KEY` now exported from `app/src/lib/prefs.ts` (removed from `storage.ts`). `EnvelopeChecking` from `components/Envelope.tsx`. `preloadPages(): void` from `App.tsx`. `LoadBoundary` from `components/LoadBoundary.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `app/test/lazy-pages.test.tsx`. The first test must stay first in the file: a `React.lazy` page renders its fallback only until its module has loaded once per test file.

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadBoundary } from '../src/components/LoadBoundary';
import { setup } from './app-harness';

afterEach(cleanup);

describe('lazy pages', () => {
  it('shows the sealed envelope at once on a claim link, before the claim page has loaded', async () => {
    const { show } = setup();
    show('/c#v1.garbage');
    expect(screen.getByRole('img', { name: 'A sealed lì xì' })).toBeTruthy();
    expect(screen.getByText('Looking at the envelope…')).toBeTruthy();
    await screen.findByRole('heading', { name: 'This link is damaged' });
  });

  it('offers a reload when a page’s code cannot load, instead of a blank page', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const Broken = () => {
      throw new Error('Failed to fetch dynamically imported module');
    };
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs the caught error
    render(
      <LoadBoundary onReload={reload}>
        <Broken />
      </LoadBoundary>,
    );
    expect(screen.getByText('This page could not load. Lixi may have been updated since you opened it.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledOnce();
    vi.mocked(console.error).mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @lixi/app -- test/lazy-pages.test.tsx`
Expected: FAIL, `Failed to resolve import "../src/components/LoadBoundary"`.

- [ ] **Step 3: Move the prover preference out of `storage.ts`**

Create `app/src/lib/prefs.ts` (it must not import `@lixi/sdk`: the header's wallet panel uses it):

```ts
import type { ProverChoice } from '../chain/port';

export const PROVER_KEY = 'lixi.prover';

/** Proving in the wallet is the default; 'local' needs the Docker proof server (audit H4). */
export const loadProver = (storage: Storage): ProverChoice =>
  storage.getItem(PROVER_KEY) === 'local' ? 'local' : 'wallet';

export const saveProver = (storage: Storage, prover: ProverChoice): void => storage.setItem(PROVER_KEY, prover);
```

In `app/src/lib/storage.ts`, delete the block from `export const PROVER_KEY = 'lixi.prover';` to the end of the file, and change line 2 from `import type { ProverChoice } from '../chain/port';` to nothing (delete the line; it is then unused).

Update the imports:
- `app/src/components/WalletPanel.tsx:5`: `import { loadProver, saveProver } from '../lib/prefs';`
- `app/test/storage.test.ts:3`: `import { VAULT_KEY, localVaultStore } from '../src/lib/storage';` and add `import { loadProver, saveProver } from '../src/lib/prefs';`
- `app/test/claim-page.test.tsx:7`: `import { PROVER_KEY } from '../src/lib/prefs';`

- [ ] **Step 4: Load `userAddressBytes` only when a wallet connects**

In `app/src/wallet/WalletContext.tsx`, delete `import { userAddressBytes } from '@lixi/sdk';` and replace the body of the `try` in `connect` up to `let recipient` with:

```tsx
        const connected = await connectWallet(initial, services.config.network);
        const { unshieldedAddress } = await connected.getUnshieldedAddress();
        // The SDK pulls in the ledger WASM; load it only once a wallet connects, so the shell paints first (user moments spec §3.1).
        const { userAddressBytes } = await import('@lixi/sdk');
        let recipient: Uint8Array;
```

(The rest of `connect` is unchanged.)

- [ ] **Step 5: Load the chain module on first use**

In `app/src/main.tsx`, replace `import { walletChain, publicReader } from './chain/midnight';` with `import type { LixiReader } from './chain/port';`, add `import { preloadPages } from './App';` next to the existing `App` import (merge into `import { App, preloadPages } from './App';`), and replace the `services` object and what follows with:

```tsx
// The chain module pulls in ~4.8 MB of WASM. Load it on first use, so pages paint before it arrives (user moments spec §3.1).
let chainModule: Promise<typeof import('./chain/midnight')> | undefined;
const loadChain = () => (chainModule ??= import('./chain/midnight'));
let reader: Promise<LixiReader> | undefined;

const services: Services = {
  config,
  reader: { readLedger: async () => (await (reader ??= loadChain().then((m) => m.publicReader(config)))).readLedger() },
  storage: window.localStorage,
  now: nowSeconds,
  origin: window.location.origin,
  detectWallets: () => detectWallets(window.midnight),
  isMobile: () => isMobile(navigator),
  reload: () => window.location.reload(),
  openChain: async (api, prover) => (await loadChain()).walletChain(api, config, prover),
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

// Once the page has painted, fetch the rest while the browser is idle, so a later click rarely waits.
const whenIdle = (run: () => void) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(run) : setTimeout(run, 1000);
whenIdle(() => {
  void loadChain();
  preloadPages();
});
```

Keep the existing `createRoot(...)` call's exact JSX if it differs from the above in anything but position; only the services object and the idle preload are new.

- [ ] **Step 6: The checking view, shared by the claim page and its fallback**

In `app/src/components/Envelope.tsx`, append:

```tsx
/** The claim page while it looks at the envelope; also what /c shows while its code loads (user moments spec §3.1). */
export const EnvelopeChecking = () => (
  <>
    <Envelope state="sealed" label="A sealed lì xì" />
    <p className="pt-4 text-paper-soft">Looking at the envelope…</p>
  </>
);
```

In `app/src/pages/Claim.tsx`, change the import to `import { Envelope, EnvelopeChecking, type EnvelopeState } from '../components/Envelope';` and replace the `checking` branch with:

```tsx
  if (phase.step === 'checking')
    return (
      <Centre>
        <EnvelopeChecking />
      </Centre>
    );
```

- [ ] **Step 7: The load boundary**

Create `app/src/components/LoadBoundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react';
import { Page } from './Layout';
import { Button, Notice } from './ui';

type Props = { readonly children: ReactNode; readonly onReload: () => void };

/**
 * A lazy page whose code fails to load (a tab left open across a redeploy, a dropped connection)
 * offers a reload instead of a blank page. Reloading keeps the URL, fragment included.
 */
export class LoadBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Page>
        <div className="max-w-xl space-y-4">
          <Notice tone="error">This page could not load. Lixi may have been updated since you opened it.</Notice>
          <Button type="button" onClick={this.props.onReload}>
            Reload
          </Button>
        </div>
      </Page>
    );
  }
}
```

- [ ] **Step 8: Lazy routes**

Replace `app/src/App.tsx` with:

```tsx
import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import { EnvelopeChecking } from './components/Envelope';
import { Layout, Page } from './components/Layout';
import { LoadBoundary } from './components/LoadBoundary';
import { Working } from './components/ui';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { useServices } from './services';

// These pages need the SDK and its ledger WASM (~4.8 MB), so they load on demand and Home paints at once
// (user moments spec §3.1). `npm run build` fails if the shell starts importing WASM again.
const pages = {
  create: () => import('./pages/Create'),
  share: () => import('./pages/Share'),
  claim: () => import('./pages/Claim'),
  dashboard: () => import('./pages/Dashboard'),
};
const Create = lazy(() => pages.create().then((m) => ({ default: m.Create })));
const Share = lazy(() => pages.share().then((m) => ({ default: m.Share })));
const Claim = lazy(() => pages.claim().then((m) => ({ default: m.Claim })));
const Dashboard = lazy(() => pages.dashboard().then((m) => ({ default: m.Dashboard })));

/** Starts loading every lazy page, so a later click does not wait. */
export const preloadPages = (): void => {
  for (const load of Object.values(pages)) void load();
};

const Loading = () => (
  <Page>
    <Working>Lighting the lanterns…</Working>
  </Page>
);

const ClaimLoading = () => (
  <Page>
    <div className="mx-auto max-w-xl space-y-5 text-center">
      <EnvelopeChecking />
    </div>
  </Page>
);

const Lazy = ({ children, fallback = <Loading /> }: { children: ReactNode; fallback?: ReactNode }) => {
  const { reload } = useServices();
  return (
    <LoadBoundary onReload={reload}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </LoadBoundary>
  );
};

export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Home />} />
      <Route
        path="create"
        element={
          <Lazy>
            <Create />
          </Lazy>
        }
      />
      <Route
        path="share/:id"
        element={
          <Lazy>
            <Share />
          </Lazy>
        }
      />
      <Route
        path="c"
        element={
          <Lazy fallback={<ClaimLoading />}>
            <Claim />
          </Lazy>
        }
      />
      <Route
        path="dashboard"
        element={
          <Lazy>
            <Dashboard />
          </Lazy>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
```

- [ ] **Step 9: Make the one synchronous page query wait**

In `app/test/claim-page.test.tsx`, the paste test queries right after `show('/c')` twice. Change both `screen.getByLabelText('Paste the link you were sent')` calls (lines ~94 and ~101) to `await screen.findByLabelText('Paste the link you were sent')`.

- [ ] **Step 10: Run the whole app suite**

Run: `npm test -w @lixi/app`
Expected: PASS, every file. If another test queries a lazy page synchronously right after `show(...)`, change that query to its `findBy…` form; do not change what it asserts.

- [ ] **Step 11: Typecheck, lint, and prove the lazy WASM still runs on the built site with the CSP**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

Run: `npm run build -w @lixi/app && npm run preview -w @lixi/app` (needs `app/.env.local` with `VITE_BLOCKFROST_PROJECT_ID`; leave the preview running).

With the Playwright MCP tools: open `http://localhost:4173/c#g1.AAAA…` (any well-formed group link with a random id; build one with the snippet below), wait 15 s, and check that the page says "This envelope is not on this network" (the ledger WASM loaded from a lazy chunk and read the chain) and that `browser_console_messages` at level `error` shows no `Content Security Policy` and no `WebAssembly` error. Also open `http://localhost:4173/` and confirm the hero heading appears.

```js
// Builds a well-formed group link with a random envelope id (it can only ever say "not on this network").
const b = crypto.getRandomValues(new Uint8Array(81)); b[64] = 2; b.fill(0, 65); b[80] = 100;
'/c#g1.' + btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
```

Expected: both pages work. If the lazy chunk fails to instantiate the WASM (top-level await), stop and report: this is the spec's named risk, and the fix (for example `vite-plugin-top-level-await`, or keeping `chain/midnight.ts` eager while the pages stay lazy) needs a decision. Stop the preview afterwards.

- [ ] **Step 12: Commit**

```bash
git add app/src app/test
git commit -m "feat(app): paint the shell before the ledger WASM loads; lazy pages with a reload fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The build refuses WASM in the entry (spec §3.1, Guard)

**Files:**
- Create: `app/scripts/entry-graph.ts`, `app/scripts/check-entry.ts`, `app/test/entry-graph.test.ts`
- Modify: `app/vite.config.ts`, `app/package.json` (`build` script)

**Interfaces:**
- Produces: `staticGraph(manifest: Manifest): string[]`, `wasmInEntry(manifest: Manifest, read: (file: string) => string): string | undefined`, type `Manifest`.

- [ ] **Step 1: Write the failing test**

Create `app/test/entry-graph.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { staticGraph, wasmInEntry, type Manifest } from '../scripts/entry-graph.ts';

const files: Record<string, string> = {
  'assets/index.js': 'import "./shell.js"; const Claim = () => import("./Claim.js");',
  'assets/shell.js': 'export const shell = 1;',
  'assets/Claim.js': 'import "./ledger.js";',
  'assets/ledger.js': 'await WebAssembly.instantiateStreaming(fetch(new URL("midnight_ledger_wasm_bg.wasm", import.meta.url)));',
};
const read = (file: string) => files[file];

const lazy: Manifest = {
  'index.html': { file: 'assets/index.js', isEntry: true, imports: ['_shell.js'], dynamicImports: ['src/pages/Claim.tsx'] },
  '_shell.js': { file: 'assets/shell.js' },
  'src/pages/Claim.tsx': { file: 'assets/Claim.js', imports: ['_ledger.js'] },
  '_ledger.js': { file: 'assets/ledger.js' },
};

describe('entry graph', () => {
  it('follows static imports only, from the entry', () => {
    expect(staticGraph(lazy)).toEqual(['assets/index.js', 'assets/shell.js']);
  });

  it('passes when only a lazy chunk reaches the WASM', () => {
    expect(wasmInEntry(lazy, read)).toBeUndefined();
  });

  it('names the static chunk that reaches it', () => {
    const eager: Manifest = { ...lazy, '_shell.js': { file: 'assets/shell.js', imports: ['_ledger.js'] } };
    expect(wasmInEntry(eager, read)).toBe('assets/ledger.js');
  });

  it('catches a .wasm asset listed on a static chunk', () => {
    const asset: Manifest = { ...lazy, '_shell.js': { file: 'assets/shell.js', assets: ['assets/x_bg.wasm'] } };
    expect(wasmInEntry(asset, read)).toBe('assets/x_bg.wasm');
  });

  it('refuses a manifest with no entry', () => {
    expect(() => staticGraph({ a: { file: 'a.js' } })).toThrow('no entry chunk in the manifest');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @lixi/app -- test/entry-graph.test.ts`
Expected: FAIL, cannot resolve `../scripts/entry-graph.ts`.

- [ ] **Step 3: Implement**

Create `app/scripts/entry-graph.ts`:

```ts
/** The parts of Vite's build manifest (`dist/.vite/manifest.json`) this check reads. */
export type ManifestChunk = {
  readonly file: string;
  readonly isEntry?: boolean;
  readonly imports?: readonly string[];
  readonly dynamicImports?: readonly string[];
  readonly assets?: readonly string[];
};
export type Manifest = Readonly<Record<string, ManifestChunk>>;

const keysFromEntry = (manifest: Manifest): string[] => {
  const entry = Object.keys(manifest).find((k) => manifest[k].isEntry);
  if (!entry) throw new Error('no entry chunk in the manifest');
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    for (const next of manifest[key].imports ?? []) visit(next);
  };
  visit(entry);
  return [...seen];
};

/** Files the browser loads before the first paint: the entry chunk and its static imports, transitively. */
export const staticGraph = (manifest: Manifest): string[] => keysFromEntry(manifest).map((k) => manifest[k].file);

/** The first file loaded before the first paint that brings in WebAssembly, or undefined (user moments spec §3.1). */
export const wasmInEntry = (manifest: Manifest, read: (file: string) => string): string | undefined => {
  for (const key of keysFromEntry(manifest)) {
    const chunk = manifest[key];
    const asset = chunk.assets?.find((a) => a.endsWith('.wasm'));
    if (asset) return asset;
    if (/\.wasm\b/.test(read(chunk.file))) return chunk.file;
  }
  return undefined;
};
```

Create `app/scripts/check-entry.ts`:

```ts
// Fails the build when the first paint would wait for WebAssembly (user moments spec §3.1).
import { readFileSync } from 'node:fs';
import { wasmInEntry, type Manifest } from './entry-graph.ts';

const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8')) as Manifest;
const culprit = wasmInEntry(manifest, (file) => readFileSync(new URL(file, dist), 'utf8'));
if (culprit) {
  console.error(
    `check-entry: ${culprit} loads WebAssembly before the first paint. Keep @lixi/sdk, @lixi/contract and chain/midnight.ts out of the shell.`,
  );
  process.exit(1);
}
console.log('check-entry: the first paint loads no WebAssembly');
```

In `app/vite.config.ts`, replace the comment and `build` line:

```ts
    // The SDK pages load lazily, so the shell paints without the ~11 MB of WASM (user moments spec §3.1).
    // The manifest lets scripts/check-entry.ts prove it after every build.
    build: { target: 'esnext', chunkSizeWarningLimit: 1500, manifest: true },
```

In `app/package.json`, change `"build": "vite build"` to `"build": "vite build && node scripts/check-entry.ts"`.

- [ ] **Step 4: Run the tests and the real build**

Run: `npm test -w @lixi/app -- test/entry-graph.test.ts`
Expected: PASS (5 tests).

Run: `npm run build -w @lixi/app`
Expected: ends with `check-entry: the first paint loads no WebAssembly`. If it names a chunk, find which shell module imports `@lixi/sdk`, `@lixi/contract` or `chain/midnight.ts` (`grep -rn "@lixi/sdk'\|@lixi/contract'\|chain/midnight" app/src --include=*.tsx --include=*.ts`) and move that import behind a dynamic `import()` or out of the shell. If instead the entry mentions `.wasm` only inside Vite's preload dependency list for a dynamic import, narrow the regex in `wasmInEntry` to ignore `__vitePreload` dependency arrays and add a test with that string.

- [ ] **Step 5: Measure the first look**

Start `npm run preview -w @lixi/app`, then run this with the Playwright MCP `browser_run_code_unsafe` tool (fresh contexts, so the cache is empty):

```js
async (page) => {
  const browser = page.context().browser();
  const out = {};
  for (const [label, bytesPerSecond] of [['no throttle', 0], ['10 Mbps', 10e6 / 8], ['3 Mbps', 3e6 / 8]]) {
    for (const path of ['/', '/c#v1.x']) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      if (bytesPerSecond) {
        const cdp = await ctx.newCDPSession(p);
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: bytesPerSecond, uploadThroughput: bytesPerSecond / 4 });
      }
      const t0 = Date.now();
      await p.goto('http://localhost:4173' + path, { waitUntil: 'commit' });
      await p.waitForSelector(path === '/' ? 'h1' : '[aria-label="A sealed lì xì"], h1', { timeout: 120000 });
      out[`${label} ${path}`] = ((Date.now() - t0) / 1000).toFixed(1) + ' s';
      await ctx.close();
    }
  }
  return out;
}
```

Expected: `10 Mbps /` and `10 Mbps /c#v1.x` at or under 1.5 s (5.0 s before this round). Record the numbers in the commit message. Stop the preview.

- [ ] **Step 6: Commit**

```bash
git add app/scripts app/test/entry-graph.test.ts app/vite.config.ts app/package.json
git commit -m "feat(app): fail the build when the first paint would wait for WebAssembly

First look on 10 Mbps, empty cache: home <N> s, claim envelope <N> s (was 5.0 s).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Replace `<N>` with the measured numbers.)

---

### Task 3: Link previews (spec §3.2)

**Files:**
- Create: `app/src/meta.ts`, `app/og/og.html`, `app/scripts/og-image.ts`, `app/public/og.png` (generated), `app/test/meta.test.ts`
- Modify: `app/index.html`, `app/vite.config.ts`, `app/package.json` (`og` script)

**Interfaces:**
- Produces: `DEFAULT_SITE_URL`, `siteUrl(env): string`, `withSiteUrl(html, url): string` from `app/src/meta.ts`.

- [ ] **Step 1: Write the failing test**

Create `app/test/meta.test.ts`:

```ts
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_URL, siteUrl, withSiteUrl } from '../src/meta';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('link previews', () => {
  it('describes the site and points to a 1200 × 630 image on the site, the same for every URL', () => {
    // Whitespace collapsed, so Prettier may wrap the tags however it likes.
    const page = withSiteUrl(html, 'https://lixi.example').replace(/\s+/g, ' ');
    for (const tag of [
      '<meta name="description" content="Red envelopes (lì xì) on Midnight. Open yours with a zero-knowledge proof: only its link knows whose." />',
      '<meta property="og:type" content="website" />',
      '<meta property="og:site_name" content="Lixi" />',
      '<meta property="og:title" content="Lixi: private red envelopes on Midnight" />',
      '<meta property="og:image" content="https://lixi.example/og.png" />',
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />',
      '<meta name="twitter:card" content="summary_large_image" />',
    ])
      expect(page).toContain(tag);
    expect(page).toMatch(/<meta property="og:description" content="[^"]+" \/>/);
    expect(page).toMatch(/<meta property="og:image:alt" content="[^"]+" \/>/);
    expect(page).not.toContain('__SITE_URL__');
  });

  it('builds against the live site unless VITE_SITE_URL says otherwise, and only for an https origin', () => {
    expect(siteUrl({})).toBe(DEFAULT_SITE_URL);
    expect(siteUrl({ VITE_SITE_URL: ' https://lixi.example/ ' })).toBe('https://lixi.example');
    expect(() => siteUrl({ VITE_SITE_URL: 'http://lixi.example' })).toThrow('VITE_SITE_URL');
    expect(() => siteUrl({ VITE_SITE_URL: 'https://lixi.example/app' })).toThrow('VITE_SITE_URL');
  });

  it('ships og.png as a 1200 × 630 PNG under 300 KB', () => {
    const file = new URL('../public/og.png', import.meta.url);
    const png = readFileSync(file);
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(statSync(file).size).toBeLessThan(300 * 1024);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @lixi/app -- test/meta.test.ts`
Expected: FAIL, cannot resolve `../src/meta`.

- [ ] **Step 3: The site URL helpers and the tags**

Create `app/src/meta.ts` (build-time only; the page never imports it):

```ts
/** Where the site is served. Link previews need an absolute image URL (user moments spec §3.2). */
export const DEFAULT_SITE_URL = 'https://lixi-3nv.pages.dev';

export const siteUrl = (env: Record<string, string | undefined>): string => {
  const url = (env.VITE_SITE_URL ?? DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^/\s]+$/.test(url)) throw new Error('VITE_SITE_URL must be an https origin, like https://lixi.example');
  return url;
};

/** Fills the `__SITE_URL__` placeholders in index.html. */
export const withSiteUrl = (html: string, url: string): string => html.replaceAll('__SITE_URL__', url);
```

In `app/index.html`, insert after the `<title>` line:

```html
    <meta
      name="description"
      content="Red envelopes (lì xì) on Midnight. Open yours with a zero-knowledge proof: only its link knows whose."
    />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Lixi" />
    <meta property="og:title" content="Lixi: private red envelopes on Midnight" />
    <meta
      property="og:description"
      content="Red envelopes (lì xì) on Midnight. Open yours with a zero-knowledge proof: only its link knows whose."
    />
    <meta property="og:image" content="__SITE_URL__/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="A glowing red envelope in the night, and the words: Every light is one lì xì." />
    <meta name="twitter:card" content="summary_large_image" />
```

Run `npx prettier --write app/index.html` afterwards; the test collapses whitespace, so any wrapping Prettier chooses still matches.

In `app/vite.config.ts`, import the helpers and add a plugin next to `csp`:

```ts
import { siteUrl, withSiteUrl } from './src/meta.ts';

/** Fills the absolute URLs link previews need (user moments spec §3.2). */
const site = (url: string): Plugin => ({
  name: 'lixi-site-url',
  transformIndexHtml: (html) => withSiteUrl(html, url),
});
```

and inside `defineConfig`, after the `appConfig` line:

```ts
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const { network } = appConfig(env);
```

(replace the existing `const { network } = appConfig(loadEnv(mode, process.cwd(), 'VITE_'));`), and change the plugins line to:

```ts
    plugins: [react(), tailwindcss(), wasm(), csp(cspFor(network)), site(siteUrl(env))],
```

- [ ] **Step 4: The preview image**

Create `app/og/og.html` (rendered once; fonts from the workspace's `node_modules`):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      @font-face {
        font-family: 'Fraunces';
        src: url('../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2') format('woff2');
        font-weight: 100 900;
      }
      @font-face {
        font-family: 'Fraunces';
        src: url('../../node_modules/@fontsource-variable/fraunces/files/fraunces-vietnamese-opsz-normal.woff2')
          format('woff2');
        font-weight: 100 900;
        unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+1EA0-1EF9;
      }
      html,
      body {
        margin: 0;
        width: 1200px;
        height: 630px;
        overflow: hidden;
      }
      body {
        background: radial-gradient(circle at 30% 55%, #2a0f16 0, #0c0a12 55%);
        color: #efe2cf;
        font-family: 'Fraunces', Georgia, serif;
        display: flex;
        align-items: center;
        gap: 96px;
        padding: 0 110px;
        box-sizing: border-box;
      }
      .envelope {
        position: relative;
        flex: none;
        width: 230px;
        height: 300px;
        border-radius: 16px;
        background: linear-gradient(160deg, #ef3346, #b0101f);
        box-shadow:
          0 0 60px 16px rgb(239 51 70 / 0.44),
          0 0 200px 60px rgb(239 51 70 / 0.16);
      }
      .envelope::before {
        content: '';
        position: absolute;
        inset: 0 0 auto;
        height: 40%;
        border-radius: 16px 16px 0 0;
        background: #8f0c1b;
        clip-path: polygon(0 0, 100% 0, 50% 100%);
      }
      .envelope::after {
        content: '';
        position: absolute;
        top: 33%;
        left: 50%;
        width: 38px;
        height: 38px;
        translate: -50% 0;
        border-radius: 999px;
        background: #f2c14e;
        box-shadow: 0 0 18px #f2c14e;
      }
      .light {
        position: absolute;
        width: 26px;
        height: 34px;
        border-radius: 4px;
        background: linear-gradient(160deg, #ef3346, #b0101f);
        box-shadow: 0 0 16px 4px rgb(239 51 70 / 0.38);
      }
      .light.out {
        background: #221a21;
        box-shadow: none;
      }
      h1 {
        margin: 0 0 18px;
        font-size: 68px;
        font-weight: 400;
        line-height: 1.08;
      }
      p {
        margin: 0;
        font-size: 30px;
        color: #b3a593;
      }
      .brand {
        margin-top: 40px;
        font-size: 26px;
        color: #f2c14e;
        letter-spacing: 0.02em;
      }
    </style>
  </head>
  <body>
    <span class="light" style="left: 70px; top: 70px"></span>
    <span class="light out" style="left: 470px; top: 520px"></span>
    <span class="light" style="left: 1090px; top: 90px"></span>
    <span class="light out" style="left: 1010px; top: 540px"></span>
    <div class="envelope"></div>
    <div>
      <h1>Every light is one lì xì.</h1>
      <p>Only its link knows whose.</p>
      <p class="brand">Lixi · private red envelopes on Midnight</p>
    </div>
  </body>
</html>
```

Create `app/scripts/og-image.ts`:

```ts
// Renders og/og.html to public/og.png at 1200 × 630 with headless Chrome (user moments spec §3.2).
// Set CHROME to the Chrome binary if it is not at the macOS default.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const html = new URL('../og/og.html', import.meta.url).href;
const out = fileURLToPath(new URL('../public/og.png', import.meta.url));
execFileSync(chrome, [
  '--headless=new',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1200,630',
  '--virtual-time-budget=3000',
  `--screenshot=${out}`,
  html,
]);
console.log('wrote public/og.png');
```

In `app/package.json` scripts, add `"og": "node scripts/og-image.ts",`.

Run: `npm run og -w @lixi/app`
Expected: `wrote public/og.png`. Open `app/public/og.png` with the Read tool and check: the envelope on the left, the three lines of text on the right in Fraunces with the Vietnamese diacritics intact ("lì xì"), nothing cut off.

- [ ] **Step 5: Run the tests**

Run: `npm test -w @lixi/app -- test/meta.test.ts test/config.test.ts`
Expected: PASS.

Run: `npm run build -w @lixi/app && grep -o 'og:image" content="[^"]*"' app/dist/index.html`
Expected: `og:image" content="https://lixi-3nv.pages.dev/og.png"`, and `ls app/dist/og.png` exists.

- [ ] **Step 6: Commit**

```bash
git add app/src/meta.ts app/og app/scripts/og-image.ts app/public/og.png app/test/meta.test.ts app/index.html app/vite.config.ts app/package.json
git commit -m "feat(app): link previews for chat apps, with one image for every URL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Copy with a greeting (spec §3.3)

**Files:**
- Create: `app/src/lib/greeting.ts`, `app/test/greeting.test.ts`, `app/test/share-page.test.tsx`
- Modify: `app/src/pages/Share.tsx`, `app/src/components/CopyButton.tsx`

**Interfaces:**
- Produces: `GREETING_KEY`, `DEFAULT_GREETING`, `GREETING_MAX`, `loadGreeting(storage)`, `saveGreeting(storage, text)`, `shareMessage({ greeting, url, expiry, locale?, timeZone? }): string`. `CopyButton` gains an optional `strong?: boolean` prop.

- [ ] **Step 1: Write the failing tests**

Create `app/test/greeting.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_GREETING, GREETING_KEY, loadGreeting, saveGreeting, shareMessage } from '../src/lib/greeting';
import { MemoryStorage } from './helpers';

const expiry = new Date(Date.UTC(2026, 9, 12, 21, 0));

describe('greeting', () => {
  it('puts the greeting, the expiry with its time zone, and the link alone on the last line', () => {
    const lines = shareMessage({ greeting: 'Chúc mừng năm mới!', url: 'https://lixi.test/c#v1.x', expiry, locale: 'en-GB', timeZone: 'UTC' }).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Chúc mừng năm mới!');
    expect(lines[1]).toMatch(/^A lì xì for you on Lixi\. Open it before .*12.*2026.*21:00.*UTC.*:$/);
    expect(lines[2]).toBe('https://lixi.test/c#v1.x');
  });

  it('leaves the first line out when the greeting is empty', () => {
    const message = shareMessage({ greeting: '   ', url: 'https://lixi.test/c#v1.x', expiry, timeZone: 'UTC' });
    expect(message.split('\n')[0]).toMatch(/^A lì xì for you on Lixi/);
  });

  it('remembers the greeting per browser, with a default', () => {
    const storage = new MemoryStorage();
    expect(loadGreeting(storage)).toBe(DEFAULT_GREETING);
    saveGreeting(storage, 'Happy birthday!');
    expect(storage.getItem(GREETING_KEY)).toBe('Happy birthday!');
    expect(loadGreeting(storage)).toBe('Happy birthday!');
  });

  it('falls back to the default when storage throws, and never throws itself', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    } as unknown as Storage;
    expect(loadGreeting(broken)).toBe(DEFAULT_GREETING);
    expect(() => saveGreeting(broken, 'x')).not.toThrow();
  });
});
```

Create `app/test/share-page.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toHex } from '@lixi/contract';
import { claimUrl } from '@lixi/sdk';
import { GREETING_KEY } from '../src/lib/greeting';
import { ORIGIN, setup } from './app-harness';

afterEach(cleanup);

describe('share page', () => {
  it('copies a message with the greeting, the expiry and the link alone on the last line', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    const [first] = await create();
    show(`/share/${toHex(first.id)}`);
    await user.click(await screen.findByRole('button', { name: 'Copy message: Lì xì 1' }));
    const lines = (await navigator.clipboard.readText()).split('\n');
    expect(lines[0]).toBe('Chúc mừng năm mới!');
    expect(lines[1]).toMatch(/^A lì xì for you on Lixi\. Open it before .+:$/);
    expect(lines[2]).toBe(claimUrl(ORIGIN, first));
    expect(screen.getByRole('button', { name: 'Copy link: Lì xì 1' })).toBeTruthy();
  });

  it('remembers an edited greeting, and drops the line when it is empty', async () => {
    const user = userEvent.setup();
    const { show, create, storage } = setup();
    const [first] = await create();
    show(`/share/${toHex(first.id)}`);
    const field = await screen.findByLabelText('Greeting');
    await user.clear(field);
    await user.type(field, 'Happy birthday!');
    expect(storage.getItem(GREETING_KEY)).toBe('Happy birthday!');
    await user.click(screen.getByRole('button', { name: 'Copy message: Lì xì 1' }));
    expect((await navigator.clipboard.readText()).split('\n')[0]).toBe('Happy birthday!');
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: 'Copied: Lì xì 1' }));
    expect((await navigator.clipboard.readText()).split('\n')[0]).toMatch(/^A lì xì for you on Lixi/);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @lixi/app -- test/greeting.test.ts test/share-page.test.tsx`
Expected: FAIL, cannot resolve `../src/lib/greeting`.

- [ ] **Step 3: Implement `greeting.ts`**

Create `app/src/lib/greeting.ts`:

```ts
export const GREETING_KEY = 'lixi.greeting';
export const DEFAULT_GREETING = 'Chúc mừng năm mới!';
export const GREETING_MAX = 120;

/** The sender's greeting, remembered per browser as a convenience; storage that throws gives the default (spec §3.3). */
export const loadGreeting = (storage: Storage): string => {
  try {
    return storage.getItem(GREETING_KEY) ?? DEFAULT_GREETING;
  } catch {
    return DEFAULT_GREETING;
  }
};

export const saveGreeting = (storage: Storage, greeting: string): void => {
  try {
    storage.setItem(GREETING_KEY, greeting);
  } catch {
    // A convenience only: the page works without it.
  }
};

/**
 * The chat message for one link (user moments spec §3.3). The expiry carries a time zone, since the
 * recipient may live elsewhere, and the URL sits alone on the last line so chat apps turn it into a link.
 */
export const shareMessage = ({
  greeting,
  url,
  expiry,
  locale,
  timeZone,
}: {
  greeting: string;
  url: string;
  expiry: Date;
  locale?: string;
  timeZone?: string;
}): string => {
  const when = expiry.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  });
  return [greeting.trim(), `A lì xì for you on Lixi. Open it before ${when}:`, url].filter((l) => l !== '').join('\n');
};
```

- [ ] **Step 4: A stronger CopyButton**

In `app/src/components/CopyButton.tsx`, add `strong` to the props and use it for the idle look:

```tsx
export const CopyButton = ({
  text,
  label = 'Copy',
  name,
  strong = false,
}: {
  text: string;
  label?: string;
  name?: string;
  /** The row's main action: filled red instead of an outline. */
  strong?: boolean;
}) => {
```

and change the idle branch of the class expression from `'border-white/15 text-paper hover:border-lantern'` to:

```tsx
            : strong
              ? 'border-lantern-deep bg-lantern-deep text-white hover:bg-[#bd2334]'
              : 'border-white/15 text-paper hover:border-lantern'
```

- [ ] **Step 5: The Share page**

In `app/src/pages/Share.tsx`:

1. Imports: add `import type { SavedEnvelope } from '@lixi/sdk';` (type-only, merge into the existing `@lixi/sdk` import as `type SavedEnvelope`), and `import { GREETING_MAX, loadGreeting, saveGreeting, shareMessage } from '../lib/greeting';`.
2. Return `saved` from the `useMemo` too:

```tsx
  const { found, saved, unreadable } = useMemo((): {
    found?: ReturnType<typeof deriveEnvelope>;
    saved?: SavedEnvelope;
    unreadable?: string;
  } => {
    try {
      const vault = localVaultStore(services.storage).load();
      const saved = vault?.envelopes.find((e) => toHex(deriveEnvelope(vault.seed, e).id) === id);
      return { found: saved && vault ? deriveEnvelope(vault.seed, saved) : undefined, saved };
    } catch (error) {
      return { unreadable: friendlyError(error) };
    }
  }, [services.storage, id]);
```

3. Greeting state, next to the other `useState` calls at the top of `Share`:

```tsx
  const [greeting, setGreeting] = useState(() => loadGreeting(services.storage));
  const changeGreeting = (text: string) => {
    const next = text.slice(0, GREETING_MAX);
    setGreeting(next);
    saveGreeting(services.storage, next);
  };
```

4. In the final render, after the warning `<Notice>`, add the field, and compute the expiry once:

```tsx
        <label className="block max-w-md space-y-1">
          <span className="text-sm text-paper-soft">Greeting</span>
          <input
            className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2.5"
            value={greeting}
            maxLength={GREETING_MAX}
            onChange={(e) => changeGreeting(e.target.value)}
          />
        </label>
```

with `const expiry = new Date(Number(saved!.expiry) * 1000);` placed next to `const links = …` (when `found` is set, `saved` is too).

5. Each row's single `CopyButton` becomes:

```tsx
                <span className="flex flex-wrap justify-end gap-2">
                  <CopyButton
                    text={shareMessage({ greeting, url, expiry })}
                    label="Copy message"
                    name={name}
                    strong
                  />
                  <CopyButton text={url} label="Copy link" name={name} />
                </span>
```

and the row `<li>` class gains `flex-wrap` (`flex flex-wrap items-center gap-4 …`) so the buttons wrap under the name on a phone.

- [ ] **Step 6: Run the tests**

Run: `npm test -w @lixi/app -- test/greeting.test.ts test/share-page.test.tsx test/create-page.test.tsx test/copy-button.test.tsx`
Expected: PASS. (`create-page.test.tsx` still finds `Copy link: Lì xì 2` and then `Copied: Lì xì 2`.)

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/greeting.ts app/src/pages/Share.tsx app/src/components/CopyButton.tsx app/test/greeting.test.ts app/test/share-page.test.tsx
git commit -m "feat(app): copy each link as a message with a remembered greeting and the expiry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Transactions report their stages (spec §3.4, plumbing)

**Files:**
- Create: `app/src/chain/stages.ts`, `app/test/stages.test.ts`
- Modify: `app/src/chain/port.ts`, `app/src/chain/midnight.ts`, `app/src/wallet/WalletContext.tsx`, `app/src/flows/create.ts`, `app/src/flows/claim.ts`, `app/src/flows/manage.ts`, `app/test/helpers.ts`, `app/test/wallet-chain.test.ts`, `app/test/flows.test.ts`

**Interfaces:**
- Produces (in `chain/port.ts`): `TX_STAGES = ['proving', 'confirm', 'sending', 'waiting'] as const`, `type TxStage`, `type OnStage = (stage: TxStage) => void`; `LixiChain.create(privateState, args, onStage?)`, `claim(args, onStage?)`, `refund(privateState, id, onStage?)`.
- Produces: `withStages(providers: LixiProviders, current: () => OnStage | undefined): LixiProviders` in `chain/stages.ts`.
- Produces: `ConnectedWallet.prover: ProverChoice`.
- Produces: flows take a trailing optional `onStage`: `createEnvelope(chain, store, form, refundAddress, now, previewedIndex?, onStage?)`, `claimWithLink(chain, link, recipient, now, onStage?, tries = 3)`, `refundEnvelope(chain, vault, index, now, onStage?)`.

- [ ] **Step 1: Write the failing tests**

Create `app/test/stages.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { LixiProviders } from '@lixi/sdk';
import type { TxStage } from '../src/chain/port';
import { withStages } from '../src/chain/stages';

const stub = () =>
  ({
    privateStateProvider: {},
    zkConfigProvider: {},
    proofProvider: { proveTx: vi.fn(async () => 'proven') },
    walletProvider: {
      getCoinPublicKey: () => 'cpk',
      getEncryptionPublicKey: () => 'epk',
      balanceTx: vi.fn(async () => 'balanced'),
    },
    midnightProvider: { submitTx: vi.fn(async () => 'tx-id') },
    publicDataProvider: { watchForTxData: vi.fn(async () => ({ txHash: 'h' })), queryContractState: vi.fn() },
  }) as unknown as LixiProviders;

describe('withStages', () => {
  it('reports proving, confirm, sending and waiting as each provider starts, and passes results through', async () => {
    const seen: TxStage[] = [];
    const p = withStages(stub(), () => (s) => seen.push(s));
    expect(await p.proofProvider.proveTx('unproven' as never)).toBe('proven');
    expect(await p.walletProvider.balanceTx('proven' as never)).toBe('balanced');
    expect(await p.midnightProvider.submitTx('balanced' as never)).toBe('tx-id');
    expect(await p.publicDataProvider.watchForTxData('tx-id')).toEqual({ txHash: 'h' });
    expect(seen).toEqual(['proving', 'confirm', 'sending', 'waiting']);
  });

  it('reports the stage a provider failed in, and nothing after it', async () => {
    const s = stub();
    vi.mocked(s.walletProvider.balanceTx).mockRejectedValueOnce(new Error('declined'));
    const seen: TxStage[] = [];
    const p = withStages(s, () => (x) => seen.push(x));
    await p.proofProvider.proveTx('unproven' as never);
    await expect(p.walletProvider.balanceTx('proven' as never)).rejects.toThrow('declined');
    expect(seen).toEqual(['proving', 'confirm']);
  });

  it('keeps every other provider method, and works with no listener', async () => {
    const p = withStages(stub(), () => undefined);
    expect(p.walletProvider.getCoinPublicKey()).toBe('cpk');
    expect(typeof p.publicDataProvider.queryContractState).toBe('function');
    await expect(p.midnightProvider.submitTx('balanced' as never)).resolves.toBe('tx-id');
  });
});
```

Append to `app/test/wallet-chain.test.ts`, inside the `describe`:

```ts
  it('reports a call’s stages to that call’s listener only', async () => {
    const sdk = await import('@lixi/sdk');
    const waits = async (providers: unknown) => {
      await (providers as { publicDataProvider: { watchForTxData(id: string): Promise<unknown> } }).publicDataProvider.watchForTxData('tx');
      return 'hash';
    };
    vi.mocked(sdk.claimTx).mockImplementationOnce(waits as never);
    vi.mocked(sdk.refundTx).mockImplementationOnce(waits as never);
    const chain = await walletChain(api, config, 'local');
    const seen: string[] = [];
    expect(await chain.claim({} as never, (s) => seen.push(s))).toBe('hash');
    expect(seen).toEqual(['waiting']);
    await chain.refund({} as never, new Uint8Array(32)); // no listener: nothing more is reported
    expect(seen).toEqual(['waiting']);
  });
```

Append to `app/test/flows.test.ts`, inside `describe('claim', …)`:

```ts
  it('reports every stage of a claim, a create and a refund', async () => {
    const { sim, chain, store, linksOf, now } = setup();
    const seen: string[] = [];
    await createEnvelope(chain, store, form(), rnd(), sim.now, undefined, (s) => seen.push(s));
    expect(seen).toEqual(['proving', 'confirm', 'sending', 'waiting']);
    seen.length = 0;
    await claimWithLink(chain, linksOf(0)[0], rnd(), now, (s) => seen.push(s));
    expect(seen).toEqual(['proving', 'confirm', 'sending', 'waiting']);
    seen.length = 0;
    sim.now = T0 + 2 * HOUR;
    await refundEnvelope(chain, store.load()!, 0, sim.now, (s) => seen.push(s));
    expect(seen).toEqual(['proving', 'confirm', 'sending', 'waiting']);
  });

  it('starts again from proving when a group claim retries after losing a race', async () => {
    const { chain, create, linksOf, now } = setup();
    await create({ kind: 'group', count: 2, total: 2_000_000n });
    const [link] = linksOf(0);
    const realClaim = chain.claim;
    let first = true;
    chain.claim = async (args, onStage) => {
      if (first) {
        first = false;
        onStage?.('proving');
        onStage?.('confirm');
        await realClaim({ ...args, recipient: rnd() }); // someone else takes this share first
        throw new Error('Rejected');
      }
      return realClaim(args, onStage);
    };
    const seen: string[] = [];
    expect(await claimWithLink(chain, link, rnd(), now, (s) => seen.push(s))).toMatchObject({ ok: true });
    expect(seen).toEqual(['proving', 'confirm', 'proving', 'confirm', 'sending', 'waiting']);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @lixi/app -- test/stages.test.ts test/wallet-chain.test.ts test/flows.test.ts`
Expected: FAIL, cannot resolve `../src/chain/stages`, and type errors on the extra arguments.

- [ ] **Step 3: The port**

In `app/src/chain/port.ts`, add after the imports:

```ts
/** Where a transaction is (user moments spec §3.4), in the order midnight-js runs them. */
export const TX_STAGES = ['proving', 'confirm', 'sending', 'waiting'] as const;
export type TxStage = (typeof TX_STAGES)[number];
export type OnStage = (stage: TxStage) => void;
```

and change `LixiChain` to:

```ts
/**
 * A wallet-backed handle on the deployed contract: each call proves, balances and submits a transaction,
 * telling `onStage` where it is.
 */
export type LixiChain = LixiReader & {
  create(privateState: LixiPrivateState, args: CreateArgs, onStage?: OnStage): Promise<{ id: Uint8Array; txId: string }>;
  /** Resolves to the transaction hash, which explorers look up (UX polish spec §3.9). */
  claim(args: ClaimTxArgs, onStage?: OnStage): Promise<string>;
  /** Resolves to the transaction hash. */
  refund(privateState: LixiPrivateState, id: Uint8Array, onStage?: OnStage): Promise<string>;
};
```

- [ ] **Step 4: `withStages`**

Create `app/src/chain/stages.ts`:

```ts
import type { LixiProviders } from '@lixi/sdk';
import type { OnStage } from './port';

/**
 * midnight-js runs every transaction as proveTx → balanceTx → submitTx → watchForTxData
 * (`submitTxCore` and `submitTx` in midnight-js-contracts). This wraps those four so each reports
 * its stage as it starts (user moments spec §3.4). `current` gives the listener of the call in flight.
 * The providers are plain objects, so spreading keeps their other methods.
 */
export const withStages = (providers: LixiProviders, current: () => OnStage | undefined): LixiProviders => {
  const { proofProvider, walletProvider, midnightProvider, publicDataProvider } = providers;
  return {
    ...providers,
    proofProvider: {
      ...proofProvider,
      proveTx: (...args) => {
        current()?.('proving');
        return proofProvider.proveTx(...args);
      },
    },
    walletProvider: {
      ...walletProvider,
      balanceTx: (...args) => {
        current()?.('confirm');
        return walletProvider.balanceTx(...args);
      },
    },
    midnightProvider: {
      ...midnightProvider,
      submitTx: (...args) => {
        current()?.('sending');
        return midnightProvider.submitTx(...args);
      },
    },
    publicDataProvider: {
      ...publicDataProvider,
      watchForTxData: (...args) => {
        current()?.('waiting');
        return publicDataProvider.watchForTxData(...args);
      },
    },
  };
};
```

- [ ] **Step 5: `walletChain` uses it**

In `app/src/chain/midnight.ts`: import `withStages` from `./stages` and `type OnStage` from `./port` (merge with the existing `./port` import). Then replace the final `const address = …; return { … };` of `walletChain` with:

```ts
  const address = config.contractAddress;
  let listener: OnStage | undefined;
  const staged = withStages(providers, () => listener);
  /** Runs one transaction with `onStage` as its listener. Pages run one transaction at a time. */
  const reporting = async <T>(onStage: OnStage | undefined, run: () => Promise<T>): Promise<T> => {
    listener = onStage;
    try {
      return await run();
    } finally {
      listener = undefined;
    }
  };
  return {
    readLedger: () => readLedger(publicDataProvider, address),
    create: (privateState, args, onStage) =>
      reporting(onStage, () => createEnvelopeTx(staged, address, privateState, args)),
    claim: (args, onStage) => reporting(onStage, () => claimTx(staged, address, args)),
    refund: (privateState, id, onStage) => reporting(onStage, () => refundTx(staged, address, privateState, id)),
  };
```

- [ ] **Step 6: The wallet context**

In `app/src/wallet/WalletContext.tsx`:
- add to `ConnectedWallet`: 

```ts
  /** Where this connection makes proofs, chosen when connecting (shown in transaction progress). */
  readonly prover: ProverChoice;
```

- `rereadingAfter` passes the listener through:

```ts
const rereadingAfter = (chain: LixiChain, reread: () => void): LixiChain => ({
  readLedger: () => chain.readLedger(),
  create: (privateState, args, onStage) => chain.create(privateState, args, onStage).finally(reread),
  claim: (args, onStage) => chain.claim(args, onStage).finally(reread),
  refund: (privateState, id, onStage) => chain.refund(privateState, id, onStage).finally(reread),
});
```

- in `connect`, the connected state gets the prover: `wallet: { name: initial.name, address: unshieldedAddress, recipient, chain, prover }`.

- [ ] **Step 7: The flows**

`app/src/flows/create.ts`: add `import type { OnStage } from '../chain/port';` (merge into the existing `LixiChain` type import), add a last parameter `onStage?: OnStage` after `previewedIndex?: number`, and pass it: `return chain.create(privateStateOf(next), { … }, onStage);`.

`app/src/flows/claim.ts`: import `type OnStage` the same way; change the signature to `(chain: LixiChain, link: ClaimLink, recipient: Uint8Array, now: () => number, onStage?: OnStage, tries = 3)`, and the call to `const txHash = await chain.claim({ ...ready.args, recipient }, onStage);`. Update the doc comment's mention of `tries` if it names its position.

`app/src/flows/manage.ts`: import `type OnStage`; add `onStage?: OnStage` after `now: number` in `refundEnvelope`, and call `chain.refund(privateStateOf(vault), id, onStage)`.

- [ ] **Step 8: The simulator chain reports stages**

In `app/test/helpers.ts`, change the port import to `import { TX_STAGES, type LixiChain, type OnStage } from '../src/chain/port';` and replace `simChain` with:

```ts
/** Reports every stage at once, as if the transaction ran through all of them. */
const report = (onStage?: OnStage) => {
  for (const stage of TX_STAGES) onStage?.(stage);
};

/** A LixiChain backed by the real compiled contract running in-process. */
export const simChain = (sim: LixiSimulator): LixiChain & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    readLedger: async () => sim.ledger(),
    create: async (privateState, a, onStage) => {
      report(onStage);
      calls.push('create');
      sim.privateState = privateState;
      return { id: sim.create(a.nonce, a.expiry, a.refundAddress, a.onePerAddress), txId: `tx${calls.length}` };
    },
    claim: async (a, onStage) => {
      report(onStage);
      calls.push('claim');
      sim.claim(a.id, a.share, a.path, a.recipient);
      return `tx${calls.length}`;
    },
    refund: async (privateState, id, onStage) => {
      report(onStage);
      calls.push('refund');
      sim.privateState = privateState;
      sim.refund(id);
      return `tx${calls.length}`;
    },
  };
};
```

- [ ] **Step 9: Run the tests**

Run: `npm test -w @lixi/app`
Expected: PASS, every file. Then `npm run typecheck && npm run lint`: no errors.

- [ ] **Step 10: Commit**

```bash
git add app/src/chain app/src/wallet/WalletContext.tsx app/src/flows app/test/helpers.ts app/test/stages.test.ts app/test/wallet-chain.test.ts app/test/flows.test.ts
git commit -m "feat(app): transactions report proving, confirm, sending and waiting as they happen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Show real progress on Seal, Open and Bring home (spec §3.4, UI)

**Files:**
- Create: `app/src/components/TxProgress.tsx`, `app/test/tx-progress.test.tsx`
- Modify: `app/src/index.css` (components layer), `app/src/pages/Claim.tsx`, `app/src/pages/Create.tsx`, `app/src/pages/Dashboard.tsx`, `app/test/claim-page.test.tsx`, `app/test/create-page.test.tsx`, `app/test/dashboard-page.test.tsx`

**Interfaces:**
- Consumes: `TX_STAGES`, `TxStage`, `ProverChoice` from `chain/port.ts`; `ConnectedWallet.prover`; flows' `onStage` (Task 5).
- Produces: `TxProgress({ stage?: TxStage; prover: ProverChoice })`, rendering `<ol aria-label="Transaction progress">` whose `<li>`s carry `data-state="done" | "now" | "later"`.

- [ ] **Step 1: Write the failing tests**

Create `app/test/tx-progress.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { TxProgress } from '../src/components/TxProgress';

afterEach(cleanup);

const states = () =>
  within(screen.getByRole('list', { name: 'Transaction progress' }))
    .getAllByRole('listitem')
    .map((li) => li.dataset.state);

describe('TxProgress', () => {
  it('ticks finished rows, marks the current one, dims the rest, and announces only the current stage', () => {
    render(<TxProgress stage="sending" prover="wallet" />);
    expect(states()).toEqual(['done', 'done', 'now', 'later']);
    expect(screen.getByText('In 1AM')).toBeTruthy();
    expect(screen.getByText('1AM pays the fee.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Sending to Midnight');
  });

  it('starts at the proof before the first stage arrives, and says where the proof is made', () => {
    render(<TxProgress prover="local" />);
    expect(states()).toEqual(['now', 'later', 'later', 'later']);
    expect(screen.getByText('On this computer')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Making the zero-knowledge proof');
  });

  it('counts the seconds of the current stage, and starts again at the next', async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<TxProgress stage="proving" prover="wallet" />);
      await act(() => vi.advanceTimersByTimeAsync(3000));
      expect(screen.getByText('3 s')).toBeTruthy();
      rerender(<TxProgress stage="confirm" prover="wallet" />);
      expect(screen.getByText('0 s')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
```

Append to `app/test/claim-page.test.tsx` (inside the `describe`):

```tsx
  it('shows each stage of opening as it happens', async () => {
    const user = userEvent.setup();
    const { show, create, chain } = setup();
    const [link] = await create();
    const realClaim = chain.claim;
    let finish!: () => void;
    chain.claim = async (args, onStage) => {
      onStage?.('proving');
      onStage?.('confirm');
      await new Promise<void>((resolve) => (finish = resolve));
      onStage?.('sending');
      onStage?.('waiting');
      return realClaim(args);
    };
    show(claimUrl('', link));
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    const list = await screen.findByRole('list', { name: 'Transaction progress' });
    await vi.waitFor(() =>
      expect(within(list).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['done', 'now', 'later', 'later']),
    );
    expect(screen.queryByText('Proving, then your wallet asks you to confirm.')).toBeNull();
    finish();
    await screen.findByRole('img', { name: /^An opened lì xì/ });
  });
```

Note: until Task 7 lands, the opened envelope's name is `An opened lì xì` exactly, which the regex also matches.

Append to `app/test/create-page.test.tsx` (inside its `describe`; it reuses the flow of the first test up to Seal):

```tsx
  it('shows each stage of sealing as it happens', async () => {
    const user = userEvent.setup();
    const { show, store, chain } = setup();
    store.setBackedUp(true);
    const realCreate = chain.create;
    let finish!: () => void;
    chain.create = async (privateState, args, onStage) => {
      onStage?.('proving');
      await new Promise<void>((resolve) => (finish = resolve));
      return realCreate(privateState, args, onStage);
    };
    show('/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 4 lì xì' }));
    await screen.findByText('Sealing your envelope. Keep this tab open.');
    const list = screen.getByRole('list', { name: 'Transaction progress' });
    expect(within(list).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['now', 'later', 'later', 'later']);
    finish();
    await screen.findByRole('heading', { name: /ready to hand out/ });
  });
```

(Add `within` to the file's `@testing-library/react` import if missing. If the vault needs creating before `setBackedUp`, `Create` creates it on render; `setBackedUp(true)` only skips the backup step, as the first test's later seals do.)

Append to `app/test/dashboard-page.test.tsx` (inside the `describe`):

```tsx
  it('shows each stage of bringing it home as it happens', async () => {
    const user = userEvent.setup();
    const { sim, show, create, chain } = setup();
    await create();
    sim.now = T0 + 2 * HOUR;
    const realRefund = chain.refund;
    let finish!: () => void;
    chain.refund = async (privateState, id, onStage) => {
      onStage?.('proving');
      onStage?.('confirm');
      onStage?.('sending');
      await new Promise<void>((resolve) => (finish = resolve));
      return realRefund(privateState, id, onStage);
    };
    show('/dashboard');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Bring 2 tNIGHT home' }));
    const list = await screen.findByRole('list', { name: 'Transaction progress' });
    expect(within(list).getAllByRole('listitem').map((li) => li.dataset.state)).toEqual(['done', 'done', 'now', 'later']);
    finish();
    await screen.findByText('Came home: 2 tNIGHT.');
  });
```

(Add `within` to that file's import.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @lixi/app -- test/tx-progress.test.tsx test/claim-page.test.tsx test/create-page.test.tsx test/dashboard-page.test.tsx`
Expected: FAIL, cannot resolve `../src/components/TxProgress`, and the three page tests time out looking for the list.

- [ ] **Step 3: The component**

Create `app/src/components/TxProgress.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { TX_STAGES, type ProverChoice, type TxStage } from '../chain/port';

const ROWS: Record<TxStage, { label: string; sub?: (prover: ProverChoice) => string }> = {
  proving: { label: 'Making the zero-knowledge proof', sub: (p) => (p === 'local' ? 'On this computer' : 'In 1AM') },
  confirm: { label: 'Confirm in 1AM', sub: () => '1AM pays the fee.' },
  sending: { label: 'Sending to Midnight' },
  waiting: { label: 'Waiting for a block' },
};

/** Whole seconds since `key` last changed. */
const useSecondsSince = (key: unknown): number => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [key]);
  return seconds;
};

/**
 * Where a transaction is, row by row (user moments spec §3.4). Finished rows show a check, the current
 * row a pulsing dot (in flight) and its own seconds, later rows are dim. Marks are CSS, not lights.
 */
export const TxProgress = ({ stage, prover }: { stage?: TxStage; prover: ProverChoice }) => {
  const current = TX_STAGES.indexOf(stage ?? 'proving');
  const seconds = useSecondsSince(current);
  return (
    <div className="space-y-2 text-left">
      <p role="status" className="sr-only">
        {ROWS[TX_STAGES[current]].label}
      </p>
      <ol aria-label="Transaction progress" className="space-y-2.5">
        {TX_STAGES.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'later';
          const row = ROWS[s];
          return (
            <li key={s} data-state={state} className="tx-row flex items-start gap-3">
              <span className="tx-mark" aria-hidden="true" />
              <span className="flex-1">
                <span className={state === 'later' ? 'text-paper-dim' : 'text-paper'}>{row.label}</span>
                <span className="sr-only">{state === 'done' ? ', done' : state === 'now' ? ', in progress' : ''}</span>
                {row.sub && <span className="block text-sm text-paper-dim">{row.sub(prover)}</span>}
              </span>
              {state === 'now' && (
                <span className="text-sm text-paper-dim" aria-hidden="true">
                  {seconds} s
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
```

In `app/src/index.css`, inside `@layer components`, after the `.envelope-xl[data-state='out'] .seal` rule, add:

```css
  /* ── Transaction progress (user moments spec §3.4): a check when done, a pulsing dot while in flight. ── */
  .tx-mark {
    position: relative;
    flex: none;
    width: 14px;
    height: 14px;
    margin-top: 5px;
    border-radius: 999px;
    border: 1px solid rgb(255 255 255 / 0.2);
  }
  .tx-row[data-state='now'] .tx-mark {
    border-color: transparent;
    background: var(--color-lantern);
    animation: pulse 1.6s ease-in-out infinite;
  }
  .tx-row[data-state='done'] .tx-mark {
    border-color: var(--color-seal);
  }
  .tx-row[data-state='done'] .tx-mark::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 4px;
    height: 8px;
    border: solid var(--color-seal);
    border-width: 0 2px 2px 0;
    rotate: 45deg;
  }
```

- [ ] **Step 4: Claim page**

In `app/src/pages/Claim.tsx`:
- imports: `import { TxProgress } from '../components/TxProgress';` and `import type { ProverChoice, TxStage } from '../chain/port';`.
- the `opening` phase: `| { readonly step: 'opening'; readonly prover: ProverChoice; readonly stage?: TxStage }`.
- `open` takes the wallet's prover and reports stages:

```tsx
  const open = async (chain: Parameters<typeof claimWithLink>[0], recipient: Uint8Array, prover: ProverChoice) => {
    const before = phase;
    setPhase({ step: 'opening', prover });
    try {
      const result = await claimWithLink(chain, link, recipient, services.now, (stage) =>
        setPhase({ step: 'opening', prover, stage }),
      );
```

  (the rest of `open` unchanged), and the button calls `open(wallet.chain, wallet.recipient, wallet.prover)`.
- in the `opening` branch, replace the `<p role="status" …>Proving, then your wallet asks you to confirm.</p>` and the progress-bar `<div>` after it with:

```tsx
          {phase.step === 'opening' && (
            <div className="mx-auto max-w-xs pt-2">
              <TxProgress stage={phase.stage} prover={phase.prover} />
            </div>
          )}
```

- [ ] **Step 5: Create page**

In `app/src/pages/Create.tsx`:
- imports: `TxProgress`, and `type TxStage` from `../chain/port`.
- status state: `useState<{ sealing: boolean; stage?: TxStage; error?: string }>({ sealing: false })`.
- in `seal`, pass the listener as the last argument:

```tsx
      const { id } = await createEnvelope(wallet.chain, store, form, wallet.recipient, services.now(), index, (stage) =>
        setStatus({ sealing: true, stage }),
      );
```

- replace `<Working>Sealing your envelope. About 30 seconds; keep this tab open.</Working>` with:

```tsx
            <div className="space-y-4">
              <p className="text-paper-soft">Sealing your envelope. Keep this tab open.</p>
              <TxProgress stage={status.stage} prover={wallet.prover} />
            </div>
```

- `Working` may now be unused in `Create.tsx`; remove it from the `ui` import if lint says so.

- [ ] **Step 6: Dashboard row**

In `app/src/pages/Dashboard.tsx`, in `Row`:
- imports: `TxProgress`, `type TxStage`.
- `const [stage, setStage] = useState<TxStage>();`
- in `bringHome`: `refundEnvelope(state.wallet.chain, vault, saved.index, services.now(), setStage)`, and in `finally` add `setStage(undefined);`.
- replace `{busy && <Working>Bringing it home…</Working>}` with:

```tsx
        {busy && state.status === 'connected' && (
          <div className="min-w-64">
            <TxProgress stage={stage} prover={state.wallet.prover} />
          </div>
        )}
```

(`Working` stays imported: `Restore` and the page still use it.)

- [ ] **Step 7: Run the tests**

Run: `npm test -w @lixi/app`
Expected: PASS, every file. Then `npm run typecheck && npm run lint`.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/TxProgress.tsx app/src/index.css app/src/pages app/test/tx-progress.test.tsx app/test/claim-page.test.tsx app/test/create-page.test.tsx app/test/dashboard-page.test.tsx
git commit -m "feat(app): show each stage of sealing, opening and bringing home, with its seconds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The opening and the privacy receipt (spec §3.5)

**Files:**
- Create: `app/src/lib/countup.ts`, `app/src/components/Opened.tsx`, `app/test/countup.test.tsx`
- Modify: `app/src/lib/units.ts`, `app/src/index.css`, `app/src/pages/Claim.tsx`, `app/test/units.test.ts`, `app/test/theme.test.ts`, `app/test/claim-page.test.tsx`

**Interfaces:**
- Produces: `formatFixed(units: bigint, decimals: number): string` (units.ts); `useCountUp(target: bigint, ms?: number, delay?: number): bigint` (countup.ts); `SlipAmount`, `Blossoms`, `PrivacyReceipt` (Opened.tsx).

- [ ] **Step 1: Write the failing tests**

Append to `app/test/units.test.ts` (inside its `describe`, importing `formatFixed`):

```ts
  it('formats with a fixed number of decimals, for amounts that count up without changing width', () => {
    expect(formatFixed(1_277_978n, 6)).toBe('1.277978');
    expect(formatFixed(638_989n, 6)).toBe('0.638989');
    expect(formatFixed(1n, 6)).toBe('0.000001');
    expect(formatFixed(12_345_123_456n, 6)).toBe('12345.123456');
    expect(formatFixed(1_500_000n, 1)).toBe('1.5');
    expect(formatFixed(750_000n, 1)).toBe('0.7');
    expect(formatFixed(2_000_000n, 0)).toBe('2');
  });
```

Append to `app/test/theme.test.ts` (inside its `describe`):

```ts
  it('keeps the amount on the slip readable: seal-ink at 4.5:1 and the large red amount at 3:1 on paper', () => {
    expect(contrast(TOKENS['seal-ink'], TOKENS.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOKENS['lantern-deep'], TOKENS.paper)).toBeGreaterThanOrEqual(3);
  });
```

Create `app/test/countup.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCountUp } from '../src/lib/countup';

afterEach(() => vi.unstubAllGlobals());

describe('useCountUp', () => {
  it('shows the final amount at once without matchMedia, or with reduced motion', () => {
    expect(renderHook(() => useCountUp(1_277_978n)).result.current).toBe(1_277_978n);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(renderHook(() => useCountUp(5n)).result.current).toBe(5n);
  });

  it('counts from 0 to the amount, easing out, and lands exactly on it', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const { result } = renderHook(() => useCountUp(1_000_000n, 900, 0));
    expect(result.current).toBe(0n);
    const t0 = performance.now();
    act(() => frames.shift()!(t0 + 450));
    expect(result.current > 500_000n && result.current < 1_000_000n).toBe(true);
    act(() => frames.shift()!(t0 + 900));
    expect(result.current).toBe(1_000_000n);
  });
});
```

In `app/test/claim-page.test.tsx`, update the first test's end to the new opened view:

```tsx
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    const envelope = await screen.findByRole('img', { name: 'An opened lì xì: 1 tNIGHT' });
    expect(envelope.querySelector('.slip')!.textContent).toBe('1tNIGHT');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('You opened 1 tNIGHT');
    expect(document.querySelectorAll('.blossom')).toHaveLength(12);
    expect(screen.getByRole('link', { name: 'See it on the explorer' }).getAttribute('href')).toBe(txUrl('tx2'));
```

replacing its last four lines (from `await screen.findByText('It is in your wallet…')` to the `View transaction` expectation). Then replace every other `await screen.findByText('It is in your wallet. The link’s secret never touched the chain.');` in the file with `await screen.findByRole('img', { name: /^An opened lì xì/ });`, and any `'View transaction'` link query in this file with `'See it on the explorer'`.

Append to the same file:

```tsx
  it('says what the chain saw and never saw, without claiming more for a group link', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    const [personal] = await create();
    show(claimUrl('', personal));
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    await screen.findByRole('heading', { name: 'It never saw' });
    for (const text of [
      '1 tNIGHT paid to your wallet',
      'that this envelope paid out once more',
      'which link you opened',
      'the secret inside your link',
      'what the other lì xì hold',
      'how many lì xì this envelope holds',
    ])
      expect(screen.getByText(text)).toBeTruthy();
    cleanup();

    const [group] = await create({ kind: 'group', count: 2, total: 2_000_000n });
    show(claimUrl('', group));
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    await screen.findByRole('heading', { name: 'It never saw' });
    expect(screen.getByText('which lì xì in the envelope you got')).toBeTruthy();
    expect(screen.queryByText('what the other lì xì hold')).toBeNull();
    expect(screen.queryByText('how many lì xì this envelope holds')).toBeNull();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @lixi/app -- test/units.test.ts test/theme.test.ts test/countup.test.tsx test/claim-page.test.tsx`
Expected: FAIL: `formatFixed` and `useCountUp` missing, the new claim expectations unmet. (The theme pairs already pass: 13.18 and 3.92; they guard against a later token change.)

- [ ] **Step 3: `formatFixed` and `useCountUp`**

Append to `app/src/lib/units.ts`:

```ts
/** Base units as tNIGHT with exactly `decimals` decimals, cut, not rounded: (1500000n, 1) → "1.5". */
export const formatFixed = (units: bigint, decimals: number): string => {
  const whole = units / SCALE;
  if (decimals === 0) return `${whole}`;
  return `${whole}.${(units % SCALE).toString().padStart(NIGHT_DECIMALS, '0').slice(0, decimals)}`;
};
```

Create `app/src/lib/countup.ts`:

```ts
import { useEffect, useState } from 'react';

/** True without matchMedia (tests, old browsers) or with reduced motion: show end states. */
const prefersStill = () => typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts from 0 up to `target` over `ms`, easing out, starting `delay` ms from now, and lands exactly on
 * `target` (user moments spec §3.5). Reduced motion shows `target` at once.
 */
export const useCountUp = (target: bigint, ms = 900, delay = 200): bigint => {
  const [still] = useState(prefersStill);
  const [value, setValue] = useState(() => (still ? target : 0n));
  useEffect(() => {
    if (still) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / ms));
      const eased = 1 - (1 - p) ** 3;
      setValue(p >= 1 ? target : (target * BigInt(Math.round(eased * 1_000_000))) / 1_000_000n);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms, delay, still]);
  return value;
};
```

- [ ] **Step 4: The opened pieces**

Create `app/src/components/Opened.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { useCountUp } from '../lib/countup';
import { formatFixed, formatNight } from '../lib/units';

/** Font size by length, so up to "12345.123456" fits the ~105 px slip. */
const sizeFor = (text: string) => (text.length <= 4 ? 'text-3xl' : text.length <= 7 ? 'text-xl' : 'text-base');

/** The amount on the slip that rises out of the envelope, counting up from 0 (user moments spec §3.5). */
export const SlipAmount = ({ amount }: { amount: bigint }) => {
  const final = formatNight(amount);
  const decimals = final.split('.')[1]?.length ?? 0;
  const shown = formatFixed(useCountUp(amount), decimals);
  return (
    <span className="flex h-full flex-col items-center justify-start pt-2 text-center">
      <span className={`font-semibold text-lantern-deep ${sizeFor(final)}`}>{shown}</span>
      <span className="text-[10px] tracking-wide text-seal-ink uppercase">tNIGHT</span>
    </span>
  );
};

/** Five petals and a dark centre: one hoa mai. */
const Blossom = () => (
  <svg viewBox="-10 -10 20 20" width="16" height="16">
    {[0, 72, 144, 216, 288].map((r) => (
      <ellipse key={r} cx="0" cy="-5" rx="3.2" ry="5" transform={`rotate(${r})`} />
    ))}
    <circle r="2" />
  </svg>
);

/** Twelve apricot blossoms that fall once when a lì xì opens. Decoration, not lights; hidden under reduced motion. */
export const Blossoms = () => (
  <div className="blossoms" aria-hidden="true">
    {Array.from({ length: 12 }, (_, i) => (
      <span
        key={i}
        className="blossom"
        style={{ '--i': i, '--x': `${(i * 37 + 7) % 96}%`, '--drift': `${((i * 53) % 60) - 30}px` } as CSSProperties}
      >
        <Blossom />
      </span>
    ))}
  </div>
);

const Column = ({ title, tone, items }: { title: string; tone: string; items: string[] }) => (
  <div className="space-y-2 bg-night p-4">
    <h2 className={`font-semibold ${tone}`}>{title}</h2>
    <ul className="list-disc space-y-1 pl-4 text-paper-soft">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  </div>
);

/**
 * What the chain saw of this opening, and what it never saw (user moments spec §3.5; README privacy
 * model). A group splits equally, so its first opening reveals the count and every other amount:
 * its column leaves those out.
 */
export const PrivacyReceipt = ({ amount, kind }: { amount: bigint; kind: 'personal' | 'group' }) => (
  <div className="receipt grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 text-left text-sm sm:grid-cols-2">
    <Column
      title="The chain saw"
      tone="text-paper"
      items={[`${formatNight(amount)} tNIGHT paid to your wallet`, 'that this envelope paid out once more']}
    />
    <Column
      title="It never saw"
      tone="text-seal"
      items={
        kind === 'personal'
          ? [
              'which link you opened',
              'the secret inside your link',
              'what the other lì xì hold',
              'how many lì xì this envelope holds',
            ]
          : ['which lì xì in the envelope you got', 'the secret inside your link']
      }
    />
  </div>
);
```

In `app/src/index.css`, inside `@layer components` after the `.tx-row` rules, add:

```css
  /* ── Hoa mai: blossoms that fall once when a lì xì opens (user moments spec §3.5). ── */
  .blossoms {
    position: absolute;
    inset: -40px 0 auto;
    height: 560px;
    overflow: hidden;
    pointer-events: none;
  }
  .blossom {
    position: absolute;
    top: -20px;
    left: var(--x);
    opacity: 0;
    animation: fall 1.8s ease-in forwards;
    animation-delay: calc(var(--i) * 0.05s);
  }
  .blossom ellipse {
    fill: var(--color-seal);
  }
  .blossom circle {
    fill: var(--color-seal-ink);
  }
  .receipt {
    animation: rise 0.3s ease 1.1s both;
  }
```

and after the `seal-then-out` keyframes:

```css
@keyframes fall {
  10%,
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--drift), 480px) rotate(200deg);
  }
}
@keyframes rise {
  from {
    opacity: 0;
    translate: 0 8px;
  }
}
```

and inside the existing `@media (prefers-reduced-motion: reduce)` block:

```css
  .blossoms {
    display: none;
  }
```

- [ ] **Step 5: The claim page's opened state**

In `app/src/pages/Claim.tsx`:
- imports: `import { Blossoms, PrivacyReceipt, SlipAmount } from '../components/Opened';` and add `buttonClass` to the `../components/ui` import.
- replace the whole `if (phase.step === 'opened') return (…);` with:

```tsx
  if (phase.step === 'opened')
    return (
      <Page>
        <div className="relative mx-auto max-w-xl space-y-5 text-center">
          <Blossoms />
          <Envelope state="opened" label={`An opened lì xì: ${formatNight(phase.amount)} tNIGHT`}>
            <SlipAmount amount={phase.amount} />
          </Envelope>
          <h1 className="sr-only">You opened {formatNight(phase.amount)} tNIGHT</h1>
          <Greeting className="pt-4">An khang thịnh vượng</Greeting>
          <PrivacyReceipt amount={phase.amount} kind={link.kind} />
          <div className="flex flex-wrap justify-center gap-3">
            {phase.txHash && (
              <a className={buttonClass('quiet')} href={txUrl(phase.txHash)} target="_blank" rel="noreferrer">
                See it on the explorer
              </a>
            )}
            <ButtonLink to="/create" tone="quiet">
              Send lì xì of your own
            </ButtonLink>
          </div>
        </div>
      </Page>
    );
```

(`Page` is already imported from `../components/Layout`.)

- [ ] **Step 6: Run the tests**

Run: `npm test -w @lixi/app`
Expected: PASS, every file. Then `npm run typecheck && npm run lint`.

- [ ] **Step 7: Build**

Run: `npm run build -w @lixi/app`
Expected: the build and `check-entry` pass. The opened view needs a wallet to reach, so its visual check is Task 9 Step 2 on Preprod.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/units.ts app/src/lib/countup.ts app/src/components/Opened.tsx app/src/index.css app/src/pages/Claim.tsx app/test/units.test.ts app/test/theme.test.ts app/test/countup.test.tsx app/test/claim-page.test.tsx
git commit -m "feat(app): the amount rises on the slip, blossoms fall, and a receipt says what stayed private

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The sender's news (spec §3.6)

**Files:**
- Create: `app/src/lib/news.ts`, `app/src/components/Toasts.tsx`, `app/test/news.test.ts`
- Modify: `app/src/pages/Dashboard.tsx`, `app/src/index.css`, `app/test/dashboard-page.test.tsx`

**Interfaces:**
- Consumes: `EnvelopeView` (with `idHex`, `shares[].opened`, `shares[].amount`, `saved.index`) from `lib/status.ts`.
- Produces: `newlyOpened(before, after): News[]`, `type News = { idHex: string; text: string }`; `Toasts({ toasts, onClose })`, `TOAST_MS = 6000`, `type Toast = { key: number; text: string }`.

- [ ] **Step 1: Write the failing tests**

Create `app/test/news.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newlyOpened } from '../src/lib/news';
import type { EnvelopeView } from '../src/lib/status';

const view = (idHex: string, opened: boolean[], state = 'open', amounts = opened.map(() => 1_000_000n)) =>
  ({ idHex, state, shares: opened.map((o, i) => ({ amount: amounts[i], opened: o })) }) as unknown as EnvelopeView;

describe('newlyOpened', () => {
  it('says one lì xì was opened, with its amount', () => {
    expect(newlyOpened([view('a', [false, false])], [view('a', [true, false], 'open', [1_277_978n, 1n])])).toEqual([
      { idHex: 'a', text: 'A lì xì was just opened: 1.277978 tNIGHT.' },
    ]);
  });

  it('adds up several opened in one read', () => {
    expect(newlyOpened([view('a', [false, false, false])], [view('a', [true, true, true])])).toEqual([
      { idHex: 'a', text: '3 lì xì were just opened: 3 tNIGHT.' },
    ]);
  });

  it('makes one item per envelope, in the order of the new read', () => {
    const before = [view('b', [false]), view('a', [false])];
    const after = [view('b', [true]), view('a', [true])];
    expect(newlyOpened(before, after).map((n) => n.idHex)).toEqual(['b', 'a']);
  });

  it('says nothing for an unchanged read, a refund, or an envelope new to the vault', () => {
    expect(newlyOpened([view('a', [true, false])], [view('a', [true, false])])).toEqual([]);
    expect(newlyOpened([view('a', [true, false], 'refundable')], [view('a', [true, false], 'refunded')])).toEqual([]);
    expect(newlyOpened([], [view('new', [true])])).toEqual([]);
  });
});
```

Append to `app/test/dashboard-page.test.tsx` (inside the `describe`; add `TOAST_MS` import from `'../src/components/Toasts'`):

```tsx
  it('tells the sender when a lì xì is opened while the page is open, and the news goes after a while', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { show, create, chain } = setup();
      const [first] = await create();
      if (first.kind !== 'personal') throw new Error('expected a personal link');
      show('/dashboard');
      await screen.findByRole('img', { name: 'Lì xì 1: 1 tNIGHT, waiting' });
      await act(() => vi.advanceTimersByTimeAsync(REFRESH_MS));
      expect(screen.queryByText(/just opened/)).toBeNull();
      await chain.claim({ ...first, recipient: rnd() });
      await act(() => vi.advanceTimersByTimeAsync(REFRESH_MS));
      await screen.findByText('A lì xì was just opened: 1 tNIGHT.');
      await act(() => vi.advanceTimersByTimeAsync(TOAST_MS));
      expect(screen.queryByText(/just opened/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says nothing about openings before the page loaded, and closes the news on its button', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { show, create, chain } = setup();
      const [first, second] = await create();
      if (first.kind !== 'personal' || second.kind !== 'personal') throw new Error('expected personal links');
      await chain.claim({ ...first, recipient: rnd() });
      show('/dashboard');
      await screen.findByRole('img', { name: 'Lì xì 1: 1 tNIGHT, opened' });
      expect(screen.queryByText(/just opened/)).toBeNull();
      await chain.claim({ ...second, recipient: rnd() });
      await act(() => vi.advanceTimersByTimeAsync(REFRESH_MS));
      await screen.findByText('A lì xì was just opened: 1 tNIGHT.');
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByText(/just opened/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @lixi/app -- test/news.test.ts test/dashboard-page.test.tsx`
Expected: FAIL, cannot resolve `../src/lib/news` and `../src/components/Toasts`.

- [ ] **Step 3: `newlyOpened`**

Create `app/src/lib/news.ts`:

```ts
import type { EnvelopeView } from './status';
import { formatNight } from './units';

/** One piece of news: the lì xì of one envelope opened since the last read. */
export type News = { readonly idHex: string; readonly text: string };

/**
 * What the sender has not heard yet (user moments spec §3.6): for each envelope in both reads, the lì xì
 * opened since `before`. Envelopes new to `after` say nothing, and so does any change that opens nothing
 * (a refund, a landing). The news follows `after`'s order.
 */
export const newlyOpened = (before: readonly EnvelopeView[], after: readonly EnvelopeView[]): News[] => {
  const was = new Map(before.map((v) => [v.idHex, v]));
  const news: News[] = [];
  for (const v of after) {
    const old = was.get(v.idHex);
    if (!old) continue;
    const fresh = v.shares.filter((s, i) => s.opened && !old.shares[i]?.opened);
    if (fresh.length === 0) continue;
    const total = formatNight(fresh.reduce((sum, s) => sum + s.amount, 0n));
    news.push({
      idHex: v.idHex,
      text:
        fresh.length === 1
          ? `A lì xì was just opened: ${total} tNIGHT.`
          : `${fresh.length} lì xì were just opened: ${total} tNIGHT.`,
    });
  }
  return news;
};
```

- [ ] **Step 4: `Toasts`**

Create `app/src/components/Toasts.tsx`:

```tsx
import { useEffect } from 'react';
import { Light } from './Light';

export const TOAST_MS = 6_000;
export type Toast = { readonly key: number; readonly text: string };

const Item = ({ toast, onClose }: { toast: Toast; onClose: (key: number) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.key), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.key, onClose]);
  return (
    <li className="toast pointer-events-auto flex items-center gap-3 rounded-lg border border-white/10 bg-night-deep px-4 py-3 shadow-lg">
      <Light state="out" size="sm" />
      <span className="flex-1 text-sm text-paper">{toast.text}</span>
      <button
        type="button"
        onClick={() => onClose(toast.key)}
        aria-label="Close"
        className="px-1 text-paper-dim hover:text-paper"
      >
        ×
      </button>
    </li>
  );
};

/** Short news at the bottom of the page (user moments spec §3.6). Each goes after 6 s, or on its close button. */
export const Toasts = ({ toasts, onClose }: { toasts: readonly Toast[]; onClose: (key: number) => void }) => (
  <div
    role="status"
    aria-live="polite"
    className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4"
  >
    <ul className="w-full max-w-sm space-y-2">
      {toasts.map((t) => (
        <Item key={t.key} toast={t} onClose={onClose} />
      ))}
    </ul>
  </div>
);
```

In `app/src/index.css`, inside `@layer components` after the `.receipt` rule, add (the light plays lit, then out: the same "opened" meaning):

```css
  /* ── The sender's news (user moments spec §3.6). ── */
  .toast {
    animation: rise 0.3s ease both;
  }
  .toast .light::before {
    animation: lit-then-out 1.6s ease forwards;
  }
  .toast .light::after {
    animation: seal-then-out 1.6s ease forwards;
  }
```

- [ ] **Step 5: Dashboard**

In `app/src/pages/Dashboard.tsx`:
- imports: add `useRef` to the React import; `import { Toasts, type Toast } from '../components/Toasts';`; `import { newlyOpened } from '../lib/news';`. (`envelopeView` and `type EnvelopeView` are already imported from `../lib/status`.)
- in `Dashboard`, after the `ledger` state:

```tsx
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<EnvelopeView[] | undefined>(undefined);
  const nextKey = useRef(0);
  const closeToast = useCallback((key: number) => setToasts((t) => t.filter((x) => x.key !== key)), []);

  // News for the sender (spec §3.6): compare each read with the one before. The first read only sets the baseline.
  useEffect(() => {
    const v = vault.vault;
    if (!v || !ledger || typeof ledger === 'string') return;
    const now = services.now();
    const current = [...v.envelopes]
      .sort((a, b) => b.index - a.index)
      .map((e) => envelopeView(ledger, v.seed, e, now));
    if (seen.current) {
      const news = newlyOpened(seen.current, current);
      if (news.length > 0)
        setToasts((t) => [...t, ...news.map((n) => ({ key: nextKey.current++, text: n.text }))].slice(-3));
    }
    seen.current = current;
  }, [ledger, vault.vault, services]);
```

- render `<Toasts toasts={toasts} onClose={closeToast} />` as the last child inside `<Page>` (after the backup box `div`'s parent `div` closes).

- [ ] **Step 6: Run the tests**

Run: `npm test -w @lixi/app`
Expected: PASS, every file. Then `npm run typecheck && npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/news.ts app/src/components/Toasts.tsx app/src/pages/Dashboard.tsx app/src/index.css app/test/news.test.ts app/test/dashboard-page.test.tsx
git commit -m "feat(app): tell the sender when a lì xì is opened while My envelopes is open

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Gate, Preprod run, deploy

**Files:**
- Modify: `docs/superpowers/specs/2026-10-09-lixi-user-moments-design.md` (status line), `README.md` only if a statement there became false (check the "Try it in 2 minutes" section against the new Share page wording)

- [ ] **Step 1: Full local gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build -w @lixi/app`
Expected: all pass; the build ends with `check-entry: the first paint loads no WebAssembly`. Paste the test counts per workspace into the merge commit message.

- [ ] **Step 2: Manual run on Preprod with 1AM (the user drives the wallet)**

`docker start midnight-proof-server` (only needed for the local-prover check), then `npm run build -w @lixi/app && npm run preview -w @lixi/app`. Ask the user to:
1. Open `http://localhost:4173/create` in the Chrome profile with 1AM (sender): Seal a 3 lì xì personal envelope with a 2 hours expiry. Watch the four stages and their seconds.
2. On the Share page, edit the greeting, **Copy message** for Lì xì 1, and paste it somewhere to check the three lines.
3. Open **My envelopes** in the sender's tab and leave it open.
4. In a second Chrome profile with another 1AM wallet (recipient), open the copied link. Check the envelope shows at once, then Open: the stages, the amount rising on the slip with the count-up, the blossoms, the receipt, **See it on the explorer** opening the transaction.
5. Back in the sender's tab, within 20 s: the toast "A lì xì was just opened: …" and the light going out.
6. Report anything that looks wrong; fix it on this branch with a test before going on.

Bring-home is covered by tests and needs a 2-hour wait; if the user wants, check it at the end of the session.

- [ ] **Step 3: Merge (user's flow: merge to main once local gate passes; no PR)**

```bash
git switch main && git merge --ff-only feat/user-moments && git push origin main && git branch -d feat/user-moments && git push origin --delete feat/user-moments 2>/dev/null || true
```

Only after the user agrees to merge.

- [ ] **Step 4: Deploy and check the preview in a chat app**

```bash
npm run build -w @lixi/app && npx wrangler pages deploy app/dist --project-name lixi --branch main --commit-dirty=true
```

Then: `curl -s https://lixi-3nv.pages.dev/ | grep -o 'og:image" content="[^"]*"'` must print the absolute `og.png` URL, and `curl -sI https://lixi-3nv.pages.dev/og.png` must return `200` with `content-type: image/png`. Re-run the Task 2 Step 5 timing against `https://lixi-3nv.pages.dev`. Ask the user to paste a link into Zalo, Messenger or Telegram and confirm the card shows the image and title.

- [ ] **Step 5: Record**

Set the spec's status line to `**Design spec · 2026-10-09 · Status: implemented, merged <date> at <sha>**`, commit `docs: user moments implemented`, push. Update the project memory (`plan3-progress.md`) with: merged sha, the measured first-look times, deploy done, and that the video comes next.

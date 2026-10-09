# Lixi Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `video/out/lixi-wave2.mp4` (+ `.srt`), a 3:30–4:15 demo video of the whole Lixi project, entirely from code.

**Architecture:** A `video/` folder (own `package.json`, not an npm workspace) holds the storyboard, Node 24 TypeScript scripts and HTML card pages. Card scenes are HTML pages animated by a time variable and screenshotted frame by frame; app scenes are CDP screencasts of a dev-only `app/demo/` entry that runs the real app against `LixiSimulator`; one scene is a live Preprod opening with the real 1AM extension. `say` voices each scene, captions and labels are rendered as transparent PNGs, and ffmpeg encodes each scene and joins them.

**Tech Stack:** Node 24 (type stripping), Playwright 1.63.0, ffmpeg 8.1 (Homebrew; has `xfade`/`loudnorm`/`libx264`, **no libass**), macOS `say`, Vite 8, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-lixi-demo-video-design.md`

## Global Constraints

- Node 24 for every command: `source ~/.nvm/nvm.sh && nvm use 24` first.
- Output: 1920×1080, 30 fps, H.264 `yuv420p` + AAC 48 kHz stereo, total length 3:30–4:15 (210–255 s).
- Browser pages render at a 1280×720 CSS viewport with `deviceScaleFactor: 1.5`, so every frame is 1920×1080.
- Narration text is verbatim from spec §3.1; `{N}` is the test count parsed from the real `npm test` output, never typed.
- Simulator scenes carry the label `Local simulator running the compiled contract (no proofs)`; the live scene `Live on Preprod · 1AM`; a sped-up wait says `sped up N×`.
- Voice: macOS `say` built-in voice (default `Samantha`; the user picks in Task 3).
- Playwright pinned exactly: `"playwright": "1.63.0"`.
- The 1AM seed never passes through a script or the assistant. Scripts never print page console messages, URLs with `project_id`, or link secrets.
- `app/demo/` is never in the Vite build; `app/dist/` must contain nothing from it.
- Colours come from `app/src/theme.ts` `TOKENS`; fonts are the app's (Fraunces Variable, Playwrite VN), plus the system monospace for code.
- No background music, no cloud TTS, no change to the contract, SDK, CLI or the shipped site.
- Commits: conventional (`feat(video): …`, `feat(app): …`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `feat/demo-video`.

## Review Focus

1. **Mispronounced words** (`lì xì`, `Lixi`, `Tết`, `tNIGHT`, `1AM`, `Preprod`, the site URL): the voice must say them intelligibly while captions keep the written form → `spoken()` tests in Task 3.
2. **A failing `npm test`**: the video must never claim "{N} tests" from a run with failures → `countTests` throws on any `failed` summary, tested in Task 8.
3. **The demo leaking into production**: a build that contains `demo/` must fail → guard in `app/scripts/check-entry.ts`, exercised in Task 1 and the final gate.
4. **Secrets on camera in the live scene**: the live site's backup step shows a real backup string, so recording must start only after sealing, and no console output is printed → structure of `record-live.ts` in Task 10, checked by viewing the first frame.
5. **Caption gaps or overlaps**: every moment of a scene shows exactly one caption, the first from 0 and the last until the scene's end → `cueTimes` tests in Task 3.

---

## File map

| File | Responsibility |
|---|---|
| `app/demo/index.html` | Dev-only HTML entry for the demo |
| `app/demo/chain.ts` | `demoChain`: a `LixiChain` on the simulator that pauses at each stage |
| `app/demo/demo.ts` | `createDemo`, `demoWallet`, `demoLinks`, `sealGroup` |
| `app/demo/main.tsx` | Mounts the real `App` with demo services; exposes `window.demo` |
| `app/vite.demo.config.ts` | Dev server on :5180 serving `demo/index.html` for every page |
| `app/test/demo.test.tsx` | jsdom test of the demo wiring |
| `app/scripts/check-entry.ts` | + fails the build if `demo/` is in the manifest |
| `video/package.json` | Playwright dependency, scripts |
| `video/script.ts` | Storyboard: scenes, narration, labels, voice |
| `video/build.ts` | Builds scenes and the final MP4/SRT |
| `video/check-demo.ts` | Risk gate: seals on the simulator in a real browser |
| `video/voice-sample.ts` | Renders scene 1 in two voices for the user |
| `video/setup-1am.ts` | One-time 1AM profile setup |
| `video/record-live.ts` | Records scene 5 on Preprod |
| `video/lib/paths.ts` | `ROOT`, `VIDEO`, `OUT` |
| `video/lib/run.ts` | `run()` child-process helper |
| `video/lib/browser.ts` | Viewport constants, `launch`, `newContext` |
| `video/lib/speech.ts` | `spoken`, `synthesize`, `audioSeconds` |
| `video/lib/timing.ts` | `FPS`, `LEAD`, `TAIL`, `FADE`, `sceneSeconds` |
| `video/lib/captions.ts` | `sentences`, `cueTimes`, `toSrt` |
| `video/lib/frames.ts` | `clip`, `retime`, `concatList`, `writeFrames` |
| `video/lib/ffmpeg.ts` | `encodeScene`, `joinScenes` |
| `video/lib/overlays.ts` | Caption/label PNGs |
| `video/lib/cards.ts` | `renderCard`, `tokensCss` |
| `video/lib/code.ts` | `claimCircuit` |
| `video/lib/tests.ts` | `countTests`, `recordTestRun` |
| `video/lib/demo-server.ts` | Start/stop the demo dev server |
| `video/lib/screencast.ts` | CDP screencast |
| `video/lib/demo-capture.ts` | Drives scenes 3, 4, 6 |
| `video/scenes/cards.html`, `cards.css`, `anim.js`, `fonts.css`, `overlay.html` | Card scenes and the overlay page |
| `video/test/*.test.ts` | `node:test` unit tests for the pure helpers |
| `video/README.md` | How to build the video |

---

### Task 1: Dev-only demo entry on the simulator

**Files:**
- Create: `app/demo/index.html`, `app/demo/chain.ts`, `app/demo/demo.ts`, `app/demo/main.tsx`, `app/vite.demo.config.ts`, `app/test/demo.test.tsx`
- Modify: `app/tsconfig.json` (include), `app/scripts/check-entry.ts`

**Interfaces:**
- Produces: `createDemo(opts: { stageMs: number; storage: Storage; origin: string; startSeconds: number }): Demo` where `Demo = { services: Services; sim: LixiSimulator; chain: LixiChain; advance(seconds: number): void }`; `demoLinks(demo: Demo, envelope: number): string[]` (paths like `/c#v1.…`); `sealGroup(demo: Demo): Promise<string>`; `DEMO_WALLET = 'Demo wallet'`.
- Produces (browser): `window.demo: { go(path: string): void; disconnect(): void; advance(seconds: number): void; links(envelope: number): string[]; sealGroup(): Promise<string> }`. `go` navigates **and remounts** the app so a claim page always starts fresh; the wallet stays connected.
- Dev server: `npx vite --config vite.demo.config.ts` in `app/` on `http://localhost:5180`.

- [ ] **Step 1: Write the failing test** — `app/test/demo.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterEach, describe, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { App } from '../src/App';
import { ServicesProvider } from '../src/services';
import { WalletProvider } from '../src/wallet/WalletContext';
import { createDemo, demoLinks, sealGroup, type Demo } from '../demo/demo';
import { MemoryStorage } from './helpers';

afterEach(cleanup);

const start = () =>
  createDemo({ stageMs: 0, storage: new MemoryStorage(), origin: 'https://lixi.test', startSeconds: 1_800_000_000 });

const show = (demo: Demo, path: string) =>
  render(
    <ServicesProvider services={demo.services}>
      <WalletProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </WalletProvider>
    </ServicesProvider>,
  );

describe('demo entry (demo video spec §5.4)', () => {
  it('seals through the UI, opens a personal link, and brings the rest home after expiry', async () => {
    const user = userEvent.setup();
    const demo = start();
    show(demo, '/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Demo wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 4 lì xì' }));
    await user.click(await screen.findByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Saved, seal 4 lì xì' }));
    await screen.findByRole('heading', { name: '4 lì xì, ready to hand out' });
    cleanup();

    const [first] = demoLinks(demo, 0);
    show(demo, first);
    await user.click(await screen.findByRole('button', { name: 'Connect Demo wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    await screen.findByRole('img', { name: /^An opened lì xì/ });
    cleanup();

    demo.advance(2 * 86400);
    show(demo, '/dashboard');
    await user.click(await screen.findByRole('button', { name: 'Connect Demo wallet' }));
    await user.click(await screen.findByRole('button', { name: /^Bring .* home$/ }));
    await screen.findByText(/^Came home:/);
  });

  it('a group link opens once per wallet', async () => {
    const user = userEvent.setup();
    const demo = start();
    const link = await sealGroup(demo);
    show(demo, link);
    await user.click(await screen.findByRole('button', { name: 'Connect Demo wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    await screen.findByRole('img', { name: /^An opened lì xì/ });
    cleanup();
    show(demo, link);
    await screen.findByRole('heading', { name: 'This wallet already opened one from this group' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && npm run compact:fast && npm test -w @lixi/app -- demo.test`
Expected: FAIL, `Failed to resolve import "../demo/demo"`.

- [ ] **Step 3: Write `app/demo/chain.ts`**

```ts
import type { LixiSimulator } from '@lixi/contract/testing';
import { TX_STAGES, type LixiChain, type OnStage } from '../src/chain/port';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A 64-hex stand-in for a transaction hash. The demo never opens it on an explorer. */
const fakeHash = (n: number): string => n.toString(16).padStart(64, '0');

/**
 * A LixiChain on the in-page simulator. The simulator call runs first, so a refusal fails at once like a
 * failed proof; then each stage is reported and held for `stageMs`, so TxProgress shows it on camera.
 */
export const demoChain = (sim: LixiSimulator, stageMs: number): LixiChain => {
  let count = 0;
  const stages = async (onStage?: OnStage): Promise<string> => {
    for (const stage of TX_STAGES) {
      onStage?.(stage);
      await sleep(stageMs);
    }
    count += 1;
    return fakeHash(count);
  };
  return {
    readLedger: async () => sim.ledger(),
    create: async (privateState, a, onStage) => {
      sim.privateState = privateState;
      const id = sim.create(a.nonce, a.expiry, a.refundAddress, a.onePerAddress);
      return { id, txId: await stages(onStage) };
    },
    claim: async (a, onStage) => {
      sim.claim(a.id, a.share, a.path, a.recipient);
      return stages(onStage);
    },
    refund: async (privateState, id, onStage) => {
      sim.privateState = privateState;
      sim.refund(id);
      return stages(onStage);
    },
  };
};
```

- [ ] **Step 4: Write `app/demo/demo.ts`**

```ts
import { LixiSimulator } from '@lixi/contract/testing';
import { claimUrl, deriveEnvelope, linksFor } from '@lixi/sdk';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { LixiChain } from '../src/chain/port';
import { createEnvelope } from '../src/flows/create';
import { localVaultStore } from '../src/lib/storage';
import type { Services } from '../src/services';
import { demoChain } from './chain';

/** An undeployed-network unshielded address (the same one the app tests use). */
const DEMO_ADDRESS = 'mn_addr_undeployed1c5c054q33elswjfesnhcccjcsrvckauhdv9fv5wfze0v42nkdfzskcza5a';
export const DEMO_WALLET = 'Demo wallet';
const HOUR = 3600;

/** A wallet that connects at once and holds 5,000 tNIGHT and 10 DUST. */
export const demoWallet = (): InitialAPI => ({
  rdns: 'demo.wallet',
  name: DEMO_WALLET,
  icon: '',
  apiVersion: '4.0.1',
  connect: async () =>
    ({
      getUnshieldedAddress: async () => ({ unshieldedAddress: DEMO_ADDRESS }),
      getUnshieldedBalances: async () => ({ ['0'.repeat(64)]: 5_000_000_000n }),
      getDustBalance: async () => ({ balance: 10n * 10n ** 15n, cap: 0n }),
    }) as unknown as ConnectedAPI,
});

export type Demo = { services: Services; sim: LixiSimulator; chain: LixiChain; advance(seconds: number): void };

/** The app's services on the real compiled contract, run in-page by the simulator (demo video spec §5.4). */
export const createDemo = (opts: { stageMs: number; storage: Storage; origin: string; startSeconds: number }): Demo => {
  const sim = new LixiSimulator(BigInt(HOUR));
  sim.now = opts.startSeconds;
  const chain = demoChain(sim, opts.stageMs);
  const services: Services = {
    config: { network: 'undeployed', contractAddress: 'ab'.repeat(32) },
    reader: chain,
    storage: opts.storage,
    now: () => sim.now,
    origin: opts.origin,
    detectWallets: () => [demoWallet()],
    isMobile: () => false,
    reload: () => undefined,
    openChain: async () => chain,
  };
  return {
    services,
    sim,
    chain,
    advance: (seconds) => {
      sim.now += seconds;
    },
  };
};

/** The claim paths (`/c#…`) of the vault's envelope number `envelope`. */
export const demoLinks = (demo: Demo, envelope: number): string[] => {
  const vault = localVaultStore(demo.services.storage).load();
  if (!vault || !vault.envelopes[envelope]) throw new Error(`no envelope ${envelope} in the demo vault`);
  return linksFor(deriveEnvelope(vault.seed, vault.envelopes[envelope])).map((link) => claimUrl('', link));
};

/** Seals 6 tNIGHT as one group link for 3 wallets, off camera, and returns its claim path. */
export const sealGroup = async (demo: Demo): Promise<string> => {
  const store = localVaultStore(demo.services.storage);
  const form = { total: 6_000_000n, count: 3, split: 'equal', kind: 'group', durationSeconds: 86400 } as const;
  await createEnvelope(demo.chain, store, form, crypto.getRandomValues(new Uint8Array(32)), demo.sim.now);
  const vault = store.load()!;
  return demoLinks(demo, vault.envelopes.length - 1)[0];
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -w @lixi/app -- demo.test`
Expected: PASS (2 tests). If `createEnvelope`'s form type rejects the `as const` object, type it as `CreateForm` from `../src/flows/create` instead.

- [ ] **Step 6: Write the browser entry** — `app/demo/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0c0a12" />
    <title>Lixi demo (simulator)</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/demo/main.tsx"></script>
  </body>
</html>
```

`app/demo/main.tsx`:

```tsx
import '../src/polyfills';
import '@fontsource-variable/fraunces/opsz.css';
import '../src/index.css';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { App } from '../src/App';
import { ServicesProvider } from '../src/services';
import { WalletProvider, useWallet } from '../src/wallet/WalletContext';
import { createDemo, demoLinks, sealGroup } from './demo';

type DemoControls = {
  go(path: string): void;
  disconnect(): void;
  advance(seconds: number): void;
  links(envelope: number): string[];
  sealGroup(): Promise<string>;
};

declare global {
  interface Window {
    demo?: DemoControls;
  }
}

setNetworkId('undeployed');
const demo = createDemo({
  stageMs: 1200,
  storage: window.localStorage,
  origin: window.location.origin,
  startSeconds: Math.floor(Date.now() / 1000),
});

/** Remounts the app on every `go`, so a claim page always starts fresh; the wallet stays connected. */
const Driven = () => {
  const navigate = useNavigate();
  const { disconnect } = useWallet();
  const [mount, setMount] = useState(0);
  useEffect(() => {
    window.demo = {
      go: (path) => {
        navigate(path);
        setMount((n) => n + 1);
      },
      disconnect,
      advance: demo.advance,
      links: (envelope) => demoLinks(demo, envelope),
      sealGroup: () => sealGroup(demo),
    };
  }, [navigate, disconnect]);
  return <App key={mount} />;
};

window.localStorage.clear(); // every recording starts from an empty vault
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={demo.services}>
      <WalletProvider>
        <BrowserRouter>
          <Driven />
        </BrowserRouter>
      </WalletProvider>
    </ServicesProvider>
  </StrictMode>,
);
```

Note: `localStorage.clear()` runs on every full page load; scene capture never reloads after the first load (it navigates with `demo.go`).

`app/vite.demo.config.ts`:

```ts
import { defineConfig, mergeConfig, type Plugin, type UserConfig } from 'vite';
import base from './vite.config.ts';

/** Serves demo/index.html for every page request, so BrowserRouter paths work on the demo server. */
const demoPages = (): Plugin => ({
  name: 'lixi-demo-pages',
  configureServer: (server) => {
    server.middlewares.use((req, _res, next) => {
      if (req.method === 'GET' && req.headers.accept?.includes('text/html')) req.url = '/demo/index.html';
      next();
    });
  },
});

// Dev-only (demo video spec §5.4): the build input stays index.html, and check-entry fails if demo/ appears.
export default defineConfig((env) =>
  mergeConfig((base as (e: typeof env) => UserConfig)(env), {
    plugins: [demoPages()],
    server: { port: 5180, strictPort: true },
  }),
);
```

- [ ] **Step 7: Include the demo in typecheck and guard the build**

In `app/tsconfig.json`, change `"include"` to:

```json
"include": ["src", "test", "demo", "vite.config.ts", "vite.demo.config.ts", "vitest.config.ts"]
```

In `app/scripts/check-entry.ts`, after the `manifest` line, add:

```ts
const demo = Object.keys(manifest).find((key) => key.startsWith('demo/'));
if (demo) {
  console.error(`check-entry: ${demo} is in the build; the demo entry is dev-only (demo video spec §5.4).`);
  process.exit(1);
}
```

- [ ] **Step 8: Verify typecheck, lint, the app tests and the build**

Run: `npm run typecheck && npm run lint && npm test -w @lixi/app && npm run build -w @lixi/app && ls app/dist | grep -c demo`
Expected: all pass; `check-entry: the first paint loads no WebAssembly`; the final `grep -c` prints `0`.

- [ ] **Step 9: Commit**

```bash
npm run format
git add app/demo app/vite.demo.config.ts app/test/demo.test.tsx app/tsconfig.json app/scripts/check-entry.ts
git commit -m "feat(app): dev-only demo entry on the simulator for the demo video"
```

---

### Task 2: Video package and the browser risk gate

**Files:**
- Create: `video/package.json`, `video/lib/paths.ts`, `video/lib/run.ts`, `video/lib/browser.ts`, `video/lib/demo-server.ts`, `video/check-demo.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1's demo server and `window.demo`.
- Produces: `ROOT`, `VIDEO`, `OUT` (absolute paths ending in `/`); `run(cmd, args, opts?) => Promise<string>`; `VIEWPORT`, `SCALE`, `launch(opts?: { fileAccess?: boolean }) => Promise<Browser>`, `newContext(browser) => Promise<BrowserContext>`; `DEMO_URL`, `startDemoServer() => Promise<() => void>`.

- [ ] **Step 1: Create `video/package.json`**

```json
{
  "name": "lixi-video",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/*.test.ts",
    "check-demo": "node check-demo.ts",
    "voice-sample": "node voice-sample.ts",
    "setup-1am": "node setup-1am.ts",
    "record-live": "node record-live.ts",
    "build": "node build.ts"
  },
  "devDependencies": {
    "playwright": "1.63.0"
  }
}
```

Run: `cd video && npm install && npx playwright install chromium && cd ..`
Expected: installs without touching the root `package-lock.json` (`git status` shows only `video/`).

Append to `.gitignore`:

```
video/out/
video/.profile-1am*/
```

- [ ] **Step 2: Write the helpers**

`video/lib/paths.ts`:

```ts
import { fileURLToPath } from 'node:url';

/** The repository root, the video folder and its output folder, each ending in '/'. */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const VIDEO = fileURLToPath(new URL('../', import.meta.url));
export const OUT = `${VIDEO}out/`;
```

`video/lib/run.ts`:

```ts
import { spawn } from 'node:child_process';

/** Runs a command and resolves with its stdout; rejects with the tail of its stderr when it fails. */
export const run = (cmd: string, args: string[], opts: { cwd?: string } = {}): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited with ${code}: ${err.slice(-2000)}`)),
    );
  });
```

`video/lib/browser.ts`:

```ts
import { chromium, type Browser, type BrowserContext } from 'playwright';

/** 1280×720 CSS pixels at scale 1.5: the app renders at a readable size and every frame is 1920×1080. */
export const VIEWPORT = { width: 1280, height: 720 } as const;
export const SCALE = 1.5;

/** `fileAccess` lets file:// card pages load their fonts and images. */
export const launch = (opts: { fileAccess?: boolean } = {}): Promise<Browser> =>
  chromium.launch({ args: opts.fileAccess ? ['--allow-file-access-from-files'] : [] });

export const newContext = (browser: Browser): Promise<BrowserContext> =>
  browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: 'dark' });
```

`video/lib/demo-server.ts`:

```ts
import { spawn } from 'node:child_process';
import { ROOT } from './paths.ts';

export const DEMO_URL = 'http://localhost:5180';

/** Starts the app's dev-only demo server; resolves with a stop function once it answers. */
export const startDemoServer = async (): Promise<() => void> => {
  const child = spawn('npx', ['vite', '--config', 'vite.demo.config.ts'], { cwd: `${ROOT}app`, stdio: 'ignore' });
  const stop = () => child.kill();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(DEMO_URL, { headers: { accept: 'text/html' } })).ok) return stop;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  stop();
  throw new Error('the demo server did not answer within 60 s');
};
```

- [ ] **Step 3: Write the risk gate** — `video/check-demo.ts`

```ts
// Spec §5.4 "first risk": does LixiSimulator run in a real browser? Seals 4 lì xì through the demo UI.
import { launch, newContext } from './lib/browser.ts';
import { DEMO_URL, startDemoServer } from './lib/demo-server.ts';

const stop = await startDemoServer();
try {
  const browser = await launch();
  const page = await (await newContext(browser)).newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${DEMO_URL}/create`);
  await page.getByRole('button', { name: 'Connect Demo wallet' }).click();
  await page.getByRole('button', { name: 'Seal 4 lì xì' }).click();
  await page.getByLabel('I saved my backup string').check();
  await page.getByRole('button', { name: 'Saved, seal 4 lì xì' }).click();
  await page.getByRole('heading', { name: '4 lì xì, ready to hand out' }).waitFor({ timeout: 60_000 });
  const links = await page.evaluate(() => window.demo!.links(0));
  await browser.close();
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log(`check-demo: sealed ${links.length} lì xì on the simulator in a real browser`);
} finally {
  stop();
}
```

The `window.demo` type comes from Task 1's `declare global`; this file is not type-checked, so the `!` is only for readability.

- [ ] **Step 4: Run the gate**

Run: `cd video && node check-demo.ts; cd ..`
Expected: `check-demo: sealed 4 lì xì on the simulator in a real browser`.
**If it fails** with a WASM/import error from `@lixi/contract/testing` or `compact-runtime`: STOP. Report the error to the user and do not continue to Task 3 (spec §5.4).

- [ ] **Step 5: Lint and commit**

```bash
npm run lint && npm run format
git add .gitignore video/package.json video/package-lock.json video/lib video/check-demo.ts
git commit -m "feat(video): video package and a browser check of the simulator demo"
```

---

### Task 3: Voice, timing and captions (+ the user picks a voice)

**Files:**
- Create: `video/lib/speech.ts`, `video/lib/timing.ts`, `video/lib/captions.ts`, `video/test/speech.test.ts`, `video/test/captions.test.ts`, `video/voice-sample.ts`

**Interfaces:**
- Consumes: `run`, `OUT`.
- Produces: `spoken(text: string): string`; `synthesize(text: string, voice: string, file: string): Promise<void>` (writes 48 kHz 16-bit WAV); `audioSeconds(file: string): Promise<number>`; `FPS = 30`, `LEAD = 0.3`, `TAIL = 0.6`, `FADE = 0.3`, `sceneSeconds(speech: number, footage?: number): number`; `type Cue = { start: number; end: number; text: string }`; `sentences(text): string[]`; `cueTimes(text, lead, speech, scene): Cue[]`; `toSrt(cues: Cue[]): string`.

- [ ] **Step 1: Write the failing tests**

`video/test/speech.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spoken } from '../lib/speech.ts';

test('says the words the built-in voices mangle, and leaves the rest', () => {
  assert.equal(spoken('In Vietnam, at Tết, you give lì xì.'), 'In Vietnam, at Tet, you give lee see.');
  assert.equal(spoken('This is Lixi.'), 'This is Lee see.');
  assert.equal(spoken('ten tNIGHT with 1AM on Preprod'), 'ten tee night with one A M on pre prod');
  assert.equal(spoken('Try it at lixi-3nv dot pages dot dev.'), 'Try it at lixi dash 3 N V, dot pages dot dev.');
  assert.equal(spoken('three circuits: createEnvelope, claim and refund'), 'three circuits: create envelope, claim and refund');
});
```

`video/test/captions.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cueTimes, sentences, toSrt } from '../lib/captions.ts';
import { sceneSeconds } from '../lib/timing.ts';

test('splits narration into sentences, keeping the punctuation', () => {
  assert.deepEqual(sentences('Lixi. Private red envelopes on Midnight. Try it!'), [
    'Lixi.',
    'Private red envelopes on Midnight.',
    'Try it!',
  ]);
});

test('cues tile the whole scene: first from 0, last to the end, no gaps, spans by word count', () => {
  const cues = cueTimes('One two three. Four.', 0.3, 4, 6);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 0);
  assert.equal(cues[0].end, 0.3 + 3);
  assert.equal(cues[1].start, cues[0].end);
  assert.equal(cues[1].end, 6);
});

test('a one-sentence scene shows its caption the whole time', () => {
  assert.deepEqual(cueTimes('Lixi.', 0.3, 1, 2), [{ start: 0, end: 2, text: 'Lixi.' }]);
});

test('SRT timestamps use hours, minutes, seconds and milliseconds', () => {
  assert.equal(toSrt([{ start: 61.5, end: 3725.25, text: 'Hi.' }]), '1\n00:01:01,500 --> 01:02:05,250\nHi.\n');
});

test('a scene lasts for its voice plus padding, or its footage if longer', () => {
  assert.equal(sceneSeconds(10), 10.9);
  assert.equal(sceneSeconds(10, 20), 20);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd video && npm test; cd ..`
Expected: FAIL, cannot find `../lib/speech.ts`.

- [ ] **Step 3: Implement**

`video/lib/timing.ts`:

```ts
export const FPS = 30;
/** Silence before the voice starts, and after it ends. */
export const LEAD = 0.3;
export const TAIL = 0.6;
/** Fade in and out at each scene's edges. */
export const FADE = 0.3;

/** A scene lasts as long as its voice plus padding, or its footage, whichever is longer. */
export const sceneSeconds = (speech: number, footage = 0): number =>
  Math.max(Math.round((LEAD + speech + TAIL) * 1000) / 1000, footage);
```

`video/lib/speech.ts`:

```ts
import { run } from './run.ts';

/** How the built-in voices should say words they mangle. Captions keep the written form. Order matters. */
const PRONOUNCE: ReadonlyArray<readonly [RegExp, string]> = [
  [/lixi-3nv dot pages dot dev/g, 'lixi dash 3 N V, dot pages dot dev'],
  [/lì xì/g, 'lee see'],
  [/Lixi/g, 'Lee see'],
  [/Tết/g, 'Tet'],
  [/tNIGHT/g, 'tee night'],
  [/\b1AM\b/g, 'one A M'],
  [/Preprod/g, 'pre prod'],
  [/createEnvelope/g, 'create envelope'],
];

export const spoken = (text: string): string => PRONOUNCE.reduce((t, [re, say]) => t.replace(re, say), text);

/** Speaks `text` with a macOS voice into a 48 kHz 16-bit WAV file. */
export const synthesize = async (text: string, voice: string, file: string): Promise<void> => {
  await run('say', ['-v', voice, '-o', file, '--file-format=WAVE', '--data-format=LEI16@48000', spoken(text)]);
};

export const audioSeconds = async (file: string): Promise<number> =>
  Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).trim());
```

`video/lib/captions.ts`:

```ts
export type Cue = { start: number; end: number; text: string };

export const sentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * One cue per sentence, each spanning a share of the speech proportional to its words. The first cue starts at 0
 * and the last ends at `scene`, so exactly one caption is on screen at every moment.
 */
export const cueTimes = (text: string, lead: number, speech: number, scene: number): Cue[] => {
  const parts = sentences(text);
  const words = parts.map((s) => s.split(/\s+/).length);
  const total = words.reduce((a, b) => a + b, 0);
  let at = lead;
  return parts.map((part, i) => {
    const start = i === 0 ? 0 : at;
    at += (speech * words[i]) / total;
    return { start, end: i === parts.length - 1 ? scene : at, text: part };
  });
};

const stamp = (seconds: number): string => {
  const ms = Math.round(seconds * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

export const toSrt = (cues: Cue[]): string =>
  cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n');
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd video && npm test; cd ..`
Expected: PASS (6 tests).

- [ ] **Step 5: Voice samples for the user** — `video/voice-sample.ts`

```ts
// Renders scene 1's narration in two voices, so the user can pick one (spec §5.2).
import { mkdirSync } from 'node:fs';
import { OUT } from './lib/paths.ts';
import { synthesize } from './lib/speech.ts';

const TEXT =
  'In Vietnam, at Tết, you give lì xì: lucky money in a red envelope. Only the person who opens it sees what is inside. This is Lixi, private red envelopes on Midnight.';
mkdirSync(`${OUT}voice-samples`, { recursive: true });
for (const voice of ['Samantha', 'Daniel']) {
  const file = `${OUT}voice-samples/${voice}.wav`;
  await synthesize(TEXT, voice, file);
  console.log(file);
}
```

Run: `cd video && node voice-sample.ts && afplay out/voice-samples/Samantha.wav && afplay out/voice-samples/Daniel.wav; cd ..`
Then **ask the user** which voice to use (Samantha or Daniel) and whether any word sounds wrong. Record the choice as `VOICE` in Task 4; add any pronunciation fix to `PRONOUNCE` with a test line.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint && npm run format
git add video/lib video/test video/voice-sample.ts
git commit -m "feat(video): narration voice, scene timing and caption cues"
```

---

### Task 4: The storyboard

**Files:**
- Create: `video/script.ts`, `video/test/script.test.ts`

**Interfaces:**
- Produces: `type Scene = { id: string; title: string; kind: 'card' | 'capture' | 'live'; narration: string; fallbackNarration?: string; label?: string }`; `SCENES: Scene[]` (ids `s1`…`s10` in order); `VOICE: string`; `SIM_LABEL`, `LIVE_LABEL`; `narrationFor(scene: Scene, testCount: number, live: boolean): string`.

- [ ] **Step 1: Write the failing test** — `video/test/script.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, SIM_LABEL, narrationFor } from '../script.ts';

const words = (t: string) => t.split(/\s+/).length;

test('ten scenes, in order, each with narration', () => {
  assert.deepEqual(
    SCENES.map((s) => s.id),
    ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'],
  );
  for (const s of SCENES) assert.ok(s.narration.length > 20, s.id);
});

test('simulator scenes are labelled, and the live scene has a fallback', () => {
  for (const id of ['s3', 's4', 's6']) assert.equal(SCENES.find((s) => s.id === id)!.label, SIM_LABEL);
  assert.ok(SCENES.find((s) => s.id === 's5')!.fallbackNarration);
});

test('the test count is filled in from the run, never left as a placeholder', () => {
  const s8 = SCENES.find((s) => s.id === 's8')!;
  assert.match(narrationFor(s8, 213, true), /^.* 213 tests run on every push/s);
  for (const s of SCENES) assert.doesNotMatch(narrationFor(s, 213, true), /\{N\}/);
});

test('the narration fits a 3:30–4:15 video at the voice’s pace', () => {
  const total = SCENES.reduce((n, s) => n + words(narrationFor(s, 213, true)), 0);
  assert.ok(total >= 480 && total <= 640, `${total} words`);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd video && npm test; cd ..` — Expected: FAIL, cannot find `../script.ts`.

- [ ] **Step 3: Write `video/script.ts`** (narration verbatim from spec §3.1)

```ts
// The storyboard (demo video spec §3). Every other file reads the scenes from here.
export type Scene = {
  id: string;
  title: string;
  kind: 'card' | 'capture' | 'live';
  narration: string;
  /** Scene 5 only: said instead when the live recording is not available. */
  fallbackNarration?: string;
  /** A corner label for the whole scene. */
  label?: string;
};

/** The macOS voice, chosen by the user in Task 3. */
export const VOICE = 'Samantha';
export const SIM_LABEL = 'Local simulator running the compiled contract (no proofs)';
export const LIVE_LABEL = 'Live on Preprod · 1AM';

export const SCENES: Scene[] = [
  {
    id: 's1',
    title: 'Hook',
    kind: 'card',
    narration:
      'In Vietnam, at Tết, you give lì xì: lucky money in a red envelope. Only the person who opens it sees what is inside. This is Lixi, private red envelopes on Midnight. You seal tNIGHT into an envelope and share it as links, one lì xì per link.',
  },
  {
    id: 's2',
    title: 'Problem',
    kind: 'card',
    narration:
      'Red packets already exist on EVM, Solana and BSC, but they are fully public. The split and every claim code sit on chain, so anyone can see who gets what. Lixi keeps the part of lì xì that matters: the link stays secret.',
  },
  {
    id: 's3',
    title: 'Seal',
    kind: 'capture',
    label: SIM_LABEL,
    narration:
      "Let's fill one. Ten tNIGHT, four lì xì, lucky amounts, expiring in a day. The split is drawn in the browser and stays there. On chain, the contract keeps only a Merkle root of the lì xì, the deposit, the expiry and the refund address. Sealing is one transaction. Each lì xì is then a link, and its secret lives only in the URL fragment, which browsers never send to a server. Copy a link with a greeting and send it in any chat.",
  },
  {
    id: 's4',
    title: 'Open',
    kind: 'capture',
    label: SIM_LABEL,
    narration:
      'A recipient opens the link and sees what is inside before connecting a wallet. They connect and open it, and a zero-knowledge proof shows they hold a valid lì xì in this envelope, without saying which one. A one-time nullifier stops the link paying twice, and the tNIGHT lands in their wallet. The receipt says what stayed private for this envelope. Opening the same link again is refused. A group link is one link for everyone, and each wallet can open one lì xì.',
  },
  {
    id: 's5',
    title: 'Live on Preprod',
    kind: 'live',
    label: LIVE_LABEL,
    narration:
      'That was a local simulator running the compiled contract. Here is the same opening live on Preprod, with the 1AM wallet, which pays the fee. The proof takes a while, so we have sped it up. And here is the transaction on the Midnight explorer.',
    fallbackNarration:
      'That was a local simulator running the compiled contract. Here is a real opening on Preprod, made with the 1AM wallet, which pays the fee: the transaction on the Midnight explorer.',
  },
  {
    id: 's6',
    title: 'Dashboard',
    kind: 'capture',
    label: SIM_LABEL,
    narration:
      'The sender gets a dashboard. A lit lantern is still waiting; one that has gone out was opened. After the expiry, the sender brings everything unopened home in one transaction, to the address that sealed it. A backup string re-derives every envelope.',
  },
  {
    id: 's7',
    title: 'How it works',
    kind: 'card',
    narration:
      "Under the hood is one Compact contract with three circuits: createEnvelope, claim and refund. The claim circuit takes the share and its Merkle path as private witnesses. It checks the path against the envelope's root, records a one-time nullifier, and pays the share out as unshielded tNIGHT. So the payout is public, while which link paid it stays private. The chain sees that an envelope exists, its total, and each payout. With lucky amounts, it never learns how many lì xì a personal envelope holds, or what the unopened ones contain.",
  },
  {
    id: 's8',
    title: 'Engineering',
    kind: 'card',
    narration:
      'The repo has four packages: the Compact contract, an SDK, a CLI for deploys and smoke tests, and the React app. {N} tests run on every push against the real compiled contract, plus a devnet end-to-end suite with concurrent claims. The page ships a strict content security policy, and the contract gave up its maintenance authority at deploy, so nobody can change it.',
  },
  {
    id: 's9',
    title: 'Market, limits, roadmap',
    kind: 'card',
    narration:
      'Vietnamese families give lì xì every Tết, at weddings and birthdays, and across the diaspora. Today Lixi runs on Preprod, in desktop Chrome with 1AM, and payouts are public. Wave 3 brings the 1AM mobile app, a fee sponsor so any wallet can open a lì xì, shielded payouts, and QR codes for giving in person.',
  },
  {
    id: 's10',
    title: 'Outro',
    kind: 'card',
    narration: 'Lixi. Private red envelopes on Midnight. Try it at lixi-3nv dot pages dot dev.',
  },
];

/** The words said in a scene: the test count filled in, and scene 5's fallback when there is no live recording. */
export const narrationFor = (scene: Scene, testCount: number, live: boolean): string =>
  (!live && scene.fallbackNarration ? scene.fallbackNarration : scene.narration).replace('{N}', String(testCount));
```

Set `VOICE` to the user's choice from Task 3.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd video && npm test; cd ..` — Expected: PASS (all). If the word-count test fails, report the count to the user rather than editing the narration.

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run format
git add video/script.ts video/test/script.test.ts
git commit -m "feat(video): the storyboard with the approved narration"
```

---

### Task 5: Frames, overlays and scene encoding

**Files:**
- Create: `video/lib/frames.ts`, `video/lib/ffmpeg.ts`, `video/lib/overlays.ts`, `video/scenes/fonts.css`, `video/scenes/overlay.html`, `video/lib/cards.ts` (only `tokensCss` in this task), `video/test/frames.test.ts`

**Interfaces:**
- Consumes: `run`, `OUT`, `VIDEO`, `FPS`, `FADE`, `launch`, `newContext`.
- Produces:
  - `type Shot = { data: Buffer; at: number }`, `type Frame = { file: string; at: number }`, `type Segment = { from: number; to: number; factor: number }`
  - `clip<T extends { at: number }>(shots: T[], start: number, end: number): T[]`
  - `retime(t: number, segments: Segment[]): number`
  - `concatList(frames: Frame[], end: number): string`
  - `writeFrames(shots: Shot[], dir: string): Frame[]`
  - `type Overlay = { png: string; start: number; end: number }`
  - `encodeScene(o: { video: string[]; voice: string; lead: number; overlays: Overlay[]; seconds: number; out: string }): Promise<void>` — `video` is the ffmpeg input args (image sequence or concat list)
  - `joinScenes(files: string[], out: string): Promise<void>`
  - `renderOverlays(items: { text: string; label: string; file: string }[]): Promise<void>`
  - `tokensCss(): string` and `writeTokens(): void` (writes `out/tokens.css`)

- [ ] **Step 1: Write the failing tests** — `video/test/frames.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clip, concatList, retime } from '../lib/frames.ts';

test('clip keeps the shots inside the window, rebased, with the last earlier shot standing in at 0', () => {
  const shots = [{ at: 10 }, { at: 12 }, { at: 15 }, { at: 21 }];
  assert.deepEqual(clip(shots, 13, 20), [{ at: 0 }, { at: 2 }]);
});

test('retime plays a segment faster and shifts what follows', () => {
  const segs = [{ from: 10, to: 30, factor: 10 }];
  assert.equal(retime(5, segs), 5);
  assert.equal(retime(20, segs), 11);
  assert.equal(retime(30, segs), 12);
  assert.equal(retime(40, segs), 22);
});

test('the concat list holds each frame until the next, and the last until the end', () => {
  const list = concatList(
    [
      { file: '/a/0.jpg', at: 0 },
      { file: '/a/1.jpg', at: 1.5 },
    ],
    4,
  );
  assert.equal(
    list,
    "ffconcat version 1.0\nfile '/a/0.jpg'\nduration 1.5000\nfile '/a/1.jpg'\nduration 2.5000\nfile '/a/1.jpg'\n",
  );
});

test('an empty recording is an error, not a silent black scene', () => {
  assert.throws(() => concatList([], 3), /no frames/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd video && npm test; cd ..` — Expected: FAIL, cannot find `../lib/frames.ts`.

- [ ] **Step 3: Implement `video/lib/frames.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { FPS } from './timing.ts';

export type Shot = { data: Buffer; at: number };
export type Frame = { file: string; at: number };
/** Recording-clock seconds [from, to) played `factor` times faster. */
export type Segment = { from: number; to: number; factor: number };

/** The shots in [start, end), rebased to start; the last shot before start stands in at 0. */
export const clip = <T extends { at: number }>(shots: T[], start: number, end: number): T[] => {
  const before = shots.filter((s) => s.at <= start).at(-1);
  const inside = shots.filter((s) => s.at > start && s.at < end);
  return [...(before ? [{ ...before, at: start }] : []), ...inside].map((s) => ({ ...s, at: s.at - start }));
};

/** Output time for recording time `t`, given sorted, non-overlapping sped-up segments. */
export const retime = (t: number, segments: Segment[]): number => {
  let shift = 0;
  for (const s of segments) {
    if (t <= s.from) break;
    const inside = Math.min(t, s.to) - s.from;
    shift += inside - inside / s.factor;
  }
  return t - shift;
};

/** An ffconcat list showing each frame until the next one, and the last until `end`. */
export const concatList = (frames: Frame[], end: number): string => {
  if (frames.length === 0) throw new Error('no frames were recorded');
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].at : end;
    lines.push(`file '${f.file}'`, `duration ${Math.max(next - f.at, 1 / FPS).toFixed(4)}`);
  });
  lines.push(`file '${frames.at(-1)!.file}'`); // the concat demuxer only honours the last duration this way
  return `${lines.join('\n')}\n`;
};

/** Writes shots as numbered JPEGs into `dir`. */
export const writeFrames = (shots: Shot[], dir: string): Frame[] => {
  mkdirSync(dir, { recursive: true });
  return shots.map((s, i) => {
    const file = `${dir}/${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(file, s.data);
    return { file, at: s.at };
  });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd video && npm test; cd ..` — Expected: PASS.

- [ ] **Step 5: Tokens, fonts and the overlay page**

`video/lib/cards.ts` (more is added in Task 6):

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { TOKENS } from '../../app/src/theme.ts';
import { OUT } from './paths.ts';

/** The app's colour tokens as CSS variables, so the video looks like the product. */
export const tokensCss = (): string =>
  `:root {\n${Object.entries(TOKENS)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n')}\n}\n`;

export const writeTokens = (): void => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}tokens.css`, tokensCss());
};
```

`video/scenes/fonts.css`:

```css
@import url('../../node_modules/@fontsource-variable/fraunces/opsz.css');

@font-face {
  font-family: 'Playwrite VN';
  font-weight: 200;
  src: url('../../app/src/assets/fonts/playwrite-vn-200.woff2') format('woff2');
}
```

`video/scenes/overlay.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="fonts.css" />
    <link rel="stylesheet" href="../out/tokens.css" />
    <style>
      html,
      body {
        margin: 0;
        width: 1280px;
        height: 720px;
        overflow: hidden;
        background: transparent;
        font-family: 'Fraunces Variable', Georgia, serif;
      }
      #cap {
        position: absolute;
        left: 50%;
        bottom: 26px;
        transform: translateX(-50%);
        max-width: 1060px;
        padding: 8px 18px;
        border-radius: 10px;
        background: rgb(8 7 12 / 0.8);
        color: var(--paper);
        font-size: 22px;
        line-height: 1.35;
        text-align: center;
      }
      #label {
        position: absolute;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        padding: 4px 12px;
        border-radius: 999px;
        border: 1px solid var(--seal);
        background: rgb(8 7 12 / 0.75);
        color: var(--seal);
        font-size: 13px;
        letter-spacing: 0.02em;
      }
      #cap:empty,
      #label:empty {
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="label"></div>
    <div id="cap"></div>
    <script>
      window.show = (text, label) => {
        document.getElementById('cap').textContent = text;
        document.getElementById('label').textContent = label;
      };
    </script>
  </body>
</html>
```

- [ ] **Step 6: Overlays and ffmpeg** — `video/lib/overlays.ts`

```ts
import { pathToFileURL } from 'node:url';
import { launch, newContext } from './browser.ts';
import { VIDEO } from './paths.ts';

type Show = { show(text: string, label: string): void };

/** Renders each caption or label as a transparent 1920×1080 PNG. Either text may be empty. */
export const renderOverlays = async (items: { text: string; label: string; file: string }[]): Promise<void> => {
  const browser = await launch({ fileAccess: true });
  const page = await (await newContext(browser)).newPage();
  await page.goto(pathToFileURL(`${VIDEO}scenes/overlay.html`).href);
  await page.evaluate(() => document.fonts.ready);
  for (const item of items) {
    await page.evaluate(([t, l]) => (window as unknown as Show).show(t, l), [item.text, item.label] as const);
    await page.screenshot({ path: item.file, omitBackground: true });
  }
  await browser.close();
};
```

`video/lib/ffmpeg.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { run } from './run.ts';
import { OUT } from './paths.ts';
import { FADE, FPS } from './timing.ts';

export type Overlay = { png: string; start: number; end: number };

const f3 = (n: number) => n.toFixed(3);

/** Encodes one scene: its footage held to `seconds`, the voice after `lead`, overlays, and fades at both ends. */
export const encodeScene = async (o: {
  video: string[];
  voice: string;
  lead: number;
  overlays: Overlay[];
  seconds: number;
  out: string;
}): Promise<void> => {
  const n = o.overlays.length;
  const parts = [
    `[0:v]scale=1920:1080,fps=${FPS},tpad=stop_mode=clone:stop_duration=${f3(o.seconds)},trim=duration=${f3(o.seconds)},setpts=PTS-STARTPTS[v0]`,
    ...o.overlays.map(
      (x, i) => `[v${i}][${i + 2}:v]overlay=0:0:enable='between(t,${f3(x.start)},${f3(x.end)})'[v${i + 1}]`,
    ),
    `[v${n}]fade=in:st=0:d=${FADE},fade=out:st=${f3(o.seconds - FADE)}:d=${FADE},format=yuv420p[vout]`,
    `[1:a]adelay=${Math.round(o.lead * 1000)}:all=1,apad,atrim=duration=${f3(o.seconds)},afade=in:st=0:d=${FADE},afade=out:st=${f3(o.seconds - FADE)}:d=${FADE},aresample=48000,aformat=channel_layouts=stereo[aout]`,
  ];
  await run('ffmpeg', [
    '-y',
    ...o.video,
    '-i',
    o.voice,
    ...o.overlays.flatMap((x) => ['-i', x.png]),
    '-filter_complex',
    parts.join(';'),
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-r',
    String(FPS),
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-t',
    f3(o.seconds),
    o.out,
  ]);
};

/** Joins the scene files in order and normalises loudness to −16 LUFS. */
export const joinScenes = async (files: string[], out: string): Promise<void> => {
  const list = `${OUT}scenes.txt`;
  writeFileSync(list, files.map((f) => `file '${f}'`).join('\n') + '\n');
  await run('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-c:v',
    'copy',
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    out,
  ]);
};
```

- [ ] **Step 7: Smoke-test the encoder on a solid colour**

Run:

```bash
cd video && node -e "
import('./lib/cards.ts').then(async ({ writeTokens }) => {
  writeTokens();
  const { renderOverlays } = await import('./lib/overlays.ts');
  const { encodeScene } = await import('./lib/ffmpeg.ts');
  const { run } = await import('./lib/run.ts');
  const { synthesize } = await import('./lib/speech.ts');
  await run('ffmpeg', ['-y','-f','lavfi','-i','color=c=0x0c0a12:s=1920x1080:d=1','-frames:v','1','out/smoke.jpg']);
  await synthesize('This is Lixi.', 'Samantha', 'out/smoke.wav');
  await renderOverlays([{ text: 'This is Lixi.', label: 'Local simulator running the compiled contract (no proofs)', file: 'out/smoke-cap.png' }]);
  await encodeScene({ video: ['-loop','1','-framerate','30','-i','out/smoke.jpg'], voice: 'out/smoke.wav', lead: 0.3, overlays: [{ png: 'out/smoke-cap.png', start: 0, end: 3 }], seconds: 3, out: 'out/smoke.mp4' });
  console.log(await run('ffprobe',['-v','error','-show_entries','stream=codec_name,width,height,r_frame_rate,sample_rate','-of','csv=p=0','out/smoke.mp4']));
});
"; cd ..
```

Expected: `h264,1920,1080,30/1` and `aac,48000`. Extract a frame (`ffmpeg -y -ss 1 -i video/out/smoke.mp4 -frames:v 1 video/out/smoke-frame.png`) and look at it: caption band at the bottom, gold label at the top, Fraunces font (not a fallback serif).

- [ ] **Step 8: Commit**

```bash
npm run lint && npm run format
git add video/lib video/scenes video/test/frames.test.ts
git commit -m "feat(video): frame timing, caption overlays and scene encoding"
```

---

### Task 6: Card scenes 1, 2, 10 and the first `build.ts` (user checkpoint on the look)

**Files:**
- Create: `video/scenes/cards.html`, `video/scenes/cards.css`, `video/scenes/anim.js`, `video/build.ts`
- Modify: `video/lib/cards.ts` (add `renderCard`)

**Interfaces:**
- Consumes: everything from Tasks 2–5.
- Produces: `renderCard(o: { scene: string; seconds: number; data: unknown; dir: string }): Promise<void>` (writes `dir/%05d.jpg` at 30 fps); in pages, `window.setData(data)` and `window.seek(t, duration)`; per-scene hooks `window.hooks[id] = { setup?(data), seek?(t, d) }`; elements animate with `data-at="<fraction>"` and optional `data-out="<fraction>"` of the scene's duration.
- `build.ts` CLI: `node build.ts [--scene s1 --scene s2 …] [--all] [--fresh-tests] [--fallback-tx <hash>]`. Scenes not named are rebuilt only if `out/<id>.mp4` is missing (`--all` rebuilds every scene). Writes `out/<id>/meta.json` = `{ seconds, cues: Cue[] }` per scene and `out/lixi-wave2.mp4` + `.srt` when every scene exists.

- [ ] **Step 1: `video/scenes/anim.js`**

```js
/* global window, document, URLSearchParams */
// Card animation as a pure function of time (spec §5.3): build.ts calls seek(t, d) and screenshots each frame.
const scene = new URLSearchParams(window.location.search).get('scene');
document.getElementById(scene).hidden = false;

const clamp = (x) => Math.min(Math.max(x, 0), 1);
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const RISE = 0.6; // seconds an item takes to appear or leave

window.hooks = window.hooks || {};
window.setData = (data) => window.hooks[scene]?.setup?.(data);
window.seek = (t, d) => {
  for (const el of document.querySelectorAll(`#${scene} [data-at]`)) {
    const at = Number(el.dataset.at) * d;
    const out = el.dataset.out === undefined ? Infinity : Number(el.dataset.out) * d;
    const k = ease((t - at) / RISE) * (1 - ease((t - out) / RISE));
    el.style.opacity = String(k);
    el.style.transform = `translateY(${(1 - k) * 18}px)`;
  }
  window.hooks[scene]?.seek?.(t, d);
};
```

- [ ] **Step 2: `video/scenes/cards.css`**

```css
* {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  width: 1280px;
  height: 720px;
  overflow: hidden;
  color: var(--paper);
  font-family: 'Fraunces Variable', Georgia, serif;
  font-variant-numeric: tabular-nums;
  background:
    radial-gradient(60% 50% at 50% 38%, rgb(239 51 70 / 0.16), transparent 70%),
    radial-gradient(90% 70% at 50% 110%, var(--ember), transparent 70%),
    var(--night);
}
section {
  position: absolute;
  inset: 0;
  padding: 64px 88px 110px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
}
[data-at] {
  opacity: 0;
}
h1 {
  margin: 0;
  font-size: 96px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
h2 {
  margin: 0;
  font-size: 40px;
  font-weight: 600;
}
.hand {
  font-family: 'Playwrite VN', cursive;
  color: var(--seal);
}
.soft {
  color: var(--paper-soft);
}
.dim {
  color: var(--paper-dim);
}
.center {
  align-items: center;
  text-align: center;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}
.cols3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}
.panel {
  border-radius: 18px;
  padding: 22px 26px;
  background: rgb(255 255 255 / 0.03);
  border: 1px solid rgb(239 226 207 / 0.12);
}
.panel h3 {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 600;
}
.row {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 20px;
  line-height: 1.4;
  margin: 8px 0;
}
.bad {
  color: var(--error);
}
.good {
  color: var(--seal);
}
.envelope {
  position: relative;
  width: 220px;
  height: 150px;
  border-radius: 14px;
  background: var(--lantern);
  box-shadow: 0 0 80px rgb(239 51 70 / 0.45);
  overflow: hidden;
}
.envelope::before {
  content: '';
  position: absolute;
  left: -10%;
  right: -10%;
  top: -60%;
  height: 120%;
  background: var(--envelope-flap);
  border-radius: 0 0 50% 50%;
}
.envelope::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 46%;
  width: 46px;
  height: 46px;
  margin-left: -23px;
  border-radius: 50%;
  background: var(--seal);
}
.box {
  border-radius: 14px;
  padding: 14px 16px;
  border: 1px solid rgb(239 226 207 / 0.18);
  background: rgb(255 255 255 / 0.03);
  font-size: 17px;
  line-height: 1.35;
}
.box b {
  display: block;
  font-size: 18px;
  margin-bottom: 4px;
}
.box.chain {
  border-color: var(--seal);
}
.box.private {
  border-color: var(--lantern);
}
.arrow {
  color: var(--paper-dim);
  font-size: 26px;
  text-align: center;
}
pre {
  margin: 0;
  padding: 18px 20px;
  border-radius: 14px;
  background: var(--night-deep);
  border: 1px solid rgb(239 226 207 / 0.12);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--paper-soft);
  white-space: pre;
}
.terminal {
  height: 380px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.chip {
  display: inline-block;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--seal);
  color: var(--seal);
  font-size: 18px;
  margin: 6px 8px 0 0;
}
.layer {
  position: absolute;
  inset: 64px 88px 110px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
}
img.shot {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgb(239 226 207 / 0.18);
}
```

- [ ] **Step 3: `video/scenes/cards.html` with scenes 1, 2, 10** (Tasks 7–8 add s7, s8, s9 sections)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="fonts.css" />
    <link rel="stylesheet" href="../out/tokens.css" />
    <link rel="stylesheet" href="cards.css" />
  </head>
  <body>
    <section id="s1" class="center" hidden>
      <div class="envelope" data-at="0"></div>
      <h1 data-at="0.08">Lixi</h1>
      <p class="hand" style="font-size: 30px; margin: 0" data-at="0.04">lì xì</p>
      <h2 class="soft" data-at="0.45">Private red envelopes on Midnight</h2>
      <p class="dim" style="font-size: 22px; margin: 0" data-at="0.7">
        Seal tNIGHT · share one link per lì xì · open it with a zero-knowledge proof
      </p>
    </section>

    <section id="s2" hidden>
      <div class="cols">
        <div class="panel" data-at="0.02">
          <h3>Red packets on EVM, Solana, BSC</h3>
          <div class="row bad" data-at="0.15">✕ <span>The split is public</span></div>
          <div class="row bad" data-at="0.3">✕ <span>Every claim code is on chain</span></div>
          <div class="row bad" data-at="0.45">✕ <span>Anyone can see who gets what</span></div>
        </div>
        <div class="panel" data-at="0.62">
          <h3>Lixi on Midnight</h3>
          <div class="row good" data-at="0.7">✓ <span>A link's secret never touches the chain</span></div>
          <div class="row good" data-at="0.78">✓ <span>Nobody can tell which link paid an opening</span></div>
          <div class="row good" data-at="0.86">✓ <span>Lucky amounts hide the count and the unopened sizes</span></div>
        </div>
      </div>
    </section>

    <section id="s10" class="center" hidden>
      <div class="envelope" data-at="0"></div>
      <h1 data-at="0.05">Lixi</h1>
      <h2 class="soft" data-at="0.2">Private red envelopes on Midnight</h2>
      <p style="font-size: 28px; margin: 8px 0 0" class="good" data-at="0.45">lixi-3nv.pages.dev</p>
      <p style="font-size: 20px; margin: 0" class="dim" data-at="0.55">github.com/hms1499/lixi-midnight</p>
      <p style="font-size: 16px; margin: 18px 0 0" class="dim" data-at="0.65">
        Built for the Midnight Buildathon · Wave 2
      </p>
    </section>

    <script src="anim.js"></script>
  </body>
</html>
```

Hook `<script>` blocks for later scenes (s7, s8) may sit before or after `anim.js`: it reads `window.hooks[scene]` only inside `setData`/`seek`, and both sides use `window.hooks = window.hooks || {}`.

- [ ] **Step 4: `renderCard`** — append to `video/lib/cards.ts`

```ts
import { pathToFileURL } from 'node:url';
import type { Browser } from 'playwright';
import { newContext } from './browser.ts';
import { VIDEO } from './paths.ts';
import { FPS } from './timing.ts';

type CardPage = { setData(data: unknown): void; seek(t: number, d: number): void };

/** Screenshots a card scene at 30 fps into `dir/%05d.jpg`. */
export const renderCard = async (
  browser: Browser,
  o: { scene: string; seconds: number; data: unknown; dir: string },
): Promise<void> => {
  mkdirSync(o.dir, { recursive: true });
  const page = await (await newContext(browser)).newPage();
  await page.goto(`${pathToFileURL(`${VIDEO}scenes/cards.html`).href}?scene=${o.scene}`);
  await page.evaluate((d) => (window as unknown as CardPage).setData(d), o.data);
  await page.evaluate(() => document.fonts.ready);
  const frames = Math.ceil(o.seconds * FPS);
  for (let i = 0; i < frames; i++) {
    await page.evaluate(([t, d]) => (window as unknown as CardPage).seek(t, d), [i / FPS, o.seconds] as const);
    await page.screenshot({ path: `${o.dir}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  await page.close();
};
```

(Merge the imports at the top of the file.)

- [ ] **Step 5: `video/build.ts` (cards only for now; later tasks extend `visual()`)**

```ts
// Builds the demo video (spec §5). Usage: node build.ts [--scene s3]… [--all] [--fresh-tests] [--fallback-tx <hash>]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { launch } from './lib/browser.ts';
import { cueTimes, toSrt, type Cue } from './lib/captions.ts';
import { renderCard, writeTokens } from './lib/cards.ts';
import { encodeScene, joinScenes, type Overlay } from './lib/ffmpeg.ts';
import { renderOverlays } from './lib/overlays.ts';
import { OUT } from './lib/paths.ts';
import { audioSeconds, synthesize } from './lib/speech.ts';
import { LEAD, sceneSeconds } from './lib/timing.ts';
import { SCENES, VOICE, narrationFor, type Scene } from './script.ts';

const { values } = parseArgs({
  options: {
    scene: { type: 'string', multiple: true, default: [] },
    all: { type: 'boolean', default: false },
    'fresh-tests': { type: 'boolean', default: false },
    'fallback-tx': { type: 'string' },
  },
});

/** What a scene shows: ffmpeg input args, how long the footage runs, and extra timed labels. */
export type Visual = { video: string[]; footage: number; labels: Overlay[] };

const wanted = (s: Scene) => values.all || values.scene!.includes(s.id) || !existsSync(`${OUT}${s.id}.mp4`);

writeTokens();
const testCount = 0; // Task 8 replaces this with the real count
const live = false; // Task 10 replaces this

const browser = await launch({ fileAccess: true });
try {
  for (const scene of SCENES.filter(wanted)) {
    const dir = `${OUT}${scene.id}`;
    mkdirSync(dir, { recursive: true });
    const text = narrationFor(scene, testCount, live);
    const voice = `${dir}/voice.wav`;
    await synthesize(text, VOICE, voice);
    const speech = await audioSeconds(voice);

    let visual: Visual;
    let seconds: number;
    if (scene.kind === 'card') {
      seconds = sceneSeconds(speech);
      await renderCard(browser, { scene: scene.id, seconds, data: {}, dir: `${dir}/frames` });
      visual = { video: ['-framerate', '30', '-i', `${dir}/frames/%05d.jpg`], footage: seconds, labels: [] };
    } else {
      throw new Error(`${scene.id}: ${scene.kind} scenes are built in a later task`);
    }

    const cues: Cue[] = cueTimes(text, LEAD, speech, seconds);
    const overlays: Overlay[] = cues.map((c, i) => ({ png: `${dir}/cap-${i}.png`, start: c.start, end: c.end }));
    const items = cues.map((c, i) => ({ text: c.text, label: '', file: overlays[i].png }));
    if (scene.label) {
      items.push({ text: '', label: scene.label, file: `${dir}/label.png` });
      overlays.push({ png: `${dir}/label.png`, start: 0, end: seconds });
    }
    await renderOverlays(items);
    await encodeScene({
      video: visual.video,
      voice,
      lead: LEAD,
      overlays: [...overlays, ...visual.labels],
      seconds,
      out: `${OUT}${scene.id}.mp4`,
    });
    writeFileSync(`${dir}/meta.json`, JSON.stringify({ seconds, cues }));
    console.log(`${scene.id} ${scene.title}: ${seconds.toFixed(1)} s`);
  }
} finally {
  await browser.close();
}

if (SCENES.every((s) => existsSync(`${OUT}${s.id}.mp4`))) {
  let offset = 0;
  const all: Cue[] = [];
  for (const s of SCENES) {
    const meta = JSON.parse(readFileSync(`${OUT}${s.id}/meta.json`, 'utf8')) as { seconds: number; cues: Cue[] };
    all.push(...meta.cues.map((c) => ({ ...c, start: c.start + offset, end: c.end + offset })));
    offset += meta.seconds;
  }
  await joinScenes(
    SCENES.map((s) => `${OUT}${s.id}.mp4`),
    `${OUT}lixi-wave2.mp4`,
  );
  writeFileSync(`${OUT}lixi-wave2.srt`, toSrt(all));
  console.log(`lixi-wave2.mp4: ${offset.toFixed(1)} s`);
}
```

- [ ] **Step 6: Build scenes 1, 2 and 10 and show the user**

Run: `cd video && node build.ts --scene s1 --scene s2 --scene s10; cd ..`
Expected: three lines like `s1 Hook: 17.4 s`. Extract a frame at the middle of each (`ffmpeg -y -ss 8 -i video/out/s1.mp4 -frames:v 1 video/out/s1-mid.png`, same for s2, s10) and look at them yourself: Fraunces and Playwrite VN rendered, colours from the app, caption readable, nothing clipped.
Then **show the user** `video/out/s1.mp4`, `s2.mp4`, `s10.mp4` (`open video/out/s1.mp4`) and ask if the look is right before building the remaining cards (memory: the user approves visual direction).

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run format
git add video/scenes video/lib/cards.ts video/build.ts
git commit -m "feat(video): card scenes for the hook, the problem and the outro, and the build script"
```

---

### Task 7: Scenes 7 (how it works) and 9 (market, limits, roadmap)

**Files:**
- Create: `video/lib/code.ts`, `video/test/code.test.ts`
- Modify: `video/scenes/cards.html`, `video/build.ts`

**Interfaces:**
- Produces: `claimCircuit(source: string): string`; scene 7 data `{ code: string }`.

- [ ] **Step 1: Failing test** — `video/test/code.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimCircuit } from '../lib/code.ts';
import { ROOT } from '../lib/paths.ts';

test('cuts the claim circuit out of the contract, from its signature to its closing brace', () => {
  const src = 'x\nexport circuit claim(id: Bytes<32>): [] {\n  a;\n}\n\nexport circuit refund() {\n}\n';
  assert.equal(claimCircuit(src), 'export circuit claim(id: Bytes<32>): [] {\n  a;\n}');
});

test('finds it in the real lixi.compact', () => {
  const code = claimCircuit(readFileSync(`${ROOT}contract/src/lixi.compact`, 'utf8'));
  assert.match(code, /^export circuit claim\(/);
  assert.match(code, /nullifiers\.insert\(nf\);/);
  assert.match(code, /sendUnshielded/);
});

test('says so when the circuit is missing', () => {
  assert.throws(() => claimCircuit('nothing here'), /claim circuit not found/);
});
```

- [ ] **Step 2: Run to verify failure** — `cd video && npm test; cd ..` → FAIL, cannot find `../lib/code.ts`.

- [ ] **Step 3: Implement** — `video/lib/code.ts`

```ts
/** The `claim` circuit's source, read from lixi.compact at build time so the video never shows stale code. */
export const claimCircuit = (source: string): string => {
  const start = source.indexOf('export circuit claim(');
  if (start < 0) throw new Error('claim circuit not found in lixi.compact');
  const end = source.indexOf('\n}\n', start);
  return source.slice(start, end + 2);
};
```

Run: `cd video && npm test; cd ..` → PASS.

- [ ] **Step 4: Add sections s7 and s9 to `cards.html`** (before `<script src="anim.js">`)

The fractions follow the narration's sentence word counts (scene 7: sentences end at ≈ .12, .26, .49, .62, .77, 1; scene 9: ≈ .27, .56, 1).

```html
<section id="s7" hidden>
  <h2 data-at="0">One Compact contract: <span class="good">createEnvelope · claim · refund</span></h2>
  <div class="layer" style="top: 150px" data-at="0.12" data-out="0.62">
    <div class="cols" style="grid-template-columns: 0.9fr 1.1fr; align-items: center">
      <div>
        <div class="box private" data-at="0.14">
          <b>In the browser · private witnesses</b>the share and its Merkle path
        </div>
        <div class="arrow" data-at="0.26">↓</div>
        <div class="box" data-at="0.27"><b>Zero-knowledge proof</b>the path leads to the envelope's root</div>
        <div class="arrow" data-at="0.36">↓</div>
        <div class="box chain" data-at="0.37"><b>On chain</b>a one-time nullifier joins the spent set</div>
        <div class="arrow" data-at="0.44">↓</div>
        <div class="box chain" data-at="0.45"><b>Payout</b>unshielded tNIGHT: public, but not which link paid</div>
      </div>
      <pre id="code" data-at="0.26"></pre>
    </div>
  </div>
  <div class="layer" style="top: 150px" data-at="0.63">
    <div class="cols">
      <div class="panel">
        <h3>The chain sees</h3>
        <div class="row" data-at="0.65">that an envelope exists, its total and its expiry</div>
        <div class="row" data-at="0.68">whether it uses a group link</div>
        <div class="row" data-at="0.71">the sender's address</div>
        <div class="row" data-at="0.74">each opening: who received, and how much</div>
      </div>
      <div class="panel">
        <h3 class="good">It never sees</h3>
        <div class="row good" data-at="0.78">with lucky amounts, how many lì xì a personal envelope holds</div>
        <div class="row good" data-at="0.84">with lucky amounts, the sizes of the lì xì nobody has opened</div>
        <div class="row good" data-at="0.88">which link paid which opening</div>
        <div class="row good" data-at="0.91">the secrets inside the links</div>
      </div>
    </div>
  </div>
</section>
<script>
  window.hooks = window.hooks || {};
  window.hooks.s7 = {
    setup: (data) => {
      document.getElementById('code').textContent = data.code;
    },
  };
</script>

<section id="s9" hidden>
  <div class="cols3">
    <div class="panel" data-at="0.02">
      <h3>Who it is for</h3>
      <div class="row" data-at="0.06">Vietnamese families, every Tết</div>
      <div class="row" data-at="0.12">Weddings and birthdays</div>
      <div class="row" data-at="0.18">The diaspora, sending lì xì home</div>
    </div>
    <div class="panel" data-at="0.27">
      <h3>Today</h3>
      <div class="row" data-at="0.32">Preprod only: tNIGHT has no value</div>
      <div class="row" data-at="0.38">Desktop Chrome with 1AM</div>
      <div class="row" data-at="0.45">Payouts are public</div>
    </div>
    <div class="panel" data-at="0.56">
      <h3 class="good">Wave 3</h3>
      <div class="row" data-at="0.62">1AM mobile app</div>
      <div class="row" data-at="0.7">A fee sponsor for any wallet</div>
      <div class="row" data-at="0.8">Shielded payouts</div>
      <div class="row" data-at="0.88">QR codes for giving in person</div>
    </div>
  </div>
</section>
```

- [ ] **Step 5: Pass scene 7's code from `build.ts`**

In `build.ts`, add imports `import { claimCircuit } from './lib/code.ts';` and `import { ROOT } from './lib/paths.ts';` (merge with the existing `OUT` import), and replace `data: {}` in the card branch with `data: cardData(scene.id)`, defined above the loop:

```ts
const cardData = (id: string): unknown =>
  id === 's7' ? { code: claimCircuit(readFileSync(`${ROOT}contract/src/lixi.compact`, 'utf8')) } : {};
```

- [ ] **Step 6: Build and look**

Run: `cd video && node build.ts --scene s7 --scene s9; cd ..`
Extract frames at 25 %, 50 % and 85 % of s7 and the middle of s9; check that the code is legible and not clipped (shrink `pre` font-size to 11.5px if it overflows), and that the diagram layer is gone before the table appears.

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run format
git add video/lib/code.ts video/test/code.test.ts video/scenes/cards.html video/build.ts
git commit -m "feat(video): how-it-works and roadmap scenes"
```

---

### Task 8: Scene 8: the real test run, CI, engineering

**Files:**
- Create: `video/lib/tests.ts`, `video/test/tests.test.ts`
- Modify: `video/scenes/cards.html`, `video/build.ts`

**Interfaces:**
- Produces: `countTests(output: string): number`; `type TestLine = { at: number; text: string }`; `recordTestRun(): Promise<{ lines: TestLine[]; count: number; seconds: number }>` (cached to `out/test-run.json` by `build.ts`); scene 8 data `{ lines: string[]; times: number[]; count: number; speed: number; ci: string }` where `ci` is a `file://` URL.

- [ ] **Step 1: Failing test** — `video/test/tests.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countTests } from '../lib/tests.ts';

const ESC = String.fromCharCode(27);

test('adds up the passed tests of every workspace, ignoring colour codes', () => {
  const out = [
    ` ${ESC}[32mTests${ESC}[39m  32 passed (32)`,
    '      Tests  44 passed (44)',
    '      Tests  17 passed | 2 skipped (19)',
    '      Tests  169 passed (169)',
  ].join('\n');
  assert.equal(countTests(out), 262);
});

test('refuses a run with any failure, so the video never claims a count from a red run', () => {
  assert.throws(() => countTests('      Tests  1 failed | 168 passed (169)'), /failures/);
});

test('refuses output with no vitest summary', () => {
  assert.throws(() => countTests('npm ERR! missing script'), /no vitest summary/);
});
```

- [ ] **Step 2: Run to verify failure** — `cd video && npm test; cd ..` → FAIL.

- [ ] **Step 3: Implement** — `video/lib/tests.ts`

```ts
import { spawn } from 'node:child_process';
import { ROOT } from './paths.ts';

const COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/** Sums vitest's per-workspace "Tests  N passed" lines; throws if any workspace failed. */
export const countTests = (output: string): number => {
  const plain = output.replace(COLOUR, '');
  if (/Tests\s+\d+ failed/.test(plain)) throw new Error('npm test reported failures');
  const counts = [...plain.matchAll(/Tests\s+(\d+) passed/g)].map((m) => Number(m[1]));
  if (counts.length === 0) throw new Error('no vitest summary found in the npm test output');
  return counts.reduce((a, b) => a + b, 0);
};

export type TestLine = { at: number; text: string };

/** Runs the real `npm test` at the repo root, recording each output line with its time since the start. */
export const recordTestRun = (): Promise<{ lines: TestLine[]; count: number; seconds: number }> =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn('npm', ['test'], { cwd: ROOT, env: { ...process.env, FORCE_COLOR: '0', CI: '1' } });
    const lines: TestLine[] = [];
    let all = '';
    let partial = '';
    const take = (chunk: Buffer) => {
      all += chunk;
      const parts = (partial + chunk).split('\n');
      partial = parts.pop()!;
      for (const text of parts) lines.push({ at: (Date.now() - started) / 1000, text: text.replace(COLOUR, '') });
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`npm test exited with ${code}`));
      try {
        resolve({ lines, count: countTests(all), seconds: (Date.now() - started) / 1000 });
      } catch (e) {
        reject(e);
      }
    });
  });
```

Run: `cd video && npm test; cd ..` → PASS.

- [ ] **Step 4: Add section s8 to `cards.html`**

Sentence ends ≈ .29 and .62 of the scene.

```html
<section id="s8" hidden>
  <div class="layer" data-at="0" data-out="0.29">
    <h2>Four packages, one repo</h2>
    <div class="cols" style="grid-template-columns: repeat(4, 1fr); gap: 18px">
      <div class="box chain" data-at="0.03"><b>contract/</b>lixi.compact, simulator tests</div>
      <div class="box" data-at="0.08"><b>sdk/</b>seeds, splits, links, vault, midnight-js</div>
      <div class="box" data-at="0.13"><b>cli/</b>deploy, smoke, devnet end-to-end</div>
      <div class="box private" data-at="0.18"><b>app/</b>React: seal, share, open, bring home</div>
    </div>
  </div>
  <div class="layer" data-at="0.3" data-out="0.63">
    <p class="dim" style="margin: 0; font-size: 16px">$ npm test · recorded output, replayed <span id="speed"></span>× faster</p>
    <pre class="terminal" id="term"></pre>
    <h2 class="good" id="total" data-at="0.56"></h2>
  </div>
  <div class="layer" data-at="0.64">
    <div class="cols" style="grid-template-columns: 1.2fr 1fr; align-items: center">
      <img class="shot" id="ci" alt="" />
      <div>
        <span class="chip" data-at="0.68">CI on every push</span>
        <span class="chip" data-at="0.74">Devnet end-to-end</span>
        <span class="chip" data-at="0.82">Strict CSP</span>
        <span class="chip" data-at="0.9">No admin key</span>
      </div>
    </div>
  </div>
</section>
<script>
  window.hooks = window.hooks || {};
  (() => {
    let lines = [];
    let times = [];
    window.hooks.s8 = {
      setup: (data) => {
        lines = data.lines;
        times = data.times;
        document.getElementById('speed').textContent = String(data.speed);
        document.getElementById('total').textContent = `${data.count} tests passed`;
        document.getElementById('ci').src = data.ci;
      },
      // Replays the recorded lines between 30 % and 55 % of the scene, keeping the last 22 on screen.
      seek: (t, d) => {
        const k = Math.min(Math.max((t - 0.3 * d) / (0.25 * d), 0), 1);
        const shown = times.filter((x) => x <= k).length;
        document.getElementById('term').textContent = lines.slice(Math.max(0, shown - 22), shown).join('\n');
      },
    };
  })();
</script>
```

- [ ] **Step 5: Wire the test run and the CI screenshot into `build.ts`**

Add imports: `import { pathToFileURL } from 'node:url';`, `import { newContext } from './lib/browser.ts';`, `import { recordTestRun, type TestLine } from './lib/tests.ts';`.

Replace `const testCount = 0; // Task 8 …` with:

```ts
type TestRun = { lines: TestLine[]; count: number; seconds: number };
const testRunFile = `${OUT}test-run.json`;
if (values['fresh-tests'] || !existsSync(testRunFile)) {
  console.log('running npm test for scene 8 (takes a few minutes)…');
  writeFileSync(testRunFile, JSON.stringify(await recordTestRun()));
}
const testRun = JSON.parse(readFileSync(testRunFile, 'utf8')) as TestRun;
const testCount = testRun.count;
```

Inside the `try`, before the loop:

```ts
const ciPng = `${OUT}s8/ci.png`;
if (!existsSync(ciPng)) {
  mkdirSync(`${OUT}s8`, { recursive: true });
  const page = await (await newContext(browser)).newPage();
  await page.goto('https://github.com/hms1499/lixi-midnight/actions/workflows/ci.yml', { waitUntil: 'networkidle' });
  await page.screenshot({ path: ciPng });
  await page.close();
}
```

Replace `cardData` with:

```ts
const cardData = (id: string, seconds: number): unknown => {
  if (id === 's7') return { code: claimCircuit(readFileSync(`${ROOT}contract/src/lixi.compact`, 'utf8')) };
  if (id === 's8') {
    const lines = testRun.lines.filter((l) => l.text.trim() !== '');
    const replay = 0.25 * seconds;
    return {
      lines: lines.map((l) => l.text),
      times: lines.map((l) => l.at / testRun.seconds),
      count: testRun.count,
      speed: Math.max(1, Math.round(testRun.seconds / replay)),
      ci: pathToFileURL(ciPng).href,
    };
  }
  return {};
};
```

and call it as `data: cardData(scene.id, seconds)`.

- [ ] **Step 6: Build and check**

Run: `cd video && node build.ts --scene s8 --fresh-tests; cd ..`
Expected: `npm test` runs (needs Node 24 and `compact` on `PATH`), then `s8 Engineering: … s`. Check: the voice says the same number as the `{count} tests passed` banner (`cat video/out/test-run.json | head -c 300` and listen to `video/out/s8.mp4`); the CI screenshot shows green runs. If GitHub shows a sign-in wall or a red run, stop and tell the user.

- [ ] **Step 7: Commit**

```bash
npm run lint && npm run format
git add video/lib/tests.ts video/test/tests.test.ts video/scenes/cards.html video/build.ts
git commit -m "feat(video): engineering scene from the real test run and CI"
```

---

### Task 9: Simulator captures: scenes 3, 4, 6

**Files:**
- Create: `video/lib/screencast.ts`, `video/lib/demo-capture.ts`
- Modify: `video/build.ts`

**Interfaces:**
- Consumes: Task 1's `window.demo`, Task 2's `startDemoServer`, Task 5's `clip`, `writeFrames`, `concatList`.
- Produces: `startScreencast(page: Page): Promise<{ stop(): Promise<Shot[]> }>` (shots timed in seconds on the wall clock, same clock as `Date.now() / 1000`); `captureDemo(browser: Browser): Promise<Record<'s3' | 's4' | 's6', { start: number; end: number }>>` plus the shots, saved by `build.ts` as `out/<id>/frames/*.jpg` + `out/<id>/frames.txt` (ffconcat) + `out/<id>/footage.json` = `{ seconds }`.

- [ ] **Step 1: `video/lib/screencast.ts`**

```ts
import type { Page } from 'playwright';
import type { Shot } from './frames.ts';

/**
 * Records a page through the DevTools screencast: high-quality JPEGs, sent only when the page changes, each
 * stamped with the wall-clock time it was painted.
 */
export const startScreencast = async (page: Page): Promise<{ stop(): Promise<Shot[]> }> => {
  const cdp = await page.context().newCDPSession(page);
  const shots: Shot[] = [];
  cdp.on('Page.screencastFrame', (f) => {
    shots.push({ data: Buffer.from(f.data, 'base64'), at: f.metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId });
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080 });
  return {
    stop: async () => {
      await cdp.send('Page.stopScreencast');
      await cdp.detach();
      return shots;
    },
  };
};
```

- [ ] **Step 2: `video/lib/demo-capture.ts`**

```ts
import type { Browser, Page } from 'playwright';
import { newContext } from './browser.ts';
import { DEMO_URL, startDemoServer } from './demo-server.ts';
import type { Shot } from './frames.ts';
import { startScreencast } from './screencast.ts';

type Window = { start: number; end: number };
type Demo = {
  go(path: string): void;
  disconnect(): void;
  advance(seconds: number): void;
  links(envelope: number): string[];
  sealGroup(): Promise<string>;
};

const now = () => Date.now() / 1000;
const beat = (page: Page, ms: number) => page.waitForTimeout(ms);
const go = (page: Page, path: string) => page.evaluate((p) => (window as unknown as { demo: Demo }).demo.go(p), path);

/** Drives scenes 3, 4 and 6 on the simulator demo in one session, returning one recording and each scene's window. */
export const captureDemo = async (browser: Browser): Promise<{ shots: Shot[]; scenes: Record<'s3' | 's4' | 's6', Window> }> => {
  const stopServer = await startDemoServer();
  try {
    const context = await newContext(browser);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: DEMO_URL });
    const page = await context.newPage();
    await page.goto(`${DEMO_URL}/`);
    await page.getByText('Fill an envelope').first().waitFor();
    await beat(page, 800);
    const cast = await startScreencast(page);

    // Scene 3: seal 10 tNIGHT as 4 lucky lì xì, then copy a message.
    const s3 = { start: now(), end: 0 };
    await beat(page, 2500);
    await page.getByText('Fill an envelope').first().click();
    await page.getByRole('button', { name: 'Connect Demo wallet' }).click();
    await beat(page, 1200);
    const total = page.getByLabel('Total tNIGHT');
    await total.fill('');
    await total.pressSequentially('10', { delay: 180 });
    const count = page.getByLabel('Number of lì xì');
    await count.fill('');
    await count.pressSequentially('4', { delay: 180 });
    await page.getByLabel('Amounts').selectOption('random');
    await page.getByLabel('Comes home after').selectOption({ label: '1 day' });
    await beat(page, 2500);
    await page.getByRole('button', { name: 'Seal 4 lì xì' }).click();
    await beat(page, 2000);
    await page.getByLabel('I saved my backup string').check();
    await beat(page, 700);
    await page.getByRole('button', { name: 'Saved, seal 4 lì xì' }).click();
    await page.getByRole('heading', { name: '4 lì xì, ready to hand out' }).waitFor({ timeout: 60_000 });
    await beat(page, 3000);
    await page.getByRole('button', { name: /^Copy message/ }).first().click();
    await beat(page, 3000);
    s3.end = now();

    // Off camera: the recipient's view starts on a fresh claim page, with no wallet connected.
    const [first] = await page.evaluate(() => (window as unknown as { demo: Demo }).demo.links(0));
    const group = await page.evaluate(() => (window as unknown as { demo: Demo }).demo.sealGroup());
    await page.evaluate(() => (window as unknown as { demo: Demo }).demo.disconnect());
    await go(page, first);
    await page.getByRole('heading', { name: 'Someone sent you a lì xì' }).waitFor();
    await beat(page, 600);

    // Scene 4: open it, show the receipt, refuse it again, then a group link once per wallet.
    const s4 = { start: now(), end: 0 };
    await beat(page, 3500);
    await page.getByRole('button', { name: 'Connect Demo wallet to open it' }).click();
    await beat(page, 1500);
    await page.getByRole('button', { name: 'Open the lì xì' }).click();
    await page.getByRole('img', { name: /^An opened lì xì/ }).waitFor({ timeout: 60_000 });
    await beat(page, 5000);
    await page.mouse.wheel(0, 500);
    await beat(page, 4000);
    await go(page, first);
    await page.getByRole('heading', { name: 'This lì xì was already opened' }).waitFor();
    await beat(page, 3000);
    await go(page, group);
    await page.getByRole('button', { name: 'Open the lì xì' }).click();
    await page.getByRole('img', { name: /^An opened lì xì/ }).waitFor({ timeout: 60_000 });
    await beat(page, 3000);
    await go(page, group);
    await page.getByRole('heading', { name: 'This wallet already opened one from this group' }).waitFor();
    await beat(page, 3000);
    s4.end = now();

    // Scene 6: the dashboard before and after the expiry; bring the unopened home; the backup.
    await go(page, '/dashboard');
    await page.getByRole('img', { name: /^Lì xì 1:/ }).first().waitFor();
    await beat(page, 600);
    const s6 = { start: now(), end: 0 };
    await beat(page, 3500);
    await page.evaluate(() => (window as unknown as { demo: Demo }).demo.advance(2 * 86400));
    await go(page, '/dashboard');
    await page.getByRole('button', { name: /^Bring .* home$/ }).first().waitFor();
    await beat(page, 2500);
    await page.getByRole('button', { name: /^Bring .* home$/ }).first().click();
    await page.getByText(/^Came home:/).waitFor({ timeout: 60_000 });
    await beat(page, 3000);
    await page.mouse.wheel(0, 800);
    await beat(page, 3000);
    s6.end = now();

    const shots = await cast.stop();
    await context.close();
    return { shots, scenes: { s3, s4, s6 } };
  } finally {
    stopServer();
  }
};
```

If a selector does not match the real page, fix the selector (read the page's test in `app/test/*-page.test.tsx` for the exact names); do not change the app.

- [ ] **Step 3: Wire captures into `build.ts`**

Add imports: `import { captureDemo } from './lib/demo-capture.ts';` and `import { clip, concatList, writeFrames } from './lib/frames.ts';`; add `rmSync` to the `node:fs` import.

Above the `try`, after `wanted`:

```ts
// Scenes 3, 4 and 6 come from one recording, so recording any of them rebuilds all three.
const CAPTURES = ['s3', 's4', 's6'] as const;
const isCapture = (s: Scene) => (CAPTURES as readonly string[]).includes(s.id);
const recordDemo = SCENES.some((s) => isCapture(s) && wanted(s));
const toBuild = SCENES.filter((s) => wanted(s) || (recordDemo && isCapture(s)));
```

Change the loop header from `for (const scene of SCENES.filter(wanted))` to `for (const scene of toBuild)`.

Inside the `try`, before the scene loop:

```ts
if (recordDemo) {
  console.log('recording the simulator demo (scenes 3, 4, 6)…');
  const { shots, scenes } = await captureDemo(browser);
  for (const id of CAPTURES) {
    const dir = `${OUT}${id}/frames`;
    rmSync(dir, { recursive: true, force: true });
    const { start, end } = scenes[id];
    const frames = writeFrames(clip(shots, start, end), dir);
    writeFileSync(`${OUT}${id}/frames.txt`, concatList(frames, end - start));
    writeFileSync(`${OUT}${id}/footage.json`, JSON.stringify({ seconds: end - start }));
  }
}
```

In the loop, add the capture branch:

```ts
} else if (scene.kind === 'capture') {
  const footage = (JSON.parse(readFileSync(`${dir}/footage.json`, 'utf8')) as { seconds: number }).seconds;
  seconds = sceneSeconds(speech, footage);
  visual = { video: ['-f', 'concat', '-safe', '0', '-i', `${dir}/frames.txt`], footage, labels: [] };
}
```

- [ ] **Step 4: Build and check**

Run: `cd video && node build.ts --scene s3; cd ..` (records all three, encodes all three)
Expected: `s3 Seal: … s`, `s4 Open: … s`, `s6 Dashboard: … s`, each 30–45 s. Extract a frame from the middle of each and look: app at a readable size, the simulator label at the top, captions not covering the app's primary button (if they do, move the caption band in `overlay.html` to `bottom: 12px` and shrink to 20px). Check the receipt is visible in s4, gold "coming home" lights in s6.

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run format
git add video/lib/screencast.ts video/lib/demo-capture.ts video/build.ts
git commit -m "feat(video): seal, open and dashboard scenes recorded on the simulator demo"
```

---

### Task 10: Scene 5: live on Preprod with 1AM (and its fallback)

**Files:**
- Create: `video/setup-1am.ts`, `video/record-live.ts`
- Modify: `video/build.ts`

**Interfaces:**
- Consumes: `startScreencast`, `clip`, `retime`, `writeFrames`, `concatList`, `VIEWPORT`, `SCALE`.
- Produces: `out/s5/frames/*.jpg`, `out/s5/frames.txt`, `out/s5/live.json` = `{ seconds: number; spedUp: { start: number; end: number; factor: number }[] }` (times in output seconds). `build.ts` treats scene 5 as live when `out/s5/live.json` exists; otherwise it needs `--fallback-tx <hash>`.

- [ ] **Step 1: `video/setup-1am.ts`**

```ts
// One-time setup (spec §5.5): a Playwright profile with the 1AM extension. The user imports a TEST wallet by hand;
// the seed never passes through this script.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { chromium } from 'playwright';
import { SCALE, VIEWPORT } from './lib/browser.ts';
import { VIDEO } from './lib/paths.ts';

const SOURCE = `${homedir()}/Library/Application Support/Google/Chrome/Default/Extensions/bphnkdkcnfhompoegfpgnkidcjfbojjp/6.3.24_0`;
export const EXTENSION = `${VIDEO}.profile-1am-extension`;
export const PROFILE = `${VIDEO}.profile-1am`;

export const launch1am = () =>
  chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync(SOURCE)) throw new Error('1AM 6.3.24 is not installed in Chrome’s Default profile');
  rmSync(EXTENSION, { recursive: true, force: true });
  cpSync(SOURCE, EXTENSION, { recursive: true });
  rmSync(`${EXTENSION}/_metadata`, { recursive: true, force: true }); // Chrome refuses unpacked copies with it
  const context = await launch1am();
  console.log('In the browser that opened: open 1AM from the extensions menu, import a TEST wallet, choose Preprod,');
  console.log('and wait until it shows a balance. Then close the browser window.');
  await new Promise((resolve) => context.on('close', resolve));
}
```

Run (with the user, who does the import): `cd video && node setup-1am.ts; cd ..`

- [ ] **Step 2: `video/record-live.ts`**

```ts
// Records scene 5 on the live site with the real 1AM (spec §5.5). The user approves each 1AM popup.
// Sealing happens before recording starts, so the backup string never reaches a frame (Review Focus 4).
// Prints no page console output and no URLs.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { clip, concatList, retime, writeFrames, type Segment } from './lib/frames.ts';
import { OUT } from './lib/paths.ts';
import { startScreencast } from './lib/screencast.ts';
import { launch1am } from './setup-1am.ts';

const SITE = 'https://lixi-3nv.pages.dev';
const WAIT = 5 * 60_000; // a proof plus the user's approval
const now = () => Date.now() / 1000;
const say = (s: string) => console.log(`→ ${s}`);

const context = await launch1am();
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
const page = context.pages()[0] ?? (await context.newPage());

// Off camera: seal 1 tNIGHT as 1 lì xì and copy its link.
await page.goto(`${SITE}/create`);
const connect = page.getByRole('button', { name: 'Connect 1AM' });
if (await connect.isVisible().catch(() => false)) {
  say('Approve the connection in 1AM');
  await connect.click();
}
const total = page.getByLabel('Total tNIGHT');
await total.fill('1');
await page.getByLabel('Number of lì xì').fill('1');
await page.getByRole('button', { name: 'Seal 1 lì xì' }).click();
const saved = page.getByLabel('I saved my backup string');
if (await saved.isVisible({ timeout: 3000 }).catch(() => false)) {
  await saved.check();
  await page.getByRole('button', { name: 'Saved, seal 1 lì xì' }).click();
}
say('Approve the seal in 1AM');
await page.getByRole('heading', { name: '1 lì xì, ready to hand out' }).waitFor({ timeout: WAIT });
await page.getByRole('button', { name: 'Copy link: Lì xì 1' }).click();
const link = await page.evaluate(() => navigator.clipboard.readText());
await page.goto(link);
await page.getByRole('heading', { name: 'Someone sent you a lì xì' }).waitFor({ timeout: 60_000 });
await page.waitForTimeout(800);

// On camera: open it, speed up the proof wait, then the explorer.
const cast = await startScreencast(page);
const start = now();
await page.waitForTimeout(3000);
const connectToOpen = page.getByRole('button', { name: 'Connect 1AM to open it' });
if (await connectToOpen.isVisible().catch(() => false)) await connectToOpen.click();
const open = page.getByRole('button', { name: 'Open the lì xì' });
await open.waitFor({ timeout: 60_000 });
await page.waitForTimeout(1200);
say('Approve the opening in 1AM');
await open.click();
const waitFrom = now();
await page.getByRole('img', { name: /^An opened lì xì/ }).waitFor({ timeout: WAIT });
const waitTo = now();
await page.waitForTimeout(6000);
const indexFrom = now();
await page.waitForTimeout(30_000); // let the explorer index the transaction; cut from the video below
const indexTo = now();
const href = await page.getByRole('link', { name: 'See it on the explorer' }).getAttribute('href');
await page.goto(href!);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(6000);
const end = now();
const shots = await cast.stop();
await context.close();

// The proof wait plays in about 4 s; the indexing pause in about 0.5 s.
const segments: Segment[] = [
  { from: waitFrom, to: waitTo, factor: Math.max(1, (waitTo - waitFrom) / 4) },
  { from: indexFrom, to: indexTo, factor: (indexTo - indexFrom) / 0.5 },
];
const t = (x: number) => retime(x, segments) - retime(start, segments);
const dir = `${OUT}s5`;
rmSync(`${dir}/frames`, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const retimed = shots.map((s) => ({ ...s, at: retime(s.at, segments) }));
const frames = writeFrames(clip(retimed, retime(start, segments), retime(end, segments)), `${dir}/frames`);
writeFileSync(`${dir}/frames.txt`, concatList(frames, t(end)));
const factor = Math.round(segments[0].factor);
writeFileSync(
  `${dir}/live.json`,
  JSON.stringify({ seconds: t(end), spedUp: factor > 1 ? [{ start: t(waitFrom), end: t(waitTo), factor }] : [] }),
);
console.log(`scene 5 recorded: ${t(end).toFixed(1)} s`);
```

- [ ] **Step 3: Live branch and fallback in `build.ts`**

Replace `const live = false; // Task 10 …` with:

```ts
const live = existsSync(`${OUT}s5/live.json`);
```

Add the `live` branch to the loop (the label overlays for the sped-up part are rendered with the others):

```ts
} else if (scene.kind === 'live') {
  if (live) {
    const rec = JSON.parse(readFileSync(`${dir}/live.json`, 'utf8')) as {
      seconds: number;
      spedUp: { start: number; end: number; factor: number }[];
    };
    seconds = sceneSeconds(speech, rec.seconds);
    const labels = rec.spedUp.map((s, i) => ({ png: `${dir}/sped-${i}.png`, start: s.start, end: s.end }));
    await renderOverlays(rec.spedUp.map((s, i) => ({ text: '', label: `${scene.label} · sped up ${s.factor}×`, file: labels[i].png })));
    visual = { video: ['-f', 'concat', '-safe', '0', '-i', `${dir}/frames.txt`], footage: rec.seconds, labels };
  } else {
    const tx = values['fallback-tx'];
    if (!tx) throw new Error('scene 5: run `node record-live.ts`, or pass --fallback-tx <claim tx hash>');
    // Fallback (spec §5.5): the explorer page of a real Preprod claim.
    const page = await (await newContext(browser)).newPage();
    await page.goto(`https://preprod.midnightexplorer.com/transactions/0x${tx.replace(/^0x/, '')}`, { waitUntil: 'networkidle' });
    mkdirSync(`${dir}/frames`, { recursive: true });
    await page.screenshot({ path: `${dir}/frames/00000.jpg`, type: 'jpeg', quality: 92 });
    await page.close();
    seconds = sceneSeconds(speech);
    visual = { video: ['-loop', '1', '-framerate', '30', '-i', `${dir}/frames/00000.jpg`], footage: seconds, labels: [] };
  }
}
```

The sped-up label overlay sits on top of the scene label for its span (same position), so the viewer reads `Live on Preprod · 1AM · sped up N×` during the wait.

- [ ] **Step 4: Record with the user**

Ask the user to be at the computer. Check 1AM's sponsor once (memory: a single probe, no monitor): `curl -s -X POST https://api-preprod.1am.xyz/balance-only -d '{}'` must not say `DUST_SYNC_STALE`.
Run: `cd video && node record-live.ts && node build.ts --scene s5; cd ..`
The user approves three popups (connect if asked, seal, open). Then look at the **first** frame of `out/s5/frames/` (must be the claim page, not the backup step) and the middle and last frames (slip; explorer showing the transaction, not "not found"). If the explorer shows "not found", re-run `record-live.ts` with a longer indexing pause (60 s).
**If 1AM fails** (error 171, a hung popup, or no DUST): ask the user for the hash of a real claim (1AM's activity list, or the "See it on the explorer" link from an earlier opening), then run `cd video && node build.ts --scene s5 --fallback-tx <hash>; cd ..`.

- [ ] **Step 5: Commit**

```bash
npm run lint && npm run format
git add video/setup-1am.ts video/record-live.ts video/build.ts
git commit -m "feat(video): live Preprod opening with 1AM, with an explorer fallback"
```

---

### Task 11: Full build, review, docs and merge

**Files:**
- Create: `video/README.md`
- Modify: `docs/superpowers/specs/2026-10-09-lixi-demo-video-design.md` (status line)

- [ ] **Step 1: Build everything that is missing and join**

Run: `cd video && node build.ts; cd ..`
Expected: the last line `lixi-wave2.mp4: <seconds> s` with 210 ≤ seconds ≤ 255.

- [ ] **Step 2: Verify the output**

```bash
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of default=nw=1 video/out/lixi-wave2.mp4
head -12 video/out/lixi-wave2.srt
for t in 10 30 60 90 120 140 160 190 210 225; do ffmpeg -v error -y -ss $t -i video/out/lixi-wave2.mp4 -frames:v 1 video/out/check-$t.png; done
```

Expected: h264 1920×1080 30/1, aac 48000 2 channels, duration in range; the SRT starts at `00:00:00,000`. Look at every `check-*.png`: no black frames, no clipped text, the right label on simulator/live scenes. If the length is outside 210–255 s, report it to the user with each scene's length (`out/<id>/meta.json`) instead of trimming silently.

- [ ] **Step 3: `video/README.md`**

````markdown
# Demo video

Builds `out/lixi-wave2.mp4` and `out/lixi-wave2.srt` from code (spec: `docs/superpowers/specs/2026-10-09-lixi-demo-video-design.md`).

Needs Node 24, ffmpeg, macOS `say`, and `compact` on `PATH` (scene 8 runs the real `npm test`).

```bash
cd video && npm install && npx playwright install chromium
node build.ts                    # builds missing scenes, then joins them
node build.ts --scene s7         # rebuilds one scene (s3, s4, s6 are recorded together)
node build.ts --all --fresh-tests
```

Scene 5 (live on Preprod) needs a one-time `node setup-1am.ts` (import a test wallet by hand), then
`node record-live.ts` while you approve 1AM's popups. Without it, pass `--fallback-tx <claim tx hash>`.

The narration lives in `script.ts`; pronunciation fixes for the voice in `lib/speech.ts`.
````

- [ ] **Step 4: Local gate**

Run: `npm run format:check && npm run lint && npm run typecheck && npm test && (cd video && npm test) && npm run build -w @lixi/app && ls app/dist | grep -c demo`
Expected: all green; the last command prints `0`.

- [ ] **Step 5: The user watches the video**

`open video/out/lixi-wave2.mp4`. Ask the user to watch it and approve or list changes. Apply changes by editing `script.ts` / cards / captures and rebuilding only the affected scenes.

- [ ] **Step 6: Mark the spec done and commit**

In the spec, set the status line to `**Design spec · 2026-10-09 · Status: implemented, merged <date> at <sha>**` after the merge commit is known (or `Status: implemented` before merging).

```bash
git add video/README.md docs/superpowers/specs/2026-10-09-lixi-demo-video-design.md
git commit -m "docs: how to build the demo video"
```

- [ ] **Step 7: Merge** (user's flow: local gate green → fast-forward `main`, push, delete the branch)

```bash
git checkout main && git merge --ff-only feat/demo-video && git push origin main && git branch -d feat/demo-video
```

Then the user uploads `video/out/lixi-wave2.mp4` (with the `.srt`) and pastes the link into `docs/submission/wave-2.md`.

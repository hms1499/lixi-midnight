# Lixi on Blockfrost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every Preprod consumer (SDK config, CLI, app, CSP, CI) from Midnight's official indexer and RPC, which are about to shut down, to Blockfrost.

**Architecture:** `NETWORKS.preprod` keeps the bare Blockfrost URLs, which the CSP lists. A new SDK function `networkConfig(network, projectId)` returns the URLs to call, with `?project_id=` appended to the indexer, indexer WS and node URLs. The CLI reads the id from `BLOCKFROST_PROJECT_ID` (`cli/.env`). The app reads it from `VITE_BLOCKFROST_PROJECT_ID` at build time (`app/.env.local`, plus a CI secret). Wallet sync caches are keyed by indexer host, because sync cursors are the indexer's own ids.

**Tech Stack:** TypeScript, Vitest, Vite, midnight-js 4.1.1, wallet SDK 1.2.0.

**Spec:** `docs/superpowers/specs/2026-09-30-lixi-design.md` (unchanged: it names no indexer). The reason for the move is `midnight-wallet#781`, where the maintainer comment of 2026-10-02 says the official Preprod indexer and RPC "are scheduled to shut down imminently". The details come from the Midnight servicedesk runbook `runbooks/indexer-blockfrost-migration-runbook/indexer-blockfrost-migration-runbook.md`.

## Global Constraints

- Preprod endpoints, exactly:
  - indexer `https://midnight-preprod.blockfrost.io/api/v0`
  - indexer WS `wss://midnight-preprod.blockfrost.io/api/v0/ws`
  - node `https://rpc.midnight-preprod.blockfrost.io`
  - proof server `http://127.0.0.1:6300` (unchanged)
- The token is the query parameter `project_id`, URL-encoded. It goes on the indexer, indexer WS and node URLs, and **never** on the proof server. Browser WebSockets cannot set headers, so a header does not work.
- Where the token lives:
  - CLI: `BLOCKFROST_PROJECT_ID` in `cli/.env`.
  - App: `VITE_BLOCKFROST_PROJECT_ID` in `app/.env.local`, and the CI secret `VITE_BLOCKFROST_PROJECT_ID`.
  - Both files are gitignored (`.env`, `.env.*`).
- Never commit, log or print the token, and never put it in a file name. Our own messages must never interpolate an endpoint URL.
  - Known exception that we cannot change: polkadot's `RPC-CORE` logger prints the node URL on disconnect.
- The devnet (`undeployed`) is unchanged and takes no token.
- A wallet sync cache is only valid on the indexer that wrote it. Never reuse an official-indexer cache with Blockfrost.
- The CSP lists origins only. `app/src/csp.ts` and `app/vercel.json` must stay equal (`app/test/config.test.ts`).
- Formatting: Prettier (single quotes, trailing commas, width 120). Commits use conventional messages on `feat/app` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `source ~/.nvm/nvm.sh && nvm use 24` before any npm command.

## Review Focus

1. **No token, or a blank one** (unset, `''`, whitespace), in the CLI, the app build or the app dev server. The run must stop before any network call, with a message naming the variable and the file. Tested in Tasks 1, 2 and 3.
2. **An error whose text quotes a keyed URL** (indexer or WS failure). The user must see `project_id=<redacted>`, never the token. Tested in Tasks 1 and 3 (`friendlyError`).
3. **A token with URL-special characters** (`+`, `/`, `=`, spaces around it). It must be trimmed, then encoded. Tested in Task 1.
4. **The old official-indexer cache still on disk** at the first Blockfrost run. It must be ignored, because the new file name contains the indexer host. Tested in Task 2.
5. **A second transaction right after the first, on Blockfrost.** Blockfrost's idle progress backoff can delay "synced" by up to ~4.8 min. The smoke run (Task 4) creates and then claims twice. If a claim fails with `could not balance dust`, Task 4 Step 3 adds the wait it describes.

---

### Task 1: SDK: Blockfrost endpoints, `networkConfig`, `redactUrl`

**Files:**
- Modify: `sdk/src/network.ts`
- Test: `sdk/test/network.test.ts` (new)

**Interfaces:**
- Produces:
  - `networkConfig(network: NetworkName, projectId?: string): NetworkConfig`. It throws `Error('missing Blockfrost project id')` for Preprod without an id.
  - `redactUrl(text: string): string`.
  - `NETWORKS.preprod` holds the bare Blockfrost URLs.
  - All of these are exported from `@lixi/sdk` and `@lixi/sdk/network`. `sdk/src/index.ts` already has `export * from './network.js'`.

- [ ] **Step 1: Write the failing test** in `sdk/test/network.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NETWORKS, networkConfig, redactUrl } from '../src/network.js';

describe('networkConfig', () => {
  it('puts the Blockfrost project id on the Preprod indexer and node URLs, never on the proof server', () => {
    const c = networkConfig('preprod', 'preprodAbC123');
    expect(c.indexer).toBe('https://midnight-preprod.blockfrost.io/api/v0?project_id=preprodAbC123');
    expect(c.indexerWS).toBe('wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=preprodAbC123');
    expect(c.node).toBe('https://rpc.midnight-preprod.blockfrost.io?project_id=preprodAbC123');
    expect(c.proofServer).toBe('http://127.0.0.1:6300');
  });

  it('trims the id and encodes characters a URL would misread', () => {
    expect(networkConfig('preprod', ' a+b/c= \n').indexer).toBe(
      'https://midnight-preprod.blockfrost.io/api/v0?project_id=a%2Bb%2Fc%3D',
    );
  });

  it('refuses a missing or blank id for Preprod', () => {
    expect(() => networkConfig('preprod')).toThrow('missing Blockfrost project id');
    expect(() => networkConfig('preprod', '  \n')).toThrow('missing Blockfrost project id');
  });

  it('leaves the local devnet as it is, with or without an id', () => {
    expect(networkConfig('undeployed')).toEqual(NETWORKS.undeployed);
    expect(networkConfig('undeployed', 'x')).toEqual(NETWORKS.undeployed);
  });
});

describe('redactUrl', () => {
  it('hides every project id in a message, wherever the URL sits', () => {
    const out = redactUrl(
      'GET https://midnight-preprod.blockfrost.io/api/v0?project_id=preprodSECRET1 failed; ws "wss://h/ws?a=1&project_id=preprodSECRET2"',
    );
    expect(out).not.toContain('SECRET');
    expect(out.match(/project_id=<redacted>/g)).toHaveLength(2);
  });

  it('leaves text without a project id unchanged', () => {
    expect(redactUrl('proof server unreachable')).toBe('proof server unreachable');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -w @lixi/sdk -- network`
Expected: FAIL. `networkConfig` and `redactUrl` are not exported.

- [ ] **Step 3: Implement** in `sdk/src/network.ts`. Replace the whole file with:

```ts
/** Endpoints for one Midnight network. The proof server is always local (audit H4). */
export type NetworkConfig = {
  readonly networkId: 'undeployed' | 'preprod';
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
};

/**
 * Bare endpoints, which the CSP lists. Preprod goes through Blockfrost because Midnight is shutting
 * down its official Preprod indexer and RPC (midnight-wallet#781). Every Blockfrost call needs the
 * project id, which `networkConfig` adds.
 */
export const NETWORKS = {
  undeployed: {
    networkId: 'undeployed',
    indexer: 'http://127.0.0.1:8088/api/v4/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    node: 'http://127.0.0.1:9944',
    proofServer: 'http://127.0.0.1:6300',
  },
  preprod: {
    networkId: 'preprod',
    indexer: 'https://midnight-preprod.blockfrost.io/api/v0',
    indexerWS: 'wss://midnight-preprod.blockfrost.io/api/v0/ws',
    node: 'https://rpc.midnight-preprod.blockfrost.io',
    proofServer: 'http://127.0.0.1:6300',
  },
} as const satisfies Record<string, NetworkConfig>;

export type NetworkName = keyof typeof NETWORKS;

/** Networks whose endpoints are Blockfrost's and need its project id. */
const ON_BLOCKFROST: Record<NetworkName, boolean> = { undeployed: false, preprod: true };

/**
 * The endpoints to call. On Blockfrost the project id goes on the indexer and node URLs as
 * `?project_id=`, because browser WebSockets cannot send headers. The local proof server never
 * gets it. Never log the result: its URLs carry the id.
 */
export const networkConfig = (network: NetworkName, projectId?: string): NetworkConfig => {
  const base = NETWORKS[network];
  if (!ON_BLOCKFROST[network]) return base;
  const id = projectId?.trim();
  if (!id) throw new Error('missing Blockfrost project id');
  const keyed = (url: string) => `${url}?project_id=${encodeURIComponent(id)}`;
  return { ...base, indexer: keyed(base.indexer), indexerWS: keyed(base.indexerWS), node: keyed(base.node) };
};

/** Hides Blockfrost project ids in text that may quote an endpoint URL. */
export const redactUrl = (text: string): string => text.replace(/project_id=[^&\s"'<>]+/g, 'project_id=<redacted>');
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `npm test -w @lixi/sdk && npm run typecheck -w @lixi/sdk`
Expected: PASS, with the 6 new tests among them.

- [ ] **Step 5: Commit**

```bash
git add sdk/src/network.ts sdk/test/network.test.ts
git commit -m "feat(sdk): Preprod endpoints on Blockfrost, with the project id added by networkConfig"
```

---

### Task 2: CLI: token from `cli/.env`, caches keyed by indexer, smoke waits for sync

**Files:**
- Create: `cli/src/network.ts`, `cli/test/network.test.ts`
- Modify:
  - `cli/src/wallet-cache.ts` (`cacheFileFor`)
  - `cli/test/wallet-cache.test.ts`
  - `cli/src/deployer.ts`
  - `cli/src/deploy.ts`
  - `cli/src/smoke.ts` (the uncommitted `waitForFeeSync` fix is already in the working tree; keep it)
  - `cli/src/sponsor.ts`
  - `cli/src/wallet.ts` (the `waitForFeeSync` default timeout)
- Delete: `cli/src/dust-diag.ts` (untracked diagnostic)

**Interfaces:**
- Consumes: `networkConfig`, `NETWORKS`, `NetworkConfig`, `NetworkName` from `@lixi/sdk` (Task 1).
- Produces:
  - `cliNetwork(network: NetworkName, env?: Record<string, string | undefined>): NetworkConfig`
  - `cacheFileFor(dir: string, network: string, indexerUrl: string, bech32Address: string): string`

- [ ] **Step 1: Write the failing tests**

`cli/test/network.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cliNetwork } from '../src/network.js';

describe('cliNetwork', () => {
  it('reads the Blockfrost project id for Preprod from BLOCKFROST_PROJECT_ID', () => {
    expect(cliNetwork('preprod', { BLOCKFROST_PROJECT_ID: 'preprodX' }).indexerWS).toBe(
      'wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=preprodX',
    );
  });

  it('says which variable and file to set when the id is missing or blank', () => {
    expect(() => cliNetwork('preprod', {})).toThrow('set BLOCKFROST_PROJECT_ID in cli/.env');
    expect(() => cliNetwork('preprod', { BLOCKFROST_PROJECT_ID: ' ' })).toThrow('set BLOCKFROST_PROJECT_ID in cli/.env');
  });

  it('needs no id for the local devnet', () => {
    expect(cliNetwork('undeployed', {}).indexer).toBe('http://127.0.0.1:8088/api/v4/graphql');
  });

  it('rejects an unknown network', () => {
    expect(() => cliNetwork('mainnet' as never, {})).toThrow('unknown network mainnet; use undeployed or preprod');
  });
});
```

In `cli/test/wallet-cache.test.ts`, replace the first `it(...)` with:

```ts
  const ADDR = 'mn_addr_preprod1mx4lng3nm3wkn0jejmevfsywzf2xd5';

  it('names the file by network, indexer host and address, never by secret or project id', () => {
    expect(
      cacheFileFor('/c', 'preprod', 'https://midnight-preprod.blockfrost.io/api/v0?project_id=preprodSECRET', ADDR),
    ).toBe('/c/preprod-midnight-preprod.blockfrost.io-mx4lng3nm3wkn0jejmevfsyw.json');
  });

  it('keeps caches from different indexers apart, because sync cursors are indexer ids', () => {
    expect(cacheFileFor('/c', 'preprod', 'https://indexer.preprod.midnight.network/api/v4/graphql', ADDR)).not.toBe(
      cacheFileFor('/c', 'preprod', 'https://midnight-preprod.blockfrost.io/api/v0', ADDR),
    );
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -w @lixi/cli -- network wallet-cache`
Expected: FAIL. `../src/network.js` is missing, and `cacheFileFor` takes three arguments.

- [ ] **Step 3: Implement**

`cli/src/network.ts`:

```ts
import { NETWORKS, networkConfig, type NetworkConfig, type NetworkName } from '@lixi/sdk';

/**
 * Endpoints for the chain scripts. Preprod needs a Blockfrost project id from
 * `BLOCKFROST_PROJECT_ID` in cli/.env. Never log the result: its URLs carry the id.
 */
export const cliNetwork = (
  network: NetworkName,
  env: Record<string, string | undefined> = process.env,
): NetworkConfig => {
  if (!(network in NETWORKS)) throw new Error(`unknown network ${network}; use undeployed or preprod`);
  try {
    return networkConfig(network, env.BLOCKFROST_PROJECT_ID);
  } catch {
    // networkConfig only throws for a missing id.
    throw new Error('set BLOCKFROST_PROJECT_ID in cli/.env to the id of a Blockfrost "Midnight Preprod" project');
  }
};
```

In `cli/src/wallet-cache.ts`, replace `cacheFileFor` and its doc comment with:

```ts
/**
 * One cache file per network, indexer and wallet. Sync cursors are the indexer's own event ids, so a
 * cache written against one indexer replays the wrong events on another (midnight-wallet#781). The
 * name holds the indexer's host, never its URL, which carries the Blockfrost project id. The rest of
 * the name comes from the public address. The contents can include key material, so the file is
 * owner-only and lives in a gitignored directory.
 */
export const cacheFileFor = (dir: string, network: string, indexerUrl: string, bech32Address: string): string => {
  const data = bech32Address.slice(bech32Address.lastIndexOf('1') + 1);
  return join(dir, `${network}-${new URL(indexerUrl).host}-${data.slice(0, 24)}.json`);
};
```

In `cli/src/deployer.ts`, replace the imports of `NETWORKS` and the body of `startDeployer`:

```ts
import type { NetworkName } from '@lixi/sdk';
import { cliNetwork } from './network.js';
// …existing imports of deployerSeed, HeadlessWallet, cacheFileFor stay…

export const startDeployer = (network: NetworkName): Promise<HeadlessWallet> => {
  const config = cliNetwork(network);
  return HeadlessWallet.start(
    config,
    deployerSeed(network),
    network === 'undeployed' ? undefined : (address) => cacheFileFor(WALLET_CACHE_DIR, network, config.indexer, address),
  );
};
```

In `cli/src/deploy.ts`, `cli/src/smoke.ts` and `cli/src/sponsor.ts`, replace `const config = NETWORKS[network];` with `const config = cliNetwork(network);`. Import `cliNetwork` from `./network.js`, and remove `NETWORKS` from the `@lixi/sdk` import. In `deploy.ts`, also delete the line `if (!(network in NETWORKS)) throw …`, because `cliNetwork` now does that check.

In `cli/src/wallet.ts`, change the `waitForFeeSync` default and extend its doc comment:

```ts
  /**
   * Waits until the unshielded and DUST sub-wallets have synced, which is all Lixi needs, and logs
   * progress every 30 s. Shielded sync is not awaited: on Preprod it replays the whole chain history.
   * The default timeout covers a sync from genesis: ~67 min for ~1.58M DUST events on Blockfrost.
   */
  waitForFeeSync(timeoutMs = 2 * 60 * 60_000, log: (line: string) => void = console.log): Promise<FacadeState> {
```

Delete the diagnostic: `rm cli/src/dust-diag.ts`.

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npm test -w @lixi/cli && npm run typecheck -w @lixi/cli && npm run lint`
Expected: PASS. `git grep -n "NETWORKS\[" cli/src` prints nothing.

- [ ] **Step 5: Carry over the Blockfrost sync made during the investigation**

The 2026-10-03 diagnostic synced the deployer from genesis on Blockfrost into `cli/.wallet-cache/preprod-blockfrost-mx4lng3nm3wkn0jejmevfsyw.json`. Give it the new name. Then delete the official-indexer cache: it holds key material and can never be used again.

```bash
cd cli/.wallet-cache
mv preprod-blockfrost-mx4lng3nm3wkn0jejmevfsyw.json preprod-midnight-preprod.blockfrost.io-mx4lng3nm3wkn0jejmevfsyw.json
rm preprod-mx4lng3nm3wkn0jejmevfsyw.json
ls -la   # one file, -rw-------
```

- [ ] **Step 6: Commit**

```bash
git add cli/src cli/test
git commit -m "feat(cli): chain scripts on Blockfrost; sync caches keyed by indexer; smoke waits for sync"
```

---

### Task 3: App: token at build time, Blockfrost reads, CSP, redacted errors

**Files:**
- Modify:
  - `app/src/config.ts`
  - `app/src/chain/midnight.ts:28-31,65`
  - `app/vite.config.ts`
  - `app/src/wallet/errors.ts`
  - `app/vercel.json`
  - `.github/workflows/ci.yml`
- Test: `app/test/config.test.ts`, `app/test/wallet.test.ts`

**Interfaces:**
- Consumes: `networkConfig`, `redactUrl`, `NETWORKS` from `@lixi/sdk/network` (Task 1).
- Produces: `AppConfig = { network, contractAddress, projectId?: string }`. `app/test/app-harness.tsx` builds `{ network: 'undeployed', contractAddress }` and still type-checks unchanged.

- [ ] **Step 1: Write the failing tests**

In `app/test/config.test.ts`, replace the `describe('appConfig', …)` block and the CSP `connect-src` expectation with:

```ts
describe('appConfig', () => {
  it('defaults to Preprod and the committed deployment, with the Blockfrost project id', () => {
    const deployment = JSON.parse(readFileSync(new URL('../../deployments/preprod.json', import.meta.url), 'utf8'));
    expect(appConfig({ VITE_BLOCKFROST_PROJECT_ID: ' preprodX ' })).toEqual({
      network: 'preprod',
      contractAddress: deployment.contractAddress,
      projectId: 'preprodX',
    });
  });

  it('refuses a Preprod build without a Blockfrost project id, naming the variable and the file', () => {
    expect(() => appConfig({})).toThrow('set VITE_BLOCKFROST_PROJECT_ID in app/.env.local');
    expect(() => appConfig({ VITE_BLOCKFROST_PROJECT_ID: '  ' })).toThrow('set VITE_BLOCKFROST_PROJECT_ID');
  });

  it('needs an explicit contract address, and no project id, for a local devnet build', () => {
    expect(() => appConfig({ VITE_LIXI_NETWORK: 'undeployed' })).toThrow(/VITE_LIXI_CONTRACT/);
    expect(appConfig({ VITE_LIXI_NETWORK: 'undeployed', VITE_LIXI_CONTRACT: 'ab'.repeat(32) }).network).toBe(
      'undeployed',
    );
    expect(() => appConfig({ VITE_LIXI_NETWORK: 'mainnet' })).toThrow(/unknown network/);
  });
});
```

In the CSP test, rename it and change the expectation:

```ts
  it('allows only our origin, the Blockfrost indexer and the local proof server, under both its names', () => {
    const policy = cspFor('preprod');
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).toContain(
      "connect-src 'self' https://midnight-preprod.blockfrost.io wss://midnight-preprod.blockfrost.io http://127.0.0.1:6300 http://localhost:6300",
    );
    expect(policy).not.toMatch(/'unsafe-inline'|'unsafe-eval'|\*|project_id/);
  });
```

In `app/test/wallet.test.ts`, add this inside the `describe` block that tests `friendlyError`:

```ts
  it('never shows a Blockfrost project id from an error that quotes an endpoint', () => {
    const shown = friendlyError(
      new Error('request to https://midnight-preprod.blockfrost.io/api/v0?project_id=preprodSECRET failed'),
    );
    expect(shown).not.toContain('preprodSECRET');
    expect(shown).toContain('project_id=<redacted>');
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -w @lixi/app -- config wallet`
Expected: FAIL. `appConfig({})` does not throw, the CSP still lists `indexer.preprod.midnight.network`, and the secret is shown.

- [ ] **Step 3: Implement**

`app/src/config.ts`:

```ts
import { NETWORKS, networkConfig, type NetworkName } from '@lixi/sdk/network';
import preprod from '../../deployments/preprod.json';

export type AppConfig = { readonly network: NetworkName; readonly contractAddress: string; readonly projectId?: string };

/**
 * Build-time config. Preprod by default, using the committed deployment record and the Blockfrost
 * project id from VITE_BLOCKFROST_PROJECT_ID (app/.env.local; the id ships in the page, as any
 * browser-side Blockfrost id does). A local devnet build sets VITE_LIXI_NETWORK=undeployed and
 * VITE_LIXI_CONTRACT.
 */
export const appConfig = (env: Record<string, string | undefined>): AppConfig => {
  const network = env.VITE_LIXI_NETWORK ?? 'preprod';
  if (!(network in NETWORKS)) throw new Error(`unknown network ${network}`);
  const contractAddress = env.VITE_LIXI_CONTRACT ?? (network === 'preprod' ? preprod.contractAddress : '');
  if (!/^[0-9a-f]{64}$/.test(contractAddress)) throw new Error(`set VITE_LIXI_CONTRACT for ${network}`);
  const projectId = env.VITE_BLOCKFROST_PROJECT_ID?.trim() || undefined;
  try {
    networkConfig(network as NetworkName, projectId); // only throws for a missing id
  } catch {
    throw new Error('set VITE_BLOCKFROST_PROJECT_ID in app/.env.local to the id of a Blockfrost "Midnight Preprod" project');
  }
  return { network: network as NetworkName, contractAddress, projectId };
};
```

(`toEqual` ignores a `projectId: undefined`, so the devnet assertions need no change. `app/vitest.config.ts` does not load `vite.config.ts`, so the build-time check in `vite.config.ts` never runs under tests.)

In `app/src/chain/midnight.ts`, replace `publicData` and the local prover URL:

```ts
const publicData = (config: AppConfig) => {
  const n = networkConfig(config.network, config.projectId);
  // The provider is typed against the `ws` package; the browser's WebSocket is what it needs here.
  return indexerPublicDataProvider(n.indexer, n.indexerWS, WebSocket as unknown as WebSocketCtor);
};
```

On line 65, `localProver(NETWORKS[config.network].proofServer, zk)` stays as it is: the proof server never carries the id. Add `networkConfig` to the `@lixi/sdk` import.

`app/vite.config.ts` should fail fast in dev and build alike. Replace the `network` line inside `defineConfig`:

```ts
  // Throws with the variable to set when the Blockfrost project id is missing, before anything is served or built.
  const { network } = appConfig(loadEnv(mode, process.cwd(), 'VITE_'));
```

Add `import { appConfig } from './src/config.ts';`, and drop the now-unused `NetworkName` import.

`app/src/wallet/errors.ts`: import `redactUrl` from `@lixi/sdk/network`, and redact at the single point where error text enters:

```ts
  const text = redactUrl(messageOf(error));
```

`app/vercel.json`: in the CSP header value, replace `https://indexer.preprod.midnight.network wss://indexer.preprod.midnight.network` with `https://midnight-preprod.blockfrost.io wss://midnight-preprod.blockfrost.io`. Change nothing else; the config test checks that the two are equal.

`.github/workflows/ci.yml`: give the app build its id:

```yaml
      - name: Build the app
        run: npm run build -w @lixi/app
        env:
          VITE_BLOCKFROST_PROJECT_ID: ${{ secrets.VITE_BLOCKFROST_PROJECT_ID }}
```

- [ ] **Step 4: Run the tests, typecheck, lint, and a local build**

The local build needs `app/.env.local`. Create it from `cli/.env` without printing the id:

```bash
printf 'VITE_BLOCKFROST_PROJECT_ID=%s\n' "$(grep -E '^BLOCKFROST_PROJECT_ID=' cli/.env | cut -d= -f2-)" > app/.env.local
chmod 600 app/.env.local
npm test -w @lixi/app && npm run typecheck && npm run lint && npm run build -w @lixi/app
grep -o 'midnight-preprod.blockfrost.io[^"]*' app/dist/index.html   # CSP meta lists the host, no project_id
```

Expected: all PASS. The build succeeds, and the CSP meta tag names `midnight-preprod.blockfrost.io`. Also check `mv app/.env.local /tmp/x && npm run build -w @lixi/app`: it must fail with `set VITE_BLOCKFROST_PROJECT_ID`. Then move the file back.

- [ ] **Step 5: Commit**

```bash
git add app/src app/test app/vite.config.ts app/vercel.json .github/workflows/ci.yml
git commit -m "feat(app): read Preprod through Blockfrost; project id at build time; CSP and CI follow"
```

---

### Task 4: Prove it on Preprod, then docs, CI and merge

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/spikes/2026-10-01-chain-spikes.md`
- Modify (only if Step 3 fails): `cli/src/smoke.ts`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Full local sequence**

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run compact && npm run build -w @lixi/app
npm ls @midnight-ntwrk/onchain-runtime-v3   # one version, 3.0.0
```

Expected: exit 0.

- [ ] **Step 2: Devnet suite** (the CLI changed, and devnet must not need a token)

Stop `midnight-proof-server` first, then run `docker compose -f devnet/compose.yml up -d --wait && npm run test:devnet -w @lixi/cli`.
Expected: 19/19. Then run `docker compose -f devnet/compose.yml down` and `docker start midnight-proof-server`.

- [ ] **Step 3: Preprod smoke on Blockfrost**

```bash
curl -s localhost:6300/health
npm run smoke -w @lixi/cli -- --network preprod 2>&1 | sed -E 's/project_id=[^&" ]*/project_id=<redacted>/g'
```

Expected: `create tx: …`, two `claim tx: …`, and `envelope id: …`. If a claim fails with `could not balance dust` (Review Focus 5), add `await wallet.waitFor((s) => s.dust.availableCoins.length > 0, 10 * 60_000, 'spendable DUST');` at the top of the claim loop in `smoke.ts`, with a comment naming Blockfrost's progress lag. Then rerun and commit it as `fix(cli): smoke waits for a spendable DUST coin between transactions`.

- [ ] **Step 4: The built site reads Preprod through Blockfrost under the CSP**

Run `npm run preview -w @lixi/app`. Open `http://localhost:4173/claim#<link 4 from s4-spike-links.local.txt>` in a browser (Playwright is enough, since no wallet is needed). Expected:
- the page shows "… tNIGHT is sealed inside";
- the console shows no `Content-Security-Policy` violation;
- the network log shows WS/HTTP to `midnight-preprod.blockfrost.io` only.

Stop the preview afterwards.

- [ ] **Step 5: Docs**

In `CLAUDE.md`:
- Replace the invariant line "App reads use the network's public indexer (`NETWORKS`), …" with: "Preprod reads and chain scripts go through Blockfrost (`NETWORKS.preprod`; `networkConfig` adds `?project_id=`). The CLI reads `BLOCKFROST_PROJECT_ID` from `cli/.env`, the app reads `VITE_BLOCKFROST_PROJECT_ID` from `app/.env.local` (CI: repo secret). App reads never use the wallet's indexer, so the CSP can list every host. Wallet sync caches are per indexer host; never reuse one across indexers."
- In Commands, after the Preprod deployer-secret sentence, add: "The first Preprod sync on Blockfrost takes ~67 min."

Append to `docs/superpowers/spikes/2026-10-01-chain-spikes.md` a section titled `## Move to Blockfrost (Preprod, 2026-10-03)`. Record the smoke tx ids, that the read went through Blockfrost under the CSP, and the investigation:
- smoke against the official indexer failed with 170 (`InvalidDustSpendProof`) because `smoke.ts` did not wait for sync;
- once it waited, the restored official-indexer cache showed 0 DUST coins;
- a genesis sync on Blockfrost showed `<result from the 2026-10-03 diagnostic>`.

Commit: `docs: Blockfrost endpoints and token setup; record the move`.

- [ ] **Step 6: CI secret (needs the user's go-ahead: it sends the id to GitHub)**

```bash
grep -E '^BLOCKFROST_PROJECT_ID=' cli/.env | cut -d= -f2- | tr -d '\n' | gh secret set VITE_BLOCKFROST_PROJECT_ID
```

- [ ] **Step 7: Push, watch CI, merge**

Run `git push` and `gh run watch`. Expected: CI green, and Devnet green too, since `cli/` and `sdk/` changed. Then fast-forward `main` to `feat/app` and push. Keep `feat/app`.

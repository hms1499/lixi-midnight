# Lixi Plan 2 (Chain: providers, devnet, Preprod, spikes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Lixi contract on a real chain. Wrap it in midnight-js, prove the whole create → concurrent claims → sponsored claim → refund flow on a local devnet, deploy it to Preprod with the maintenance authority relinquished, and answer spikes S1–S5.

**Architecture:**
- `@lixi/sdk` gains the environment-agnostic chain layer, which works in Node and in browsers:
  - network endpoints
  - Bech32m address decoding
  - an in-memory private-state provider
  - claim and refund pre-checks
  - midnight-js wrappers for deploy, relinquish, create, claim, prove-only claim and refund
- A new `@lixi/cli` workspace holds everything Node-only:
  - a headless wallet on the wallet SDK
  - Node providers (filesystem keys, local proof server)
  - the `deploy`, `smoke` and `sponsor` scripts
  - the devnet end-to-end suite
- A throwaway `spikes/s4-wallet` Vite page answers S4 with real browser wallets.

**Tech Stack:** midnight-js 4.1.1, `@midnight-ntwrk/wallet-sdk` 1.2.0, dapp-connector-api 4.0.1, proof server 8.1.0, devnet images `midnight-node:1.0.0` and `indexer-standalone:4.3.3`, Docker Compose, Vitest 4, tsx, Vite 8.

**Spec:** `docs/superpowers/specs/2026-09-30-lixi-design.md`. Plan 1, `docs/superpowers/plans/2026-09-30-lixi-plan-1-core.md`, built the contract and the pure SDK that this plan extends.

**Scope:** This is plan 2 of 4. It covers spec tasks T4c, T5a, T5b, T6, the S1–S5 spikes, and these Plan 1 carry-overs:
- the expiry and refund pre-check
- local-only proving (H4)
- relinquishing the authority on Preprod (H5)
- pinning CI to `ubuntu-24.04`

Plan 3 (the app) consumes:
- the S4 result
- the browser-safe SDK chain layer
- the Vite and Buffer findings from Task 8
- the sponsor flow from Task 5

**Verification note:** On 2026-10-01, every code block in Tasks 1–6 and the Task 8 page was run against a local devnet in a scratch copy of this repo. The plan's file blocks were then extracted and diffed against that copy: they match exactly, except that Task 5's inserted test needs the usual two-space indent, which the format hook applies. Not run: the Task 8, Step 3 link script and the Task 9 CI job.
- `npm test` passed with 32 contract tests and 30 SDK tests (before the in-memory provider tests, which add 3).
- The full devnet suite passed three times (6/6 tests, ~7 min each). The Task 4 variant passed separately.
- `deploy`, `smoke` and the unfunded-deploy error behaved as written.
- The S4 page built and was loaded in Chromium with a fake connector. The indexer read, the pre-check and in-browser proving through the local proof server all worked. Only the real 1AM and Lace runs (Task 8) and Preprod (Task 7) are unverified, because both need the user's wallets.

Measured on the devnet (Apple Silicon, Docker with 8 GB):

| Step | Wall time, incl. proving and finality | Proving only |
|---|---|---|
| deploy | 16–20 s | — |
| relinquish | 17–19 s | — |
| createEnvelope | 17–24 s | 0.9–1.9 s |
| claim | 17–25 s | 0.2–2.5 s |
| refund | ~21 s | 0.9–1.3 s |

## Global Constraints

- Everything from Plan 1 still holds:
  - Node 24, compiler 0.31.1, `compact-runtime` 0.16.0
  - MAX_SHARES 16, depth 4
  - Poseidon hashing through pure circuits
  - unix seconds
  - secrets never logged
- **Pinned versions:** `@midnight-ntwrk/midnight-js-*` **4.1.1**, `@midnight-ntwrk/wallet-sdk` **1.2.0**, `@midnight-ntwrk/wallet-sdk-address-format` **3.1.2**, `@midnight-ntwrk/dapp-connector-api` **4.0.1**. Install with `--save-exact`.
- **One copy of the on-chain runtime:**
  - Root `package.json` `overrides` must pin `"@midnight-ntwrk/onchain-runtime-v3": "3.0.0"`.
  - After every install, `npm ls @midnight-ntwrk/onchain-runtime-v3` must show no `invalid` line.
  - Why: `compact-runtime` would otherwise pull 3.1.1 next to midnight-js's 3.0.0, and every circuit call then fails with `expected instance of StateValue`.
- **Proving is always local (audit H4).** The SDK's `NETWORKS[*].proofServer` is `http://127.0.0.1:6300` for every network. Never point a proof provider at a remote server.
- **Every deployment relinquishes its maintenance authority (audit H5)**: an empty committee with threshold 1. The deploy script refuses to write a deployment record otherwise.
- **`npm test` stays network-free.** Chain tests live only in `npm run test:devnet -w @lixi/cli`.
- **Proving keys:**
  - `npm test` and `npm run typecheck` recompile with `--skip-zk`, which **deletes** `contract/src/managed/lixi/keys`.
  - So every chain script (`deploy`, `smoke`, `test:devnet`) recompiles the keys in its `pre` script. Don't remove those.
- **Network ID before providers:** `setNetworkId(...)` must run before any provider or wallet is created.
- **Secrets:**
  - Wallet seeds come only from `LIXI_DEPLOYER_SEED` in the environment or a gitignored `cli/.env`.
  - The devnet genesis seed `00…01` is public and is used only for `undeployed`.
  - No script prints a seed, a share secret or a claim link.
- **Private state:** Lixi keeps no durable midnight-js private state. The sender vault (Plan 1) re-derives every share, and `chain.ts` writes the private state right before each call. Use `memoryPrivateStateProvider`, never `levelPrivateStateProvider`.
- **Port 6300:** The devnet stack runs its own proof server on 6300. Stop the standalone `midnight-proof-server` container first (`docker stop midnight-proof-server`).

## Review Focus

These are failure modes the spec implies but no feature test exercises directly. Each one has a pinning test or check in the task that owns the code.

1. **A recipient pastes a link from another deployment, or a tampered link** (amount or path edited). The claim must be refused before any proof is spent: `no envelope` or `invalid link`. Task 3: "rejects unknown envelopes and tampered links before proving".
2. **A recipient's wallet is on the wrong network** (a `mn_addr_preprod…` address while the app runs on `undeployed`). The address decode must fail loudly instead of paying the wrong bytes. Task 2: "rejects an address from another network".
3. **A sender whose wallet just paid a fee submits again at once.** The node can reject the second transaction because the wallet reused a DUST coin. The harness retries after a block instead of failing the run; this happened in 2 of 4 verification runs. Task 4: `retrySubmission` in `cli/test/harness.ts`.
4. **The deployer runs `deploy` with an unfunded seed.** It must stop with "fund the address above", print the address, and write no deployment file. Task 6, Step 4.
5. **A claim lands exactly at expiry.** The pre-check must call it `expired` (the contract requires `blockTime < expiry`), and refund must stay unavailable until then. Task 3: "rejects after expiry and after refund" and "offers refund only after expiry and only once".

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | Workspaces `contract`, `sdk`, `cli`, `spikes/s4-wallet`; on-chain runtime override |
| `devnet/compose.yml` | Local Midnight devnet: node, indexer and proof server, pinned |
| `deployments/preprod.json` | Committed public deployment record (address, durations, date) |
| `sdk/src/network.ts` | `NETWORKS` endpoints for `undeployed` and `preprod` |
| `sdk/src/address.ts` | `userAddressBytes`: Bech32m unshielded address → contract `UserAddress` bytes |
| `sdk/src/memory-private-state.ts` | In-memory `PrivateStateProvider` (Node and browser) |
| `sdk/src/precheck.ts` | `checkClaim` and `checkRefund`: the contract's checks against a ledger snapshot |
| `sdk/src/chain.ts` | midnight-js wrappers: deploy, relinquish, read, create, claim, prove-only claim, refund |
| `cli/src/wallet.ts` | `HeadlessWallet`: wallet SDK facade, balancing, DUST registration, sponsorship |
| `cli/src/providers.ts` | `nodeProviders`: filesystem ZK config, local proof server, indexer |
| `cli/src/deploy.ts`, `cli/src/smoke.ts`, `cli/src/sponsor.ts` | Operator scripts |
| `cli/test/harness.ts`, `cli/test/devnet.test.ts` | Devnet E2E harness and suite |
| `spikes/s4-wallet/` | Throwaway browser-wallet spike page |
| `docs/superpowers/spikes/2026-10-01-chain-spikes.md` | S1–S5 results and decisions |

## Execution Order

Run Task 1 → 2 → 3 → 4 → 5 → 6 in order. Task 7 (Preprod) needs Task 6 and the user's funded wallet. Task 8 (S4) needs Task 6, plus Task 7 for the Preprod run. Task 9 comes last.

All work happens on branch `feat/chain`:
```bash
git switch main && git pull --ff-only && git switch -c feat/chain
```

---

### Task 1: Dependencies, on-chain runtime pin and the devnet stack

**Files:**
- Modify: `package.json` (overrides), `sdk/package.json` (dependencies), `.gitignore`, `eslint.config.js`
- Create: `devnet/compose.yml`
- Generated: `package-lock.json`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `@lixi/sdk` can import `@midnight-ntwrk/midnight-js-{contracts,network-id,protocol,types,utils}` and `@midnight-ntwrk/wallet-sdk-address-format`.
  - A running devnet: node `http://127.0.0.1:9944`, indexer `http://127.0.0.1:8088/api/v4/graphql`, proof server `http://127.0.0.1:6300`.

- [ ] **Step 1: Pin the on-chain runtime**

Add the override to the root `package.json`, keeping the existing `source-map-js` entry:
```json
  "overrides": {
    "source-map-js": "1.2.1",
    "@midnight-ntwrk/onchain-runtime-v3": "3.0.0"
  },
```

- [ ] **Step 2: Install the SDK's chain dependencies**

```bash
source ~/.nvm/nvm.sh && nvm use 24
npm i -w @lixi/sdk --save-exact @midnight-ntwrk/midnight-js-contracts@4.1.1 @midnight-ntwrk/midnight-js-types@4.1.1 \
  @midnight-ntwrk/midnight-js-protocol@4.1.1 @midnight-ntwrk/midnight-js-network-id@4.1.1 \
  @midnight-ntwrk/midnight-js-utils@4.1.1 @midnight-ntwrk/wallet-sdk-address-format@3.1.2
npm dedupe
npm ls @midnight-ntwrk/onchain-runtime-v3 @midnight-ntwrk/compact-runtime @midnight-ntwrk/ledger-v8
```
Expected:
- The tree shows `onchain-runtime-v3@3.0.0` under both `compact-runtime` and `midnight-js-protocol` (`overridden` or `deduped`), with **no** `invalid` line.
- `compact-runtime@0.16.0` and `ledger-v8@8.1.0` each appear once.

Without `npm dedupe`, the lockfile keeps the earlier 3.1.1 and `npm ls` reports `invalid`.

- [ ] **Step 3: Write the devnet stack**

`devnet/compose.yml`:
```yaml
# Local Midnight devnet (network id `undeployed`), pinned to the Preprod compatibility matrix.
# Adapted from github.com/midnightntwrk/midnight-local-dev (Apache-2.0).
name: lixi-devnet

services:
  proof-server:
    image: 'midnightntwrk/proof-server:8.1.0'
    command: ['midnight-proof-server', '-v']
    ports:
      - '127.0.0.1:6300:6300'
    healthcheck:
      test: ['CMD-SHELL', 'echo > /dev/tcp/127.0.0.1/6300']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s

  node:
    image: 'midnightntwrk/midnight-node:1.0.0'
    ports:
      - '127.0.0.1:9944:9944'
    environment:
      CFG_PRESET: 'dev'
      SIDECHAIN_BLOCK_BENEFICIARY: '04bcf7ad3be7a5c790460be82a713af570f22e0f801f6659ab8e84a52be6969e'
    healthcheck:
      # Wait for block #1, not just the RPC port: the indexer exits if block #1 does not exist yet.
      test:
        [
          'CMD-SHELL',
          'curl -sf -X POST -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"chain_getBlockHash\",\"params\":[1]}" http://localhost:9944 | grep -q "\"result\":\"0x"',
        ]
      interval: 2s
      timeout: 5s
      retries: 30
      start_period: 20s

  indexer:
    image: 'midnightntwrk/indexer-standalone:4.3.3'
    ports:
      - '127.0.0.1:8088:8088'
    environment:
      RUST_LOG: 'indexer=info,chain_indexer=info,indexer_api=info,wallet_indexer=info,indexer_common=info,fastrace_opentelemetry=off,info'
      APP__INFRA__NODE__URL: 'ws://node:9944'
      APP__APPLICATION__NETWORK_ID: 'undeployed'
      APP__INFRA__STORAGE__PASSWORD: 'indexer'
      APP__INFRA__PUB_SUB__PASSWORD: 'indexer'
      APP__INFRA__LEDGER_STATE_STORAGE__PASSWORD: 'indexer'
      APP__INFRA__SECRET: '303132333435363738393031323334353637383930313233343536373839303132'
      APP__INFRA__SPO_NODE__URL: 'ws://node:9944'
      APP__INFRA__SPO_NODE__BLOCKFROST_ID: 'e2e-test-dummy-id'
    healthcheck:
      test: ['CMD-SHELL', 'cat /var/run/indexer-standalone/running']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s
    depends_on:
      node:
        condition: service_healthy
```

- [ ] **Step 4: Ignore local-only outputs**

Append to `.gitignore`:
```
deployments/undeployed.json
```
(`.env` and `.env.*` are already ignored, and they cover `cli/.env`.)

In `eslint.config.js`, add `'**/dist/'` to the ignores so the spike's build output (Task 8) is not linted:
```js
  { ignores: ['**/node_modules/', '**/dist/', 'contract/src/managed/', '.superpowers/', 'docs/'] },
```

- [ ] **Step 5: Start the devnet and check it**

```bash
docker stop midnight-proof-server 2>/dev/null; docker compose -f devnet/compose.yml up -d --wait
curl -s -X POST -H 'Content-Type: application/json' -d '{"query":"{ block { height } }"}' http://127.0.0.1:8088/api/v4/graphql
curl -s http://127.0.0.1:6300/health
```
Expected:
- `up` reports all three containers `Healthy` in about 20 s.
- The indexer answers `{"data":{"block":{"height":N}}}` with N > 0.
- The proof server answers `{"status":"ok",...}`.

- [ ] **Step 6: Existing suites still pass**

Run: `npm test && npm run typecheck && npm run lint && npm run format:check`
Expected: 32 contract tests and 21 SDK tests pass, and every command exits 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json sdk/package.json devnet/compose.yml .gitignore eslint.config.js
git commit -m "chore: add midnight-js 4.1.1, pin onchain-runtime 3.0.0, local devnet compose"
```

---

### Task 2: Network config, address decoding and in-memory private state

**Files:**
- Create: `sdk/src/network.ts`, `sdk/src/address.ts`, `sdk/src/memory-private-state.ts`, `sdk/test/address.test.ts`, `sdk/test/memory-private-state.test.ts`
- Modify: `sdk/src/index.ts`

**Interfaces:**
- Consumes: Task 1 dependencies.
- Produces:
  - `type NetworkConfig = { networkId: 'undeployed' | 'preprod'; indexer: string; indexerWS: string; node: string; proofServer: string }`
  - `NETWORKS: { undeployed: NetworkConfig; preprod: NetworkConfig }`, `type NetworkName = 'undeployed' | 'preprod'`
  - `userAddressBytes(bech32: string, networkId: string): Uint8Array` (32 bytes; throws on another network or a malformed address)
  - `memoryPrivateStateProvider<PSI, PS>(): PrivateStateProvider<PSI, PS>`

- [ ] **Step 1: Write the failing tests**

`sdk/test/address.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { toHex } from '@lixi/contract';
import { userAddressBytes } from '../src/address.js';

// Generated with the wallet SDK: createKeystore(secret, 'undeployed').getBech32Address() and .getAddress().
const BECH32 = 'mn_addr_undeployed1c5c054q33elswjfesnhcccjcsrvckauhdv9fv5wfze0v42nkdfzskcza5a';
const HEX = 'c530fa54118e7f07493984ef8c625880d98b77976b0a9651c9165ecaaa766a45';

describe('userAddressBytes', () => {
  it('decodes an unshielded address to the 32 contract bytes', () => {
    expect(toHex(userAddressBytes(BECH32, 'undeployed'))).toBe(HEX);
    expect(toHex(userAddressBytes(`  ${BECH32}\n`, 'undeployed'))).toBe(HEX);
  });

  it('rejects an address from another network', () => {
    expect(() => userAddressBytes(BECH32, 'preprod')).toThrow(/preprod/);
  });

  it('rejects text that is not an address', () => {
    expect(() => userAddressBytes('mn_addr_undeployed1nope', 'undeployed')).toThrow();
  });
});
```

`sdk/test/memory-private-state.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { emptyPrivateState, type LixiPrivateState } from '@lixi/contract';
import { memoryPrivateStateProvider } from '../src/memory-private-state.js';

describe('memoryPrivateStateProvider', () => {
  it('scopes private state to the current contract address', async () => {
    const p = memoryPrivateStateProvider<'lixi', LixiPrivateState>();
    await expect(p.get('lixi')).rejects.toThrow(/setContractAddress/);
    const state = { shares: { ab: [] } };
    p.setContractAddress('aa');
    await p.set('lixi', state);
    expect(await p.get('lixi')).toBe(state);
    p.setContractAddress('bb');
    expect(await p.get('lixi')).toBeNull();
    await p.set('lixi', emptyPrivateState());
    p.setContractAddress('aa');
    expect(await p.get('lixi')).toBe(state);
  });

  it('keeps signing keys by contract address until removed', async () => {
    const p = memoryPrivateStateProvider<'lixi', LixiPrivateState>();
    await p.setSigningKey('aa', 'key');
    expect(await p.getSigningKey('aa')).toBe('key');
    expect(await p.getSigningKey('bb')).toBeNull();
    await p.removeSigningKey('aa');
    expect(await p.getSigningKey('aa')).toBeNull();
  });

  it('refuses export and import instead of pretending to back up', async () => {
    const p = memoryPrivateStateProvider<'lixi', LixiPrivateState>();
    await expect(p.exportPrivateStates()).rejects.toThrow(/not supported/);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run compact:fast && npm test -w @lixi/sdk -- address memory-private-state`
Expected: FAIL. Both files report that `../src/address.js` and `../src/memory-private-state.js` cannot be resolved.

- [ ] **Step 3: Implement**

`sdk/src/network.ts`:
```typescript
/** Endpoints for one Midnight network. The proof server is always local (audit H4). */
export type NetworkConfig = {
  readonly networkId: 'undeployed' | 'preprod';
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
};

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
    indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    proofServer: 'http://127.0.0.1:6300',
  },
} as const satisfies Record<string, NetworkConfig>;

export type NetworkName = keyof typeof NETWORKS;
```

`sdk/src/address.ts`:
```typescript
import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';

/**
 * The 32 bytes the contract's `UserAddress` expects, from a wallet's Bech32m unshielded address
 * (`mn_addr_<network>1…`). Throws on another network's address or any other address type.
 */
export const userAddressBytes = (bech32: string, networkId: string): Uint8Array =>
  new Uint8Array(MidnightBech32m.parse(bech32.trim()).decode(UnshieldedAddress, networkId).data);
```

`sdk/src/memory-private-state.ts`:
```typescript
import type { PrivateStateId, PrivateStateProvider } from '@midnight-ntwrk/midnight-js-types';

/**
 * In-memory private state. Lixi needs nothing durable here: the sender's vault re-derives
 * every share from the seed, and `chain.ts` writes the private state right before each call.
 * The maintenance signing key only lives between deploy and `relinquishAuthority`.
 */
export const memoryPrivateStateProvider = <PSI extends PrivateStateId, PS>(): PrivateStateProvider<PSI, PS> => {
  const states = new Map<string, PS>();
  const keys = new Map<string, string>();
  let address: string | undefined;
  const scoped = (id: PSI): string => {
    if (address === undefined) throw new Error('call setContractAddress first');
    return `${address}:${id}`;
  };
  const unsupported = (): Promise<never> => Promise.reject(new Error('not supported by the in-memory provider'));
  return {
    setContractAddress: (a) => {
      address = a;
    },
    set: async (id, state) => {
      states.set(scoped(id), state);
    },
    get: async (id) => states.get(scoped(id)) ?? null,
    remove: async (id) => {
      states.delete(scoped(id));
    },
    clear: async () => states.clear(),
    setSigningKey: async (a, key) => {
      keys.set(a, key);
    },
    getSigningKey: async (a) => keys.get(a) ?? null,
    removeSigningKey: async (a) => {
      keys.delete(a);
    },
    clearSigningKeys: async () => keys.clear(),
    exportPrivateStates: unsupported,
    importPrivateStates: unsupported,
    exportSigningKeys: unsupported,
    importSigningKeys: unsupported,
  };
};
```

Append to `sdk/src/index.ts`:
```typescript
export * from './network.js';
export * from './address.js';
export * from './memory-private-state.js';
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test -w @lixi/sdk && npm run typecheck && npm run lint`
Expected: 27 SDK tests pass (21 + 3 + 3), and typecheck and lint exit 0.

- [ ] **Step 5: Commit**

```bash
git add sdk/src/network.ts sdk/src/address.ts sdk/src/memory-private-state.ts sdk/src/index.ts sdk/test/address.test.ts sdk/test/memory-private-state.test.ts
git commit -m "feat(sdk): network endpoints, unshielded address decoding, in-memory private state"
```

---

### Task 3: Claim and refund pre-checks

**Files:**
- Create: `sdk/src/precheck.ts`, `sdk/test/precheck.test.ts`
- Modify: `sdk/src/index.ts`

**Interfaces:**
- Consumes:
  - `ClaimArgs` from `sdk/src/claim.ts` (`{ id, share, path }`)
  - `resolveClaim`
  - `LixiSimulator` and `T0` from `@lixi/contract/testing`
- Produces:
  - `checkClaim(ledger, args: ClaimArgs, recipient: Uint8Array, now: number): ClaimCheck`, where `ClaimCheck = { ok: true; amount; secondsLeft; expiringSoon } | { ok: false; reason: ClaimRejection }`
  - `ClaimRejection = 'no envelope' | 'refunded' | 'expired' | 'invalid link' | 'already claimed' | 'address already claimed'`
  - `checkRefund(ledger, id, now): { ok: true } | { ok: false; reason: 'no envelope' | 'refunded' | 'not expired' }`
  - `EXPIRY_WARNING_SECONDS = 600`

- [ ] **Step 1: Write the failing test**

`sdk/test/precheck.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { LixiSimulator, T0 } from '@lixi/contract/testing';
import { resolveClaim, type ClaimArgs } from '../src/claim.js';
import { deriveEnvelope, linksFor, type EnvelopeSpec } from '../src/envelope.js';
import { checkClaim, checkRefund } from '../src/precheck.js';
import { addEnvelope, newVault, privateStateOf } from '../src/vault.js';

const HOUR = 3600;
const expiry = BigInt(T0 + 2 * HOUR);
const rnd = () => crypto.getRandomValues(new Uint8Array(32));

const open = (spec: Omit<EnvelopeSpec, 'index'>) => {
  const sim = new LixiSimulator(BigInt(HOUR));
  const vault = addEnvelope(newVault(), { ...spec, index: 0, expiry, labels: [] });
  const d = deriveEnvelope(vault.seed, vault.envelopes[0]);
  sim.privateState = privateStateOf(vault);
  sim.create(d.nonce, expiry, rnd(), spec.kind === 'group');
  const isClaimed = (nf: bigint) => sim.ledger().nullifiers.member(nf);
  const args = (i = 0): ClaimArgs => resolveClaim(linksFor(d)[i], isClaimed);
  return { sim, d, vault, args };
};

/** The pre-check must refuse exactly what the contract refuses. */
const expectRejected = (sim: LixiSimulator, a: ClaimArgs, who: Uint8Array, reason: string) => {
  expect(checkClaim(sim.ledger(), a, who, sim.now)).toEqual({ ok: false, reason });
  expect(() => sim.claim(a.id, a.share, a.path, who)).toThrow();
};

describe('claim pre-check', () => {
  it('accepts a fresh share and warns in the last ten minutes', () => {
    const { sim, args } = open({ total: 300n, count: 3, kind: 'personal', split: 'equal' });
    expect(checkClaim(sim.ledger(), args(), rnd(), T0)).toEqual({
      ok: true,
      amount: 100n,
      secondsLeft: 2 * HOUR,
      expiringSoon: false,
    });
    const late = checkClaim(sim.ledger(), args(), rnd(), Number(expiry) - 300);
    expect(late).toMatchObject({ ok: true, secondsLeft: 300, expiringSoon: true });
  });

  it('rejects unknown envelopes and tampered links before proving', () => {
    const { sim, args } = open({ total: 300n, count: 3, kind: 'personal', split: 'equal' });
    const a = args();
    expectRejected(sim, { ...a, id: rnd() }, rnd(), 'no envelope');
    expectRejected(sim, { ...a, share: { ...a.share, amount: 101n } }, rnd(), 'invalid link');
    expectRejected(sim, { ...a, path: args(1).path }, rnd(), 'invalid link');
  });

  it('rejects a share that is already claimed', () => {
    const { sim, args } = open({ total: 300n, count: 3, kind: 'personal', split: 'equal' });
    const a = args();
    sim.claim(a.id, a.share, a.path, rnd());
    expectRejected(sim, a, rnd(), 'already claimed');
  });

  it('rejects after expiry and after refund', () => {
    const { sim, args, d } = open({ total: 300n, count: 3, kind: 'personal', split: 'equal' });
    const a = args();
    sim.now = Number(expiry);
    expectRejected(sim, a, rnd(), 'expired');
    sim.refund(d.id);
    expectRejected(sim, a, rnd(), 'refunded');
  });

  it('rejects a second claim from the same address in group mode', () => {
    const { sim, args } = open({ total: 300n, count: 3, kind: 'group', split: 'equal' });
    const who = rnd();
    const first = args();
    sim.claim(first.id, first.share, first.path, who);
    expectRejected(sim, args(), who, 'address already claimed');
    expect(checkClaim(sim.ledger(), args(), rnd(), sim.now).ok).toBe(true);
  });
});

describe('refund pre-check', () => {
  it('offers refund only after expiry and only once', () => {
    const { sim, d } = open({ total: 300n, count: 3, kind: 'personal', split: 'equal' });
    expect(checkRefund(sim.ledger(), rnd(), sim.now)).toEqual({ ok: false, reason: 'no envelope' });
    expect(checkRefund(sim.ledger(), d.id, sim.now)).toEqual({ ok: false, reason: 'not expired' });
    sim.now = Number(expiry);
    expect(checkRefund(sim.ledger(), d.id, sim.now)).toEqual({ ok: true });
    sim.refund(d.id);
    expect(checkRefund(sim.ledger(), d.id, sim.now)).toEqual({ ok: false, reason: 'refunded' });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -w @lixi/sdk -- precheck`
Expected: FAIL. `../src/precheck.js` cannot be resolved.

- [ ] **Step 3: Implement**

`sdk/src/precheck.ts`:
```typescript
import { pureCircuits, type Ledger } from '@lixi/contract';
import type { ClaimArgs } from './claim.js';

/** Recipients get a warning when less than this many seconds remain (spec §4.6). */
export const EXPIRY_WARNING_SECONDS = 600;

export type ClaimRejection =
  'no envelope' | 'refunded' | 'expired' | 'invalid link' | 'already claimed' | 'address already claimed';

export type ClaimCheck =
  | { readonly ok: true; readonly amount: bigint; readonly secondsLeft: number; readonly expiringSoon: boolean }
  | { readonly ok: false; readonly reason: ClaimRejection };

type ClaimView = Pick<Ledger, 'envelopes' | 'nullifiers' | 'addrClaims'>;

/**
 * Runs every check `claim` would run, against a ledger snapshot, so the app can refuse a doomed
 * claim before spending time and fees on a proof. `now` is unix seconds.
 */
export const checkClaim = (ledger: ClaimView, args: ClaimArgs, recipient: Uint8Array, now: number): ClaimCheck => {
  const { id, share, path } = args;
  if (!ledger.envelopes.member(id)) return { ok: false, reason: 'no envelope' };
  const env = ledger.envelopes.lookup(id);
  if (env.refunded) return { ok: false, reason: 'refunded' };
  const secondsLeft = Number(env.expiry) - now;
  if (secondsLeft <= 0) return { ok: false, reason: 'expired' };
  if (share.amount <= 0n || pureCircuits.rootFromPath(pureCircuits.leafHash(id, share), path) !== env.root) {
    return { ok: false, reason: 'invalid link' };
  }
  if (ledger.nullifiers.member(pureCircuits.nullifierOf(id, share.secret)))
    return { ok: false, reason: 'already claimed' };
  if (env.onePerAddress && ledger.addrClaims.member(pureCircuits.addrKey(id, { bytes: recipient }))) {
    return { ok: false, reason: 'address already claimed' };
  }
  return { ok: true, amount: share.amount, secondsLeft, expiringSoon: secondsLeft < EXPIRY_WARNING_SECONDS };
};

export type RefundCheck =
  { readonly ok: true } | { readonly ok: false; readonly reason: 'no envelope' | 'refunded' | 'not expired' };

/** The checks `refund` would run, so the dashboard only offers Refund when it can succeed. */
export const checkRefund = (ledger: Pick<Ledger, 'envelopes'>, id: Uint8Array, now: number): RefundCheck => {
  if (!ledger.envelopes.member(id)) return { ok: false, reason: 'no envelope' };
  const env = ledger.envelopes.lookup(id);
  if (env.refunded) return { ok: false, reason: 'refunded' };
  if (now < Number(env.expiry)) return { ok: false, reason: 'not expired' };
  return { ok: true };
};
```

Append to `sdk/src/index.ts`:
```typescript
export * from './precheck.js';
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm test -w @lixi/sdk && npm run lint`
Expected: 33 SDK tests pass (27 + 6).

- [ ] **Step 5: Commit**

```bash
git add sdk/src/precheck.ts sdk/src/index.ts sdk/test/precheck.test.ts
git commit -m "feat(sdk): claim and refund pre-checks that mirror the contract's asserts"
```

---

### Task 4: Chain wrappers, headless wallet and the devnet suite (S1, S2, S3, H5)

**Files:**
- Create:
  - `sdk/src/chain.ts`
  - `cli/package.json`, `cli/tsconfig.json`, `cli/vitest.config.ts`
  - `cli/src/wallet.ts`, `cli/src/providers.ts`
  - `cli/test/harness.ts`, `cli/test/devnet.test.ts`
- Modify: `sdk/src/index.ts`, root `package.json` (workspaces)

**Interfaces:**
- Consumes:
  - Tasks 2–3
  - Plan 1's `deriveEnvelope`, `linksFor`, `newVault`, `addEnvelope`, `privateStateOf`, `PersonalLink`
  - `Contract`, `ledger`, `witnesses`, `emptyPrivateState` from `@lixi/contract`
- Produces:
  - `LixiCircuit`, `LIXI_PRIVATE_STATE_ID = 'lixi'`, `LixiProviders`, `lixiContract`
  - `deployLixi(providers, { minDuration, maxDuration }): Promise<string>`
  - `relinquishAuthority(providers, address): Promise<void>`
  - `readLedger(publicDataProvider, address): Promise<Ledger>`
  - `createEnvelopeTx(providers, address, privateState, { nonce, expiry, refundAddress, onePerAddress }): Promise<{ id; txId }>`
  - `ClaimTxArgs = { id; share; path; recipient }`
  - `claimTx(providers, address, ClaimTxArgs): Promise<string>`
  - `refundTx(providers, address, privateState, id): Promise<string>`
  - `HeadlessWallet` (`start`, `userAddress`, `bech32Address`, `nightBalance`, `balanceTx`, `submitTx`, `sendNight`, `registerForDust`, `waitFor`, `stop`)
  - `nodeProviders(config, wallet): LixiProviders`, `ZK_CONFIG_PATH`

- [ ] **Step 1: Create the CLI workspace**

Add `"cli"` to the root `workspaces` array, after `"sdk"`.

`cli/package.json`:
```json
{
  "name": "@lixi/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "scripts": {
    "keys": "npm run compact -w @lixi/contract",
    "pretest:devnet": "npm run keys",
    "test:devnet": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@lixi/contract": "0.1.0",
    "@lixi/sdk": "0.1.0"
  }
}
```

`cli/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "compilerOptions": { "types": ["node"] }, "include": ["src", "test"] }
```

`cli/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

// Devnet tests share one chain and one funded genesis wallet, so they run one file at a time.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 15 * 60_000,
    hookTimeout: 15 * 60_000,
    fileParallelism: false,
    disableConsoleIntercept: true,
  },
});
```

Install:
```bash
npm i -w @lixi/cli --save-exact @midnight-ntwrk/wallet-sdk@1.2.0 @midnight-ntwrk/midnight-js-indexer-public-data-provider@4.1.1 \
  @midnight-ntwrk/midnight-js-http-client-proof-provider@4.1.1 @midnight-ntwrk/midnight-js-node-zk-config-provider@4.1.1 \
  ws@8.21.3 rxjs@7.8.2
npm i -w @lixi/cli -D --save-exact @types/node@24.19.0 @types/ws@8.18.1 tsx@4.23.1 typescript@5.9.3 vitest@4.1.11
npm dedupe && npm ls @midnight-ntwrk/onchain-runtime-v3 | grep -c invalid
```
Expected: the last command prints `0`.

- [ ] **Step 2: Write the failing devnet suite and its harness**

`cli/test/harness.ts`:
```typescript
import { nativeToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { LixiProviders, NetworkConfig } from '@lixi/sdk';
import { HeadlessWallet } from '../src/wallet.js';

/** The devnet genesis wallet, pre-funded with NIGHT and registered for DUST. */
export const GENESIS_SEED = '0'.repeat(63) + '1';

export const randomSeed = (): string => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries a submission the node rejected, after a block, because a wallet that just paid a fee can
 * briefly select a DUST coin the chain already spent.
 */
export const retrySubmission = async <T>(submit: () => Promise<T>, attempts = 3): Promise<T> => {
  for (let i = 1; ; i++) {
    try {
      return await submit();
    } catch (error) {
      if (i >= attempts || !String(error).includes('SubmissionError')) throw error;
      console.warn(`submission rejected (attempt ${i}), retrying after a block`);
      await sleep(7_000);
    }
  }
};

/** Starts a fresh wallet funded by `funder`; with `dust`, it also registers the NIGHT so it can pay fees. */
export const fundedWallet = async (
  config: NetworkConfig,
  funder: HeadlessWallet,
  night: bigint,
  dust: boolean,
): Promise<HeadlessWallet> => {
  const wallet = await HeadlessWallet.start(config, randomSeed());
  await retrySubmission(() => funder.sendNight(wallet, night));
  await wallet.waitFor((s) => s.unshielded.availableCoins.length > 0, 120_000, 'NIGHT');
  if (dust) await wallet.registerForDust();
  return wallet;
};

/** Waits until the wallet's unshielded NIGHT balance is exactly `expected`. */
export const waitForNight = (wallet: HeadlessWallet, expected: bigint) =>
  wallet.waitFor((s) => (s.unshielded.balances[nativeToken().raw] ?? 0n) === expected, 120_000, `NIGHT = ${expected}`);

/** Proving times per label, for spike S2. */
export const proofTimes: Array<{ label: string; seconds: number }> = [];

export const timeProofs = (providers: LixiProviders, label: string): LixiProviders => ({
  ...providers,
  proofProvider: {
    proveTx: async (tx, cfg) => {
      const start = performance.now();
      const proven = await providers.proofProvider.proveTx(tx, cfg);
      proofTimes.push({ label, seconds: (performance.now() - start) / 1000 });
      return proven;
    },
  },
});
```

`cli/test/devnet.test.ts`:
```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { submitRemoveVerifierKeyTx } from '@midnight-ntwrk/midnight-js-contracts';
import {
  NETWORKS,
  addEnvelope,
  checkClaim,
  checkRefund,
  claimTx,
  createEnvelopeTx,
  deployLixi,
  deriveEnvelope,
  linksFor,
  lixiContract,
  newVault,
  privateStateOf,
  readLedger,
  refundTx,
  relinquishAuthority,
  type LixiProviders,
  type PersonalLink,
} from '@lixi/sdk';
import { nodeProviders } from '../src/providers.js';
import { HeadlessWallet } from '../src/wallet.js';
import {
  GENESIS_SEED,
  fundedWallet,
  randomSeed,
  nowSeconds,
  proofTimes,
  sleep,
  timeProofs,
  waitForNight,
} from './harness.js';

const config = NETWORKS.undeployed;
const NIGHT = 1_000_000n; // 1 tNIGHT in base units

describe.sequential('Lixi on the local devnet', () => {
  let sender: HeadlessWallet, alice: HeadlessWallet, bob: HeadlessWallet, carol: HeadlessWallet;
  let ps: LixiProviders;
  let address: string;
  let vault = newVault();
  const spec = { index: 0, total: 4n * NIGHT, count: 4, kind: 'personal', split: 'equal' } as const;
  const envelope = deriveEnvelope(vault.seed, spec);
  const links = linksFor(envelope) as PersonalLink[];
  let expiry: bigint;
  let senderNightBeforeCreate: bigint;

  beforeAll(async () => {
    setNetworkId('undeployed');
    sender = await HeadlessWallet.start(config, GENESIS_SEED);
    await sender.registerForDust();
    alice = await fundedWallet(config, sender, 10n * NIGHT, true);
    bob = await fundedWallet(config, sender, 10n * NIGHT, true);
    carol = await HeadlessWallet.start(config, randomSeed());
    ps = timeProofs(nodeProviders(config, sender), 'sender');
  });

  afterAll(async () => {
    console.table(proofTimes.map((p) => ({ ...p, seconds: p.seconds.toFixed(2) })));
    await Promise.all([sender, alice, bob, carol].filter(Boolean).map((w) => w.stop()));
  });

  it('deploys, then relinquishes the maintenance authority for good (H5)', async () => {
    address = await deployLixi(ps, { minDuration: 60n, maxDuration: 30n * 86400n });
    const oldKey = (await ps.privateStateProvider.getSigningKey(address))!;
    await relinquishAuthority(ps, address);

    const state = (await ps.publicDataProvider.queryContractState(address))!;
    expect(state.maintenanceAuthority.committee).toHaveLength(0);
    expect(state.maintenanceAuthority.threshold).toBe(1);
    await ps.privateStateProvider.setSigningKey(address, oldKey);
    await expect(submitRemoveVerifierKeyTx(ps, lixiContract, address, 'claim')).rejects.toThrow();
  });

  it('creates an envelope whose public state shows the deposit but not the split', async () => {
    expiry = BigInt(nowSeconds() + 240);
    vault = addEnvelope(vault, { ...spec, expiry, labels: [] });
    senderNightBeforeCreate = await sender.nightBalance();
    const { id } = await createEnvelopeTx(ps, address, privateStateOf(vault), {
      nonce: envelope.nonce,
      expiry,
      refundAddress: await sender.userAddress(),
      onePerAddress: false,
    });
    expect(id).toEqual(envelope.id);
    const onChain = (await readLedger(ps.publicDataProvider, address)).envelopes.lookup(id);
    expect(Object.keys(onChain).sort()).toEqual([
      'deposit',
      'expiry',
      'onePerAddress',
      'refundAddress',
      'refunded',
      'root',
    ]);
    expect(onChain.deposit).toBe(spec.total);
  });

  it('pays two concurrent claims from different wallets (S1)', async () => {
    const [aBefore, bBefore] = [await alice.nightBalance(), await bob.nightBalance()];
    const claimFor = async (wallet: HeadlessWallet, link: PersonalLink, label: string) =>
      claimTx(timeProofs(nodeProviders(config, wallet), label), address, {
        id: link.id,
        share: link.share,
        path: link.path,
        recipient: await wallet.userAddress(),
      });
    await Promise.all([claimFor(alice, links[0], 'alice'), claimFor(bob, links[1], 'bob')]);
    await waitForNight(alice, aBefore + NIGHT);
    await waitForNight(bob, bBefore + NIGHT);
  });

  it('refuses a reused link before any proof is made', async () => {
    const ledger = await readLedger(ps.publicDataProvider, address);
    expect(checkClaim(ledger, links[0], await carol.userAddress(), nowSeconds())).toEqual({
      ok: false,
      reason: 'already claimed',
    });
  });

  it('refunds exactly the unclaimed remainder after expiry', async () => {
    const early = await readLedger(ps.publicDataProvider, address);
    expect(checkRefund(early, envelope.id, nowSeconds())).toEqual({ ok: false, reason: 'not expired' });
    while (nowSeconds() < Number(expiry) + 12) await sleep(5_000);

    await refundTx(ps, address, privateStateOf(vault), envelope.id);
    const ledger = await readLedger(ps.publicDataProvider, address);
    expect(ledger.envelopes.lookup(envelope.id).refunded).toBe(true);
    // Deposit 4, two claims paid out 2, so the refund returns the 2 unclaimed shares.
    await waitForNight(sender, senderNightBeforeCreate - 2n * NIGHT);
  });
});
```

Notes for the reviewer:
- `carol` only supplies a recipient address here. Task 5 makes her a zero-DUST claimant.
- The refund assertion is exact because DUST, not NIGHT, pays every fee.

- [ ] **Step 3: Run it to see it fail**

Run: `npm run typecheck -w @lixi/cli`
Expected: FAIL. TypeScript reports that `../src/wallet.js` and `../src/providers.js` cannot be found, and that `@lixi/sdk` has no exported member `deployLixi`.

- [ ] **Step 4: Implement the SDK chain layer**

`sdk/src/chain.ts`:
```typescript
import {
  Contract,
  emptyPrivateState,
  ledger,
  witnesses,
  type Ledger,
  type LixiPrivateState,
  type PathEntry,
  type Share,
} from '@lixi/contract';
import { deployContract, submitCallTx, submitTx } from '@midnight-ntwrk/midnight-js-contracts';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import {
  ContractMaintenanceAuthority,
  Intent,
  MaintenanceUpdate,
  ReplaceAuthority,
  Transaction,
  signData,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { SucceedEntirely, type MidnightProviders, type PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';

export type LixiCircuit = 'createEnvelope' | 'claim' | 'refund';
export const LIXI_PRIVATE_STATE_ID = 'lixi';
export type LixiProviders = MidnightProviders<LixiCircuit, typeof LIXI_PRIVATE_STATE_ID, LixiPrivateState>;

export const lixiContract = CompiledContract.make<Contract<LixiPrivateState>>('lixi', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('./managed/lixi'),
);

export type DeployParams = { readonly minDuration: bigint; readonly maxDuration: bigint };

/** Deploys a fresh Lixi contract and returns its address. */
export const deployLixi = async (providers: LixiProviders, params: DeployParams): Promise<string> => {
  const deployed = await deployContract(providers, {
    compiledContract: lixiContract,
    privateStateId: LIXI_PRIVATE_STATE_ID,
    initialPrivateState: emptyPrivateState(),
    args: [params.minDuration, params.maxDuration],
  });
  return deployed.deployTxData.public.contractAddress;
};

/**
 * Replaces the maintenance authority with an empty committee (threshold 1), which no
 * signature set can satisfy, so the circuits can never change again (audit H5).
 */
export const relinquishAuthority = async (providers: LixiProviders, address: string): Promise<void> => {
  const state = await providers.publicDataProvider.queryContractState(address);
  if (!state) throw new Error('contract not found');
  const key = await providers.privateStateProvider.getSigningKey(address);
  if (!key) throw new Error('no maintenance key for this contract');
  const counter = state.maintenanceAuthority.counter;
  const update = new MaintenanceUpdate(
    address,
    [new ReplaceAuthority(new ContractMaintenanceAuthority([], 1, counter + 1n))],
    counter,
  );
  const signed = update.addSignature(0n, signData(key, update.dataToSign));
  const unprovenTx = Transaction.fromParts(
    getNetworkId(),
    undefined,
    undefined,
    Intent.new(ttlOneHour()).addMaintenanceUpdate(signed),
  );
  const result = await submitTx(providers, { unprovenTx });
  if (result.status !== SucceedEntirely) throw new Error(`relinquish failed: ${result.status}`);
  await providers.privateStateProvider.removeSigningKey(address);
};

/** Public ledger state of the contract, read through the indexer. */
export const readLedger = async (publicData: PublicDataProvider, address: string): Promise<Ledger> => {
  const state = await publicData.queryContractState(address);
  if (!state) throw new Error('contract not found');
  return ledger(state.data);
};

/** Private state goes in right before each call; the vault, not this provider, is the source of truth. */
const callOptions = async (
  providers: LixiProviders,
  address: string,
  privateState: LixiPrivateState,
): Promise<{ compiledContract: typeof lixiContract; contractAddress: string; privateStateId: 'lixi' }> => {
  providers.privateStateProvider.setContractAddress(address);
  await providers.privateStateProvider.set(LIXI_PRIVATE_STATE_ID, privateState);
  return { compiledContract: lixiContract, contractAddress: address, privateStateId: LIXI_PRIVATE_STATE_ID };
};

export type CreateArgs = {
  readonly nonce: Uint8Array;
  readonly expiry: bigint;
  readonly refundAddress: Uint8Array;
  readonly onePerAddress: boolean;
};

/** Proves and submits `createEnvelope`. `privateState` must hold this envelope's 16 shares. */
export const createEnvelopeTx = async (
  providers: LixiProviders,
  address: string,
  privateState: LixiPrivateState,
  args: CreateArgs,
): Promise<{ id: Uint8Array; txId: string }> => {
  const tx = await submitCallTx(providers, {
    ...(await callOptions(providers, address, privateState)),
    circuitId: 'createEnvelope',
    args: [args.nonce, args.expiry, { bytes: args.refundAddress }, args.onePerAddress],
  });
  return { id: tx.private.result, txId: tx.public.txId };
};

export type ClaimTxArgs = {
  readonly id: Uint8Array;
  readonly share: Share;
  readonly path: PathEntry[];
  /** Unshielded user address bytes (see `userAddressBytes`). */
  readonly recipient: Uint8Array;
};

/** Proves and submits `claim`, paying the share to `recipient`. */
export const claimTx = async (providers: LixiProviders, address: string, args: ClaimTxArgs): Promise<string> => {
  const tx = await submitCallTx(providers, {
    ...(await callOptions(providers, address, emptyPrivateState())),
    circuitId: 'claim',
    args: [args.id, args.share, args.path, { bytes: args.recipient }],
  });
  return tx.public.txId;
};

/** Proves and submits `refund`. `privateState` must hold this envelope's 16 shares. */
export const refundTx = async (
  providers: LixiProviders,
  address: string,
  privateState: LixiPrivateState,
  id: Uint8Array,
): Promise<string> => {
  const tx = await submitCallTx(providers, {
    ...(await callOptions(providers, address, privateState)),
    circuitId: 'refund',
    args: [id],
  });
  return tx.public.txId;
};
```

Append to `sdk/src/index.ts`:
```typescript
export * from './chain.js';
```

Why the relinquish is hand-built:
- midnight-js's `replaceAuthority` only accepts a new signing key, which would leave a single-key authority in place.
- The empty committee is the ledger's own "no authority" value. The Step 6 test proves it: after the relinquish, the old key can no longer remove a verifier key.

- [ ] **Step 5: Implement the headless wallet and the Node providers**

`cli/src/wallet.ts`:
```typescript
import { Buffer } from 'node:buffer';
import {
  DustSecretKey,
  LedgerParameters,
  ZswapSecretKeys,
  nativeToken,
  type FinalizedTransaction,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { MidnightProvider, UnboundTransaction, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import {
  DustWallet,
  HDWallet,
  NoOpTransactionHistoryStorage,
  PublicKey,
  Roles,
  ShieldedWallet,
  UnshieldedWallet,
  WalletFacade,
  createKeystore,
  type FacadeState,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk';
import type { NetworkConfig } from '@lixi/sdk';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';

// The wallet SDK's indexer client needs a global WebSocket in Node.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

/** A headless wallet for scripts and tests. Never log `seed`. */
export class HeadlessWallet implements WalletProvider, MidnightProvider {
  private constructor(
    readonly facade: WalletFacade,
    private readonly shieldedSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
    readonly keystore: UnshieldedKeystore,
  ) {}

  static async start(config: NetworkConfig, seedHex: string): Promise<HeadlessWallet> {
    const hd = HDWallet.fromSeed(Buffer.from(seedHex, 'hex'));
    if (hd.type !== 'seedOk') throw new Error('invalid wallet seed');
    const derived = hd.hdWallet
      .selectAccount(0)
      .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
      .deriveKeysAt(0);
    if (derived.type !== 'keysDerived') throw new Error('key derivation failed');
    hd.hdWallet.clear();
    const keys = derived.keys;

    const shieldedSecretKeys = ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
    const dustSecretKey = DustSecretKey.fromSeed(keys[Roles.Dust]);
    const keystore = createKeystore(keys[Roles.NightExternal], config.networkId);
    const indexerClientConnection = { indexerHttpUrl: config.indexer, indexerWsUrl: config.indexerWS };
    const facade = await WalletFacade.init({
      configuration: {
        networkId: config.networkId,
        indexerClientConnection,
        provingServerUrl: new URL(config.proofServer),
        relayURL: new URL(config.node.replace(/^http/, 'ws')),
        txHistoryStorage: new NoOpTransactionHistoryStorage(),
        costParameters: { additionalFeeOverhead: 1_000n, feeBlocksMargin: 5 },
      },
      shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
      unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(keystore)),
      dust: (cfg) => DustWallet(cfg).startWithSecretKey(dustSecretKey, LedgerParameters.initialParameters().dust),
    });
    await facade.start(shieldedSecretKeys, dustSecretKey);
    return new HeadlessWallet(facade, shieldedSecretKeys, dustSecretKey, keystore);
  }

  /** Unshielded address as the 32 bytes the contract's `UserAddress` expects. */
  async userAddress(): Promise<Uint8Array> {
    return new Uint8Array((await this.facade.unshielded.getAddress()).data);
  }

  bech32Address(): string {
    return this.keystore.getBech32Address().asString();
  }

  async nightBalance(): Promise<bigint> {
    const state = await this.facade.waitForSyncedState();
    return state.unshielded.balances[nativeToken().raw] ?? 0n;
  }

  getCoinPublicKey() {
    return this.shieldedSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey() {
    return this.shieldedSecretKeys.encryptionPublicKey;
  }

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.facade.balanceUnboundTransaction(tx, this.secretKeys(), { ttl });
    const signed = await this.facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    return this.facade.finalizeRecipe(signed);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.facade.submitTransaction(tx);
  }

  /** Sends unshielded NIGHT to another wallet and returns the transaction id. */
  async sendNight(to: HeadlessWallet, amount: bigint): Promise<string> {
    const recipe = await this.facade.transferTransaction(
      [
        {
          type: 'unshielded',
          outputs: [{ type: nativeToken().raw, receiverAddress: await to.facade.unshielded.getAddress(), amount }],
        },
      ],
      this.secretKeys(),
      { ttl: ttlOneHour() },
    );
    const signed = await this.facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    return this.facade.submitTransaction(await this.facade.finalizeRecipe(signed));
  }

  /** Registers every unregistered NIGHT UTXO for DUST generation, then waits for a spendable DUST coin. */
  async registerForDust(timeoutMs = 180_000): Promise<void> {
    const state = await this.facade.waitForSyncedState();
    const unregistered = state.unshielded.availableCoins.filter((c) => !c.meta.registeredForDustGeneration);
    if (unregistered.length > 0) {
      const recipe = await this.facade.registerNightUtxosForDustGeneration(
        unregistered,
        this.keystore.getPublicKey(),
        (payload) => this.keystore.signData(payload),
      );
      await this.facade.submitTransaction(await this.facade.finalizeRecipe(recipe));
    }
    await this.waitFor((s) => s.dust.availableCoins.length > 0, timeoutMs, 'spendable DUST');
  }

  /** Resolves once the wallet state satisfies `predicate`. */
  waitFor(predicate: (s: FacadeState) => boolean, timeoutMs: number, label: string): Promise<FacadeState> {
    return Rx.firstValueFrom(
      this.facade.state().pipe(
        Rx.filter(predicate),
        Rx.timeout({
          first: timeoutMs,
          with: () => Rx.throwError(() => new Error(`timed out waiting for ${label}`)),
        }),
      ),
    );
  }

  stop(): Promise<void> {
    return this.facade.stop();
  }

  private secretKeys() {
    return { shieldedSecretKeys: this.shieldedSecretKeys, dustSecretKey: this.dustSecretKey };
  }
}
```

`cli/src/providers.ts`:
```typescript
import { fileURLToPath } from 'node:url';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { memoryPrivateStateProvider, type LixiCircuit, type LixiProviders, type NetworkConfig } from '@lixi/sdk';
import type { HeadlessWallet } from './wallet.js';

/** Compiled contract output with proving keys (`npm run compact`). */
export const ZK_CONFIG_PATH = fileURLToPath(new URL('../../contract/src/managed/lixi', import.meta.url));

/** Node providers for one wallet, proving on the local proof server. */
export const nodeProviders = (config: NetworkConfig, wallet: HeadlessWallet): LixiProviders => {
  const zkConfigProvider = new NodeZkConfigProvider<LixiCircuit>(ZK_CONFIG_PATH);
  return {
    privateStateProvider: memoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: wallet,
    midnightProvider: wallet,
  };
};
```

- [ ] **Step 6: Run the devnet suite to see it pass**

With the devnet from Task 1 running:
```bash
npm run typecheck && npm run lint && npm run format:check
npm run test:devnet -w @lixi/cli
```
Expected:
- The `pretest:devnet` script recompiles the proving keys.
- 5 tests pass in about 6–7 minutes. A `submission rejected (attempt 1), retrying after a block` warning may appear; it is expected.
- The final table lists proving times: `sender` ≈ 0.9–1.9 s for create and refund, and `alice`/`bob` ≈ 0.2–2.5 s for claims. Deploy and relinquish show `0.00`, because their transactions carry no circuit proof.

If a test fails with `expected instance of StateValue`, the on-chain runtime is duplicated: go back to Task 1, Step 2.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json sdk/src/chain.ts sdk/src/index.ts cli
git commit -m "feat(cli): headless wallet, Node providers and devnet E2E; feat(sdk): midnight-js wrappers with authority relinquish"
```

---

### Task 5: Fee sponsorship for recipients without DUST (S5)

**Files:**
- Modify: `sdk/src/chain.ts`, `cli/src/wallet.ts`, `cli/test/devnet.test.ts`

**Interfaces:**
- Consumes: Task 4.
- Produces:
  - `proveClaimTx(providers, address, ClaimTxArgs): Promise<UnboundTransaction>`: builds and proves only.
  - `HeadlessWallet.balanceWithoutFees(tx: UnboundTransaction): Promise<FinalizedTransaction>`: the recipient side; balances shielded and unshielded value, never DUST.
  - `HeadlessWallet.addDustFee(tx: FinalizedTransaction): Promise<FinalizedTransaction>`
  - `HeadlessWallet.sponsor(boundTxHex: string): Promise<string>`: the sponsor side; deserializes, pays DUST, submits and returns the tx id.

- [ ] **Step 1: Write the failing test**

In `cli/test/devnet.test.ts`:
- Add two imports:
  ```typescript
  import { toHex } from '@midnight-ntwrk/midnight-js-utils';
  import { pureCircuits } from '@lixi/contract';
  ```
- Add `proveClaimTx,` to the `@lixi/sdk` import list, after `privateStateOf,`.
- Insert this test **before** `it('refunds exactly the unclaimed remainder after expiry'`, indented like its neighbours:
  ```typescript
  it('lets a sponsor pay the fee for a recipient with no NIGHT and no DUST (S5)', async () => {
    const pc = timeProofs(nodeProviders(config, carol), 'carol');
    const recipient = await carol.userAddress();
    expect((await carol.facade.waitForSyncedState()).dust.balance(new Date())).toBe(0n);

    const proven = await proveClaimTx(pc, address, { ...links[2], recipient });
    const bound = await carol.balanceWithoutFees(proven); // recipient side: no DUST touched
    const txId = await sender.sponsor(toHex(bound.serialize())); // sponsor side, across a hex boundary
    await ps.publicDataProvider.watchForTxData(txId);
    await waitForNight(carol, NIGHT);
    const ledger = await readLedger(ps.publicDataProvider, address);
    expect(ledger.nullifiers.member(pureCircuits.nullifierOf(envelope.id, links[2].share.secret))).toBe(true);
  });
  ```
- In the refund test, three shares are now claimed. Replace its last two lines with:
  ```typescript
    // Deposit 4, three claims paid out 3, so the refund returns the 1 unclaimed share.
    await waitForNight(sender, senderNightBeforeCreate - 3n * NIGHT);
  ```

- [ ] **Step 2: Run it to see it fail**

Run: `npm run typecheck -w @lixi/cli`
Expected: FAIL. `@lixi/sdk` has no exported member `proveClaimTx`, and `HeadlessWallet` has no `balanceWithoutFees` and no `sponsor`.

- [ ] **Step 3: Implement**

In `sdk/src/chain.ts`, change the contracts import to:
```typescript
import { createUnprovenCallTx, deployContract, submitCallTx, submitTx } from '@midnight-ntwrk/midnight-js-contracts';
```
and append:
```typescript
/**
 * Builds and proves a `claim` without balancing or submitting it. A wallet with no DUST can
 * then balance its own side and hand the bound transaction to a fee sponsor.
 */
export const proveClaimTx = async (providers: LixiProviders, address: string, args: ClaimTxArgs) => {
  const unproven = await createUnprovenCallTx(providers, {
    ...(await callOptions(providers, address, emptyPrivateState())),
    circuitId: 'claim',
    args: [args.id, args.share, args.path, { bytes: args.recipient }],
  });
  return providers.proofProvider.proveTx(unproven.private.unprovenTx);
};
```

In `cli/src/wallet.ts`, change two imports:
- The ledger import gains `Transaction`, `type Binding`, `type Proof` and `type SignatureEnabled`:
  ```typescript
  import {
    DustSecretKey,
    LedgerParameters,
    Transaction,
    type Binding,
    type Proof,
    type SignatureEnabled,
    ZswapSecretKeys,
    nativeToken,
    type FinalizedTransaction,
  } from '@midnight-ntwrk/midnight-js-protocol/ledger';
  ```
- The utils import becomes `import { fromHex, ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';`.

Then insert these methods right before `/** Sends unshielded NIGHT`:
```typescript
  /** Fee sponsorship, user side: balance only shielded/unshielded value (no DUST), sign and bind. */
  async balanceWithoutFees(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.facade.balanceUnboundTransaction(tx, this.secretKeys(), {
      ttl,
      tokenKindsToBalance: ['shielded', 'unshielded'],
    });
    const signed = await this.facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    return this.facade.finalizeRecipe(signed);
  }

  /** Fee sponsorship, sponsor side: add a DUST fee offer to someone else's bound transaction. */
  async addDustFee(tx: FinalizedTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.facade.balanceFinalizedTransaction(tx, this.secretKeys(), {
      ttl,
      tokenKindsToBalance: ['dust'],
    });
    const signed = await this.facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    return this.facade.finalizeRecipe(signed);
  }

  /**
   * Fee sponsorship, sponsor side, across the network boundary: takes the hex of a transaction
   * the recipient already proved, balanced and bound, pays its DUST fee and submits it.
   */
  async sponsor(boundTxHex: string): Promise<string> {
    const tx: FinalizedTransaction = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
      'signature',
      'proof',
      'binding',
      fromHex(boundTxHex.trim()),
    );
    return this.submitTx(await this.addDustFee(tx));
  }

```

The pattern follows `midnightntwrk/example-private-party`:
- The recipient proves, balances and binds the transaction first.
- The sponsor can only add a DUST fee offer to it; it cannot change who gets paid, because the recipient address is inside the proof.

- [ ] **Step 4: Run it to see it pass**

Run: `npm run typecheck && npm run lint && npm run test:devnet -w @lixi/cli`
Expected:
- 6 tests pass.
- Carol starts with 0 DUST and 0 NIGHT and ends with exactly 1 tNIGHT.
- The sender's NIGHT drops by exactly 3 tNIGHT, the three claimed shares.

- [ ] **Step 5: Commit**

```bash
git add sdk/src/chain.ts cli/src/wallet.ts cli/test/devnet.test.ts
git commit -m "feat: sponsored claims, so a recipient with no DUST can claim (spike S5)"
```

---

### Task 6: Deploy, smoke and sponsor scripts

**Files:**
- Create: `cli/src/deploy.ts`, `cli/src/smoke.ts`, `cli/src/sponsor.ts`
- Modify: `cli/package.json` (scripts)

**Interfaces:**
- Consumes: Tasks 4–5.
- Produces:
  - `npm run deploy -w @lixi/cli -- --network <undeployed|preprod>`: writes `deployments/<network>.json` with `{ network, contractAddress, minDuration, maxDuration, deployedAt }`.
  - `npm run smoke -w @lixi/cli -- --network <net>`
  - `npm run sponsor -w @lixi/cli -- --network <net> <file>`
  - All three read `LIXI_DEPLOYER_SEED` from the environment or `cli/.env`. `undeployed` defaults to the genesis seed.

- [ ] **Step 1: Add the scripts to `cli/package.json`**

Replace the `scripts` block with:
```json
  "scripts": {
    "keys": "npm run compact -w @lixi/contract",
    "predeploy": "npm run keys",
    "deploy": "tsx --env-file-if-exists=.env src/deploy.ts",
    "presmoke": "npm run keys",
    "smoke": "tsx --env-file-if-exists=.env src/smoke.ts",
    "sponsor": "tsx --env-file-if-exists=.env src/sponsor.ts",
    "pretest:devnet": "npm run keys",
    "test:devnet": "vitest run",
    "typecheck": "tsc --noEmit"
  },
```

- [ ] **Step 2: Write the scripts**

`cli/src/deploy.ts`:
```typescript
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NETWORKS, deployLixi, readLedger, relinquishAuthority, type NetworkName } from '@lixi/sdk';
import { nodeProviders } from './providers.js';
import { HeadlessWallet } from './wallet.js';

const DAY = 86400n;
/** Spec §3.4: minDuration 60 s on the devnet, 3600 s on Preprod; maxDuration 30 days. */
const DURATIONS: Record<NetworkName, { minDuration: bigint; maxDuration: bigint }> = {
  undeployed: { minDuration: 60n, maxDuration: 30n * DAY },
  preprod: { minDuration: 3600n, maxDuration: 30n * DAY },
};
const GENESIS_SEED = '0'.repeat(63) + '1';
const DEPLOYMENTS_DIR = fileURLToPath(new URL('../../deployments/', import.meta.url));

const { values } = parseArgs({ options: { network: { type: 'string', default: 'undeployed' } } });
const network = values.network as NetworkName;
if (!(network in NETWORKS)) throw new Error(`unknown network ${network}; use undeployed or preprod`);
const config = NETWORKS[network];

const seed = process.env.LIXI_DEPLOYER_SEED ?? (network === 'undeployed' ? GENESIS_SEED : undefined);
if (!seed || !/^[0-9a-f]{64}$/i.test(seed)) {
  throw new Error('set LIXI_DEPLOYER_SEED to 64 hex characters (generate one with: openssl rand -hex 32)');
}

setNetworkId(config.networkId);
const wallet = await HeadlessWallet.start(config, seed);
try {
  console.log(`deployer address: ${wallet.bech32Address()}`);
  console.log('syncing wallet (a fresh Preprod wallet can take several minutes)...');
  if ((await wallet.nightBalance()) === 0n) {
    throw new Error('the deployer has no tNIGHT: fund the address above from the faucet, then run again');
  }
  await wallet.registerForDust(30 * 60_000);

  const providers = nodeProviders(config, wallet);
  const params = DURATIONS[network];
  const contractAddress = await deployLixi(providers, params);
  console.log(`deployed: ${contractAddress}`);
  await relinquishAuthority(providers, contractAddress);
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!state || state.maintenanceAuthority.committee.length !== 0) throw new Error('authority was not relinquished');
  const ledger = await readLedger(providers.publicDataProvider, contractAddress);
  console.log(
    `maintenance authority relinquished; minDuration=${ledger.minDuration} maxDuration=${ledger.maxDuration}`,
  );

  const record = {
    network,
    contractAddress,
    minDuration: Number(params.minDuration),
    maxDuration: Number(params.maxDuration),
    deployedAt: new Date().toISOString(),
  };
  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  writeFileSync(`${DEPLOYMENTS_DIR}${network}.json`, JSON.stringify(record, null, 2) + '\n');
  console.log(`wrote deployments/${network}.json`);
} finally {
  await wallet.stop();
}
```

`cli/src/smoke.ts`:
```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  NETWORKS,
  addEnvelope,
  checkClaim,
  claimTx,
  createEnvelopeTx,
  deriveEnvelope,
  linksFor,
  newVault,
  privateStateOf,
  readLedger,
  type NetworkName,
  type PersonalLink,
} from '@lixi/sdk';
import { nodeProviders } from './providers.js';
import { HeadlessWallet } from './wallet.js';

/**
 * Smoke test against a deployed contract: create a two-share envelope, then claim both shares back
 * to the deployer. Proves the deployment end to end without a browser wallet.
 */
const { values } = parseArgs({ options: { network: { type: 'string', default: 'undeployed' } } });
const network = values.network as NetworkName;
const config = NETWORKS[network];
const { contractAddress } = JSON.parse(
  readFileSync(fileURLToPath(new URL(`../../deployments/${network}.json`, import.meta.url)), 'utf8'),
) as { contractAddress: string };
const seed = process.env.LIXI_DEPLOYER_SEED ?? (network === 'undeployed' ? '0'.repeat(63) + '1' : undefined);
if (!seed) throw new Error('set LIXI_DEPLOYER_SEED');

setNetworkId(config.networkId);
const wallet = await HeadlessWallet.start(config, seed);
try {
  const providers = nodeProviders(config, wallet);
  const me = await wallet.userAddress();
  const spec = { index: 0, total: 2_000_000n, count: 2, kind: 'personal', split: 'random' } as const;
  const minDuration = (await readLedger(providers.publicDataProvider, contractAddress)).minDuration;
  const expiry = BigInt(Math.floor(Date.now() / 1000)) + minDuration + 600n;
  const vault = addEnvelope(newVault(), { ...spec, expiry, labels: [] });
  const envelope = deriveEnvelope(vault.seed, spec);

  console.log('creating a 2-share envelope of 2 tNIGHT...');
  const created = await createEnvelopeTx(providers, contractAddress, privateStateOf(vault), {
    nonce: envelope.nonce,
    expiry,
    refundAddress: me,
    onePerAddress: false,
  });
  console.log(`create tx: ${created.txId}`);

  // Claim both shares back, so nothing stays locked in the envelope.
  for (const link of linksFor(envelope) as PersonalLink[]) {
    const ledger = await readLedger(providers.publicDataProvider, contractAddress);
    const check = checkClaim(ledger, link, me, Math.floor(Date.now() / 1000));
    if (!check.ok) throw new Error(`pre-check failed: ${check.reason}`);
    const claimId = await claimTx(providers, contractAddress, { ...link, recipient: me });
    console.log(`claim tx: ${claimId} (${check.amount} base units)`);
  }
  console.log(`envelope id: ${Buffer.from(envelope.id).toString('hex')}`);
} finally {
  await wallet.stop();
}
```

`cli/src/sponsor.ts`:
```typescript
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NETWORKS, type NetworkName } from '@lixi/sdk';
import { HeadlessWallet } from './wallet.js';

/**
 * Pays the DUST fee for a claim a recipient proved and bound in the browser (spike S5).
 * Usage: npm run sponsor -w @lixi/cli -- --network preprod <file with the transaction hex>
 */
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { network: { type: 'string', default: 'undeployed' } },
});
const network = values.network as NetworkName;
const config = NETWORKS[network];
const seed = process.env.LIXI_DEPLOYER_SEED ?? (network === 'undeployed' ? '0'.repeat(63) + '1' : undefined);
if (!seed) throw new Error('set LIXI_DEPLOYER_SEED');
if (positionals.length !== 1) throw new Error('pass the file that holds the transaction hex');

setNetworkId(config.networkId);
const sponsor = await HeadlessWallet.start(config, seed);
try {
  console.log(`sponsored tx: ${await sponsor.sponsor(readFileSync(positionals[0], 'utf8'))}`);
} finally {
  await sponsor.stop();
}
```

- [ ] **Step 3: Deploy and smoke-test on the devnet**

```bash
npm run typecheck && npm run lint && npm run format:check
npm run deploy -w @lixi/cli && cat deployments/undeployed.json
npm run smoke -w @lixi/cli
```
Expected:
- `deploy` prints the deployer address, `deployed: <64 hex>`, `maintenance authority relinquished; minDuration=60 maxDuration=2592000`, and `wrote deployments/undeployed.json`. The file holds that address.
- `smoke` prints one create tx and two claim txs, whose amounts add up to 2000000.

- [ ] **Step 4: The unfunded-deployer guard (Review Focus 4)**

Run: `LIXI_DEPLOYER_SEED=$(openssl rand -hex 32) npm run deploy -w @lixi/cli; git status --short deployments`
Expected:
- It prints a fresh `mn_addr_undeployed1…` address, then fails with `the deployer has no tNIGHT: fund the address above from the faucet, then run again`.
- `deployments/undeployed.json` is unchanged; `git status` shows nothing, because the file is gitignored and keeps the address from Step 3.

- [ ] **Step 5: Commit**

```bash
git add cli/package.json cli/src/deploy.ts cli/src/smoke.ts cli/src/sponsor.ts
git commit -m "feat(cli): deploy (with authority relinquish), smoke and sponsor scripts"
```

---

### Task 7: Deploy to Preprod (needs the user)

**Files:**
- Create: `deployments/preprod.json` (committed), `cli/.env` (gitignored, local only)

**Interfaces:**
- Consumes: Task 6.
- Produces: the Preprod contract address that Plan 3's app config reads from `deployments/preprod.json`.

- [ ] **Step 1: Create the deployer seed (user)**

The user runs this in their own terminal, so the seed never enters the session transcript:
```bash
printf 'LIXI_DEPLOYER_SEED=%s\n' "$(openssl rand -hex 32)" > cli/.env && chmod 600 cli/.env
```
Then check that the file is ignored: `git check-ignore cli/.env` prints `cli/.env`.

- [ ] **Step 2: Start only the proof server, then get the address**

```bash
docker compose -f devnet/compose.yml down
docker compose -f devnet/compose.yml up -d --wait proof-server
npm run deploy -w @lixi/cli -- --network preprod
```
Expected:
- It prints `deployer address: mn_addr_preprod1…`, syncs, and stops with "the deployer has no tNIGHT".
- The first sync of a fresh wallet walks Preprod's history and can take several minutes.

- [ ] **Step 3: Fund the deployer (user)**

The user pastes that address into https://midnight-tmnight-preprod.nethermind.dev/ (1,000 tNIGHT per request). Wait until the faucet confirms.

- [ ] **Step 4: Deploy and relinquish on Preprod**

Run: `npm run deploy -w @lixi/cli -- --network preprod`
Expected:
- It registers the NIGHT for DUST and waits for a spendable DUST coin; that can take minutes.
- It deploys, relinquishes, prints `minDuration=3600 maxDuration=2592000`, and writes `deployments/preprod.json`.
- Open `https://preprod.midnightexplorer.com/` and search the address: the deploy and maintenance transactions appear.

- [ ] **Step 5: Smoke-test on Preprod**

Run: `npm run smoke -w @lixi/cli -- --network preprod`
Expected: one create and two claim transaction ids, visible on the explorer.

- [ ] **Step 6: Commit the deployment record**

```bash
git add deployments/preprod.json
git commit -m "chore: deploy Lixi to Preprod with the maintenance authority relinquished"
```

---

### Task 8: Spike S4, claiming with a real browser wallet (needs the user)

**Files:**
- Create: `spikes/s4-wallet/package.json`, `spikes/s4-wallet/tsconfig.json`, `spikes/s4-wallet/vite.config.ts`, `spikes/s4-wallet/index.html`, `spikes/s4-wallet/src/polyfills.ts`, `spikes/s4-wallet/src/main.ts`
- Modify: root `package.json` (workspaces)

**Interfaces:**
- Consumes:
  - SDK `memoryPrivateStateProvider`, `proveClaimTx`, `readLedger`, `checkClaim`, `resolveClaim`, `parseClaimInput`, `userAddressBytes`
  - `deployments/preprod.json`
  - the `sponsor` script
- Produces: S4 answers for Plan 3:
  - Which wallet works end to end?
  - Does 1AM's `getProvingProvider` prove in-tab?
  - Does Lace balance `receiveUnshielded`/`sendUnshielded`?
  - Does `balanceUnsealedTransaction(tx, { payFees: false })` give a sponsorable transaction?

- [ ] **Step 1: Create the workspace**

Add `"spikes/s4-wallet"` to the root `workspaces` array.

`spikes/s4-wallet/package.json`:
```json
{
  "name": "@lixi/s4-wallet-spike",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@lixi/contract": "0.1.0",
    "@lixi/sdk": "0.1.0"
  }
}
```

```bash
npm i -w @lixi/s4-wallet-spike --save-exact @midnight-ntwrk/dapp-connector-api@4.0.1 \
  @midnight-ntwrk/midnight-js-fetch-zk-config-provider@4.1.1 @midnight-ntwrk/midnight-js-http-client-proof-provider@4.1.1 \
  @midnight-ntwrk/midnight-js-indexer-public-data-provider@4.1.1 buffer@6.0.3
npm i -w @lixi/s4-wallet-spike -D --save-exact vite@8.3.1 vite-plugin-wasm@3.6.0 typescript@5.9.3
npm dedupe && npm ls @midnight-ntwrk/onchain-runtime-v3 | grep -c invalid
```
Expected: `0`.

`spikes/s4-wallet/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["vite/client"] },
  "include": ["src", "vite.config.ts"]
}
```

`spikes/s4-wallet/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

// Serves the compiled contract (keys/ and zkir/) at the site root for FetchZkConfigProvider.
// Target esnext keeps top-level await native, which the ledger WASM bindings need.
export default defineConfig({
  publicDir: '../../contract/src/managed/lixi',
  plugins: [wasm()],
  build: { target: 'esnext' },
  optimizeDeps: { exclude: ['@midnight-ntwrk/onchain-runtime-v3'] },
});
```

`vite-plugin-top-level-await` is left out on purpose: with Vite 8 (rolldown) it fails with `Cannot find module 'rollup'`, and target `esnext` makes it unnecessary.

`spikes/s4-wallet/src/polyfills.ts`:
```typescript
// The wallet SDK address codec uses Node's Buffer; browsers need the `buffer` package.
import { Buffer } from 'buffer';

globalThis.Buffer ??= Buffer;
```
Without this polyfill, the claim fails in the browser with `ReferenceError: Buffer is not defined` (seen in verification).

`spikes/s4-wallet/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Lixi spike S4: browser wallet claim</title>
    <style>
      body {
        font:
          14px system-ui,
          sans-serif;
        max-width: 760px;
        margin: 2rem auto;
        padding: 0 16px;
      }
      input,
      textarea {
        width: 100%;
        box-sizing: border-box;
      }
      pre {
        background: #111;
        color: #9f9;
        padding: 12px;
        white-space: pre-wrap;
        min-height: 8rem;
      }
    </style>
  </head>
  <body>
    <h1>Spike S4: claim with a browser wallet</h1>
    <p>
      <select id="network">
        <option>preprod</option>
        <option>undeployed</option>
      </select>
      <button id="detect">Detect wallets</button>
      <select id="wallet"></select>
      <button id="connect">Connect</button>
    </p>
    <p>
      <label>Contract address <input id="contract" /></label>
    </p>
    <p>
      <label>Claim link <input id="link" /></label>
    </p>
    <p>
      Prover
      <select id="proving">
        <option value="wallet">wallet (getProvingProvider)</option>
        <option value="local">local proof server :6300</option>
      </select>
      Fees
      <select id="fees">
        <option value="wallet">wallet pays</option>
        <option value="sponsor">sponsor pays (payFees: false)</option>
      </select>
      <button id="claim">Claim</button>
    </p>
    <p>
      <label>Bound transaction for the sponsor <textarea id="txhex" rows="3" readonly></textarea></label>
    </p>
    <pre id="log"></pre>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`spikes/s4-wallet/src/main.ts`:
```typescript
// Spike S4: can a browser wallet prove, balance and submit a Lixi claim?
// Throwaway page. Plan 3 builds the real wallet bridge from what this shows.
import './polyfills.js';
import '@midnight-ntwrk/dapp-connector-api';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Transaction, type FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { createProofProvider, type UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  checkClaim,
  memoryPrivateStateProvider,
  parseClaimInput,
  proveClaimTx,
  readLedger,
  resolveClaim,
  userAddressBytes,
  type LixiCircuit,
  type LixiProviders,
} from '@lixi/sdk';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const log = (line: string) => {
  $('log').textContent += `${new Date().toISOString().slice(11, 19)} ${line}\n`;
};
const deserialize = (hex: string): FinalizedTransaction =>
  Transaction.deserialize('signature', 'proof', 'binding', fromHex(hex));

let api: ConnectedAPI | undefined;

const wallets = (): InitialAPI[] => Object.values(window.midnight ?? {});

$('detect').onclick = () => {
  const found = wallets();
  log(
    found.length ? found.map((w) => `found ${w.name} (${w.rdns}) api ${w.apiVersion}`).join('\n') : 'no wallet found',
  );
  $<HTMLSelectElement>('wallet').innerHTML = found.map((w, i) => `<option value="${i}">${w.name}</option>`).join('');
};

$('connect').onclick = async () => {
  const network = $<HTMLSelectElement>('network').value;
  setNetworkId(network);
  api = await wallets()[Number($<HTMLSelectElement>('wallet').value)].connect(network);
  const config = await api.getConfiguration();
  log(`connected: indexer ${config.indexerUri}, prover ${config.proverServerUri ?? '(none)'}`);
  log(`unshielded ${(await api.getUnshieldedAddress()).unshieldedAddress}`);
  const dust = await api.getDustBalance();
  log(`DUST balance ${dust.balance} / cap ${dust.cap}`);
  log(`getProvingProvider: ${typeof api.getProvingProvider}`);
};

$('claim').onclick = async () => {
  if (!api) return log('connect first');
  const network = $<HTMLSelectElement>('network').value;
  const proving = $<HTMLSelectElement>('proving').value;
  const payFees = $<HTMLSelectElement>('fees').value === 'wallet';
  const address = $<HTMLInputElement>('contract').value.trim();
  const config = await api.getConfiguration();
  const zk = new FetchZkConfigProvider<LixiCircuit>(window.location.origin, fetch.bind(window));
  const connected = api;
  const shielded = await connected.getShieldedAddresses();
  const providers: LixiProviders = {
    privateStateProvider: memoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(
      config.indexerUri,
      config.indexerWsUri,
      // The provider is typed against the `ws` package; the browser's WebSocket is what it needs here.
      WebSocket as unknown as Parameters<typeof indexerPublicDataProvider>[2],
    ),
    zkConfigProvider: zk,
    proofProvider:
      proving === 'wallet'
        ? createProofProvider(await connected.getProvingProvider(zk))
        : httpClientProofProvider('http://127.0.0.1:6300', zk),
    walletProvider: {
      getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction) =>
        deserialize((await connected.balanceUnsealedTransaction(toHex(tx.serialize()), { payFees })).tx),
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction) => {
        await connected.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };

  const recipient = userAddressBytes((await api.getUnshieldedAddress()).unshieldedAddress, network);
  const ledger = await readLedger(providers.publicDataProvider, address);
  const args = resolveClaim(parseClaimInput($<HTMLInputElement>('link').value), (nf) => ledger.nullifiers.member(nf));
  const check = checkClaim(ledger, args, recipient, Math.floor(Date.now() / 1000));
  log(`pre-check: ${JSON.stringify(check, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`);
  if (!check.ok) return;

  let t = performance.now();
  const proven = await proveClaimTx(providers, address, { ...args, recipient });
  log(`proved with ${proving} prover in ${((performance.now() - t) / 1000).toFixed(1)}s`);
  t = performance.now();
  const balanced = await providers.walletProvider.balanceTx(proven);
  log(`wallet balanced (payFees=${payFees}) in ${((performance.now() - t) / 1000).toFixed(1)}s`);
  if (!payFees) {
    $<HTMLTextAreaElement>('txhex').value = toHex(balanced.serialize());
    return log('copy the hex into a file and run: npm run sponsor -w @lixi/cli -- --network <net> <file>');
  }
  log(`submitted: ${await providers.midnightProvider.submitTx(balanced)}`);
};

window.addEventListener('error', (e) => log(`error: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => log(`error: ${String(e.reason)}`));
```

- [ ] **Step 2: Build it**

Run: `npm run typecheck && npm run lint && npm run compact && npm run build -w @lixi/s4-wallet-spike`. Keep this order: `typecheck` recompiles with `--skip-zk`, which deletes the keys that the build copies.
Expected:
- `✓ built`. Two warnings are harmless and expected: a chunk-size warning, and `IMPORT_IS_UNDEFINED … isomorphic-ws` (the page passes the browser `WebSocket` explicitly).
- `spikes/s4-wallet/dist/keys/claim.prover` exists.

- [ ] **Step 3: Get claim links for the spike**

Claim links are secrets, so they never appear in a transcript or log. The user creates them on Preprod with a throwaway script run in their own terminal:
```bash
cat > /tmp/lixi-links.ts <<'EOF'
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NETWORKS, addEnvelope, claimUrl, createEnvelopeTx, deriveEnvelope, linksFor, newVault, privateStateOf } from '@lixi/sdk';
import { nodeProviders } from './src/providers.js';
import { HeadlessWallet } from './src/wallet.js';
import dep from '../deployments/preprod.json' with { type: 'json' };
setNetworkId('preprod');
const w = await HeadlessWallet.start(NETWORKS.preprod, process.env.LIXI_DEPLOYER_SEED!);
const spec = { index: 0, total: 4_000_000n, count: 4, kind: 'personal', split: 'equal' } as const;
const expiry = BigInt(Math.floor(Date.now() / 1000) + 2 * 86400);
const vault = addEnvelope(newVault(), { ...spec, expiry, labels: [] });
const d = deriveEnvelope(vault.seed, spec);
await createEnvelopeTx(nodeProviders(NETWORKS.preprod, w), dep.contractAddress, privateStateOf(vault), {
  nonce: d.nonce, expiry, refundAddress: await w.userAddress(), onePerAddress: false });
for (const l of linksFor(d)) console.log(claimUrl('http://localhost:5173', l));
await w.stop();
EOF
cp /tmp/lixi-links.ts cli/links.local.ts && (cd cli && npx tsx --env-file=.env links.local.ts); rm cli/links.local.ts
```
This prints four claim URLs (4 × 1 tNIGHT, expiring in two days). The 4 tNIGHT left unclaimed after the spike stays locked, because the throwaway vault is not saved. That is acceptable on a testnet.

- [ ] **Step 4: Run the spike with each wallet (user)**

Start the page with `npm run dev -w @lixi/s4-wallet-spike` and open http://localhost:5173. Keep the proof server from Task 7 running. Paste `deployments/preprod.json`'s address into **Contract address**.

| Run | Wallet | Prover | Fees | Link |
|---|---|---|---|---|
| A | 1AM (Preprod, funded from the faucet, DUST registered) | wallet | wallet pays | #1 |
| B | Lace (Preprod, funded, DUST registered; Settings → proof server `http://localhost:6300`) | local | wallet pays | #2 |
| C | Lace (same) | wallet | wallet pays | #3 |
| D | The wallet that passed A or B, on a fresh account with 0 DUST | wallet or local | sponsor pays | #4. Save the hex to `/tmp/claim.hex`, then run `npm run sponsor -w @lixi/cli -- --network preprod /tmp/claim.hex` |

For each run, record:
- the log lines: connected config, `getProvingProvider` type, pre-check, proving time, balancing, `submitted:`
- any error text, verbatim
- whether the claimed tNIGHT shows up in the wallet

**Decision rule (spec §8, S4):**
- The Must-tier wallet is whichever run of A or B succeeds first. If both succeed, 1AM wins, because nothing runs in Docker.
- The other wallet becomes the Should-tier second path.
- If run D succeeds, sponsored claims are feasible in the browser. Promote S5 to Wave 2 Should if Plan 3 can host the sponsor in one day or less (for example, a Vercel function holding a funded seed).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json spikes/s4-wallet
git commit -m "chore(spike): S4 browser-wallet claim page"
```

---

### Task 9: Spike report, CI devnet job, docs, merge

**Files:**
- Create: `docs/superpowers/spikes/2026-10-01-chain-spikes.md`
- Modify: `.github/workflows/ci.yml`, `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: the results of Tasks 4–8.
- Produces:
  - the spike decisions Plan 3 is written against
  - CI that also runs the devnet suite on `ubuntu-24.04`

- [ ] **Step 1: Write the spike report**

`docs/superpowers/spikes/2026-10-01-chain-spikes.md` records, for each spike, what was run, the numbers, the decision, and the consequence for Plan 3. S1, S2, S3 and S5 come from the devnet suite; fill S4 from Task 8, Step 4.

```markdown
# Chain spikes (S1–S5), 2026-10-01

| ID | Question | Result | Decision |
|---|---|---|---|
| S1 | Do two concurrent claims on one envelope both succeed? | Yes: `devnet.test.ts` "pays two concurrent claims", both payouts exact. | Keep the v2 design; no claim serialization in the UI. |
| S2 | Proving time per circuit (local proof server 8.1.0) | createEnvelope 0.9–1.9 s, claim 0.2–2.5 s, refund 0.9–1.3 s; end-to-end tx 15–25 s (block + indexer). | Far under the 30 s profiling threshold. The UI shows a progress state for ~20 s per transaction. |
| S3 | Does `nativeToken()` move tNIGHT? | Yes: deposits and payouts move NIGHT, and the sender's balance delta equals exactly the claimed shares. | Nothing to change. |
| S4 | Which browser wallet proves and balances a claim? | <fill from Task 8: runs A–D, with error text> | <Must-tier wallet / Should-tier wallet> |
| S5 | Can a sponsor pay DUST for a recipient with no DUST? | Yes headless: a recipient with 0 NIGHT and 0 DUST claimed 1 tNIGHT; the sponsor added only the DUST fee. Browser: <run D>. | <Wave 2 Should or Wave 3> |

## Findings Plan 3 must carry
- **Bundling:** Vite 8 with `vite-plugin-wasm` and `build.target: 'esnext'`. No top-level-await plugin (it needs rollup). A `buffer` polyfill is required. Pass the browser `WebSocket` to `indexerPublicDataProvider`.
- **Assets:** serve `keys/` and `zkir/` for `FetchZkConfigProvider`. Copy only those two folders into the app's public assets, not the whole `managed/` tree.
- **Private state:** `memoryPrivateStateProvider` is enough. The vault re-derives the shares.
- **Back-to-back transactions:** a wallet can briefly reuse a spent DUST coin, and the node then rejects the submission. Retry once after a block, then show an error.
- **Pre-checks:** run `checkClaim` and `checkRefund` before every proof (spec §4.6).
```

- [ ] **Step 2: Pin CI and add the devnet job**

`.github/workflows/ci.yml`:
- Change `runs-on: ubuntu-latest` to `runs-on: ubuntu-24.04`. `ubuntu-latest` moves to Ubuntu 26 on 2026-10-19, the submission deadline.
- Append this job:
```yaml
  devnet:
    needs: test
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

- [ ] **Step 3: Update `README.md` and `CLAUDE.md`**

In `README.md`, extend the Develop section after the `npm run compact` block:
````markdown
Chain work needs Docker:

```bash
docker compose -f devnet/compose.yml up -d --wait   # local node, indexer, proof server
npm run test:devnet -w @lixi/cli                    # deploy → claims → sponsored claim → refund (~7 min)
npm run deploy -w @lixi/cli                         # deploy to the devnet; --network preprod needs LIXI_DEPLOYER_SEED
```
````

In the package table, add these rows:
```markdown
| `cli/` | Headless wallet, Node providers, deploy/smoke/sponsor scripts, devnet end-to-end tests |
| `deployments/` | Public deployment records (`preprod.json`) |
```
In the `sdk/` row, append ", midnight-js wrappers, pre-checks".

In `CLAUDE.md`, update three sections.

Under **Commands**, add:
```markdown
- Devnet: `docker compose -f devnet/compose.yml up -d --wait` (stop `midnight-proof-server` first; it also wants port 6300). Then `npm run test:devnet -w @lixi/cli`, or `deploy`/`smoke`/`sponsor` with `-- --network <undeployed|preprod>`. These scripts recompile the proving keys first, because `npm test` deletes them.
```

Under **Invariants**, add:
```markdown
- `npm ls @midnight-ntwrk/onchain-runtime-v3` must show one version (3.0.0, root `overrides`). Two copies break every circuit call with `expected instance of StateValue`. After installing, run `npm dedupe`.
- Every deployment relinquishes its maintenance authority (`relinquishAuthority`, an empty committee). Proving is always local (`NETWORKS[*].proofServer`).
- Use `memoryPrivateStateProvider`. The vault is the source of truth for shares.
```

Under **Testing quirks**, add:
```markdown
- Devnet tests use the public genesis seed `00…01` and fresh random wallets. A `submission rejected, retrying` warning is expected now and then.
```

- [ ] **Step 4: Commit and push**

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
git add docs/superpowers/spikes README.md CLAUDE.md .github/workflows/ci.yml
git commit -m "docs: chain spike results; ci: pin ubuntu-24.04 and run the devnet suite"
git push -u origin feat/chain
```

- [ ] **Step 5: Watch CI**

Run: `gh run watch --exit-status $(gh run list --branch feat/chain --limit 1 --json databaseId --jq '.[0].databaseId')`
Expected: the `test` and `devnet` jobs both succeed. `devnet` takes about 10–15 minutes, including the image pulls.

If `devnet` fails, read `gh run view --log-failed`. Likely causes:
- the indexer start race (the compose healthcheck already waits for block #1)
- runner memory (the proof server needs about 2 GB)

Use superpowers:systematic-debugging; don't weaken the assertions.

- [ ] **Step 6: Merge into `main`**

```bash
git switch main && git merge --ff-only feat/chain && git push origin main
gh run watch --exit-status $(gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
```
Expected: the fast-forward succeeds and the `main` CI run exits 0.

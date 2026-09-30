# Lixi Plan 1 (Core: Contract + SDK) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a compiling, fully tested Lixi Compact contract and a pure-TypeScript SDK (seed derivation, splits, claim links, sender vault, recovery) in a public monorepo with CI.

**Architecture:** An npm-workspace monorepo with two packages.
- `@lixi/contract` owns the Compact source, the generated bindings, the off-chain Merkle helper and the private-state witness.
- `@lixi/sdk` owns every off-chain piece that does not touch the network.

Tests run the real compiled contract in-process on `@midnight-ntwrk/compact-runtime`. Packages export TypeScript sources directly, so there is no build step.

**Tech Stack:** Compact compiler 0.31.1 (language 0.23), `@midnight-ntwrk/compact-runtime` 0.16.0, TypeScript 5.9, Vitest 4, `@noble/hashes` 2, Node 24, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-30-lixi-design.md`

**Scope:** This is plan 1 of 4. The later plans depend on results from this one, on the spikes, and on Docker and wallets being set up, so they are written after this plan lands:
- Plan 2, chain: providers, deploy, devnet E2E, Preprod, spikes S1, S2, S4 and S5.
- Plan 3: the app.
- Plan 4: README, slides, video and submission.

**Verification note:** Every code block in this plan was compiled with compiler 0.31.1 and tested before the plan was written. The tasks were also replayed in order on a clean repo. Expected test counts after each task: 6 → 15 → 26 → 32 (contract), then 9 → 14 → 21 (SDK).

## Global Constraints

- Node ≥ 24 (`.nvmrc` is `24`). npm workspaces. ESM only (`"type": "module"`).
- Compact compiler **0.31.1** (`compact update 0.31.1`), `pragma language_version 0.23;`, `@midnight-ntwrk/compact-runtime` **0.16.0** exactly.
- License Apache-2.0: a LICENSE file plus `"license": "Apache-2.0"` in every `package.json`. The GitHub repo carries the topic `midnightntwrk`.
- `MAX_SHARES = 16` and `TREE_DEPTH = 4`. They must match `Vector<16, Share>` and `Vector<4, PathEntry>` in `lixi.compact`.
- Hashing (spec §3.2): `envelopeId = persistentHash(pad(32, "lixi:id:v1"), nonce)`. Leaf, node, nullifier and address hashes use `transientHash` with tags 1, 2, 3 and 4.
- Times are unix **seconds**. The constructor takes `(minDuration, maxDuration)`.
- Amounts are NIGHT base units as `bigint`. Each share is ≤ 2^64 − 1 and each deposit ≤ 2^128 − 1.
- Assert and error messages are generic and never include secrets.
- Secrets live only in private state, the sender vault and the link fragment. Never log them.
- Root `package.json` pins `source-map-js` to `1.2.1` via `overrides`. The 1.2.2 tarball returned 404 from the npm registry on 2026-09-30.

## Review Focus

These are inputs the spec implies that could hurt real users. Each one has a pinning test in the task that owns the code.

1. **An expiry in milliseconds, or any far-future expiry,** must be rejected rather than lock funds for millennia. Task 3: "rejects an expiry more than maxDuration away, e.g. milliseconds passed as seconds".
2. **Links pasted as full URLs, with whitespace, or with trailing chat punctuation** must still parse, and junk must throw `invalid link`. Task 7: "accepts pasted URLs with whitespace and trailing punctuation".
3. **A backup string pasted with surrounding whitespace or newlines** must restore the same seed. Task 8: "serializes and restores the vault".
4. **Failed `createEnvelope` transactions burn vault indices,** but recovery must still find later envelopes after a gap of up to 4. Task 8: "recovers envelopes after up to four burned indices".
5. **A total so large that a share would exceed `Uint<64>`** must throw before any transaction is built. Task 6: "rejects impossible splits" and "rejects totals whose shares cannot fit in Uint<64>".

## File Structure

| Path | Responsibility |
|---|---|
| `package.json`, `.nvmrc`, `.gitignore`, `tsconfig.base.json`, `LICENSE`, `README.md` | Workspace root, toolchain pins, license |
| `contract/src/lixi.compact` | The contract: types, ledger, hashes, `createEnvelope`, `claim`, `refund` |
| `contract/src/constants.ts` | `MAX_SHARES`, `TREE_DEPTH`, `toHex` |
| `contract/src/merkle.ts` | `buildTree`: the off-chain tree and paths, built from the contract's own pure circuits |
| `contract/src/private-state.ts` | `LixiPrivateState` and the `envelopeShares` witness |
| `contract/src/index.ts` | Package entry: generated bindings plus the three modules above |
| `contract/src/test/lixi-simulator.ts` | In-process simulator (exported as `@lixi/contract/testing`) |
| `contract/src/test/fixtures.ts` | Shared test helpers |
| `contract/src/test/{hashing,create,claim,refund}.test.ts` | Contract tests |
| `sdk/src/bytes.ts` | base64url and big-endian bigint codecs |
| `sdk/src/kdf.ts` | HMAC-SHA256 label KDF |
| `sdk/src/split.ts` | Equal and random ("double mean") splits |
| `sdk/src/envelope.ts` | Derive an envelope (nonce, id, 16 shares) from the seed; `linksFor` |
| `sdk/src/link.ts` | Claim-link codec and paste-tolerant parsing |
| `sdk/src/claim.ts` | Link → claim arguments (group links pick an unclaimed share) |
| `sdk/src/vault.ts` | Sender vault, backup string, (de)serialization, private-state bridge |
| `sdk/src/recovery.ts` | Rebuild a vault from the seed and the on-chain ledger |
| `sdk/src/index.ts` | Package entry |
| `sdk/test/*.test.ts` | SDK tests, including the full SDK ↔ contract flow |
| `.github/workflows/ci.yml` | CI: install Compact, typecheck, test, full compile |

## Execution Lanes

Task 1 → Task 2 → then **Lane A** (Task 3 → 4 → 5) and **Lane B** (Task 6 → 7) run independently. Task 8 needs Tasks 5 and 7. Task 9 needs everything.

---

### Task 1: Bootstrap the repository and GitHub remote

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `tsconfig.base.json`, `LICENSE`, `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: root scripts `compact`, `compact:fast`, `typecheck`, `test` (both compile the contract first through their `pre` scripts), and `tsconfig.base.json` for the packages to extend.

- [ ] **Step 1: Confirm the toolchain**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && node -v && compact compile --version`
Expected: `v24.x.x` and `0.31.1`.

If `compact` is missing, install it and pin the compiler:
```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
export PATH="$HOME/.local/bin:$PATH"
compact update 0.31.1
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "lixi-midnight",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "engines": { "node": ">=24" },
  "workspaces": ["contract", "sdk"],
  "scripts": {
    "compact": "npm run compact -w @lixi/contract",
    "compact:fast": "npm run compact:fast -w @lixi/contract",
    "pretypecheck": "npm run compact:fast",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "pretest": "npm run compact:fast",
    "test": "npm test --workspaces --if-present"
  },
  "overrides": {
    "source-map-js": "1.2.1"
  }
}
```

- [ ] **Step 3: Write `.nvmrc`, `.gitignore`, `tsconfig.base.json`**

`.nvmrc`:
```
24
```

`.gitignore`:
```
node_modules/
contract/src/managed/
dist/
coverage/
.env
.env.*
*.log
.DS_Store
.claude/settings.local.json
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowJs": true,
    "noEmit": true,
    "types": []
  }
}
```

- [ ] **Step 4: Write `LICENSE` and `README.md`**

Run: `gh api licenses/apache-2.0 --jq .body > LICENSE`
Expected: `head -2 LICENSE` prints `Apache License` and `Version 2.0, January 2004`.

`README.md`:
```markdown
# Lixi — private red envelopes on Midnight

Send lì xì (red envelopes) in tNIGHT through claim links. Recipients claim with a zero-knowledge proof: the claim code never touches the chain, the recipient list stays private, and anyone can verify an envelope is fully funded without seeing how it is split.

Built for the [Midnight Buildathon](https://app.akindo.io/wave-hacks/jaMZjqPOBsLXvjdG) (Wave 2).

> Status: in development. Design: [docs/superpowers/specs/2026-09-30-lixi-design.md](docs/superpowers/specs/2026-09-30-lixi-design.md)

## License

Apache-2.0
```

- [ ] **Step 5: Commit on `main`**

```bash
git add package.json .nvmrc .gitignore tsconfig.base.json LICENSE README.md
git commit -m "chore: bootstrap monorepo root (Node 24, Compact 0.31.1, Apache-2.0)"
```

- [ ] **Step 6: Create the public GitHub repo and push `main`**

```bash
gh repo create hms1499/lixi-midnight --public --source . --remote origin \
  --description "Private red envelopes (lì xì) on Midnight — ZK claim links" --push
gh repo edit hms1499/lixi-midnight --add-topic midnightntwrk --add-topic midnight \
  --add-topic compact --add-topic zero-knowledge --add-topic privacy
```

- [ ] **Step 7: Verify the remote**

Run: `gh repo view hms1499/lixi-midnight --json visibility,repositoryTopics --jq '{v: .visibility, t: [.repositoryTopics[].name]}'`
Expected: `"v":"PUBLIC"`, and `t` contains `"midnightntwrk"`.

- [ ] **Step 8: Start the working branch**

Run: `git switch -c feat/core`
Expected: `Switched to a new branch 'feat/core'`.

---

### Task 2: Contract types, ledger, hashing and off-chain tree

**Files:**
- Create: `contract/package.json`, `contract/tsconfig.json`, `contract/src/lixi.compact`, `contract/src/constants.ts`, `contract/src/merkle.ts`, `contract/src/index.ts`, `contract/src/test/fixtures.ts`, `contract/src/test/hashing.test.ts`
- Generated (committed): `package-lock.json`

**Interfaces:**
- Consumes: root scripts from Task 1.
- Produces:
  - `pureCircuits.envelopeId(nonce: Uint8Array): Uint8Array`
  - `pureCircuits.leafHash(id: Uint8Array, share: Share): bigint`
  - `pureCircuits.nodeHash(l: bigint, r: bigint): bigint`
  - `pureCircuits.nullifierOf(id: Uint8Array, secret: Uint8Array): bigint`
  - `pureCircuits.addrKey(id: Uint8Array, recipient: { bytes: Uint8Array }): bigint`
  - `pureCircuits.rootOf(id: Uint8Array, shares: Share[]): bigint`
  - `pureCircuits.rootFromPath(leaf: bigint, path: PathEntry[]): bigint`
  - Types `Share { secret: Uint8Array; amount: bigint }`, `PathEntry { sibling: bigint; goesLeft: boolean }`, `Envelope`, `Ledger`
  - `MAX_SHARES`, `TREE_DEPTH`, `toHex(bytes): string`
  - `buildTree(id, shares): EnvelopeTree { root: bigint; leaves: bigint[]; pathFor(i): PathEntry[] }`
  - Test fixtures `rnd`, `makeShares`, `HOUR`, `DAY`

- [ ] **Step 1: Write the package manifests**

`contract/package.json`:
```json
{
  "name": "@lixi/contract",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/test/lixi-simulator.ts"
  },
  "scripts": {
    "compact": "compact compile src/lixi.compact src/managed/lixi",
    "compact:fast": "compact compile --skip-zk src/lixi.compact src/managed/lixi",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@midnight-ntwrk/compact-runtime": "0.16.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.1.0"
  }
}
```

`contract/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "include": ["src"] }
```

Run: `npm install`
Expected: exits 0, `package-lock.json` is created, and `node_modules/@midnight-ntwrk/compact-runtime` exists.

- [ ] **Step 2: Write the failing test and its fixtures**

`contract/src/test/fixtures.ts`:
```typescript
import type { Share } from '../managed/lixi/contract/index.js';
import { MAX_SHARES } from '../constants.js';

export const HOUR = 3600;
export const DAY = 24 * HOUR;

export const rnd = (n = 32): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

/** `amounts` real shares, padded with zero-amount shares up to MAX_SHARES. */
export const makeShares = (amounts: bigint[]): Share[] =>
  Array.from({ length: MAX_SHARES }, (_, i) => ({ secret: rnd(), amount: amounts[i] ?? 0n }));
```

`contract/src/test/hashing.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { pureCircuits } from '../managed/lixi/contract/index.js';
import { MAX_SHARES } from '../constants.js';
import { buildTree } from '../merkle.js';
import { makeShares, rnd } from './fixtures.js';

describe('hashing and Merkle tree', () => {
  const id = pureCircuits.envelopeId(rnd());
  const shares = makeShares([100n, 200n, 300n]);

  it('derives envelope ids deterministically from the nonce', () => {
    const nonce = rnd();
    expect(pureCircuits.envelopeId(nonce)).toEqual(pureCircuits.envelopeId(nonce));
    expect(pureCircuits.envelopeId(nonce)).not.toEqual(pureCircuits.envelopeId(rnd()));
  });

  it('builds the same root off-chain as the contract computes in-circuit', () => {
    expect(buildTree(id, shares).root).toBe(pureCircuits.rootOf(id, shares));
  });

  it('produces a valid path for every leaf', () => {
    const tree = buildTree(id, shares);
    for (let i = 0; i < MAX_SHARES; i++) {
      expect(pureCircuits.rootFromPath(tree.leaves[i], tree.pathFor(i))).toBe(tree.root);
    }
  });

  it('binds leaves to the envelope and the amount', () => {
    const s = shares[0];
    expect(pureCircuits.leafHash(id, s)).not.toBe(pureCircuits.leafHash(rnd(), s));
    expect(pureCircuits.leafHash(id, s)).not.toBe(pureCircuits.leafHash(id, { ...s, amount: s.amount + 1n }));
  });

  it('separates hash domains', () => {
    const secret = rnd();
    const leaf = pureCircuits.leafHash(id, { secret, amount: 0n });
    expect(pureCircuits.nullifierOf(id, secret)).not.toBe(leaf);
    expect(pureCircuits.addrKey(id, { bytes: secret })).not.toBe(pureCircuits.nullifierOf(id, secret));
  });

  it('rejects malformed input', () => {
    expect(() => buildTree(id, shares.slice(1))).toThrow(/expected 16 shares/);
    expect(() => buildTree(id, shares).pathFor(16)).toThrow(/bad leaf index/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -w @lixi/contract`
Expected: FAIL. The test cannot resolve `../managed/lixi/contract/index.js` or `../merkle.js`, because nothing is compiled or written yet.

- [ ] **Step 4: Write the contract (types, ledger, constructor, hashes)**

`contract/src/lixi.compact`:
```compact
// Lixi — private red envelopes on Midnight.
// SPDX-License-Identifier: Apache-2.0

pragma language_version 0.23;

import CompactStandardLibrary;

// One share of an envelope. Padding shares have amount 0.
export struct Share {
  secret: Bytes<32>,
  amount: Uint<64>
}

// One step of a Merkle path: the sibling hash and whether it sits on the left.
export struct PathEntry {
  sibling: Field,
  goesLeft: Boolean
}

export struct Envelope {
  root: Field,
  deposit: Uint<128>,
  expiry: Uint<64>,
  refundAddress: UserAddress,
  onePerAddress: Boolean,
  refunded: Boolean
}

struct LeafPreimage {
  tag: Field,
  id: Bytes<32>,
  secret: Bytes<32>,
  amount: Uint<64>
}

export sealed ledger minDuration: Uint<64>;
export sealed ledger maxDuration: Uint<64>;
export ledger envelopes: Map<Bytes<32>, Envelope>;
export ledger nullifiers: Set<Field>;
export ledger addrClaims: Set<Field>;

constructor(minDur: Uint<64>, maxDur: Uint<64>) {
  assert(minDur < maxDur, "bad durations");
  minDuration = disclose(minDur);
  maxDuration = disclose(maxDur);
}

// Hashes. Merkle nodes, nullifiers and address keys use transientHash (Poseidon):
// this deployment is immutable (no maintenance authority), so the algorithm is
// frozen for the contract's lifetime. Domain tags: 1 leaf, 2 node, 3 nullifier, 4 address.
export pure circuit envelopeId(nonce: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "lixi:id:v1"), nonce]);
}

export pure circuit leafHash(id: Bytes<32>, share: Share): Field {
  return transientHash<LeafPreimage>(LeafPreimage { tag: 1, id: id, secret: share.secret, amount: share.amount });
}

export pure circuit nodeHash(left: Field, right: Field): Field {
  return transientHash<Vector<3, Field>>([2, left, right]);
}

export pure circuit nullifierOf(id: Bytes<32>, secret: Bytes<32>): Field {
  return transientHash<[Field, Bytes<32>, Bytes<32>]>([3, id, secret]);
}

export pure circuit addrKey(id: Bytes<32>, recipient: UserAddress): Field {
  return transientHash<[Field, Bytes<32>, Bytes<32>]>([4, id, recipient.bytes]);
}

export pure circuit rootOf(id: Bytes<32>, shares: Vector<16, Share>): Field {
  const l = map((s: Share): Field => leafHash(id, s), shares);
  const a = [nodeHash(l[0], l[1]), nodeHash(l[2], l[3]), nodeHash(l[4], l[5]), nodeHash(l[6], l[7]),
             nodeHash(l[8], l[9]), nodeHash(l[10], l[11]), nodeHash(l[12], l[13]), nodeHash(l[14], l[15])];
  const b = [nodeHash(a[0], a[1]), nodeHash(a[2], a[3]), nodeHash(a[4], a[5]), nodeHash(a[6], a[7])];
  const c = [nodeHash(b[0], b[1]), nodeHash(b[2], b[3])];
  return nodeHash(c[0], c[1]);
}

export pure circuit rootFromPath(leaf: Field, path: Vector<4, PathEntry>): Field {
  return fold((acc: Field, e: PathEntry): Field =>
                e.goesLeft ? nodeHash(e.sibling, acc) : nodeHash(acc, e.sibling),
              leaf, path);
}
```

- [ ] **Step 5: Write the TypeScript side**

`contract/src/constants.ts`:
```typescript
/** Shares per envelope (real + zero-amount padding). Must match `Vector<16, Share>` in lixi.compact. */
export const MAX_SHARES = 16;
/** log2(MAX_SHARES). Must match `Vector<4, PathEntry>` in lixi.compact. */
export const TREE_DEPTH = 4;

export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
```

`contract/src/merkle.ts`:
```typescript
import { pureCircuits, type PathEntry, type Share } from './managed/lixi/contract/index.js';
import { MAX_SHARES, TREE_DEPTH } from './constants.js';

export type EnvelopeTree = {
  readonly root: bigint;
  readonly leaves: readonly bigint[];
  pathFor(index: number): PathEntry[];
};

/** Builds the same fixed-depth tree as the contract's `rootOf`, using the contract's own pure circuits. */
export const buildTree = (id: Uint8Array, shares: readonly Share[]): EnvelopeTree => {
  if (shares.length !== MAX_SHARES) throw new Error(`expected ${MAX_SHARES} shares, got ${shares.length}`);
  const levels: bigint[][] = [shares.map((s) => pureCircuits.leafHash(id, s))];
  for (let d = 0; d < TREE_DEPTH; d++) {
    const prev = levels[d];
    const next: bigint[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(pureCircuits.nodeHash(prev[i], prev[i + 1]));
    levels.push(next);
  }
  return {
    root: levels[TREE_DEPTH][0],
    leaves: levels[0],
    pathFor(index: number): PathEntry[] {
      if (!Number.isInteger(index) || index < 0 || index >= MAX_SHARES) throw new Error(`bad leaf index ${index}`);
      return levels.slice(0, TREE_DEPTH).map((level, d) => {
        const i = index >> d;
        return { sibling: level[i ^ 1], goesLeft: (i & 1) === 1 };
      });
    },
  };
};
```

`contract/src/index.ts`:
```typescript
export * from './managed/lixi/contract/index.js';
export * from './constants.js';
export * from './merkle.js';
```

- [ ] **Step 6: Compile and run the tests**

Run: `npm test`
Expected: the `pretest` step runs `compact compile --skip-zk …` and exits 0. Vitest reports `Tests  6 passed (6)`.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 with no `error TS` lines.

- [ ] **Step 8: Commit**

```bash
git add package-lock.json contract/
git commit -m "feat(contract): ledger, Poseidon Merkle hashing and off-chain tree helper"
```

---

### Task 3: `createEnvelope`, the private-state witness and the simulator

**Files:**
- Modify: `contract/src/lixi.compact` (insert the witness after `export ledger addrClaims`; append `createEnvelope`)
- Modify: `contract/src/index.ts` (export private state)
- Modify: `contract/src/test/fixtures.ts` (replace the whole file)
- Create: `contract/src/private-state.ts`, `contract/src/test/lixi-simulator.ts`, `contract/src/test/create.test.ts`

**Interfaces:**
- Consumes (Task 2): `pureCircuits`, `buildTree`, `MAX_SHARES`, `toHex`, `rnd`, `makeShares`.
- Produces:
  - `LixiPrivateState { shares: Record<hexId, Share[]> }`, `emptyPrivateState()`, `withEnvelopeShares(state, id, shares)`, `witnesses`
  - `LixiSimulator`, with:
    - `constructor(minDuration?: bigint, maxDuration?: bigint)`
    - `create(nonce, expiry, refundAddress: Uint8Array, onePerAddress): Uint8Array`
    - `rememberShares(id, shares)`, `ledger()`, `lastDeposit()`
    - public fields `now`, `privateState`, `lastEffects`
  - `T0`
  - Fixtures `EXPIRY`, `openEnvelope(sim, amounts, onePerAddress?) → { nonce, id, shares, refundAddr }`

- [ ] **Step 1: Write the simulator, the new fixtures and the failing test**

`contract/src/test/lixi-simulator.ts`:
```typescript
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
  type CircuitResults,
  type ContractState,
  type ChargedState,
  type Effects,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, type Ledger, type Share } from '../managed/lixi/contract/index.js';
import { emptyPrivateState, withEnvelopeShares, witnesses, type LixiPrivateState } from '../private-state.js';

export const T0 = 1_800_000_000;
const COIN_PK = '0'.repeat(64);

/** Runs the compiled contract in-process. Each call starts from a fresh query context, like a real transaction. */
export class LixiSimulator {
  readonly contract = new Contract<LixiPrivateState>(witnesses);
  readonly address = sampleContractAddress();
  privateState: LixiPrivateState = emptyPrivateState();
  now = T0;
  lastEffects: Effects | undefined;
  private state: ContractState | ChargedState;

  constructor(minDuration = 3600n, maxDuration = 30n * 86400n) {
    this.state = this.contract.initialState(createConstructorContext(emptyPrivateState(), COIN_PK), minDuration, maxDuration)
      .currentContractState;
  }

  ledger(): Ledger {
    return ledger(this.context().currentQueryContext.state);
  }

  rememberShares(id: Uint8Array, shares: readonly Share[]): void {
    this.privateState = withEnvelopeShares(this.privateState, id, shares);
  }

  create(nonce: Uint8Array, expiry: bigint, refundAddress: Uint8Array, onePerAddress: boolean): Uint8Array {
    return this.run((ctx) =>
      this.contract.impureCircuits.createEnvelope(ctx, nonce, expiry, { bytes: refundAddress }, onePerAddress),
    );
  }

  /** NIGHT pulled into the contract by the last call. */
  lastDeposit(): bigint {
    let total = 0n;
    for (const [, amount] of this.lastEffects?.unshieldedInputs ?? []) total += amount;
    return total;
  }

  private context(): CircuitContext<LixiPrivateState> {
    return createCircuitContext(this.address, COIN_PK, this.state, this.privateState, undefined, undefined, this.now);
  }

  private run<R>(call: (ctx: CircuitContext<LixiPrivateState>) => CircuitResults<LixiPrivateState, R>): R {
    const result = call(this.context());
    this.state = result.context.currentQueryContext.state;
    this.privateState = result.context.currentPrivateState;
    this.lastEffects = result.context.currentQueryContext.effects;
    return result.result;
  }
}
```

`contract/src/test/fixtures.ts` (replaces the Task 2 version):
```typescript
import { pureCircuits, type Share } from '../managed/lixi/contract/index.js';
import { MAX_SHARES } from '../constants.js';
import { T0, type LixiSimulator } from './lixi-simulator.js';

export const HOUR = 3600;
export const DAY = 24 * HOUR;
export const EXPIRY = BigInt(T0 + 2 * HOUR);

export const rnd = (n = 32): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

/** `amounts` real shares, padded with zero-amount shares up to MAX_SHARES. */
export const makeShares = (amounts: bigint[]): Share[] =>
  Array.from({ length: MAX_SHARES }, (_, i) => ({ secret: rnd(), amount: amounts[i] ?? 0n }));

export type OpenEnvelope = { nonce: Uint8Array; id: Uint8Array; shares: Share[]; refundAddr: Uint8Array };

/** Creates an envelope as a sender would: remember the shares privately, then call createEnvelope. */
export const openEnvelope = (sim: LixiSimulator, amounts: bigint[], onePerAddress = false): OpenEnvelope => {
  const nonce = rnd();
  const id = pureCircuits.envelopeId(nonce);
  const shares = makeShares(amounts);
  const refundAddr = rnd();
  sim.rememberShares(id, shares);
  sim.create(nonce, EXPIRY, refundAddr, onePerAddress);
  return { nonce, id, shares, refundAddr };
};
```

`contract/src/test/create.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { pureCircuits } from '../managed/lixi/contract/index.js';
import { buildTree } from '../merkle.js';
import { LixiSimulator, T0 } from './lixi-simulator.js';
import { DAY, EXPIRY, HOUR, makeShares, openEnvelope, rnd } from './fixtures.js';

describe('createEnvelope', () => {
  let sim: LixiSimulator;

  beforeEach(() => {
    sim = new LixiSimulator(BigInt(HOUR), BigInt(30 * DAY));
  });

  /** Registers private shares for a fresh nonce without creating the envelope. */
  const prepare = (amounts: bigint[]) => {
    const nonce = rnd();
    sim.rememberShares(pureCircuits.envelopeId(nonce), makeShares(amounts));
    return nonce;
  };

  it('locks the sum of the shares and stores only the root', () => {
    const { id, shares, refundAddr } = openEnvelope(sim, [100n, 250n, 50n]);
    expect(sim.lastDeposit()).toBe(400n);
    expect(sim.ledger().envelopes.lookup(id)).toEqual({
      root: buildTree(id, shares).root,
      deposit: 400n,
      expiry: EXPIRY,
      refundAddress: { bytes: refundAddr },
      onePerAddress: false,
      refunded: false,
    });
  });

  it('does not reveal the share count or split', () => {
    const a = openEnvelope(sim, [400n]);
    const b = openEnvelope(sim, [100n, 100n, 100n, 100n]);
    const one = sim.ledger().envelopes.lookup(a.id);
    const four = sim.ledger().envelopes.lookup(b.id);
    expect(Object.keys(one)).toEqual(Object.keys(four));
    expect(one.deposit).toBe(four.deposit);
    expect(sim.ledger().nullifiers.isEmpty()).toBe(true);
  });

  it('rejects a duplicate envelope id', () => {
    const { nonce, refundAddr } = openEnvelope(sim, [100n]);
    expect(() => sim.create(nonce, EXPIRY, refundAddr, false)).toThrow(/envelope exists/);
  });

  it('rejects an envelope with no value', () => {
    expect(() => sim.create(prepare([]), EXPIRY, rnd(), false)).toThrow(/empty envelope/);
  });

  it('accepts an expiry exactly minDuration away and rejects one second less', () => {
    const nonce = prepare([1n]);
    expect(() => sim.create(nonce, BigInt(T0 + HOUR - 1), rnd(), false)).toThrow(/expiry too soon/);
    expect(sim.create(nonce, BigInt(T0 + HOUR), rnd(), false)).toEqual(pureCircuits.envelopeId(nonce));
  });

  it('rejects an expiry more than maxDuration away, e.g. milliseconds passed as seconds', () => {
    const nonce = prepare([1n]);
    expect(() => sim.create(nonce, BigInt(T0 + 30 * DAY + 1), rnd(), false)).toThrow(/expiry too far/);
    expect(() => sim.create(nonce, EXPIRY * 1000n, rnd(), false)).toThrow(/expiry too far/);
    expect(sim.create(nonce, BigInt(T0 + 30 * DAY), rnd(), false)).toEqual(pureCircuits.envelopeId(nonce));
  });

  it('rejects a nonsense expiry', () => {
    expect(() => sim.create(prepare([1n]), 10n, rnd(), false)).toThrow(/bad expiry/);
  });

  it('fails when the sender has no private shares for the envelope', () => {
    expect(() => sim.create(rnd(), EXPIRY, rnd(), false)).toThrow(/no private shares/);
  });

  it('rejects inconsistent deploy-time durations', () => {
    expect(() => new LixiSimulator(BigInt(DAY), BigInt(HOUR))).toThrow(/bad durations/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @lixi/contract`
Expected: FAIL. `../private-state.js` cannot be resolved, and the generated contract has no `createEnvelope`.

- [ ] **Step 3: Add the witness and `createEnvelope` to the contract**

In `contract/src/lixi.compact`, insert this directly after the line `export ledger addrClaims: Set<Field>;`:
```compact
// The sender's shares for envelope `id`, read from the sender's private state.
witness envelopeShares(id: Bytes<32>): Vector<16, Share>;
```

Then append at the end of the file:
```compact
// Lock `Σ amounts` of NIGHT behind a Merkle root of the sender's shares.
export circuit createEnvelope(nonce: Bytes<32>,
                              expiry: Uint<64>,
                              refundAddress: UserAddress,
                              onePerAddress: Boolean): Bytes<32> {
  const id = disclose(envelopeId(nonce));
  assert(!envelopes.member(id), "envelope exists");
  const shares = envelopeShares(id);
  const deposit = fold((acc: Uint<128>, s: Share): Uint<128> => (acc + s.amount) as Uint<128>,
                       0 as Uint<128>, shares);
  assert(deposit > 0, "empty envelope");
  const exp = disclose(expiry);
  assert(exp > maxDuration, "bad expiry");
  assert(blockTimeLte((exp - minDuration) as Uint<64>), "expiry too soon");
  assert(blockTimeGte((exp - maxDuration) as Uint<64>), "expiry too far");
  receiveUnshielded(nativeToken(), disclose(deposit));
  envelopes.insert(id, Envelope {
    root: disclose(rootOf(id, shares)),
    deposit: disclose(deposit),
    expiry: exp,
    refundAddress: disclose(refundAddress),
    onePerAddress: disclose(onePerAddress),
    refunded: false
  });
  return id;
}
```

- [ ] **Step 4: Write the private state and export it**

`contract/src/private-state.ts`:
```typescript
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Share } from './managed/lixi/contract/index.js';
import { MAX_SHARES, toHex } from './constants.js';

/** Sender-side private state: the full share list of every envelope, keyed by hex envelope id. */
export type LixiPrivateState = {
  readonly shares: Readonly<Record<string, readonly Share[]>>;
};

export const emptyPrivateState = (): LixiPrivateState => ({ shares: {} });

export const withEnvelopeShares = (
  state: LixiPrivateState,
  id: Uint8Array,
  shares: readonly Share[],
): LixiPrivateState => {
  if (shares.length !== MAX_SHARES) throw new Error(`expected ${MAX_SHARES} shares, got ${shares.length}`);
  return { shares: { ...state.shares, [toHex(id)]: shares } };
};

export const witnesses = {
  envelopeShares: (
    { privateState }: WitnessContext<Ledger, LixiPrivateState>,
    id: Uint8Array,
  ): [LixiPrivateState, Share[]] => {
    const shares = privateState.shares[toHex(id)];
    if (!shares) throw new Error('no private shares for this envelope');
    return [privateState, [...shares]];
  },
};
```

Append to `contract/src/index.ts`:
```typescript
export * from './private-state.js';
```

- [ ] **Step 5: Compile and run the tests**

Run: `npm test`
Expected: `Tests  15 passed (15)` (6 hashing + 9 create).

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`. Expected: exits 0.
```bash
git add contract/
git commit -m "feat(contract): createEnvelope with private-state witness, duration guards and simulator"
```

---

### Task 4: `claim`

**Files:**
- Modify: `contract/src/lixi.compact` (append `claim`)
- Modify: `contract/src/test/lixi-simulator.ts` (add `claim` and `lastPayouts`, and import `PathEntry`)
- Create: `contract/src/test/claim.test.ts`

**Interfaces:**
- Consumes (Task 3): `LixiSimulator`, `openEnvelope`, `EXPIRY`.
- Produces:
  - `LixiSimulator.claim(id, share, path: PathEntry[], recipient: Uint8Array): void`
  - `LixiSimulator.lastPayouts(): Map<hexAddress, bigint>`

- [ ] **Step 1: Write the failing test**

`contract/src/test/claim.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { pureCircuits } from '../managed/lixi/contract/index.js';
import { toHex } from '../constants.js';
import { buildTree } from '../merkle.js';
import { LixiSimulator } from './lixi-simulator.js';
import { DAY, EXPIRY, HOUR, openEnvelope, rnd, type OpenEnvelope } from './fixtures.js';

describe('claim', () => {
  let sim: LixiSimulator;
  let env: OpenEnvelope;
  const claimShare = (i: number, recipient: Uint8Array) =>
    sim.claim(env.id, env.shares[i], buildTree(env.id, env.shares).pathFor(i), recipient);

  beforeEach(() => {
    sim = new LixiSimulator(BigInt(HOUR), BigInt(30 * DAY));
    env = openEnvelope(sim, [100n, 250n, 50n]);
  });

  it('pays the share to the recipient and records its nullifier', () => {
    const alice = rnd();
    claimShare(1, alice);
    expect(sim.lastPayouts()).toEqual(new Map([[toHex(alice), 250n]]));
    expect(sim.ledger().nullifiers.member(pureCircuits.nullifierOf(env.id, env.shares[1].secret))).toBe(true);
  });

  it('never writes the envelope, so concurrent claims cannot conflict on it', () => {
    const before = sim.ledger().envelopes.lookup(env.id);
    claimShare(0, rnd());
    expect(sim.ledger().envelopes.lookup(env.id)).toEqual(before);
  });

  it('rejects claiming the same share twice', () => {
    claimShare(0, rnd());
    expect(() => claimShare(0, rnd())).toThrow(/already claimed/);
  });

  it('rejects a share whose amount was changed', () => {
    const path = buildTree(env.id, env.shares).pathFor(2);
    expect(() => sim.claim(env.id, { ...env.shares[2], amount: 5000n }, path, rnd())).toThrow(/invalid share/);
  });

  it('rejects a forged Merkle path', () => {
    const path = buildTree(env.id, env.shares).pathFor(0).map((e) => ({ ...e, goesLeft: !e.goesLeft }));
    expect(() => sim.claim(env.id, env.shares[0], path, rnd())).toThrow(/invalid share/);
  });

  it('rejects a share that belongs to another envelope', () => {
    const other = openEnvelope(sim, [100n]);
    const path = buildTree(env.id, env.shares).pathFor(0);
    expect(() => sim.claim(other.id, env.shares[0], path, rnd())).toThrow(/invalid share/);
  });

  it('rejects padding shares', () => {
    expect(() => claimShare(7, rnd())).toThrow(/empty share/);
  });

  it('rejects claims at or after expiry', () => {
    sim.now = Number(EXPIRY);
    expect(() => claimShare(0, rnd())).toThrow(/expired/);
  });

  it('rejects an unknown envelope', () => {
    const path = buildTree(env.id, env.shares).pathFor(0);
    expect(() => sim.claim(rnd(), env.shares[0], path, rnd())).toThrow(/no envelope/);
  });

  it('lets one address claim two personal-link shares', () => {
    const bob = rnd();
    claimShare(0, bob);
    claimShare(1, bob);
    expect(sim.lastPayouts()).toEqual(new Map([[toHex(bob), 250n]]));
  });

  describe('group mode (onePerAddress)', () => {
    beforeEach(() => {
      env = openEnvelope(sim, [100n, 100n, 100n], true);
    });

    it('allows one share per address', () => {
      const carol = rnd();
      claimShare(0, carol);
      expect(() => claimShare(1, carol)).toThrow(/address already claimed/);
      claimShare(1, rnd());
    });
  });
});
```

- [ ] **Step 2: Add the simulator methods**

In `contract/src/test/lixi-simulator.ts`, change the bindings import to include `type PathEntry`:
```typescript
import { Contract, ledger, type Ledger, type PathEntry, type Share } from '../managed/lixi/contract/index.js';
```

Insert these methods directly before the `/** NIGHT pulled into the contract by the last call. */` doc comment:
```typescript
  claim(id: Uint8Array, share: Share, path: PathEntry[], recipient: Uint8Array): void {
    this.run((ctx) => this.contract.impureCircuits.claim(ctx, id, share, path, { bytes: recipient }));
  }

  /** NIGHT sent to each user address by the last call, keyed by hex address. */
  lastPayouts(): Map<string, bigint> {
    const out = new Map<string, bigint>();
    for (const [[, to], amount] of this.lastEffects?.claimedUnshieldedSpends ?? []) {
      if (to.tag === 'user') out.set(to.address, (out.get(to.address) ?? 0n) + amount);
    }
    return out;
  }
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -w @lixi/contract`
Expected: FAIL in `claim.test.ts` with `this.contract.impureCircuits.claim is not a function`.

- [ ] **Step 4: Append `claim` to the contract**

Append at the end of `contract/src/lixi.compact`:
```compact
// Claim one share. Reads the envelope but never writes it, so claims do not conflict.
export circuit claim(id: Bytes<32>, share: Share, path: Vector<4, PathEntry>, recipient: UserAddress): [] {
  const eid = disclose(id);
  assert(envelopes.member(eid), "no envelope");
  const env = envelopes.lookup(eid);
  assert(!env.refunded, "refunded");
  assert(blockTimeLt(env.expiry), "expired");
  const amount = disclose(share.amount);
  assert(amount > 0, "empty share");
  assert(rootFromPath(leafHash(eid, share), path) == env.root, "invalid share");
  const nf = disclose(nullifierOf(eid, share.secret));
  assert(!nullifiers.member(nf), "already claimed");
  nullifiers.insert(nf);
  const to = disclose(recipient);
  if (env.onePerAddress) {
    const k = addrKey(eid, to);
    assert(!addrClaims.member(k), "address already claimed");
    addrClaims.insert(k);
  }
  sendUnshielded(nativeToken(), amount as Uint<128>, right<ContractAddress, UserAddress>(to));
}
```

- [ ] **Step 5: Compile and run the tests**

Run: `npm test`
Expected: `Tests  26 passed (26)`.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`. Expected: exits 0.
```bash
git add contract/
git commit -m "feat(contract): claim with Merkle proof, nullifiers and one-per-address group mode"
```

---

### Task 5: `refund`

**Files:**
- Modify: `contract/src/lixi.compact` (append `refund`)
- Modify: `contract/src/test/lixi-simulator.ts` (add `refund`)
- Create: `contract/src/test/refund.test.ts`

**Interfaces:**
- Consumes (Task 4): `LixiSimulator.claim`, `lastPayouts`.
- Produces: `LixiSimulator.refund(id: Uint8Array): void`. The contract is now complete (spec §3.3).

- [ ] **Step 1: Write the failing test**

`contract/src/test/refund.test.ts`:
```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { toHex } from '../constants.js';
import { buildTree } from '../merkle.js';
import { LixiSimulator } from './lixi-simulator.js';
import { DAY, EXPIRY, HOUR, makeShares, openEnvelope, rnd, type OpenEnvelope } from './fixtures.js';

describe('refund', () => {
  let sim: LixiSimulator;
  let env: OpenEnvelope;
  const claimShare = (i: number) =>
    sim.claim(env.id, env.shares[i], buildTree(env.id, env.shares).pathFor(i), rnd());

  beforeEach(() => {
    sim = new LixiSimulator(BigInt(HOUR), BigInt(30 * DAY));
    env = openEnvelope(sim, [100n, 250n, 50n]);
  });

  it('is not possible before expiry', () => {
    expect(() => sim.refund(env.id)).toThrow(/not expired/);
  });

  it('returns exactly the unclaimed amount to the refund address', () => {
    claimShare(1);
    sim.now = Number(EXPIRY);
    sim.refund(env.id);
    expect(sim.lastPayouts()).toEqual(new Map([[toHex(env.refundAddr), 150n]]));
    expect(sim.ledger().envelopes.lookup(env.id).refunded).toBe(true);
  });

  it('pays nothing when every share was claimed', () => {
    [0, 1, 2].forEach(claimShare);
    sim.now = Number(EXPIRY);
    sim.refund(env.id);
    expect(sim.lastPayouts().size).toBe(0);
    expect(sim.ledger().envelopes.lookup(env.id).refunded).toBe(true);
  });

  it('can only happen once, and blocks later claims', () => {
    sim.now = Number(EXPIRY);
    sim.refund(env.id);
    expect(() => sim.refund(env.id)).toThrow(/refunded/);
    expect(() => claimShare(0)).toThrow(/refunded/);
  });

  it('rejects private shares that do not match the root', () => {
    sim.rememberShares(env.id, makeShares([400n]));
    sim.now = Number(EXPIRY);
    expect(() => sim.refund(env.id)).toThrow(/invalid shares/);
  });

  it('sends funds only to the refund address, whoever triggers it', () => {
    sim.privateState = { shares: { [toHex(env.id)]: env.shares } }; // e.g. a group member who rebuilt the shares
    sim.now = Number(EXPIRY);
    sim.refund(env.id);
    expect([...sim.lastPayouts().keys()]).toEqual([toHex(env.refundAddr)]);
  });
});
```

- [ ] **Step 2: Add the simulator method**

In `contract/src/test/lixi-simulator.ts`, insert this directly before the `/** NIGHT sent to each user address by the last call, keyed by hex address. */` doc comment:
```typescript
  refund(id: Uint8Array): void {
    this.run((ctx) => this.contract.impureCircuits.refund(ctx, id));
  }
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -w @lixi/contract`
Expected: FAIL in `refund.test.ts` with `this.contract.impureCircuits.refund is not a function`.

- [ ] **Step 4: Append `refund` to the contract**

Append at the end of `contract/src/lixi.compact`:
```compact
// After expiry, return every unclaimed share to the envelope's refund address.
export circuit refund(id: Bytes<32>): [] {
  const eid = disclose(id);
  assert(envelopes.member(eid), "no envelope");
  const env = envelopes.lookup(eid);
  assert(!env.refunded, "refunded");
  assert(blockTimeGte(env.expiry), "not expired");
  const shares = envelopeShares(eid);
  assert(rootOf(eid, shares) == env.root, "invalid shares");
  const unclaimed = fold((acc: Uint<128>, s: Share): Uint<128> =>
                           nullifiers.member(disclose(nullifierOf(eid, s.secret)))
                             ? acc
                             : (acc + disclose(s.amount)) as Uint<128>,
                         0 as Uint<128>, shares);
  envelopes.insert(eid, Envelope {
    root: env.root,
    deposit: env.deposit,
    expiry: env.expiry,
    refundAddress: env.refundAddress,
    onePerAddress: env.onePerAddress,
    refunded: true
  });
  if (unclaimed > 0) {
    sendUnshielded(nativeToken(), unclaimed, right<ContractAddress, UserAddress>(env.refundAddress));
  }
}
```

- [ ] **Step 5: Compile and run the tests**

Run: `npm test`
Expected: `Tests  32 passed (32)`.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`. Expected: exits 0.
```bash
git add contract/
git commit -m "feat(contract): refund of unclaimed shares after expiry"
```

---

### Task 6: SDK bytes, KDF and splits

**Files:**
- Create: `sdk/package.json`, `sdk/tsconfig.json`, `sdk/src/bytes.ts`, `sdk/src/kdf.ts`, `sdk/src/split.ts`, `sdk/test/kdf-split.test.ts`
- Modify: `package-lock.json` (npm install)

**Interfaces:**
- Consumes (Task 2): `MAX_SHARES` from `@lixi/contract`.
- Produces:
  - `toBase64Url(bytes)`, `fromBase64Url(text)`
  - `bigintToBytes(value, width)`, `bytesToBigint(bytes)`
  - `kdf(key, ...labels: (string | number)[]): Uint8Array`
  - `equalSplit(total, count): bigint[]`, `randomSplit(total, count, seed): bigint[]`

- [ ] **Step 1: Write the package manifests and install**

`sdk/package.json`:
```json
{
  "name": "@lixi/sdk",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "Apache-2.0",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@lixi/contract": "0.1.0",
    "@noble/hashes": "^2.4.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.1.0"
  }
}
```

`sdk/tsconfig.json`:
```json
{ "extends": "../tsconfig.base.json", "include": ["src", "test"] }
```

Run: `npm install`
Expected: exits 0, and `node_modules/@noble/hashes` and the `node_modules/@lixi/contract` symlink exist.

- [ ] **Step 2: Write the failing test**

`sdk/test/kdf-split.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { bytesToBigint, fromBase64Url, toBase64Url } from '../src/bytes.js';
import { kdf } from '../src/kdf.js';
import { equalSplit, randomSplit } from '../src/split.js';

const seed = new Uint8Array(32).fill(7);
const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);

describe('kdf', () => {
  it('is deterministic and separates labels', () => {
    expect(kdf(seed, 'share', 0, 1)).toEqual(kdf(seed, 'share', 0, 1));
    expect(kdf(seed, 'share', 0, 1)).not.toEqual(kdf(seed, 'share', 1, 0));
    expect(kdf(seed, 'ab', 'c')).not.toEqual(kdf(seed, 'a', 'bc'));
    expect(kdf(seed, 'nonce', 0)).toHaveLength(32);
  });

  it('matches a fixed test vector', () => {
    expect(toBase64Url(kdf(seed, 'nonce', 0))).toMatchInlineSnapshot(`"My4igF2HWihMHo0Adz1h6ysPmGAvag7CWWLlH84Blqk"`);
  });

  it('rejects numeric labels outside u32', () => {
    expect(() => kdf(seed, -1)).toThrow(/out of range/);
    expect(() => kdf(seed, 1.5)).toThrow(/out of range/);
  });
});

describe('bytes', () => {
  it('round-trips base64url', () => {
    const b = crypto.getRandomValues(new Uint8Array(77));
    expect(fromBase64Url(toBase64Url(b))).toEqual(b);
    expect(() => fromBase64Url('a+b')).toThrow(/base64url/);
    expect(bytesToBigint(new Uint8Array([1, 0]))).toBe(256n);
  });
});

describe('equalSplit', () => {
  it('splits exactly and spreads the remainder over the first shares', () => {
    expect(equalSplit(10n, 3)).toEqual([4n, 3n, 3n]);
    expect(equalSplit(16n, 16)).toEqual(Array(16).fill(1n));
  });

  it('rejects impossible splits', () => {
    expect(() => equalSplit(2n, 3)).toThrow(/at least one unit/);
    expect(() => equalSplit(100n, 0)).toThrow(/share count/);
    expect(() => equalSplit(100n, 17)).toThrow(/share count/);
    expect(() => equalSplit(1n << 70n, 1)).toThrow(/Uint<64>/);
  });
});

describe('randomSplit', () => {
  it('always sums to the total with every share ≥ 1', () => {
    for (let n = 1; n <= 16; n++) {
      for (const total of [BigInt(n), 1000n, 123_456_789n]) {
        const s = randomSplit(total, n, kdf(seed, 'split', n));
        expect(s).toHaveLength(n);
        expect(sum(s)).toBe(total);
        expect(s.every((a) => a >= 1n)).toBe(true);
      }
    }
  });

  it('is deterministic per seed and differs across seeds', () => {
    expect(randomSplit(1000n, 8, seed)).toEqual(randomSplit(1000n, 8, seed));
    expect(randomSplit(1000n, 8, seed)).not.toEqual(randomSplit(1000n, 8, kdf(seed, 'other')));
  });

  it('rejects totals whose shares cannot fit in Uint<64>', () => {
    expect(() => randomSplit(1n << 70n, 2, seed)).toThrow(/Uint<64>/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -w @lixi/sdk`
Expected: FAIL, because `../src/bytes.js`, `../src/kdf.js` and `../src/split.js` cannot be resolved.

- [ ] **Step 4: Implement**

`sdk/src/bytes.ts`:
```typescript
export const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const fromBase64Url = (text: string): Uint8Array => {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('invalid base64url');
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

/** Big-endian fixed-width encoding of a non-negative bigint. */
export const bigintToBytes = (value: bigint, width: number): Uint8Array => {
  if (value < 0n || value >= 1n << BigInt(8 * width)) throw new Error(`value does not fit in ${width} bytes`);
  const out = new Uint8Array(width);
  for (let i = width - 1, v = value; i >= 0; i--, v >>= 8n) out[i] = Number(v & 0xffn);
  return out;
};

export const bytesToBigint = (bytes: Uint8Array): bigint =>
  bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
```

`sdk/src/kdf.ts`:
```typescript
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { bigintToBytes } from './bytes.js';

const u32 = (n: number): Uint8Array => {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error(`label out of range: ${n}`);
  return bigintToBytes(BigInt(n), 4);
};

/** HMAC-SHA256(key, "lixi/v1" ‖ len‖label …). Every secret Lixi uses is derived through this. */
export const kdf = (key: Uint8Array, ...labels: (string | number)[]): Uint8Array => {
  const parts: Uint8Array[] = [utf8ToBytes('lixi/v1')];
  for (const label of labels) {
    const bytes = typeof label === 'number' ? u32(label) : utf8ToBytes(label);
    parts.push(u32(bytes.length), bytes);
  }
  return hmac(sha256, key, concatBytes(...parts));
};
```

`sdk/src/split.ts`:
```typescript
import { bytesToBigint } from './bytes.js';
import { kdf } from './kdf.js';
import { MAX_SHARES } from '@lixi/contract';

const MAX_SHARE_AMOUNT = (1n << 64n) - 1n;

const check = (total: bigint, count: number): void => {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SHARES) throw new Error(`share count must be 1..${MAX_SHARES}`);
  if (total < BigInt(count)) throw new Error('total must be at least one unit per share');
};

const checkShares = (amounts: bigint[]): bigint[] => {
  if (amounts.some((a) => a > MAX_SHARE_AMOUNT)) throw new Error('share amount exceeds Uint<64>');
  return amounts;
};

/** Equal split; the first `total % count` shares get one extra unit. */
export const equalSplit = (total: bigint, count: number): bigint[] => {
  check(total, count);
  const base = total / BigInt(count);
  const extra = total % BigInt(count);
  return checkShares(Array.from({ length: count }, (_, i) => base + (BigInt(i) < extra ? 1n : 0n)));
};

/** WeChat "double mean": draw uniformly in [1, 2·remaining/left − 1], never starving later shares. */
export const randomSplit = (total: bigint, count: number, seed: Uint8Array): bigint[] => {
  check(total, count);
  const out: bigint[] = [];
  let remaining = total;
  for (let i = 0; i < count - 1; i++) {
    const left = BigInt(count - i);
    const doubleMean = (remaining * 2n) / left - 1n;
    const hi = [doubleMean < 1n ? 1n : doubleMean, remaining - (left - 1n)].reduce((a, b) => (a < b ? a : b));
    const amount = 1n + (hi <= 1n ? 0n : bytesToBigint(kdf(seed, 'draw', i)) % hi);
    out.push(amount);
    remaining -= amount;
  }
  out.push(remaining);
  return checkShares(out);
};
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: the contract still reports `Tests  32 passed (32)`, and the SDK reports `Tests  9 passed (9)`. The inline snapshot fixes the KDF test vector `My4igF2HWihMHo0Adz1h6ysPmGAvag7CWWLlH84Blqk`.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`. Expected: exits 0.
```bash
git add package-lock.json sdk/
git commit -m "feat(sdk): base64url/bigint codecs, HMAC-SHA256 KDF, equal and double-mean splits"
```

---

### Task 7: SDK envelope derivation and claim links

**Files:**
- Create: `sdk/src/envelope.ts`, `sdk/src/link.ts`, `sdk/test/link.test.ts`

**Interfaces:**
- Consumes: `kdf`, `equalSplit`, `randomSplit` (Task 6), and `pureCircuits`, `buildTree`, `MAX_SHARES`, `TREE_DEPTH` (Task 2).
- Produces:
  - `EnvelopeSpec { index; total; count; kind: 'personal' | 'group'; split: 'equal' | 'random' }`
  - `deriveEnvelope(seed, spec): DerivedEnvelope { spec; nonce; id; shares: Share[16]; groupSecret? }`
  - `groupShares(groupSecret, count, total): Share[]`
  - `linksFor(derived): ClaimLink[]`
  - `ClaimLink = PersonalLink | GroupLink`
  - `encodeLink(link): string`, `decodeLink(fragment): ClaimLink`, `parseClaimInput(text): ClaimLink`
  - `claimUrl(origin, link): string`

- [ ] **Step 1: Write the failing test**

`sdk/test/link.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { deriveEnvelope, linksFor } from '../src/envelope.js';
import { claimUrl, decodeLink, encodeLink, parseClaimInput, type PersonalLink } from '../src/link.js';

const seed = crypto.getRandomValues(new Uint8Array(32));

describe('claim links', () => {
  it('round-trips personal links', () => {
    const d = deriveEnvelope(seed, { index: 0, total: 1000n, count: 5, kind: 'personal', split: 'random' });
    const links = linksFor(d);
    expect(links).toHaveLength(5);
    for (const link of links) expect(decodeLink(encodeLink(link))).toEqual(link);
  });

  it('round-trips group links', () => {
    const d = deriveEnvelope(seed, { index: 1, total: 900n, count: 3, kind: 'group', split: 'equal' });
    const [link] = linksFor(d);
    expect(decodeLink(encodeLink(link))).toEqual(link);
    expect(encodeLink(link).length).toBeLessThan(120);
  });

  it('keeps personal links short enough for chat apps', () => {
    const d = deriveEnvelope(seed, { index: 2, total: 10n, count: 1, kind: 'personal', split: 'equal' });
    expect(claimUrl('https://lixi.example', linksFor(d)[0]).length).toBeLessThan(320);
  });

  it('rejects malformed fragments', () => {
    const d = deriveEnvelope(seed, { index: 3, total: 10n, count: 1, kind: 'personal', split: 'equal' });
    const good = encodeLink(linksFor(d)[0]);
    expect(() => decodeLink('')).toThrow(/invalid link/);
    expect(() => decodeLink('x1.' + good.slice(3))).toThrow(/invalid link/);
    expect(() => decodeLink(good.slice(0, -4))).toThrow(/invalid link/);
    expect(() => decodeLink(good + '!')).toThrow(/base64url/);
    const zeroAmount: PersonalLink = { ...(linksFor(d)[0] as PersonalLink) };
    zeroAmount.share = { ...zeroAmount.share, amount: 0n };
    expect(() => decodeLink(encodeLink(zeroAmount))).toThrow(/invalid link/);
  });

  it('accepts pasted URLs with whitespace and trailing punctuation', () => {
    const d = deriveEnvelope(seed, { index: 4, total: 10n, count: 1, kind: 'personal', split: 'equal' });
    const link = linksFor(d)[0];
    const url = claimUrl('https://lixi.example', link);
    expect(parseClaimInput(`  ${url}).\n`)).toEqual(link);
    expect(parseClaimInput(encodeLink(link))).toEqual(link);
    expect(() => parseClaimInput('https://lixi.example/c')).toThrow(/invalid link/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @lixi/sdk`
Expected: FAIL, because `../src/envelope.js` and `../src/link.js` cannot be resolved.

- [ ] **Step 3: Implement**

`sdk/src/envelope.ts`:
```typescript
import { MAX_SHARES, buildTree, pureCircuits, type Share } from '@lixi/contract';
import { kdf } from './kdf.js';
import { equalSplit, randomSplit } from './split.js';
import type { ClaimLink } from './link.js';

export type EnvelopeKind = 'personal' | 'group';
export type SplitMode = 'equal' | 'random';

/** Everything needed to re-derive an envelope from the sender's seed. */
export type EnvelopeSpec = {
  readonly index: number;
  readonly total: bigint;
  readonly count: number;
  readonly kind: EnvelopeKind;
  readonly split: SplitMode;
};

export type DerivedEnvelope = {
  readonly spec: EnvelopeSpec;
  readonly nonce: Uint8Array;
  readonly id: Uint8Array;
  readonly shares: Share[];
  readonly groupSecret?: Uint8Array;
};

const padTo16 = (secretOf: (i: number) => Uint8Array, amounts: bigint[]): Share[] =>
  Array.from({ length: MAX_SHARES }, (_, i) => ({ secret: secretOf(i), amount: amounts[i] ?? 0n }));

/** Group members rebuild all 16 shares from the group secret carried in the link. */
export const groupShares = (groupSecret: Uint8Array, count: number, total: bigint): Share[] =>
  padTo16((i) => kdf(groupSecret, 'share', i), equalSplit(total, count));

export const deriveEnvelope = (seed: Uint8Array, spec: EnvelopeSpec): DerivedEnvelope => {
  if (spec.kind === 'group' && spec.split !== 'equal') throw new Error('group envelopes use an equal split');
  const nonce = kdf(seed, 'nonce', spec.index);
  const id = pureCircuits.envelopeId(nonce);
  if (spec.kind === 'group') {
    const groupSecret = kdf(seed, 'group', spec.index);
    return { spec, nonce, id, groupSecret, shares: groupShares(groupSecret, spec.count, spec.total) };
  }
  const amounts =
    spec.split === 'equal'
      ? equalSplit(spec.total, spec.count)
      : randomSplit(spec.total, spec.count, kdf(seed, 'split', spec.index));
  return { spec, nonce, id, shares: padTo16((i) => kdf(seed, 'share', spec.index, i), amounts) };
};

/** Claim links for an envelope: one per real share, or a single group link. */
export const linksFor = (d: DerivedEnvelope): ClaimLink[] => {
  if (d.spec.kind === 'group') {
    return [{ kind: 'group', id: d.id, groupSecret: d.groupSecret!, count: d.spec.count, total: d.spec.total }];
  }
  const tree = buildTree(d.id, d.shares);
  return Array.from({ length: d.spec.count }, (_, i) => ({
    kind: 'personal' as const,
    id: d.id,
    share: d.shares[i],
    path: tree.pathFor(i),
  }));
};
```

`sdk/src/link.ts`:
```typescript
import { MAX_SHARES, TREE_DEPTH, type PathEntry, type Share } from '@lixi/contract';
import { bigintToBytes, bytesToBigint, fromBase64Url, toBase64Url } from './bytes.js';

export type PersonalLink = { kind: 'personal'; id: Uint8Array; share: Share; path: PathEntry[] };
export type GroupLink = { kind: 'group'; id: Uint8Array; groupSecret: Uint8Array; count: number; total: bigint };
export type ClaimLink = PersonalLink | GroupLink;

const PERSONAL = 'v1.';
const GROUP = 'g1.';
const PERSONAL_LEN = 32 + 32 + 8 + TREE_DEPTH * 33;
const GROUP_LEN = 32 + 32 + 1 + 16;

export const encodeLink = (link: ClaimLink): string => {
  if (link.kind === 'group') {
    const body = new Uint8Array(GROUP_LEN);
    body.set(link.id, 0);
    body.set(link.groupSecret, 32);
    body[64] = link.count;
    body.set(bigintToBytes(link.total, 16), 65);
    return GROUP + toBase64Url(body);
  }
  if (link.path.length !== TREE_DEPTH) throw new Error('bad path length');
  const body = new Uint8Array(PERSONAL_LEN);
  body.set(link.id, 0);
  body.set(link.share.secret, 32);
  body.set(bigintToBytes(link.share.amount, 8), 64);
  link.path.forEach((e, d) => {
    body.set(bigintToBytes(e.sibling, 32), 72 + d * 33);
    body[72 + d * 33 + 32] = e.goesLeft ? 1 : 0;
  });
  return PERSONAL + toBase64Url(body);
};

/** Parses the URL fragment (without '#'). Throws on anything malformed. */
export const decodeLink = (fragment: string): ClaimLink => {
  if (fragment.startsWith(GROUP)) {
    const body = fromBase64Url(fragment.slice(GROUP.length));
    if (body.length !== GROUP_LEN) throw new Error('invalid link');
    const count = body[64];
    if (count < 1 || count > MAX_SHARES) throw new Error('invalid link');
    return {
      kind: 'group',
      id: body.slice(0, 32),
      groupSecret: body.slice(32, 64),
      count,
      total: bytesToBigint(body.slice(65)),
    };
  }
  if (fragment.startsWith(PERSONAL)) {
    const body = fromBase64Url(fragment.slice(PERSONAL.length));
    if (body.length !== PERSONAL_LEN) throw new Error('invalid link');
    const path = Array.from({ length: TREE_DEPTH }, (_, d) => {
      const flag = body[72 + d * 33 + 32];
      if (flag > 1) throw new Error('invalid link');
      return { sibling: bytesToBigint(body.slice(72 + d * 33, 72 + d * 33 + 32)), goesLeft: flag === 1 };
    });
    const amount = bytesToBigint(body.slice(64, 72));
    if (amount === 0n) throw new Error('invalid link');
    return { kind: 'personal', id: body.slice(0, 32), share: { secret: body.slice(32, 64), amount }, path };
  }
  throw new Error('invalid link');
};

export const claimUrl = (origin: string, link: ClaimLink): string => `${origin}/c#${encodeLink(link)}`;

/**
 * Accepts what people actually paste: a full URL, a bare fragment, surrounding whitespace,
 * or trailing punctuation added by chat apps ("…abc)." ). Throws 'invalid link' otherwise.
 */
export const parseClaimInput = (text: string): ClaimLink => {
  const afterHash = text.trim().split('#').pop() ?? '';
  return decodeLink(afterHash.replace(/[^A-Za-z0-9_-]+$/, ''));
};
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: contract `32 passed`, SDK `Tests  14 passed (14)`.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`. Expected: exits 0.
```bash
git add sdk/
git commit -m "feat(sdk): seed-derived envelopes and paste-tolerant claim links"
```

---

### Task 8: SDK claim resolution, sender vault, recovery and the end-to-end flow

**Files:**
- Create: `sdk/src/claim.ts`, `sdk/src/vault.ts`, `sdk/src/recovery.ts`, `sdk/src/index.ts`, `sdk/test/flow.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 5 and 7, plus `LixiSimulator` and `T0` from `@lixi/contract/testing`.
- Produces:
  - `resolveClaim(link, isClaimed: (nf: bigint) => boolean, random?): ClaimArgs { id; share; path }`
  - `SenderVault { seed; envelopes: SavedEnvelope[] }`, with helpers:
    - `newVault(seed?)`, `nextIndex(vault)`, `addEnvelope(vault, env)`
    - `backupString(vault)`, `seedFromBackup(text)`
    - `serializeVault(vault)`, `deserializeVault(json)`
    - `privateStateOf(vault): LixiPrivateState`
  - `recoverVault(seed, lookup: (id) => { root; deposit; expiry } | undefined, gapLimit = 5): SenderVault`
  - `@lixi/sdk` package entry (`sdk/src/index.ts`)

- [ ] **Step 1: Write the failing test**

`sdk/test/flow.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { buildTree, pureCircuits, toHex } from '@lixi/contract';
import { LixiSimulator, T0 } from '@lixi/contract/testing';
import { resolveClaim } from '../src/claim.js';
import { deriveEnvelope, linksFor, type EnvelopeSpec } from '../src/envelope.js';
import { decodeLink, encodeLink } from '../src/link.js';
import { recoverVault } from '../src/recovery.js';
import {
  addEnvelope, backupString, deserializeVault, newVault, nextIndex, privateStateOf, seedFromBackup, serializeVault,
} from '../src/vault.js';

const HOUR = 3600;
const expiry = BigInt(T0 + 2 * HOUR);
const rnd = () => crypto.getRandomValues(new Uint8Array(32));

const setup = (specs: Omit<EnvelopeSpec, 'index'>[]) => {
  const sim = new LixiSimulator(BigInt(HOUR));
  let vault = newVault();
  const refundAddr = rnd();
  for (const s of specs) {
    const spec = { ...s, index: nextIndex(vault) };
    vault = addEnvelope(vault, { ...spec, expiry, labels: [] });
    sim.privateState = privateStateOf(vault);
    sim.create(deriveEnvelope(vault.seed, spec).nonce, expiry, refundAddr, spec.kind === 'group');
  }
  const isClaimed = (nf: bigint) => sim.ledger().nullifiers.member(nf);
  return { sim, vault, refundAddr, isClaimed };
};

describe('SDK ↔ contract flow', () => {
  it('SDK roots match the contract for every mode', () => {
    const { sim, vault } = setup([
      { total: 1000n, count: 4, kind: 'personal', split: 'equal' },
      { total: 1000n, count: 7, kind: 'personal', split: 'random' },
      { total: 900n, count: 3, kind: 'group', split: 'equal' },
    ]);
    for (const e of vault.envelopes) {
      const d = deriveEnvelope(vault.seed, e);
      expect(sim.ledger().envelopes.lookup(d.id).root).toBe(buildTree(d.id, d.shares).root);
    }
  });

  it('personal links claim through encode → decode → resolve', () => {
    const { sim, vault, isClaimed } = setup([{ total: 1000n, count: 3, kind: 'personal', split: 'random' }]);
    const d = deriveEnvelope(vault.seed, vault.envelopes[0]);
    let paid = 0n;
    for (const link of linksFor(d)) {
      const { id, share, path } = resolveClaim(decodeLink(encodeLink(link)), isClaimed);
      const who = rnd();
      sim.claim(id, share, path, who);
      paid += sim.lastPayouts().get(toHex(who))!;
    }
    expect(paid).toBe(1000n);
    expect(() => resolveClaim(linksFor(d)[0], isClaimed)).toThrow(/already claimed/);
  });

  it('group links hand out every share once, then report none left', () => {
    const { sim, vault, isClaimed } = setup([{ total: 900n, count: 3, kind: 'group', split: 'equal' }]);
    const [link] = linksFor(deriveEnvelope(vault.seed, vault.envelopes[0]));
    for (let i = 0; i < 3; i++) {
      const { id, share, path } = resolveClaim(decodeLink(encodeLink(link)), isClaimed);
      sim.claim(id, share, path, rnd());
    }
    expect(() => resolveClaim(link, isClaimed)).toThrow(/all shares claimed/);
  });

  it('refunds from vault-derived private state after expiry', () => {
    const { sim, vault, refundAddr, isClaimed } = setup([{ total: 500n, count: 5, kind: 'personal', split: 'equal' }]);
    const d = deriveEnvelope(vault.seed, vault.envelopes[0]);
    const first = resolveClaim(linksFor(d)[0], isClaimed);
    sim.claim(first.id, first.share, first.path, rnd());
    sim.now = Number(expiry);
    sim.privateState = privateStateOf(vault);
    sim.refund(d.id);
    expect(sim.lastPayouts().get(toHex(refundAddr))).toBe(400n);
  });

  it('recovers the whole vault from the backup string alone', () => {
    const { sim, vault } = setup([
      { total: 1000n, count: 4, kind: 'personal', split: 'equal' },
      { total: 777n, count: 16, kind: 'personal', split: 'random' },
      { total: 900n, count: 3, kind: 'group', split: 'equal' },
    ]);
    const seed = seedFromBackup(backupString(vault));
    const lookup = (id: Uint8Array) => {
      const l = sim.ledger();
      return l.envelopes.member(id) ? l.envelopes.lookup(id) : undefined;
    };
    const recovered = recoverVault(seed, lookup);
    const strip = (v: typeof vault) => v.envelopes.map(({ labels: _l, ...rest }) => rest);
    expect(strip(recovered)).toEqual(strip(vault));
    expect(pureCircuits.envelopeId(deriveEnvelope(seed, recovered.envelopes[1]).nonce)).toEqual(
      deriveEnvelope(vault.seed, vault.envelopes[1]).id,
    );
  });

  it('serializes and restores the vault', () => {
    let vault = newVault();
    vault = addEnvelope(vault, { index: 0, total: 5n, count: 2, kind: 'personal', split: 'random', expiry, labels: ['Mẹ', 'Bố'] });
    expect(deserializeVault(serializeVault(vault))).toEqual(vault);
    expect(() => seedFromBackup('nope')).toThrow(/not a Lixi backup/);
    expect(seedFromBackup(`\n  ${backupString(vault)}  \n`)).toEqual(vault.seed);
  });

  it('recovers envelopes after up to four burned indices (failed creates)', () => {
    const sim = new LixiSimulator(BigInt(HOUR));
    let vault = newVault();
    for (const index of [0, 5]) {
      const spec = { index, total: 300n, count: 3, kind: 'personal' as const, split: 'equal' as const };
      vault = addEnvelope(vault, { ...spec, expiry, labels: [] });
      sim.privateState = privateStateOf(vault);
      sim.create(deriveEnvelope(vault.seed, spec).nonce, expiry, rnd(), false);
    }
    const l = sim.ledger();
    const recovered = recoverVault(vault.seed, (id) => (l.envelopes.member(id) ? l.envelopes.lookup(id) : undefined));
    expect(recovered.envelopes.map((e) => e.index)).toEqual([0, 5]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -w @lixi/sdk`
Expected: FAIL, because `../src/claim.js`, `../src/recovery.js` and `../src/vault.js` cannot be resolved.

- [ ] **Step 3: Implement**

`sdk/src/claim.ts`:
```typescript
import { buildTree, pureCircuits, type PathEntry, type Share } from '@lixi/contract';
import { groupShares } from './envelope.js';
import type { ClaimLink } from './link.js';

export type ClaimArgs = { readonly id: Uint8Array; readonly share: Share; readonly path: PathEntry[] };

/**
 * Turns a link into claim arguments. For a group link, picks a random share whose
 * nullifier is not yet on-chain. Throws when nothing is left to claim.
 */
export const resolveClaim = (
  link: ClaimLink,
  isClaimed: (nullifier: bigint) => boolean,
  random: () => number = Math.random,
): ClaimArgs => {
  if (link.kind === 'personal') {
    if (isClaimed(pureCircuits.nullifierOf(link.id, link.share.secret))) throw new Error('already claimed');
    return { id: link.id, share: link.share, path: link.path };
  }
  const shares = groupShares(link.groupSecret, link.count, link.total);
  const open = shares
    .map((share, index) => ({ share, index }))
    .filter(({ share }) => share.amount > 0n && !isClaimed(pureCircuits.nullifierOf(link.id, share.secret)));
  if (open.length === 0) throw new Error('all shares claimed');
  const pick = open[Math.floor(random() * open.length)];
  return { id: link.id, share: pick.share, path: buildTree(link.id, shares).pathFor(pick.index) };
};
```

`sdk/src/vault.ts`:
```typescript
import { emptyPrivateState, withEnvelopeShares, type LixiPrivateState } from '@lixi/contract';
import { fromBase64Url, toBase64Url } from './bytes.js';
import { deriveEnvelope, type EnvelopeSpec } from './envelope.js';

export type SavedEnvelope = EnvelopeSpec & { readonly expiry: bigint; readonly labels: readonly string[] };

/** The sender's local state. The seed alone can rebuild everything except labels. */
export type SenderVault = { readonly seed: Uint8Array; readonly envelopes: readonly SavedEnvelope[] };

const BACKUP_PREFIX = 'lixi_';

export const newVault = (seed: Uint8Array = crypto.getRandomValues(new Uint8Array(32))): SenderVault => {
  if (seed.length !== 32) throw new Error('seed must be 32 bytes');
  return { seed, envelopes: [] };
};

export const nextIndex = (vault: SenderVault): number =>
  vault.envelopes.reduce((max, e) => Math.max(max, e.index + 1), 0);

export const addEnvelope = (vault: SenderVault, envelope: SavedEnvelope): SenderVault => ({
  ...vault,
  envelopes: [...vault.envelopes.filter((e) => e.index !== envelope.index), envelope],
});

export const backupString = (vault: SenderVault): string => BACKUP_PREFIX + toBase64Url(vault.seed);

export const seedFromBackup = (text: string): Uint8Array => {
  const trimmed = text.trim();
  if (!trimmed.startsWith(BACKUP_PREFIX)) throw new Error('not a Lixi backup');
  const seed = fromBase64Url(trimmed.slice(BACKUP_PREFIX.length));
  if (seed.length !== 32) throw new Error('not a Lixi backup');
  return seed;
};

export const serializeVault = (vault: SenderVault): string =>
  JSON.stringify({
    seed: toBase64Url(vault.seed),
    envelopes: vault.envelopes.map((e) => ({ ...e, total: e.total.toString(), expiry: e.expiry.toString() })),
  });

export const deserializeVault = (json: string): SenderVault => {
  const raw = JSON.parse(json) as { seed: string; envelopes: Array<Record<string, unknown>> };
  return {
    seed: fromBase64Url(raw.seed),
    envelopes: raw.envelopes.map((e) => ({
      index: Number(e.index),
      total: BigInt(e.total as string),
      count: Number(e.count),
      kind: e.kind as SavedEnvelope['kind'],
      split: e.split as SavedEnvelope['split'],
      expiry: BigInt(e.expiry as string),
      labels: (e.labels as string[]) ?? [],
    })),
  };
};

/** Contract private state (shares by envelope id) for every envelope in the vault. */
export const privateStateOf = (vault: SenderVault): LixiPrivateState =>
  vault.envelopes.reduce((state, e) => {
    const d = deriveEnvelope(vault.seed, e);
    return withEnvelopeShares(state, d.id, d.shares);
  }, emptyPrivateState());
```

`sdk/src/recovery.ts`:
```typescript
import { MAX_SHARES, buildTree, pureCircuits } from '@lixi/contract';
import { kdf } from './kdf.js';
import { deriveEnvelope, type EnvelopeKind, type EnvelopeSpec, type SplitMode } from './envelope.js';
import type { SenderVault } from './vault.js';

export type OnChainEnvelope = { readonly root: bigint; readonly deposit: bigint; readonly expiry: bigint };

const MODES: ReadonlyArray<[EnvelopeKind, SplitMode]> = [
  ['personal', 'equal'],
  ['personal', 'random'],
  ['group', 'equal'],
];

const matchSpec = (seed: Uint8Array, index: number, env: OnChainEnvelope): EnvelopeSpec | undefined => {
  for (let count = 1; count <= MAX_SHARES && BigInt(count) <= env.deposit; count++) {
    for (const [kind, split] of MODES) {
      const d = deriveEnvelope(seed, { index, total: env.deposit, count, kind, split });
      if (buildTree(d.id, d.shares).root === env.root) return d.spec;
    }
  }
  return undefined;
};

/**
 * Rebuilds a sender vault from the seed alone: scan envelope indices until `gapLimit`
 * consecutive misses, then brute-force (count × mode) against each on-chain root.
 * Recipient labels are local-only and come back empty.
 */
export const recoverVault = (
  seed: Uint8Array,
  lookup: (id: Uint8Array) => OnChainEnvelope | undefined,
  gapLimit = 5,
): SenderVault => {
  const envelopes: SenderVault['envelopes'][number][] = [];
  for (let index = 0, misses = 0; misses < gapLimit; index++) {
    const env = lookup(pureCircuits.envelopeId(kdf(seed, 'nonce', index)));
    if (!env) {
      misses++;
      continue;
    }
    misses = 0;
    const spec = matchSpec(seed, index, env);
    if (spec) envelopes.push({ ...spec, expiry: env.expiry, labels: [] });
  }
  return { seed, envelopes };
};
```

`sdk/src/index.ts`:
```typescript
export * from './bytes.js';
export * from './kdf.js';
export * from './split.js';
export * from './envelope.js';
export * from './link.js';
export * from './claim.js';
export * from './vault.js';
export * from './recovery.js';
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: contract `Tests  32 passed (32)`, SDK `Tests  21 passed (21)`.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`. Expected: exits 0.
```bash
git add sdk/
git commit -m "feat(sdk): claim resolution, sender vault with backup, seed recovery; SDK↔contract flow tests"
```

---

### Task 9: CI, developer README, full compile, push and merge

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md` (add a Develop section)

**Interfaces:**
- Consumes: root scripts `typecheck`, `test`, `compact`.
- Produces: a green CI run on `feat/core` and on `main`.

- [ ] **Step 1: Full compile with proving keys (the buildathon gate)**

Run: `npm run compact && ls -la contract/src/managed/lixi/keys | awk '/prover/{print $5, $9}'`
Expected: exits 0 after roughly 1–2 minutes. It prints three prover keys of about `554079 claim.prover`, `5207938 createEnvelope.prover` and `4249036 refund.prover` bytes (±5%).

- [ ] **Step 2: Write the CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
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
      - run: npm run typecheck
      - run: npm test
      - name: Full compile with proving keys
        run: npm run compact
```

- [ ] **Step 3: Add the Develop section to `README.md`**

Insert before `## License`:
````markdown
## Develop

Prerequisites: Node 24 (`nvm use`) and the Compact toolchain with compiler 0.31.1:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31.1
```

Then:

```bash
npm ci
npm test            # compiles the contract (without proving keys) and runs every test
npm run typecheck
npm run compact     # full compile with proving keys (~1–2 min)
```

| Package | What it holds |
|---|---|
| `contract/` | `lixi.compact`, generated bindings, Merkle helper, private-state witness, simulator tests |
| `sdk/` | Seed derivation, splits, claim links, sender vault, recovery |

````

- [ ] **Step 4: Commit and push the branch**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: compile Compact 0.31.1, typecheck and test on every push"
git push -u origin feat/core
```

- [ ] **Step 5: Watch CI**

Run: `gh run watch --exit-status $(gh run list --branch feat/core --limit 1 --json databaseId --jq '.[0].databaseId')`
Expected: every step succeeds and the command exits 0. If a step fails, stop and use superpowers:systematic-debugging on the failing step's log (`gh run view --log-failed`). The most likely candidate is the Compact installer path on Linux.

- [ ] **Step 6: Merge into `main` and verify**

```bash
git switch main
git merge --ff-only feat/core
git push origin main
gh run watch --exit-status $(gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
```
Expected: the fast-forward succeeds and the `main` CI run exits 0.

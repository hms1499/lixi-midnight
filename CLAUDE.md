# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Lixi: private red envelopes on Midnight (Midnight Buildathon entry).
- The design authority is `docs/superpowers/specs/2026-09-30-lixi-design.md`.
- Implementation plans live in `docs/superpowers/plans/`.

## Toolchain
- Node 24 is required, but the shell defaults to Node 22. Run `source ~/.nvm/nvm.sh && nvm use 24` before any npm command.
- The `compact` CLI lives in `~/.local/bin`.
- Pinned versions:
  - compiler **0.31.1** (`compact update 0.31.1`)
  - `pragma language_version 0.23`
  - `@midnight-ntwrk/compact-runtime` **0.16.0**, which must match `compact compile --runtime-version`
- Don't write Compact from memory. Use the `compact-contract` skill, and compile after every `.compact` change.

## Commands
- `npm test` / `npm run typecheck`: both compile the contract first (`compact compile --skip-zk`), then run every workspace.
- Single test: `npm test -w @lixi/contract -- -t "rejects a forged Merkle path"` (or `-w @lixi/sdk`). This skips the root pre-compile, so run `npm run compact:fast` first if `contract/src/managed/` is missing or stale.
- `npm run compact`: full compile with proving keys into `contract/src/managed/lixi/keys`.
- `npm run lint` (ESLint + typescript-eslint) and `npm run format:check` (Prettier: single quotes, trailing commas, width 120) both run in CI. Project hooks auto-format edited TS/JSON files and compile edited `.compact` files; a Compact compile error blocks until fixed.
- `contract/src/managed/` is generated and gitignored. Never edit it.
- Local proof server: Docker container `midnight-proof-server` on port 6300 (`docker start midnight-proof-server`, then `curl localhost:6300/health`).
- Devnet: `docker compose -f devnet/compose.yml up -d --wait`. Stop `midnight-proof-server` first, because it also wants port 6300. For Preprod, start only `proof-server` from the same file.
- Chain scripts: `npm run test:devnet -w @lixi/cli`, or `deploy`/`smoke`/`sponsor` with `-- --network <undeployed|preprod>`. They recompile the proving keys first, because `npm test` deletes them. The Preprod deployer secret lives in gitignored `cli/.env`, as `LIXI_DEPLOYER_MNEMONIC` (recovery phrase) or `LIXI_DEPLOYER_SEED` (64 hex), next to `BLOCKFROST_PROJECT_ID`. The first Preprod run syncs ~1.6M DUST events from genesis (~67 min on Blockfrost with `batchUpdates: { size: 2000 }`; the SDK default of 10 takes hours). Sync state is cached in gitignored `cli/.wallet-cache/` (owner-only, one file per indexer host), so later runs are fast. Never commit or share that folder.
- App: `npm run dev -w @lixi/app` (no CSP), or `npm run build -w @lixi/app && npm run preview -w @lixi/app` for the built site with the CSP on http://localhost:4173. Both first copy `keys/` and `zkir/` into `app/public/` (`npm run zk -w @lixi/app`), compiling the keys if `npm test` deleted them.
- CI: `ci.yml` runs on every push (~2 min). `devnet.yml` runs only when `contract/`, `sdk/`, `cli/`, `devnet/` or the lockfile change, or by hand: `gh workflow run devnet.yml --ref <branch>`.

## Invariants (don't break)
- `npm ls @midnight-ntwrk/onchain-runtime-v3` must show one version (3.0.0, root `overrides`). Two copies break every circuit call with `expected instance of StateValue`. After installing, run `npm dedupe`.
- Every deployment relinquishes its maintenance authority (`relinquishAuthority`, an empty committee). Proving is always local (`NETWORKS[*].proofServer`).
- Use `memoryPrivateStateProvider`. The vault is the source of truth for shares.
- Packages export TypeScript sources directly (`exports` → `./src/*.ts`); there is no build step. `@lixi/contract/testing` exports the simulator.
- `MAX_SHARES = 16` and `TREE_DEPTH = 4` in `contract/src/constants.ts` must match `Vector<16, Share>` and `Vector<4, PathEntry>` in `lixi.compact`.
- Hashing is a deliberate choice (spec §3.2):
  - `envelopeId` uses `persistentHash`.
  - Leaf, node, nullifier and address hashes use `transientHash` (Poseidon) with tags 1–4.
  - Off-chain code must hash through the compiled `pureCircuits` (or `buildTree`). Never reimplement these hashes in TypeScript.
- `claim` only reads the envelope and never writes it, so concurrent claims don't conflict.
- Times are unix **seconds**. Amounts are `bigint` base units, and each share must fit in `Uint<64>`.
- Secrets (the seed and share secrets) never appear in logs or error messages. Link secrets live only in the URL fragment.
- The CSP is defined twice: `app/src/csp.ts` (meta tag in the built page) and `app/vercel.json` (header). `app/test/config.test.ts` keeps them equal; a new host the page talks to goes into both.
- Preprod goes through Blockfrost, because Midnight is shutting down its official Preprod indexer and RPC (midnight-wallet#781).
  - `NETWORKS.preprod` holds the bare URLs, which the CSP lists. `networkConfig` adds `?project_id=`.
  - The CLI reads `BLOCKFROST_PROJECT_ID` from `cli/.env`. The app reads `VITE_BLOCKFROST_PROJECT_ID` at build time from gitignored `app/.env.local`. CI builds with the placeholder `ci-build-check`, because it never uses the page. Without it, the build and the dev server stop. The id ships in the page.
  - Never log or print an endpoint URL, because it carries the id. Pass error text through `redactUrl`.
  - App reads never use the wallet's indexer, so the CSP can list every host.
  - Wallet sync cursors are indexer ids, so a sync cache is valid only on the indexer that wrote it.
- The sender vault lives in `localStorage` (`app/src/lib/storage.ts`). Its entry is saved before `createEnvelope` is submitted, and a vault that fails to parse is only replaced by an explicit restore.
- Pages reach the outside world only through `Services` (`app/src/services.tsx`).
- The look is set by `docs/superpowers/specs/2026-10-02-lixi-frontend-design.md`. Colours live in `app/src/theme.ts` and `app/src/index.css`, and `app/test/theme.test.ts` keeps them equal and above WCAG AA. A light’s state always means the same thing: lit = waiting, out = opened, gold = coming home, dashed = not on chain, pulsing = in flight.

## Testing quirks
- Devnet tests use the public genesis seed `00…01` and fresh random wallets. A `submission rejected, retrying` warning is expected now and then.
- Tests run the real compiled contract through `LixiSimulator`. Each call builds a fresh context, so effects are per call.
- `sim.ledger()` returns a snapshot. Take it after the calls you want to observe; a stale snapshot throws `expected a cell, received null`.
- To control block time, set `sim.now` (unix seconds) before a call.
- App page tests run the whole app in jsdom (`// @vitest-environment jsdom`) through `app/test/app-harness.tsx`: the real contract via `LixiSimulator`, a fake wallet, in-memory storage.

## Git
- Work on `feat/*` branches. When CI is green, fast-forward merge into `main`; no PRs.
- Use conventional commits (`feat(contract): …`, `feat(sdk): …`, `docs: …`, `ci: …`).
- CI installs Compact 0.31.1, then runs typecheck, tests and the full compile. Check a run with `gh run watch`.
- Root `package.json` overrides `source-map-js` to `1.2.1`, because the 1.2.2 tarball returned 404 from npm. Keep the override until that is fixed.

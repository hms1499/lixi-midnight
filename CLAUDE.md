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

## Invariants (don't break)
- Packages export TypeScript sources directly (`exports` → `./src/*.ts`); there is no build step. `@lixi/contract/testing` exports the simulator.
- `MAX_SHARES = 16` and `TREE_DEPTH = 4` in `contract/src/constants.ts` must match `Vector<16, Share>` and `Vector<4, PathEntry>` in `lixi.compact`.
- Hashing is a deliberate choice (spec §3.2):
  - `envelopeId` uses `persistentHash`.
  - Leaf, node, nullifier and address hashes use `transientHash` (Poseidon) with tags 1–4.
  - Off-chain code must hash through the compiled `pureCircuits` (or `buildTree`). Never reimplement these hashes in TypeScript.
- `claim` only reads the envelope and never writes it, so concurrent claims don't conflict.
- Times are unix **seconds**. Amounts are `bigint` base units, and each share must fit in `Uint<64>`.
- Secrets (the seed and share secrets) never appear in logs or error messages. Link secrets live only in the URL fragment.

## Testing quirks
- Tests run the real compiled contract through `LixiSimulator`. Each call builds a fresh context, so effects are per call.
- `sim.ledger()` returns a snapshot. Take it after the calls you want to observe; a stale snapshot throws `expected a cell, received null`.
- To control block time, set `sim.now` (unix seconds) before a call.

## Git
- Work on `feat/*` branches. When CI is green, fast-forward merge into `main`; no PRs.
- Use conventional commits (`feat(contract): …`, `feat(sdk): …`, `docs: …`, `ci: …`).
- CI installs Compact 0.31.1, then runs typecheck, tests and the full compile. Check a run with `gh run watch`.
- Root `package.json` overrides `source-map-js` to `1.2.1`, because the 1.2.2 tarball returned 404 from npm. Keep the override until that is fixed.

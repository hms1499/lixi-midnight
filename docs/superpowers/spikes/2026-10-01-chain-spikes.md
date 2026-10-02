# Chain spikes (S1–S5), 2026-10-01

Plan 2 (`docs/superpowers/plans/2026-10-01-lixi-plan-2-chain.md`) ran these spikes. S1, S2, S3 and the headless half of S5 come from the devnet suite (`npm run test:devnet -w @lixi/cli`, 19/19). S4 and the browser half of S5 were run by hand on Preprod against contract `971f70aeb5c33bcafde88471431d7e0fc3b5e1a75fc31ce9d3bc0d90499d1f61` (`deployments/preprod.json`), using the throwaway page in `spikes/s4-wallet` (removed in Plan 3; see git history; `app/src/chain/midnight.ts` is its successor).

| ID | Question | Result | Decision |
|---|---|---|---|
| S1 | Do two concurrent claims on one envelope both succeed? | Yes: `devnet.test.ts` "pays two concurrent claims", both payouts exact. | Keep the v2 design; no claim serialization in the UI. |
| S2 | Proving time per circuit (local proof server 8.1.0) | createEnvelope 0.9–1.9 s, claim 0.2–2.5 s, refund 0.9–1.3 s; end-to-end tx 15–25 s (block + indexer). Browser on Preprod: claim proved by the local server in 0.6–1.2 s; 1AM balanced in 6.7 s; submit to inclusion ~20 s. | Far under the 30 s profiling threshold. The UI shows a progress state for ~20–30 s per transaction. |
| S3 | Does `nativeToken()` move tNIGHT? | Yes: deposits and payouts move NIGHT, and the sender's balance delta equals exactly the claimed shares. Preprod smoke: 2 claims paid 1,059,505 + 940,495 = 2,000,000 base units. | Nothing to change. |
| S4 | Which browser wallet proves and balances a claim? | **1AM: yes, end to end, both with its own prover and with the local proof server.** Lace: cannot connect on Preprod. Details below. | **Must tier: 1AM**, proving through `getProvingProvider` (no Docker for recipients). Should tier: Lace through the local proof server, once its connect works. |
| S5 | Can a sponsor pay DUST for a recipient with no DUST? | Headless on the devnet: yes. A recipient with 0 NIGHT and 0 DUST claimed 1 tNIGHT; the sponsor added only the DUST fee. Browser on Preprod: 1AM produced a sponsorable bound transaction (`payFees: false`). The Node sponsor then hung on Preprod twice, inside the wallet SDK. | **Wave 3.** The wallet side works. A hosted sponsor depends on the headless wallet SDK, which hangs on Preprod (see below), so it does not fit in one day. |

## S4 runs (Preprod, 2026-10-01)

| Run | Wallet | Prover | Fees | Result |
|---|---|---|---|---|
| A (first try) | 1AM, **same recovery phrase as the deployer** | wallet | wallet | Failed: the 1AM UI showed `r.identifiers is not iterable` while proving. |
| A′ | 1AM, same shared phrase | local :6300 | wallet | Proved and balanced. `submitTransaction` resolved, but the transaction never reached the chain; 1AM kept it "pending". Every later attempt got `A transaction is already pending. Wait for it to confirm or expire before requesting another.` |
| A″ | 1AM, **fresh wallet with its own phrase** | local :6300 | wallet | **Success:** tx `a31562fb…8bb6`, block 2791449, `ContractCall` SUCCESS. |
| A (retest) | 1AM, fresh wallet | **wallet** (`getProvingProvider`) | wallet | **Success:** tx `aaba65c9…31cc`, block 2791479, `ContractCall` SUCCESS. |
| B | Lace (connector API 4.0.1) | local :6300 | wallet | Failed: `connect('preprod')` never resolves. The Authorize popup opens, but clicking Authorize does nothing. The result was the same after unlocking, checking sync and restarting the browser. |
| C | Lace | wallet | wallet | Not run: Lace does not implement `getProvingProvider` (Midnight wallet reference). |
| D | 1AM, fresh wallet with 0 NIGHT and 0 DUST | local :6300 | sponsor | Browser side OK: a bound `Transaction<SignatureEnabled, Proof, Binding>` (27,194 hex chars) that deserializes. Sponsor side hung (see S5). |

Every result was checked on the Preprod indexer, not only in the wallet UI.

The shared phrase is the likely cause of the A/A′ failures:
- The deployer (headless), 1AM and Lace all held one recovery phrase.
- The headless wallet had spent DUST shortly before, so 1AM probably built on stale DUST state.
- The same flows passed as soon as 1AM had a wallet of its own.

## Findings Plan 3 must carry
- **Bundling:** Vite 8 with `vite-plugin-wasm` and `build.target: 'esnext'`. No top-level-await plugin (it needs rollup). A `buffer` polyfill is required. Pass the browser `WebSocket` to `indexerPublicDataProvider`.
- **Assets:** serve `keys/` and `zkir/` for `FetchZkConfigProvider`. Copy only those two folders into the app's public assets, not the whole `managed/` tree.
- **Private state:** `memoryPrivateStateProvider` is enough. The vault re-derives the shares.
- **Back-to-back transactions:** a wallet can briefly reuse a spent DUST coin, and the node then rejects the submission. Retry once after a block, then show an error.
- **Pre-checks:** run `checkClaim` and `checkRefund` before every proof (spec §4.6).
- **Use the wallet's endpoints:** 1AM's `getConfiguration()` points the indexer and prover at `api-preprod.1am.xyz`, with a session token in the indexer URL. Read the indexer from `getConfiguration()`; never log that URL.
- **H4 (where proving happens):**
  - The Midnight wallet reference says 1AM proves in the browser (WASM).
  - This spike did not inspect the network traffic during proving, so that is unverified.
  - Plan 3 must check it in DevTools before treating 1AM proving as local. If it turns out not to be local, keep a "local proof server" option for the share secret.
- **1AM connector quirks.** The app has to handle each of these:
  - The first call after ~45–65 s idle fails with `Request failed`, and an immediate retry succeeds. This was seen four times. Retry every connector call once.
  - `Wallet is syncing — open 1AM and wait for sync to finish` comes up while a wallet catches up. Show a waiting state with that instruction, then retry.
  - 1AM allows one pending transaction at a time. A submission that never lands blocks the wallet until it expires. Surface that error verbatim.
  - `getDustBalance()` reports a balance far above its `cap` (unit mismatch). Do not show `cap`, and do not compare against it.
- **Lace:**
  - `connect()` can hang with no error. Time it out (60 s), then tell the user to open Lace from the extensions menu and approve.
  - Lace has no `getProvingProvider`, so it needs the local proof server.
  - Open Lace issues on Preprod: [#2243](https://github.com/input-output-hk/lace/issues/2243) ("Wallet is unavailable" right after connect) and [#2256](https://github.com/input-output-hk/lace/issues/2256) (DUST balance freezes).
- **One wallet per key:** the demo and test wallets must not share a recovery phrase with the deployer or with each other.
- **Wallet sync:**
  - A fresh Preprod wallet replays ~1.58M DUST events. With `batchUpdates: { size: 2000 }` (the SDK default is 10), the first deploy went from start to on-chain in 34 min, at ~600–1,000 events/s. Before that change the sync ran 70+ min without finishing.
  - The indexer WebSocket stalls now and then. The SDK logs `Wallet.Sync: [object Object]` and retries by itself.
  - Recipients on a freshly installed wallet will meet the same first sync. The claim page should explain it.
- **Headless wallet SDK hang (blocks S5 on Preprod):**
  - The sponsor's `balanceFinalizedTransaction` ran 10+ min at ~300% CPU with RSS climbing.
  - A rerun that first waited for sync froze right after restoring a 75-min-old cache: the DUST counter did not move, and RSS grew from 0.6 to 3.2 GB in 12 min.
  - This matches [servicedesk#194](https://github.com/midnightntwrk/servicedesk/issues/194) (facade 4.1.0, dust 4.2.0; our versions) and [midnight-wallet#784](https://github.com/midnightntwrk/midnight-wallet/issues/784).
  - A 4-min-old cache restored and transacted fine.
  - It is not root-caused. Re-test when the wallet SDK moves past these versions.

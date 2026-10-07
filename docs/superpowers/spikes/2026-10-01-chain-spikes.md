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

## S4 retest: Lace 2.4.2 against the built app (Preprod, 2026-10-02)

Run during 1AM's DUST outage, on the built site with the CSP (`vite preview`) and the local proof server.

| Step | Result |
|---|---|
| `connect('preprod')` | **Works.** The run B hang is gone, and #2243 ("Wallet is unavailable" right after connect) did not occur either. |
| Prove, "On this computer" (`127.0.0.1:6300`) | **Works.** The proof server logged `/check` + `/prove` (~0.25 s) for each attempt. |
| Prove, "In my wallet" | Blocked by the CSP. Lace 2.4.2 now has `getProvingProvider`, but it proves through its own proof-server setting, `http://localhost:6300` for Local. CSP treats that as a different host from `127.0.0.1`. **Fixed:** the CSP lists both loopback names. A Remote setting stays blocked, which keeps audit H4. |
| Sign prompt | Shows the right claim (1 tNIGHT to the wallet's own address, `dust_actions: None`). |
| Balance (DUST fee) | **Failed** with a bare `Error`. Lace reported `getDustBalance() = { balance: 0, cap: 0 }`, although its NIGHT designation (tx `354976da…6d3d`, block 2805648) had landed SUCCESS with a `DustInitialUtxo` 25+ min earlier. A browser restart did not help. Lace's DUST view is stale (matches #2256), which is external. Nothing landed on chain. |

What the app now does about it:
- A failed balance asks the wallet for its DUST and says "no DUST, generate it" when there is none. It asks only after a failure, because 1AM pays through its sponsor.
- A locked Lace (`Rejected`, "Wallet is locked") reads as locked, not as declined.
- A prover fetch that fails ("'check' returned an error: TypeError: Failed to fetch") explains how to start the local proof server.

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
  - Plan 3 skipped the DevTools check (2026-10-07), so it is still unverified. The "On this computer" prover stays in the app for anyone who wants the secret to stay local.
- **1AM connector quirks.** The app has to handle each of these:
  - The first call after ~45–65 s idle fails with `Request failed`, and an immediate retry succeeds. This was seen four times. Retry every connector call once.
  - `Wallet is syncing — open 1AM and wait for sync to finish` comes up while a wallet catches up. Show a waiting state with that instruction, then retry.
  - 1AM allows one pending transaction at a time. A submission that never lands blocks the wallet until it expires. Surface that error verbatim.
  - `getDustBalance()` reports a balance far above its `cap` (unit mismatch). Do not show `cap`, and do not compare against it.
- **Lace:**
  - `connect()` can hang with no error. Time it out (60 s), then tell the user to open Lace from the extensions menu and approve.
  - Lace 2.4.2 has `getProvingProvider`, but it proves through its own proof-server setting (Local = `http://localhost:6300`). Either way, Lace needs the local proof server.
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

## Move to Blockfrost (Preprod, 2026-10-03)

Midnight is about to shut down the official Preprod indexer and RPC (`midnight-wallet#781`, maintainer comment of 2026-10-02). Mainnet's were shut down on 2026-09-30. Lixi now reads Preprod and runs its chain scripts through Blockfrost (plan `docs/superpowers/plans/2026-10-03-lixi-blockfrost.md`).

| Step | Result | Tx / note |
|---|---|---|
| Smoke against the official indexer, restored cache | **Failed:** node `1010: Custom error: 170` (`InvalidDustSpendProof`) | `smoke.ts` built the fee before the restored wallet had synced. It now waits, as `deploy` and `sponsor` already did. |
| Same, after waiting for sync | **Failed:** `could not balance dust`. The wallet saw 4996 tNIGHT, registered, but 0 DUST coins. | The cached official-indexer DUST state was broken. |
| Genesis sync of the same wallet on Blockfrost | 35 min. 1 DUST coin, available. | It confirms the cache was the fault. That cache was deleted; caches are now keyed by indexer host. |
| Devnet suite after the change | 24/24 | The devnet needs no token. |
| Smoke on Blockfrost: create 2 × 2 tNIGHT, claim both | **Passed**, with two transactions back to back and no extra wait | create `003b6c66…30df` (block 2812825), claims `00d033df…d43a` (2812830, 1,779,816) and `0030930d…14b2` (2812835, 220,184), all SUCCESS |
| Built site (`vite preview`, CSP on) reads a link | **Passed:** "1 tNIGHT is sealed inside" | Console clean, no CSP violation. The page talks only to `midnight-preprod.blockfrost.io`. |

midnight-js returns the 33-byte transaction *identifier*. The indexer finds it with `transactions(offset: { identifier })`, not with `hash`.

What this means for the wallets in Task 11:
- 1AM's `DUST_SYNC_STALE` and Lace's DUST balance of 0 are consistent with the same indexer change. Their wallets run their own sync, so only their vendors can fix them.
- Unconfirmed.

## Plan 3 app run (Preprod, 2026-10-06 – 2026-10-07)

Built site (`vite preview`, CSP on), contract `971f70ae…1f61`, three 1AM wallets with separate phrases, prover "In my wallet". Lace was meant to run it, but its Authorize button stopped responding again on 2026-10-06. 1AM's sponsor had recovered from `DUST_SYNC_STALE` by then.

| Step | Result | Tx / note |
|---|---|---|
| CSP with the 1AM extension | **Passed:** 1AM listed, no CSP violation in any of the three profiles | |
| Where 1AM proves (H4) | **Not checked** (skipped) | Unverified. The "On this computer" prover remains the local option. |
| Create personal, 4 × lucky, 10 tNIGHT, ~24 h | **Passed** | envelope `6364c663…`; shares 1.277978 / 4.975531 / 0.257603 / 3.488888 |
| Create group, 2 × 5 tNIGHT, one per wallet | **Passed** | envelope `71297011…` |
| Claim personal link 1 | **Passed** | the chain shows 1 of 4 shares claimed |
| Group: claim, then the same wallet again | **Passed:** the second claim is refused | the chain shows 1 of 2 shares claimed |
| Bring the group envelope home after expiry | **Passed:** the unopened 5 tNIGHT came home | the chain shows `refunded = true` (read 2026-10-07) |
| Bring the personal envelope home | Pending | It expires 2026-10-07 14:58:47Z. |

Issues found and fixed:
- Lace's "In my wallet" was blocked by the CSP, because it proves via `localhost`, not `127.0.0.1`. The CSP now lists both loopback names (`f61cd79`).
- Two wallets in one browser profile see the same My envelopes list, because the vault lives in the browser's `localStorage`. This is by design. The page now says the list belongs to this browser, and that a refund goes to the wallet that sealed the envelope (`37db342`).
- Seals failed with node error 171 (`OutOfDustValidityWindow`) during 1AM's DUST outage (2026-10-02 – 03). The fault was in 1AM's infrastructure. The app now says the wallet's DUST is out of date, instead of asking for a retry.

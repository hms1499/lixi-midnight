# Lixi — Private Red Envelopes on Midnight

**Design spec · 2026-09-30 · Status: approved in chat, pending written-spec review**

Midnight Buildathon (AKINDO) entry. Wave 2 submission target: **2026-10-17** (hard deadline 2026-10-19 15:00 UTC).
Repository: `github.com/hms1499/lixi-midnight` (public, Apache-2.0).

---

## 1. Summary

Lixi lets a sender put tNIGHT into a "red envelope" split into N shares and hand out claim links. A recipient opens a link and claims their share with a zero-knowledge proof. The claim code never appears on-chain, so it cannot be stolen from the mempool. The recipient list and the unclaimed amounts stay private, and anyone can verify that the envelope is fully funded without learning how it is split.

On-chain red packets already exist (Mask Network HappyRedPacket on EVM and Solana, Red Envelopes on BSC, IRISnet). All of them are fully public. A ZK red packet (`gunatppcap/privacy-redpacket`) exists only as a README with no code. None of the ~161 Wave 1 Midnight Buildathon submissions build red envelopes.

### 1.1 What Wave 2 delivers and what it does not

| Property | Wave 2 |
|---|---|
| Claim codes never touch the chain; a copied proof cannot redirect funds | Yes |
| Recipient list, share count and unclaimed amounts are hidden (commitments) | Yes |
| Public proof that the envelope is fully funded, with the split hidden | Yes |
| Double-claim prevention (nullifiers) | Yes |
| Trust-minimized refund to the sender after expiry, no early rug-pull | Yes |
| Hiding *who received from whom, and how much* | **No.** tNIGHT is unshielded, so each claim publicly shows recipient address and amount. |

We state the last row plainly in the README and the pitch.

---

## 2. Product

### 2.1 Sender flow
1. The sender connects a wallet and enters the total tNIGHT, the share count N (≤ `MAX_SHARES`), the split mode (**equal** or **random / "lucky"**), the expiry, and the distribution mode (**personal links** or **group link**).
2. The browser derives every secret from the sender's **Lixi seed** (§4.4). It builds `MAX_SHARES` leaves; the leaves beyond N are zero-amount padding.
3. `createEnvelope` proves that the leaves sum to the deposit, stores only the Merkle root, and pulls the deposit from the wallet.
4. After the transaction confirms, the sender gets N personal links (or one group link) to share over Zalo, Telegram or any other channel.
5. The dashboard shows which shares were claimed. The sender's browser computes this locally from on-chain nullifiers. After expiry, the dashboard offers **Refund**.

### 2.2 Recipient flow
1. The recipient opens `https://<host>/c#v1.<payload>`. The payload sits in the URL fragment and is never sent to any server.
2. The page shows an "open envelope" screen and asks the recipient to connect a wallet.
3. `claim` proves that the recipient holds a valid, unclaimed share of this envelope. The proof binds the recipient address, and the amount is paid out to it.

### 2.3 Distribution modes
- **Personal links (core).** One link per share, each usable once, with `onePerAddress = false`. Supports equal and random splits.
- **Group link (Should tier).** One link for everyone, with `onePerAddress = true`. **Equal split only** in Wave 2, because group members can derive every leaf and could otherwise pick the largest share. Known limit: one person with many wallets can claim many shares.

### 2.4 Privacy model

| Data | Public on-chain | Private to |
|---|---|---|
| Sender address, deposit, expiry, refund address | ✓ | |
| Share count, split, recipient list | | sender |
| Claim code (secret) | never on-chain | link holder |
| Per claim: recipient address and amount | ✓ (unshielded payout) | |
| Which shares are still unclaimed, and their amounts | | sender |

### 2.5 Known limitations (documented in the README)
- **Fees.** The recipient needs a wallet with DUST to pay the claim fee. Fee sponsorship is Wave 3 unless spike S5 shows it is cheap to add.
- **Sender can claim.** The sender knows every secret and can claim shares before recipients do. This is inherent: it is the same as taking back your own envelope.
- **Bearer links.** A link works like cash: a leaked link means a lost share.
- **Lace needs Docker.** Lace requires a local proof server. 1AM proves in the browser. **Dropped 2026-10-07:** Lace was unstable on Preprod, so the app connects 1AM only (spec 2026-10-07-lixi-ux-polish-design.md).
- **Desktop first.** 1AM mobile (iOS and Android beta, with a dApp browser) is the Wave 3 path.

---

## 3. Contract design (v2, post-audit, revised 2026-09-30 after verification)

A single deployed contract holds every envelope. The Compact toolchain is pinned to the Preprod compatibility matrix (§5.1). The design below compiles with compiler 0.31.1, and its simulator test suite passes. Two changes came out of that verification pass:
- Merkle nodes, nullifiers and address keys now use Poseidon (`transientHash`) instead of SHA-256 (§3.2).
- A new `maxDuration` guard caps how far away the expiry can be (§3.3).

### 3.1 Ledger

```compact
export sealed ledger minDuration: Uint<64>;          // constructor: 60 s devnet, 3600 s Preprod
export sealed ledger maxDuration: Uint<64>;          // constructor: 30 days
export ledger envelopes:  Map<Bytes<32>, Envelope>;
export ledger nullifiers: Set<Field>;
export ledger addrClaims: Set<Field>;                // group mode only

witness envelopeShares(id: Bytes<32>): Vector<16, Share>;   // sender private state

struct Share     { secret: Bytes<32>, amount: Uint<64> }
struct PathEntry { sibling: Field, goesLeft: Boolean }
struct Envelope {
  root: Field,                // Merkle root over MAX_SHARES leaves
  deposit: Uint<128>,         // = Σ amounts; already public through the funding transfer
  expiry: Uint<64>,           // unix seconds
  refundAddress: UserAddress, // refunds can only go here
  onePerAddress: Boolean,
  refunded: Boolean
}
```

After creation, `claim` only **reads** the envelope. It writes only to the `nullifiers` and `addrClaims` sets, adding a distinct element each time. This keeps concurrent claims conflict-free (audit H1; a simulator test asserts it, and spike S1 checks it on the devnet).

The sender's shares reach `createEnvelope` and `refund` through the `envelopeShares` **witness**, which reads the sender's private state. This follows Midnight's private-state pattern: the data stays on the sender's machine and is proven over, never published.

### 3.2 Hashing

| Name | Definition | Hash |
|---|---|---|
| `envelopeId(nonce)` | `H(pad("lixi:id:v1"), nonce)` → `Bytes<32>` | `persistentHash` (SHA-256) |
| `leafHash(id, share)` | `H(tag 1, id, secret, amount)` → `Field` | `transientHash` (Poseidon) |
| `nodeHash(l, r)` | `H(tag 2, l, r)` | `transientHash` |
| `nullifierOf(id, secret)` | `H(tag 3, id, secret)` | `transientHash` |
| `addrKey(id, recipient)` | `H(tag 4, id, recipient)` | `transientHash` |

**Why Poseidon (decision 2026-09-30, option C).** We measured prover keys with `MAX_SHARES = 16`:

| Variant | `claim` | `createEnvelope` | `refund` |
|---|---|---|---|
| SHA-256 everywhere | 19 MB | 76 MB | 76 MB |
| Poseidon (chosen) | **0.55 MB** | **5.2 MB** | **4.2 MB** |

The docs advise storing only persistent hashes, because transient algorithms may change between compiler versions. That risk does not apply to this deployment, for two reasons:
- The contract is **immutable**, because the maintenance authority is relinquished (H5), so its circuits never change.
- The SDK computes every hash with the **same compiled pure circuits** as the deployed contract.

The remaining consequence is documented: a future redeploy built with a newer compiler cannot read envelopes created by an older deployment.

The tree is a custom fixed-depth Merkle tree with `DEPTH = 4`. `rootOf`, `rootFromPath` and every hash above are exported as **pure circuits**, so the SDK never has a second implementation that could drift.

### 3.3 Circuits

**`createEnvelope(nonce, expiry, refundAddress, onePerAddress): Bytes<32>`**
- Compute `id = envelopeId(nonce)` in-circuit, so nobody can squat the id (audit M2). Assert the id is not already in `envelopes`.
- Read `shares = envelopeShares(id)` from private state. Compute `deposit = Σ amount` and assert `deposit > 0`.
- Assert `expiry > maxDuration` (this guards both subtractions) and `now + minDuration ≤ expiry ≤ now + maxDuration`. The lower bound is audit M1. The upper bound is new (M4): it rejects an expiry given in milliseconds, which would otherwise lock funds for millennia.
- `receiveUnshielded(nativeToken(), deposit)`. On the simulator, `nativeToken()` is NIGHT (raw type all zeros), which answers S3.
- Insert the `Envelope` with `root = rootOf(id, shares)` and `refunded = false`, and return `id`.

**`claim(id, share: Share, path: Vector<4, PathEntry>, recipient: UserAddress): []`**
- Assert the envelope exists, `!refunded`, `blockTimeLt(expiry)` and `share.amount > 0`.
- Recompute the root from `leafHash(id, share)` and `path`. Assert it equals `envelope.root`.
- Compute `nf = nullifierOf(id, share.secret)`, assert it is not yet used, then insert it.
- If `onePerAddress`: compute `k = addrKey(id, recipient)`, assert it is not yet used, then insert it.
- `sendUnshielded(nativeToken(), amount, right(recipient))`.
- Disclosed values: `nf`, `amount`, `recipient`, `id`. The secret, the path and the leaf position stay private.

**`refund(id): []`**
- Assert the envelope exists, `!refunded` and `blockTimeGte(expiry)`.
- Read `shares = envelopeShares(id)` from private state. Assert `rootOf(id, shares) == envelope.root`.
- `unclaimed = Σ amount_i` over every i where `nullifierOf(id, secret_i)` is not in `nullifiers`.
- Set `refunded = true`. If `unclaimed > 0`, `sendUnshielded(nativeToken(), unclaimed, right(refundAddress))`.
- Anyone who holds the shares may call `refund`, for example a group member, but the funds only ever go to `refundAddress`. No owner key exists that could be lost (audit H2).

### 3.4 Constants
- **`MAX_SHARES = 16`, `DEPTH = 4`.** Fixed. With Poseidon the keys are small, so a larger value is a Wave 3 option.
- **`minDuration` and `maxDuration`:** set at deploy time.
- **Assert messages:** generic; they never contain private data.

### 3.5 Invariants
1. **Solvency.** Total payouts from an envelope never exceed its `deposit`. This follows from the in-circuit Σ check plus one nullifier per leaf, with no mutable balance involved.
2. **No early exit.** Before `expiry`, funds leave only through valid claims.
3. **Refund target.** After `expiry`, only `refundAddress` can receive the unclaimed remainder, and only once.

---

## 4. Off-chain design

### 4.1 Repository layout (npm workspaces, Apache-2.0)

```
contract/   lixi.compact, witnesses, simulator tests (vitest)
sdk/        seed derivation, split generation, tree/paths via pure circuits,
            link codec, midnight-js wrappers (deploy/create/claim/refund), indexer reads
app/        React + Vite + Tailwind; wallet bridge (1AM, proving in 1AM or with the local proof server)
cli/        deploy script, devnet end-to-end tests
docs/       specs, architecture diagram, audit notes
```

The project is scaffolded from the `create-mn-app` `leaderboard` template (React + Lace wiring). The README credits the template, and all Lixi logic is new.

### 4.2 Architecture

```
 Sender browser                        Midnight (Preprod)                 Recipient browser
 ┌───────────────────┐  createEnvelope  ┌──────────────────────┐  claim   ┌───────────────────┐
 │ app + sdk         │ ───────────────▶ │ Lixi contract        │ ◀─────── │ app + sdk         │
 │ seed → shares     │                  │ envelopes/nullifiers │          │ link → share+path │
 │ private state     │ ◀── indexer ──── │ pooled tNIGHT        │ ── pay ─▶│ wallet address    │
 └────────┬──────────┘                  └──────────────────────┘          └────────┬──────────┘
          │ proving: in 1AM, or with the local proof server (never a shared server; audit H4)
```

### 4.3 Link format

- **Personal link:** `https://<host>/c#v1.<base64url(payload)>`, where `payload = id ‖ secret ‖ amount(u64) ‖ 4 × (sibling(32) ‖ goesLeft(1))`. That is 204 bytes, or about 272 characters.
- **Group link:** `https://<host>/c#g1.<base64url(id ‖ groupSecret ‖ count(u8) ‖ total(u128))>`. The SDK rebuilds every leaf, picks a random unclaimed share, and retries on a collision.
- **Pasted input:** full URLs, surrounding whitespace and trailing chat punctuation are all accepted (`parseClaimInput`).
- **Deployment binding:** the contract address comes from the app config per deployment, not from the link.

### 4.4 Seed and recovery

The **Lixi seed** is 32 random bytes, shown once as a backup string. The sender can export and import it. Everything is derived deterministically from it with SHA-256 KDF labels:
- `nonce_j = KDF(seed, "nonce", j)`, where `j` is the sender's envelope counter
- `secret_{j,i} = KDF(seed, "share", j, i)` for personal mode. In group mode, `groupSecret_j = KDF(seed, "group", j)` and `secret_{j,i} = KDF(groupSecret_j, "share", i)`, so group members can rebuild the full tree.
- `KDF(key, labels…) = HMAC-SHA256(key, "lixi/v1" ‖ len‖label …)`.
- Random split amounts use the WeChat "double-mean" algorithm. Draw `i` is `KDF(KDF(seed, "split", j), "draw", i)`. The algorithm is fixed with test vectors, and every share is ≥ 1 base unit.
- Padding leaves (i ≥ N) use the same secret derivation with `amount = 0`.

**Recovery from the seed alone.** Scan `j = 0, 1, …` and look up `envelopeId(nonce_j)` on-chain. For each envelope found, brute-force N ∈ [1, MAX_SHARES] × {personal-equal, personal-random, group-equal} until the rebuilt root matches `envelope.root`. That is at most 3 × MAX_SHARES candidates, which is trivial. Recipient labels ("for Mom") are local-only and are lost on recovery.

### 4.5 Screens

| Route | Purpose |
|---|---|
| `/` | Landing and explanation |
| `/create` | Envelope form; the seed backup prompt at the first Seal |
| `/share/:id` | Links (and QR codes, Could tier), shown only after confirmation |
| `/c` | Claim page: no third-party scripts, strict CSP (audit Low) |
| `/dashboard` | Envelope list, claim status, Refund, seed import/export |

The UI is in English; the Vietnamese lì xì story is the theme.

### 4.6 Error handling
- **Wallet not installed or wrong network:** blocking banner with setup steps.
- **Proof server unreachable:** explain how to start the Docker proof server, or prove in 1AM.
- **Claim fails because the share is already claimed, the envelope expired or the link is invalid:** a specific, friendly message. The SDK checks the nullifier and expiry *before* proving, to avoid wasted fees.
- **Less than 10 minutes to expiry:** warn the recipient before they prove.
- **Group-mode collision:** retry automatically with another unclaimed share (at most 3 tries).

---

## 5. Toolchain, deployment, testing

### 5.1 Pinned versions (Preprod column of the compatibility matrix)

| Component | Version |
|---|---|
| compact devtools | 0.5.1 |
| compiler | 0.31.1 |
| compact-runtime | 0.16.0 |
| compact-js | 2.5.1 |
| midnight-js | 4.1.1 |
| testkit-js | 4.1.1 |
| dapp-connector-api | 4.0.1 |
| wallet SDK | 1.2.0 |
| proof-server | 8.1.0 |

### 5.2 Deployment
- **Contract on Preprod,** with `minDuration = 3600`. **The maintenance authority is relinquished** (audit H5), so no key can change the circuits. Bug fixes mean deploying a new contract.
- **Frontend** as a static Vite build on Vercel, confirmed with the user before deploying.

### 5.3 Testing (QA is 15% of the score)

**Contract (simulator, vitest):**
- create: Σ-mismatch cannot occur because `deposit` is computed in-circuit; `deposit = 0`, duplicate id, and expiry below `minDuration` are rejected.
- claim: a valid claim succeeds; wrong amount, forged path, reused nullifier, expired envelope, `amount = 0`, a second claim from the same address in group mode, and a claim after refund are all rejected.
- refund: rejected before expiry and on a second call; a wrong share set is rejected (root mismatch); after a mix of claimed and unclaimed shares, the refunded amount is exact.
- adversarial: malicious witnesses and inputs.
- privacy: the public ledger after `createEnvelope` contains no amounts, no secrets, and nothing that reveals N.

**SDK:**
- KDF and PRNG test vectors.
- Link codec round-trip.
- Property test: the SDK root equals the root from the pure circuits, for random share sets.
- Recovery test: seed → the same envelopes.

**End-to-end on the local devnet:**
- deploy → create → claim from two wallets **at the same time** (spike S1) → wait for expiry → refund.

**CI (Should tier):** GitHub Actions installs Compact, compiles, and runs contract and SDK tests.

---

## 6. Security review (audit of v1, resolved in v2)

| ID | Finding | Resolution |
|---|---|---|
| H1 | Read-modify-write on `remaining` makes concurrent claims conflict | `remaining` removed; `claim` only reads the envelope. Verified by S1. |
| H2 | Losing the owner secret locks funds | No owner key; fixed `refundAddress`; everything recoverable from the seed |
| H3 | Transient hashes stored on the ledger | Revised: Poseidon kept on purpose, because the contract is immutable and the SDK uses the same compiled circuits (§3.2) |
| H4 | The proof server sees witnesses and could steal claims | Local or in-tab proving only; documented |
| H5 | The default single-key maintenance authority could drain the pooled funds | Authority relinquished on Preprod |
| M1 | Rug-pull via a very short expiry | `expiry ≥ now + minDuration`, enforced on-chain |
| M2 | Envelope-id squatting | Id derived in-circuit from a private nonce |
| M3 | Circuit cost of create/refund | Poseidon hashing; measured keys 0.55 / 5.2 / 4.2 MB (§3.2) |
| M4 | An expiry in milliseconds locks funds for millennia | `expiry ≤ now + maxDuration` (30 days), enforced on-chain |
| L | Domain separation, `amount > 0`, generic errors, no `unshieldedBalance()`, CSP on the claim page, unbounded nullifier set (accepted) | Applied |

---

## 7. Scope tiers and roadmap

**Wave 2, Must** (if time runs out, ship only this): contract v2 and simulator tests · SDK · create (personal links, equal and random split) · claim page · minimal dashboard (status, refund, seed backup) · **one** wallet path end-to-end · basic CSP · Preprod deploy · README · slides · demo video.

**Wave 2, Should:** second wallet (1AM in-tab proving) · group link · devnet concurrent-claim E2E · CI · Vercel deploy.

**Wave 2, Could:** QR codes · envelope-opening animation polish · seed import on another device.

**Wave 3, product MVP:** DUST fee sponsorship so recipients with zero DUST can claim (reference: `midnightntwrk/example-private-party`) · mobile claim via the 1AM app · exploration of shielded payouts.

**Non-goals:** mainnet, real funds, a Telegram or Zalo bot, i18n, per-envelope contracts.

---

## 8. Spikes (run first; each one has a decision rule)

| ID | Question | Decision rule |
|---|---|---|
| S1 | Do two concurrent `claim`s on one envelope both succeed with the v2 design? | If not, move the per-address and nullifier sets under per-envelope keys and re-test; if it still fails, document the limit and serialize claims in the UI. |
| S2 | Proving time for create, claim and refund on the local proof server | Key sizes are already measured (§3.2). If claim proving takes more than 30 s, profile it before the UI work. |
| S3 | Does `nativeToken()` move tNIGHT on the devnet? | The simulator already shows NIGHT (raw type all zeros). Confirm with a devnet transfer. |
| S4 | Does 1AM `getProvingProvider` prove in-tab, not through its hosted Proof Station, for our circuits? Does Lace + local proof server balance `receiveUnshielded`? | Must-tier wallet = whichever path works end-to-end first. |
| S5 | DUST sponsorship with browser wallets: can the connector split the balancing (user covers unshielded, sponsor covers DUST)? | If yes and it is ≤ 1 day of work, promote it to Wave 2 Should; otherwise Wave 3. |

---

## 9. Task breakdown (dependency-ordered, built for parallel execution)

**Critical path:** T0 → T2 → (S1, S2, S3) → T4c → T5a → T6 → T8/T9 → T17 → T18.

| ID | Task | Depends on | Tier | Owner | Lane |
|---|---|---|---|---|---|
| U1 | Register on AKINDO, join the Midnight Discord | — | Must | User | U |
| U2 | Install 1AM and Lace; fund 2 wallets from the Preprod faucet | — | Must | User | U |
| U3 | Start Docker Desktop; approve the GitHub repo name and visibility | — | Must | User | U |
| T0 | Install the pinned toolchain; scaffold the monorepo from the template; license, `.gitignore`, topics | U3 | Must | Claude | A |
| T1 | Link codec and KDF/PRNG split generation with test vectors (pure TS) | T0 | Must | Claude | B |
| T2 | Contract v2 with pure circuits; compiles | T0 | Must | Claude | A |
| T3 | Simulator test suite (§5.3), written TDD-style alongside T2 | T0 | Must | Claude | A |
| S1–S3 | Spikes on the devnet and the compiler | T2 | Must | Claude | A |
| S4 | Wallet proving and balancing spike | T0, U2 | Must | Claude | C |
| S5 | Sponsorship feasibility spike | T0 | Should | Claude | D |
| T4a | SDK: tree and paths via pure circuits, plus the property test | T2, T1 | Must | Claude | B |
| T4b | SDK: seed recovery scan | T4a | Must | Claude | B |
| T4c | SDK: midnight-js wrappers and indexer reads | T2, S3, S4 | Must | Claude | B |
| T5a | CLI deploy script (devnet and Preprod) | T4c | Must | Claude | A |
| T5b | Devnet E2E: create → concurrent claims → expiry → refund | T5a | Should | Claude | A |
| T6 | Preprod deploy with the authority relinquished | T5a, U2 | Must | Claude | A |
| T7 | App shell, routing, wallet bridge | T0, S4 | Must | Claude | C |
| T8 | Create and share flow | T7, T4c | Must | Claude | C |
| T9 | Claim page with CSP | T7, T4c | Must | Claude | C |
| T10 | Dashboard: status, refund, seed export and import | T7, T4b, T4c | Must | Claude | C |
| T11 | Group link mode | T9 | Should | Claude | C |
| T12 | Second wallet path | T7, S4 | Should | Claude | C |
| T13 | CI workflow | T3, T4a | Should | Claude | E |
| T14 | Cloudflare Pages deploy (after confirmation; was Vercel, changed 2026-10-07) | T8–T10 | Should | Claude | E |
| T15 | README, architecture diagram, privacy model, audit notes | T2 (draft), T6 (final) | Must | Claude | E |
| T16 | Slide deck | T15 | Must | Claude | E |
| T17 | Demo video script (Claude); recording and voice-over (User) | T6, T8–T10 | Must | Both | E |
| T18 | Submit on AKINDO; verify the gate checklist | all Must | Must | User | U |
| T19 | Could-tier polish: QR, animation, cross-device import | T8–T10 | Could | Claude | C |

**Lanes:** A = contract and chain · B = SDK · C = app · D = research · E = docs and ops · U = user. Lanes B, C, D and E start as soon as T0 finishes, and the lanes meet at T4c and T8–T10.

---

## 10. Wave 2 acceptance criteria
1. `compact compile` succeeds with compiler 0.31.1, and all contract and SDK tests pass in a clean checkout (`npm ci && npm test`) without a wallet.
2. On Preprod, on video: create an envelope, claim from two different wallets, and refund after expiry.
3. The public ledger state after `createEnvelope` contains no share amounts, secrets or share count, and a test asserts it.
4. The README gets a judge from clone to passing tests in under 10 minutes, and explains the architecture, the Midnight integration, the privacy model and the limitations.
5. Gate checklist: the public repo has the `midnightntwrk` topic; LICENSE is Apache-2.0; slides and video are linked; the Wave 2 progress description is filled in on AKINDO.

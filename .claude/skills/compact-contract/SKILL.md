---
name: compact-contract
description: Verified Compact 0.31.1 (language 0.23) syntax, disclosure rules, token/time primitives and simulator-testing patterns. Use before writing or changing contract/src/lixi.compact or its tests.
---

# Writing Compact in this repo

Compact changes fast, and knowledge from training data is unreliable. Everything below was verified with compiler 0.31.1 and compact-runtime 0.16.0.

When unsure, don't guess. Compile the smallest snippet that answers the question (`compact compile --skip-zk <file> <outdir>`) and read the error.

- Docs index: https://docs.midnight.network/llms.txt. Append `.md` to any docs path for raw markdown.
- Pinned versions: https://docs.midnight.network/relnotes/support-matrix.md

## Syntax that compiles

- File header: `pragma language_version 0.23;` then `import CompactStandardLibrary;`
- Struct fields are separated by **commas**: `export struct Share { secret: Bytes<32>, amount: Uint<64> }`
- Ledger declarations:
  - `export ledger m: Map<Bytes<32>, Envelope>;`
  - `export ledger s: Set<Field>;`
  - `export sealed ledger d: Uint<64>;`. A sealed field can only be set in `constructor(...)`.
- Map operations: `m.member(k)`, `m.lookup(k)`, `m.insert(k, v)`. Set operations: `s.member(x)`, `s.insert(x)`. Always assert `member` before `lookup`.
- Witnesses:
  - Declaration: `witness envelopeShares(id: Bytes<32>): Vector<16, Share>;`
  - TypeScript implementation: `(ctx: WitnessContext<Ledger, PS>, id: Uint8Array) => [ps, value]`
- `export pure circuit f(...)` appears in the generated `pureCircuits` export. TypeScript calls it without a context. Use pure circuits for every hash the SDK needs.
- Iteration:
  - `map((s: Share): Field => leafHash(id, s), shares)`
  - `fold((acc: Uint<128>, s: Share): Uint<128> => (acc + s.amount) as Uint<128>, 0 as Uint<128>, shares)`
  - Lambdas may capture outer `const`s and may call ledger operations.
  - Variables are not mutable.
  - `for (const i of 0..N)` needs constant bounds and cannot `return`.
- Vector literals index with constants only: `[f(l[0], l[1]), f(l[2], l[3])]`.
- Uint arithmetic widens the result type (`Uint<64> + Uint<64>` is wider than `Uint<64>`), so cast back with `as Uint<128>`. Subtraction below zero is a runtime error, so assert `a > b` before computing `a - b`.
- Block time is in unix seconds. Use the predicates `blockTimeLt/Lte/Gt/Gte(t)`; there is no raw time accessor.
- Tokens:
  - `receiveUnshielded(nativeToken(), amount)` pulls NIGHT from the caller.
  - `sendUnshielded(nativeToken(), amount, right<ContractAddress, UserAddress>(to))` pays a user.
  - `nativeToken()` is NIGHT (its raw type is all zeros).
  - Avoid `unshieldedBalance()`: the transaction fails if the balance changes before it is applied.
- Hashes:
  - `persistentHash<T>(v)` returns `Bytes<32>` (SHA-256). It is stable across compiler versions, but expensive in-circuit.
  - `transientHash<T>(v)` returns `Field` (Poseidon). It is far cheaper; here, switching to it shrank the claim key from 19 MB to 0.55 MB. It may change across compiler versions, which is acceptable only because this deployment is immutable (spec §3.2).
  - `pad(32, "tag")` builds a `Bytes<32>` domain tag. Numeric `Field` tags work for Poseidon.

## Disclosure rules

- Exported-circuit arguments and witness results are private. Wrap anything derived from them in `disclose(...)` before it is:
  - written to the ledger
  - used as a Map or Set key or query argument
  - returned
  - passed to a token call
  - used as an `if` condition
- The compiler error names the offending path. Add `disclose` at the narrowest point.
- Values read from the ledger are already public and need no `disclose`.
- `disclose` does not publish anything by itself. Only ledger operations, token calls and return values reach the public transcript. Audit every `disclose` against the privacy table in spec §2.4.

## Testing with the simulator

- `contract/src/test/lixi-simulator.ts` wraps `new Contract<PS>(witnesses)`. Each call runs on `createCircuitContext(address, coinPk, state, privateState, undefined, undefined, now)`, so effects are per call, just like a real transaction.
- `contract.impureCircuits.<name>(ctx, ...args)` returns `{ result, context }`. Keep `context.currentQueryContext.state` as the new state and `context.currentPrivateState` as the new private state.
- Money movement lives in `context.currentQueryContext.effects`: `unshieldedInputs` for deposits and `claimedUnshieldedSpends` for payouts to users.
- Assert rejections by their message, for example `expect(() => sim.claim(...)).toThrow(/invalid share/)`.
- Take `sim.ledger()` snapshots **after** the calls you want to observe.

## After changing the contract

1. The PostToolUse hook compiles every edited `.compact` file. If it reports an error, fix it before moving on.
2. Run `npm test` and `npm run typecheck`.
3. Run `npm run compact` to build proving keys. Key size is the proxy for proving cost (claim ≈ 0.55 MB, create ≈ 5.2 MB, refund ≈ 4.2 MB). Call out any large jump.

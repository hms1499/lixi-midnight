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
import { Contract, ledger, type Ledger, type PathEntry, type Share } from '../managed/lixi/contract/index.js';
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

  claim(id: Uint8Array, share: Share, path: PathEntry[], recipient: Uint8Array): void {
    this.run((ctx) => this.contract.impureCircuits.claim(ctx, id, share, path, { bytes: recipient }));
  }

  refund(id: Uint8Array): void {
    this.run((ctx) => this.contract.impureCircuits.refund(ctx, id));
  }

  /** NIGHT sent to each user address by the last call, keyed by hex address. */
  lastPayouts(): Map<string, bigint> {
    const out = new Map<string, bigint>();
    for (const [[, to], amount] of this.lastEffects?.claimedUnshieldedSpends ?? []) {
      if (to.tag === 'user') out.set(to.address, (out.get(to.address) ?? 0n) + amount);
    }
    return out;
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

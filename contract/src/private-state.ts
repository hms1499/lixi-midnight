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

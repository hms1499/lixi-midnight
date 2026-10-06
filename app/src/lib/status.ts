import { pureCircuits, toHex, type Ledger } from '@lixi/contract';
import { deriveEnvelope, type SavedEnvelope } from '@lixi/sdk';

export type EnvelopeState =
  /** Not found on chain: the create transaction failed, was declined, or is still in flight. */
  | 'missing'
  | 'open'
  /** Every share was claimed. */
  | 'empty'
  /** Expired with unclaimed shares, so the sender can refund. */
  | 'refundable'
  | 'refunded';

/** One real share of an envelope, as its light shows it. */
export type ShareView = { readonly amount: bigint; readonly opened: boolean };

export type EnvelopeView = {
  readonly saved: SavedEnvelope;
  readonly idHex: string;
  readonly state: EnvelopeState;
  readonly claimed: number;
  readonly unclaimedAmount: bigint;
  /** The envelope's real shares in link order; `opened` once its nullifier is on chain. */
  readonly shares: readonly ShareView[];
  /** Where a refund pays, as recorded on chain at sealing; undefined while the envelope is missing. */
  readonly refundAddress?: Uint8Array;
};

/** The dashboard row for one vault envelope, computed locally from public nullifiers. */
export const envelopeView = (
  ledger: Pick<Ledger, 'envelopes' | 'nullifiers'>,
  seed: Uint8Array,
  saved: SavedEnvelope,
  now: number,
): EnvelopeView => {
  const d = deriveEnvelope(seed, saved);
  const idHex = toHex(d.id);
  const real = d.shares.slice(0, saved.count);
  if (!ledger.envelopes.member(d.id)) {
    const shares = real.map((s) => ({ amount: s.amount, opened: false }));
    return { saved, idHex, state: 'missing', claimed: 0, unclaimedAmount: 0n, shares };
  }
  const env = ledger.envelopes.lookup(d.id);
  const shares = real.map((s) => ({
    amount: s.amount,
    opened: ledger.nullifiers.member(pureCircuits.nullifierOf(d.id, s.secret)),
  }));
  const open = shares.filter((s) => !s.opened);
  const unclaimedAmount = open.reduce((sum, s) => sum + s.amount, 0n);
  const claimed = saved.count - open.length;
  const state: EnvelopeState = env.refunded
    ? 'refunded'
    : open.length === 0
      ? 'empty'
      : now >= Number(env.expiry)
        ? 'refundable'
        : 'open';
  return { saved, idHex, state, claimed, unclaimedAmount, shares, refundAddress: env.refundAddress.bytes };
};

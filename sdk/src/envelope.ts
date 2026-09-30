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

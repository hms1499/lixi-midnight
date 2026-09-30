import { pureCircuits, type PathEntry, type Share } from './managed/lixi/contract/index.js';
import { MAX_SHARES, TREE_DEPTH } from './constants.js';

export type EnvelopeTree = {
  readonly root: bigint;
  readonly leaves: readonly bigint[];
  pathFor(index: number): PathEntry[];
};

/** Builds the same fixed-depth tree as the contract's `rootOf`, using the contract's own pure circuits. */
export const buildTree = (id: Uint8Array, shares: readonly Share[]): EnvelopeTree => {
  if (shares.length !== MAX_SHARES) throw new Error(`expected ${MAX_SHARES} shares, got ${shares.length}`);
  const levels: bigint[][] = [shares.map((s) => pureCircuits.leafHash(id, s))];
  for (let d = 0; d < TREE_DEPTH; d++) {
    const prev = levels[d];
    const next: bigint[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(pureCircuits.nodeHash(prev[i], prev[i + 1]));
    levels.push(next);
  }
  return {
    root: levels[TREE_DEPTH][0],
    leaves: levels[0],
    pathFor(index: number): PathEntry[] {
      if (!Number.isInteger(index) || index < 0 || index >= MAX_SHARES) throw new Error(`bad leaf index ${index}`);
      return levels.slice(0, TREE_DEPTH).map((level, d) => {
        const i = index >> d;
        return { sibling: level[i ^ 1], goesLeft: (i & 1) === 1 };
      });
    },
  };
};

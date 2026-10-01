import { describe, expect, it } from 'vitest';
import { describeSync, feeSyncReady, syncProgress } from '../src/sync.js';

const indexed = (applied: bigint, highest: bigint) => ({
  appliedIndex: applied,
  highestIndex: highest,
  isStrictlyComplete: () => applied >= highest,
});
const unshieldedAt = (applied: bigint, highest: bigint) => ({
  appliedId: applied,
  highestTransactionId: highest,
  isStrictlyComplete: () => applied >= highest,
});
const state = (u: [bigint, bigint], d: [bigint, bigint], s: [bigint, bigint]) => ({
  unshielded: { progress: unshieldedAt(...u) },
  dust: { state: { progress: indexed(...d) } },
  shielded: { state: { progress: indexed(...s) } },
});

describe('wallet sync progress', () => {
  it('reads each sub-wallet as a percentage', () => {
    const p = syncProgress(state([10n, 10n], [425n, 1000n], [31n, 1000n]));
    expect(p).toEqual({
      unshielded: { percent: 100, complete: true },
      dust: { percent: 42.5, complete: false },
      shielded: { percent: 3.1, complete: false },
    });
    expect(describeSync(p)).toBe('unshielded 100% · DUST 42.5% · shielded 3.1% (not needed)');
  });

  it('counts an empty chain as complete rather than dividing by zero', () => {
    expect(syncProgress(state([0n, 0n], [0n, 0n], [0n, 0n])).dust).toEqual({ percent: 100, complete: true });
  });

  it('is ready to pay fees once unshielded and DUST are synced, whatever shielded says', () => {
    expect(feeSyncReady(state([5n, 5n], [7n, 7n], [1n, 900n]))).toBe(true);
    expect(feeSyncReady(state([5n, 5n], [6n, 7n], [900n, 900n]))).toBe(false);
    expect(feeSyncReady(state([4n, 5n], [7n, 7n], [900n, 900n]))).toBe(false);
  });
});

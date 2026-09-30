import { describe, expect, it } from 'vitest';
import { bytesToBigint, fromBase64Url, toBase64Url } from '../src/bytes.js';
import { kdf } from '../src/kdf.js';
import { equalSplit, randomSplit } from '../src/split.js';

const seed = new Uint8Array(32).fill(7);
const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);

describe('kdf', () => {
  it('is deterministic and separates labels', () => {
    expect(kdf(seed, 'share', 0, 1)).toEqual(kdf(seed, 'share', 0, 1));
    expect(kdf(seed, 'share', 0, 1)).not.toEqual(kdf(seed, 'share', 1, 0));
    expect(kdf(seed, 'ab', 'c')).not.toEqual(kdf(seed, 'a', 'bc'));
    expect(kdf(seed, 'nonce', 0)).toHaveLength(32);
  });

  it('matches a fixed test vector', () => {
    expect(toBase64Url(kdf(seed, 'nonce', 0))).toMatchInlineSnapshot(`"My4igF2HWihMHo0Adz1h6ysPmGAvag7CWWLlH84Blqk"`);
  });

  it('rejects numeric labels outside u32', () => {
    expect(() => kdf(seed, -1)).toThrow(/out of range/);
    expect(() => kdf(seed, 1.5)).toThrow(/out of range/);
  });
});

describe('bytes', () => {
  it('round-trips base64url', () => {
    const b = crypto.getRandomValues(new Uint8Array(77));
    expect(fromBase64Url(toBase64Url(b))).toEqual(b);
    expect(() => fromBase64Url('a+b')).toThrow(/base64url/);
    expect(bytesToBigint(new Uint8Array([1, 0]))).toBe(256n);
  });
});

describe('equalSplit', () => {
  it('splits exactly and spreads the remainder over the first shares', () => {
    expect(equalSplit(10n, 3)).toEqual([4n, 3n, 3n]);
    expect(equalSplit(16n, 16)).toEqual(Array(16).fill(1n));
  });

  it('rejects impossible splits', () => {
    expect(() => equalSplit(2n, 3)).toThrow(/at least one unit/);
    expect(() => equalSplit(100n, 0)).toThrow(/share count/);
    expect(() => equalSplit(100n, 17)).toThrow(/share count/);
    expect(() => equalSplit(1n << 70n, 1)).toThrow(/Uint<64>/);
  });
});

describe('randomSplit', () => {
  it('always sums to the total with every share ≥ 1', () => {
    for (let n = 1; n <= 16; n++) {
      for (const total of [BigInt(n), 1000n, 123_456_789n]) {
        const s = randomSplit(total, n, kdf(seed, 'split', n));
        expect(s).toHaveLength(n);
        expect(sum(s)).toBe(total);
        expect(s.every((a) => a >= 1n)).toBe(true);
      }
    }
  });

  it('is deterministic per seed and differs across seeds', () => {
    expect(randomSplit(1000n, 8, seed)).toEqual(randomSplit(1000n, 8, seed));
    expect(randomSplit(1000n, 8, seed)).not.toEqual(randomSplit(1000n, 8, kdf(seed, 'other')));
  });

  it('rejects totals whose shares cannot fit in Uint<64>', () => {
    expect(() => randomSplit(1n << 70n, 2, seed)).toThrow(/Uint<64>/);
  });
});

import { bytesToBigint } from './bytes.js';
import { kdf } from './kdf.js';
import { MAX_SHARES } from '@lixi/contract';

const MAX_SHARE_AMOUNT = (1n << 64n) - 1n;

const check = (total: bigint, count: number): void => {
  if (!Number.isInteger(count) || count < 1 || count > MAX_SHARES)
    throw new Error(`share count must be 1..${MAX_SHARES}`);
  if (total < BigInt(count)) throw new Error('total must be at least one unit per share');
};

const checkShares = (amounts: bigint[]): bigint[] => {
  if (amounts.some((a) => a > MAX_SHARE_AMOUNT)) throw new Error('share amount exceeds Uint<64>');
  return amounts;
};

/** Equal split; the first `total % count` shares get one extra unit. */
export const equalSplit = (total: bigint, count: number): bigint[] => {
  check(total, count);
  const base = total / BigInt(count);
  const extra = total % BigInt(count);
  return checkShares(Array.from({ length: count }, (_, i) => base + (BigInt(i) < extra ? 1n : 0n)));
};

/** WeChat "double mean": draw uniformly in [1, 2·remaining/left − 1], never starving later shares. */
export const randomSplit = (total: bigint, count: number, seed: Uint8Array): bigint[] => {
  check(total, count);
  const out: bigint[] = [];
  let remaining = total;
  for (let i = 0; i < count - 1; i++) {
    const left = BigInt(count - i);
    const doubleMean = (remaining * 2n) / left - 1n;
    const hi = [doubleMean < 1n ? 1n : doubleMean, remaining - (left - 1n)].reduce((a, b) => (a < b ? a : b));
    const amount = 1n + (hi <= 1n ? 0n : bytesToBigint(kdf(seed, 'draw', i)) % hi);
    out.push(amount);
    remaining -= amount;
  }
  out.push(remaining);
  return checkShares(out);
};

import type { Share } from '../managed/lixi/contract/index.js';
import { MAX_SHARES } from '../constants.js';

export const HOUR = 3600;
export const DAY = 24 * HOUR;

export const rnd = (n = 32): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

/** `amounts` real shares, padded with zero-amount shares up to MAX_SHARES. */
export const makeShares = (amounts: bigint[]): Share[] =>
  Array.from({ length: MAX_SHARES }, (_, i) => ({ secret: rnd(), amount: amounts[i] ?? 0n }));

import { pureCircuits, type Share } from '../managed/lixi/contract/index.js';
import { MAX_SHARES } from '../constants.js';
import { T0, type LixiSimulator } from './lixi-simulator.js';

export const HOUR = 3600;
export const DAY = 24 * HOUR;
export const EXPIRY = BigInt(T0 + 2 * HOUR);

export const rnd = (n = 32): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

/** `amounts` real shares, padded with zero-amount shares up to MAX_SHARES. */
export const makeShares = (amounts: bigint[]): Share[] =>
  Array.from({ length: MAX_SHARES }, (_, i) => ({ secret: rnd(), amount: amounts[i] ?? 0n }));

export type OpenEnvelope = { nonce: Uint8Array; id: Uint8Array; shares: Share[]; refundAddr: Uint8Array };

/** Creates an envelope as a sender would: remember the shares privately, then call createEnvelope. */
export const openEnvelope = (sim: LixiSimulator, amounts: bigint[], onePerAddress = false): OpenEnvelope => {
  const nonce = rnd();
  const id = pureCircuits.envelopeId(nonce);
  const shares = makeShares(amounts);
  const refundAddr = rnd();
  sim.rememberShares(id, shares);
  sim.create(nonce, EXPIRY, refundAddr, onePerAddress);
  return { nonce, id, shares, refundAddr };
};

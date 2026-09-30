import { beforeEach, describe, expect, it } from 'vitest';
import { toHex } from '../constants.js';
import { buildTree } from '../merkle.js';
import { LixiSimulator } from './lixi-simulator.js';
import { DAY, EXPIRY, HOUR, makeShares, openEnvelope, rnd, type OpenEnvelope } from './fixtures.js';

describe('refund', () => {
  let sim: LixiSimulator;
  let env: OpenEnvelope;
  const claimShare = (i: number) => sim.claim(env.id, env.shares[i], buildTree(env.id, env.shares).pathFor(i), rnd());

  beforeEach(() => {
    sim = new LixiSimulator(BigInt(HOUR), BigInt(30 * DAY));
    env = openEnvelope(sim, [100n, 250n, 50n]);
  });

  it('is not possible before expiry', () => {
    expect(() => sim.refund(env.id)).toThrow(/not expired/);
  });

  it('returns exactly the unclaimed amount to the refund address', () => {
    claimShare(1);
    sim.now = Number(EXPIRY);
    sim.refund(env.id);
    expect(sim.lastPayouts()).toEqual(new Map([[toHex(env.refundAddr), 150n]]));
    expect(sim.ledger().envelopes.lookup(env.id).refunded).toBe(true);
  });

  it('pays nothing when every share was claimed', () => {
    [0, 1, 2].forEach(claimShare);
    sim.now = Number(EXPIRY);
    sim.refund(env.id);
    expect(sim.lastPayouts().size).toBe(0);
    expect(sim.ledger().envelopes.lookup(env.id).refunded).toBe(true);
  });

  it('can only happen once, and blocks later claims', () => {
    sim.now = Number(EXPIRY);
    sim.refund(env.id);
    expect(() => sim.refund(env.id)).toThrow(/refunded/);
    expect(() => claimShare(0)).toThrow(/refunded/);
  });

  it('rejects private shares that do not match the root', () => {
    sim.rememberShares(env.id, makeShares([400n]));
    sim.now = Number(EXPIRY);
    expect(() => sim.refund(env.id)).toThrow(/invalid shares/);
  });

  it('sends funds only to the refund address, whoever triggers it', () => {
    sim.privateState = { shares: { [toHex(env.id)]: env.shares } }; // e.g. a group member who rebuilt the shares
    sim.now = Number(EXPIRY);
    sim.refund(env.id);
    expect([...sim.lastPayouts().keys()]).toEqual([toHex(env.refundAddr)]);
  });
});

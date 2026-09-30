import { beforeEach, describe, expect, it } from 'vitest';
import { pureCircuits } from '../managed/lixi/contract/index.js';
import { toHex } from '../constants.js';
import { buildTree } from '../merkle.js';
import { LixiSimulator } from './lixi-simulator.js';
import { DAY, EXPIRY, HOUR, openEnvelope, rnd, type OpenEnvelope } from './fixtures.js';

describe('claim', () => {
  let sim: LixiSimulator;
  let env: OpenEnvelope;
  const claimShare = (i: number, recipient: Uint8Array) =>
    sim.claim(env.id, env.shares[i], buildTree(env.id, env.shares).pathFor(i), recipient);

  beforeEach(() => {
    sim = new LixiSimulator(BigInt(HOUR), BigInt(30 * DAY));
    env = openEnvelope(sim, [100n, 250n, 50n]);
  });

  it('pays the share to the recipient and records its nullifier', () => {
    const alice = rnd();
    claimShare(1, alice);
    expect(sim.lastPayouts()).toEqual(new Map([[toHex(alice), 250n]]));
    expect(sim.ledger().nullifiers.member(pureCircuits.nullifierOf(env.id, env.shares[1].secret))).toBe(true);
  });

  it('never writes the envelope, so concurrent claims cannot conflict on it', () => {
    const before = sim.ledger().envelopes.lookup(env.id);
    claimShare(0, rnd());
    expect(sim.ledger().envelopes.lookup(env.id)).toEqual(before);
  });

  it('rejects claiming the same share twice', () => {
    claimShare(0, rnd());
    expect(() => claimShare(0, rnd())).toThrow(/already claimed/);
  });

  it('rejects a share whose amount was changed', () => {
    const path = buildTree(env.id, env.shares).pathFor(2);
    expect(() => sim.claim(env.id, { ...env.shares[2], amount: 5000n }, path, rnd())).toThrow(/invalid share/);
  });

  it('rejects a forged Merkle path', () => {
    const path = buildTree(env.id, env.shares)
      .pathFor(0)
      .map((e) => ({ ...e, goesLeft: !e.goesLeft }));
    expect(() => sim.claim(env.id, env.shares[0], path, rnd())).toThrow(/invalid share/);
  });

  it('rejects a share that belongs to another envelope', () => {
    const other = openEnvelope(sim, [100n]);
    const path = buildTree(env.id, env.shares).pathFor(0);
    expect(() => sim.claim(other.id, env.shares[0], path, rnd())).toThrow(/invalid share/);
  });

  it('rejects padding shares', () => {
    expect(() => claimShare(7, rnd())).toThrow(/empty share/);
  });

  it('rejects claims at or after expiry', () => {
    sim.now = Number(EXPIRY);
    expect(() => claimShare(0, rnd())).toThrow(/expired/);
  });

  it('rejects an unknown envelope', () => {
    const path = buildTree(env.id, env.shares).pathFor(0);
    expect(() => sim.claim(rnd(), env.shares[0], path, rnd())).toThrow(/no envelope/);
  });

  it('lets one address claim two personal-link shares', () => {
    const bob = rnd();
    claimShare(0, bob);
    claimShare(1, bob);
    expect(sim.lastPayouts()).toEqual(new Map([[toHex(bob), 250n]]));
  });

  describe('group mode (onePerAddress)', () => {
    beforeEach(() => {
      env = openEnvelope(sim, [100n, 100n, 100n], true);
    });

    it('allows one share per address', () => {
      const carol = rnd();
      claimShare(0, carol);
      expect(() => claimShare(1, carol)).toThrow(/address already claimed/);
      claimShare(1, rnd());
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { pureCircuits } from '../managed/lixi/contract/index.js';
import { buildTree } from '../merkle.js';
import { LixiSimulator, T0 } from './lixi-simulator.js';
import { DAY, EXPIRY, HOUR, makeShares, openEnvelope, rnd } from './fixtures.js';

describe('createEnvelope', () => {
  let sim: LixiSimulator;

  beforeEach(() => {
    sim = new LixiSimulator(BigInt(HOUR), BigInt(30 * DAY));
  });

  /** Registers private shares for a fresh nonce without creating the envelope. */
  const prepare = (amounts: bigint[]) => {
    const nonce = rnd();
    sim.rememberShares(pureCircuits.envelopeId(nonce), makeShares(amounts));
    return nonce;
  };

  it('locks the sum of the shares and stores only the root', () => {
    const { id, shares, refundAddr } = openEnvelope(sim, [100n, 250n, 50n]);
    expect(sim.lastDeposit()).toBe(400n);
    expect(sim.ledger().envelopes.lookup(id)).toEqual({
      root: buildTree(id, shares).root,
      deposit: 400n,
      expiry: EXPIRY,
      refundAddress: { bytes: refundAddr },
      onePerAddress: false,
      refunded: false,
    });
  });

  it('does not reveal the share count or split', () => {
    const a = openEnvelope(sim, [400n]);
    const b = openEnvelope(sim, [100n, 100n, 100n, 100n]);
    const one = sim.ledger().envelopes.lookup(a.id);
    const four = sim.ledger().envelopes.lookup(b.id);
    expect(Object.keys(one)).toEqual(Object.keys(four));
    expect(one.deposit).toBe(four.deposit);
    expect(sim.ledger().nullifiers.isEmpty()).toBe(true);
  });

  it('rejects a duplicate envelope id', () => {
    const { nonce, refundAddr } = openEnvelope(sim, [100n]);
    expect(() => sim.create(nonce, EXPIRY, refundAddr, false)).toThrow(/envelope exists/);
  });

  it('rejects an envelope with no value', () => {
    expect(() => sim.create(prepare([]), EXPIRY, rnd(), false)).toThrow(/empty envelope/);
  });

  it('accepts an expiry exactly minDuration away and rejects one second less', () => {
    const nonce = prepare([1n]);
    expect(() => sim.create(nonce, BigInt(T0 + HOUR - 1), rnd(), false)).toThrow(/expiry too soon/);
    expect(sim.create(nonce, BigInt(T0 + HOUR), rnd(), false)).toEqual(pureCircuits.envelopeId(nonce));
  });

  it('rejects an expiry more than maxDuration away, e.g. milliseconds passed as seconds', () => {
    const nonce = prepare([1n]);
    expect(() => sim.create(nonce, BigInt(T0 + 30 * DAY + 1), rnd(), false)).toThrow(/expiry too far/);
    expect(() => sim.create(nonce, EXPIRY * 1000n, rnd(), false)).toThrow(/expiry too far/);
    expect(sim.create(nonce, BigInt(T0 + 30 * DAY), rnd(), false)).toEqual(pureCircuits.envelopeId(nonce));
  });

  it('rejects a nonsense expiry', () => {
    expect(() => sim.create(prepare([1n]), 10n, rnd(), false)).toThrow(/bad expiry/);
  });

  it('fails when the sender has no private shares for the envelope', () => {
    expect(() => sim.create(rnd(), EXPIRY, rnd(), false)).toThrow(/no private shares/);
  });

  it('rejects inconsistent deploy-time durations', () => {
    expect(() => new LixiSimulator(BigInt(DAY), BigInt(HOUR))).toThrow(/bad durations/);
  });
});

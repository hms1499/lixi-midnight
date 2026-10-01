import { describe, expect, it } from 'vitest';
import { LixiSimulator, T0 } from '@lixi/contract/testing';
import { resolveClaim, type ClaimArgs } from '../src/claim.js';
import { deriveEnvelope, linksFor, type EnvelopeSpec } from '../src/envelope.js';
import { checkClaim, checkRefund } from '../src/precheck.js';
import { addEnvelope, newVault, privateStateOf } from '../src/vault.js';

const HOUR = 3600;
const expiry = BigInt(T0 + 2 * HOUR);
const rnd = () => crypto.getRandomValues(new Uint8Array(32));

const open = (spec: Omit<EnvelopeSpec, 'index'>) => {
  const sim = new LixiSimulator(BigInt(HOUR));
  const vault = addEnvelope(newVault(), { ...spec, index: 0, expiry, labels: [] });
  const d = deriveEnvelope(vault.seed, vault.envelopes[0]);
  sim.privateState = privateStateOf(vault);
  sim.create(d.nonce, expiry, rnd(), spec.kind === 'group');
  const isClaimed = (nf: bigint) => sim.ledger().nullifiers.member(nf);
  const args = (i = 0): ClaimArgs => resolveClaim(linksFor(d)[i], isClaimed);
  return { sim, d, vault, args };
};

/** The pre-check must refuse exactly what the contract refuses. */
const expectRejected = (sim: LixiSimulator, a: ClaimArgs, who: Uint8Array, reason: string) => {
  expect(checkClaim(sim.ledger(), a, who, sim.now)).toEqual({ ok: false, reason });
  expect(() => sim.claim(a.id, a.share, a.path, who)).toThrow();
};

describe('claim pre-check', () => {
  it('accepts a fresh share and warns in the last ten minutes', () => {
    const { sim, args } = open({ total: 300n, count: 3, kind: 'personal', split: 'equal' });
    expect(checkClaim(sim.ledger(), args(), rnd(), T0)).toEqual({
      ok: true,
      amount: 100n,
      secondsLeft: 2 * HOUR,
      expiringSoon: false,
    });
    const late = checkClaim(sim.ledger(), args(), rnd(), Number(expiry) - 300);
    expect(late).toMatchObject({ ok: true, secondsLeft: 300, expiringSoon: true });
  });

  it('rejects unknown envelopes and tampered links before proving', () => {
    const { sim, args } = open({ total: 300n, count: 3, kind: 'personal', split: 'equal' });
    const a = args();
    expectRejected(sim, { ...a, id: rnd() }, rnd(), 'no envelope');
    expectRejected(sim, { ...a, share: { ...a.share, amount: 101n } }, rnd(), 'invalid link');
    expectRejected(sim, { ...a, path: args(1).path }, rnd(), 'invalid link');
  });

  it('rejects a share that is already claimed', () => {
    const { sim, args } = open({ total: 300n, count: 3, kind: 'personal', split: 'equal' });
    const a = args();
    sim.claim(a.id, a.share, a.path, rnd());
    expectRejected(sim, a, rnd(), 'already claimed');
  });

  it('rejects after expiry and after refund', () => {
    const { sim, args, d } = open({ total: 300n, count: 3, kind: 'personal', split: 'equal' });
    const a = args();
    sim.now = Number(expiry);
    expectRejected(sim, a, rnd(), 'expired');
    sim.refund(d.id);
    expectRejected(sim, a, rnd(), 'refunded');
  });

  it('rejects a second claim from the same address in group mode', () => {
    const { sim, args } = open({ total: 300n, count: 3, kind: 'group', split: 'equal' });
    const who = rnd();
    const first = args();
    sim.claim(first.id, first.share, first.path, who);
    expectRejected(sim, args(), who, 'address already claimed');
    expect(checkClaim(sim.ledger(), args(), rnd(), sim.now).ok).toBe(true);
  });
});

describe('refund pre-check', () => {
  it('offers refund only after expiry and only once', () => {
    const { sim, d } = open({ total: 300n, count: 3, kind: 'personal', split: 'equal' });
    expect(checkRefund(sim.ledger(), rnd(), sim.now)).toEqual({ ok: false, reason: 'no envelope' });
    expect(checkRefund(sim.ledger(), d.id, sim.now)).toEqual({ ok: false, reason: 'not expired' });
    sim.now = Number(expiry);
    expect(checkRefund(sim.ledger(), d.id, sim.now)).toEqual({ ok: true });
    sim.refund(d.id);
    expect(checkRefund(sim.ledger(), d.id, sim.now)).toEqual({ ok: false, reason: 'refunded' });
  });
});

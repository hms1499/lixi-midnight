import { describe, expect, it } from 'vitest';
import { buildTree, pureCircuits, toHex } from '@lixi/contract';
import { LixiSimulator, T0 } from '@lixi/contract/testing';
import { resolveClaim } from '../src/claim.js';
import { deriveEnvelope, linksFor, type EnvelopeSpec } from '../src/envelope.js';
import { decodeLink, encodeLink } from '../src/link.js';
import { recoverVault } from '../src/recovery.js';
import {
  addEnvelope,
  backupString,
  deserializeVault,
  newVault,
  nextIndex,
  privateStateOf,
  seedFromBackup,
  serializeVault,
} from '../src/vault.js';

const HOUR = 3600;
const expiry = BigInt(T0 + 2 * HOUR);
const rnd = () => crypto.getRandomValues(new Uint8Array(32));

const setup = (specs: Omit<EnvelopeSpec, 'index'>[]) => {
  const sim = new LixiSimulator(BigInt(HOUR));
  let vault = newVault();
  const refundAddr = rnd();
  for (const s of specs) {
    const spec = { ...s, index: nextIndex(vault) };
    vault = addEnvelope(vault, { ...spec, expiry, labels: [] });
    sim.privateState = privateStateOf(vault);
    sim.create(deriveEnvelope(vault.seed, spec).nonce, expiry, refundAddr, spec.kind === 'group');
  }
  const isClaimed = (nf: bigint) => sim.ledger().nullifiers.member(nf);
  return { sim, vault, refundAddr, isClaimed };
};

describe('SDK ↔ contract flow', () => {
  it('SDK roots match the contract for every mode', () => {
    const { sim, vault } = setup([
      { total: 1000n, count: 4, kind: 'personal', split: 'equal' },
      { total: 1000n, count: 7, kind: 'personal', split: 'random' },
      { total: 900n, count: 3, kind: 'group', split: 'equal' },
    ]);
    for (const e of vault.envelopes) {
      const d = deriveEnvelope(vault.seed, e);
      expect(sim.ledger().envelopes.lookup(d.id).root).toBe(buildTree(d.id, d.shares).root);
    }
  });

  it('personal links claim through encode → decode → resolve', () => {
    const { sim, vault, isClaimed } = setup([{ total: 1000n, count: 3, kind: 'personal', split: 'random' }]);
    const d = deriveEnvelope(vault.seed, vault.envelopes[0]);
    let paid = 0n;
    for (const link of linksFor(d)) {
      const { id, share, path } = resolveClaim(decodeLink(encodeLink(link)), isClaimed);
      const who = rnd();
      sim.claim(id, share, path, who);
      paid += sim.lastPayouts().get(toHex(who))!;
    }
    expect(paid).toBe(1000n);
    expect(() => resolveClaim(linksFor(d)[0], isClaimed)).toThrow(/already claimed/);
  });

  it('group links hand out every share once, then report none left', () => {
    const { sim, vault, isClaimed } = setup([{ total: 900n, count: 3, kind: 'group', split: 'equal' }]);
    const [link] = linksFor(deriveEnvelope(vault.seed, vault.envelopes[0]));
    for (let i = 0; i < 3; i++) {
      const { id, share, path } = resolveClaim(decodeLink(encodeLink(link)), isClaimed);
      sim.claim(id, share, path, rnd());
    }
    expect(() => resolveClaim(link, isClaimed)).toThrow(/all shares claimed/);
  });

  it('refunds from vault-derived private state after expiry', () => {
    const { sim, vault, refundAddr, isClaimed } = setup([{ total: 500n, count: 5, kind: 'personal', split: 'equal' }]);
    const d = deriveEnvelope(vault.seed, vault.envelopes[0]);
    const first = resolveClaim(linksFor(d)[0], isClaimed);
    sim.claim(first.id, first.share, first.path, rnd());
    sim.now = Number(expiry);
    sim.privateState = privateStateOf(vault);
    sim.refund(d.id);
    expect(sim.lastPayouts().get(toHex(refundAddr))).toBe(400n);
  });

  it('recovers the whole vault from the backup string alone', () => {
    const { sim, vault } = setup([
      { total: 1000n, count: 4, kind: 'personal', split: 'equal' },
      { total: 777n, count: 16, kind: 'personal', split: 'random' },
      { total: 900n, count: 3, kind: 'group', split: 'equal' },
    ]);
    const seed = seedFromBackup(backupString(vault));
    const lookup = (id: Uint8Array) => {
      const l = sim.ledger();
      return l.envelopes.member(id) ? l.envelopes.lookup(id) : undefined;
    };
    const recovered = recoverVault(seed, lookup);
    const strip = (v: typeof vault) => v.envelopes.map(({ labels: _l, ...rest }) => rest);
    expect(strip(recovered)).toEqual(strip(vault));
    expect(pureCircuits.envelopeId(deriveEnvelope(seed, recovered.envelopes[1]).nonce)).toEqual(
      deriveEnvelope(vault.seed, vault.envelopes[1]).id,
    );
  });

  it('serializes and restores the vault', () => {
    let vault = newVault();
    vault = addEnvelope(vault, {
      index: 0,
      total: 5n,
      count: 2,
      kind: 'personal',
      split: 'random',
      expiry,
      labels: ['Mẹ', 'Bố'],
    });
    expect(deserializeVault(serializeVault(vault))).toEqual(vault);
    expect(() => seedFromBackup('nope')).toThrow(/not a Lixi backup/);
    expect(seedFromBackup(`\n  ${backupString(vault)}  \n`)).toEqual(vault.seed);
  });

  it('recovers envelopes after up to four burned indices (failed creates)', () => {
    const sim = new LixiSimulator(BigInt(HOUR));
    let vault = newVault();
    for (const index of [0, 5]) {
      const spec = { index, total: 300n, count: 3, kind: 'personal' as const, split: 'equal' as const };
      vault = addEnvelope(vault, { ...spec, expiry, labels: [] });
      sim.privateState = privateStateOf(vault);
      sim.create(deriveEnvelope(vault.seed, spec).nonce, expiry, rnd(), false);
    }
    const l = sim.ledger();
    const recovered = recoverVault(vault.seed, (id) => (l.envelopes.member(id) ? l.envelopes.lookup(id) : undefined));
    expect(recovered.envelopes.map((e) => e.index)).toEqual([0, 5]);
  });
});

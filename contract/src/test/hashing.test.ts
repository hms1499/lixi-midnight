import { describe, expect, it } from 'vitest';
import { pureCircuits } from '../managed/lixi/contract/index.js';
import { MAX_SHARES } from '../constants.js';
import { buildTree } from '../merkle.js';
import { makeShares, rnd } from './fixtures.js';

describe('hashing and Merkle tree', () => {
  const id = pureCircuits.envelopeId(rnd());
  const shares = makeShares([100n, 200n, 300n]);

  it('derives envelope ids deterministically from the nonce', () => {
    const nonce = rnd();
    expect(pureCircuits.envelopeId(nonce)).toEqual(pureCircuits.envelopeId(nonce));
    expect(pureCircuits.envelopeId(nonce)).not.toEqual(pureCircuits.envelopeId(rnd()));
  });

  it('builds the same root off-chain as the contract computes in-circuit', () => {
    expect(buildTree(id, shares).root).toBe(pureCircuits.rootOf(id, shares));
  });

  it('produces a valid path for every leaf', () => {
    const tree = buildTree(id, shares);
    for (let i = 0; i < MAX_SHARES; i++) {
      expect(pureCircuits.rootFromPath(tree.leaves[i], tree.pathFor(i))).toBe(tree.root);
    }
  });

  it('binds leaves to the envelope and the amount', () => {
    const s = shares[0];
    expect(pureCircuits.leafHash(id, s)).not.toBe(pureCircuits.leafHash(rnd(), s));
    expect(pureCircuits.leafHash(id, s)).not.toBe(pureCircuits.leafHash(id, { ...s, amount: s.amount + 1n }));
  });

  it('separates hash domains', () => {
    const secret = rnd();
    const leaf = pureCircuits.leafHash(id, { secret, amount: 0n });
    expect(pureCircuits.nullifierOf(id, secret)).not.toBe(leaf);
    expect(pureCircuits.addrKey(id, { bytes: secret })).not.toBe(pureCircuits.nullifierOf(id, secret));
  });

  it('rejects malformed input', () => {
    expect(() => buildTree(id, shares.slice(1))).toThrow(/expected 16 shares/);
    expect(() => buildTree(id, shares).pathFor(16)).toThrow(/bad leaf index/);
  });
});

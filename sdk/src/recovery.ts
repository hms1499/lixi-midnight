import { MAX_SHARES, buildTree, pureCircuits } from '@lixi/contract';
import { kdf } from './kdf.js';
import { deriveEnvelope, type EnvelopeKind, type EnvelopeSpec, type SplitMode } from './envelope.js';
import type { SenderVault } from './vault.js';

export type OnChainEnvelope = { readonly root: bigint; readonly deposit: bigint; readonly expiry: bigint };

const MODES: ReadonlyArray<[EnvelopeKind, SplitMode]> = [
  ['personal', 'equal'],
  ['personal', 'random'],
  ['group', 'equal'],
];

const matchSpec = (seed: Uint8Array, index: number, env: OnChainEnvelope): EnvelopeSpec | undefined => {
  for (let count = 1; count <= MAX_SHARES && BigInt(count) <= env.deposit; count++) {
    for (const [kind, split] of MODES) {
      const d = deriveEnvelope(seed, { index, total: env.deposit, count, kind, split });
      if (buildTree(d.id, d.shares).root === env.root) return d.spec;
    }
  }
  return undefined;
};

/**
 * Rebuilds a sender vault from the seed alone: scan envelope indices until `gapLimit`
 * consecutive misses, then brute-force (count × mode) against each on-chain root.
 * Recipient labels are local-only and come back empty.
 */
export const recoverVault = (
  seed: Uint8Array,
  lookup: (id: Uint8Array) => OnChainEnvelope | undefined,
  gapLimit = 5,
): SenderVault => {
  const envelopes: SenderVault['envelopes'][number][] = [];
  for (let index = 0, misses = 0; misses < gapLimit; index++) {
    const env = lookup(pureCircuits.envelopeId(kdf(seed, 'nonce', index)));
    if (!env) {
      misses++;
      continue;
    }
    misses = 0;
    const spec = matchSpec(seed, index, env);
    if (spec) envelopes.push({ ...spec, expiry: env.expiry, labels: [] });
  }
  return { seed, envelopes };
};

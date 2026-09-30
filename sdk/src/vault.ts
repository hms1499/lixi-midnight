import { emptyPrivateState, withEnvelopeShares, type LixiPrivateState } from '@lixi/contract';
import { fromBase64Url, toBase64Url } from './bytes.js';
import { deriveEnvelope, type EnvelopeSpec } from './envelope.js';

export type SavedEnvelope = EnvelopeSpec & { readonly expiry: bigint; readonly labels: readonly string[] };

/** The sender's local state. The seed alone can rebuild everything except labels. */
export type SenderVault = { readonly seed: Uint8Array; readonly envelopes: readonly SavedEnvelope[] };

const BACKUP_PREFIX = 'lixi_';

export const newVault = (seed: Uint8Array = crypto.getRandomValues(new Uint8Array(32))): SenderVault => {
  if (seed.length !== 32) throw new Error('seed must be 32 bytes');
  return { seed, envelopes: [] };
};

export const nextIndex = (vault: SenderVault): number =>
  vault.envelopes.reduce((max, e) => Math.max(max, e.index + 1), 0);

export const addEnvelope = (vault: SenderVault, envelope: SavedEnvelope): SenderVault => ({
  ...vault,
  envelopes: [...vault.envelopes.filter((e) => e.index !== envelope.index), envelope],
});

export const backupString = (vault: SenderVault): string => BACKUP_PREFIX + toBase64Url(vault.seed);

export const seedFromBackup = (text: string): Uint8Array => {
  const trimmed = text.trim();
  if (!trimmed.startsWith(BACKUP_PREFIX)) throw new Error('not a Lixi backup');
  const seed = fromBase64Url(trimmed.slice(BACKUP_PREFIX.length));
  if (seed.length !== 32) throw new Error('not a Lixi backup');
  return seed;
};

export const serializeVault = (vault: SenderVault): string =>
  JSON.stringify({
    seed: toBase64Url(vault.seed),
    envelopes: vault.envelopes.map((e) => ({ ...e, total: e.total.toString(), expiry: e.expiry.toString() })),
  });

export const deserializeVault = (json: string): SenderVault => {
  const raw = JSON.parse(json) as { seed: string; envelopes: Array<Record<string, unknown>> };
  return {
    seed: fromBase64Url(raw.seed),
    envelopes: raw.envelopes.map((e) => ({
      index: Number(e.index),
      total: BigInt(e.total as string),
      count: Number(e.count),
      kind: e.kind as SavedEnvelope['kind'],
      split: e.split as SavedEnvelope['split'],
      expiry: BigInt(e.expiry as string),
      labels: (e.labels as string[]) ?? [],
    })),
  };
};

/** Contract private state (shares by envelope id) for every envelope in the vault. */
export const privateStateOf = (vault: SenderVault): LixiPrivateState =>
  vault.envelopes.reduce((state, e) => {
    const d = deriveEnvelope(vault.seed, e);
    return withEnvelopeShares(state, d.id, d.shares);
  }, emptyPrivateState());

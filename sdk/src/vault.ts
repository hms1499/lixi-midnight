import { MAX_SHARES, emptyPrivateState, withEnvelopeShares, type LixiPrivateState } from '@lixi/contract';
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

const invalid = (): never => {
  throw new Error('invalid vault');
};
const int = (v: unknown, min: number, max: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : invalid();
const uint = (v: unknown): bigint => (typeof v === 'string' && /^\d{1,40}$/.test(v) ? BigInt(v) : invalid());
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T =>
  options.includes(v as T) ? (v as T) : invalid();
const strings = (v: unknown): string[] => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : invalid());

/** Parses `serializeVault` output. Throws 'invalid vault' on anything else, so a damaged vault is never half-read. */
export const deserializeVault = (json: string): SenderVault => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return invalid();
  }
  const { seed, envelopes } = (raw ?? {}) as Record<string, unknown>;
  if (typeof seed !== 'string' || !Array.isArray(envelopes)) return invalid();
  let seedBytes: Uint8Array;
  try {
    seedBytes = fromBase64Url(seed);
  } catch {
    return invalid();
  }
  if (seedBytes.length !== 32) return invalid();
  return {
    seed: seedBytes,
    envelopes: envelopes.map((item: unknown) => {
      const e = (item ?? {}) as Record<string, unknown>;
      const kind = oneOf(e.kind, ['personal', 'group'] as const);
      const split = oneOf(e.split, ['equal', 'random'] as const);
      const count = int(e.count, 1, MAX_SHARES);
      const total = uint(e.total);
      if (kind === 'group' && split !== 'equal') invalid();
      if (total < BigInt(count)) invalid();
      return {
        index: int(e.index, 0, 2 ** 31),
        total,
        count,
        kind,
        split,
        expiry: uint(e.expiry),
        labels: strings(e.labels ?? []),
      };
    }),
  };
};

/** Contract private state (shares by envelope id) for every envelope in the vault. */
export const privateStateOf = (vault: SenderVault): LixiPrivateState =>
  vault.envelopes.reduce((state, e) => {
    const d = deriveEnvelope(vault.seed, e);
    return withEnvelopeShares(state, d.id, d.shares);
  }, emptyPrivateState());

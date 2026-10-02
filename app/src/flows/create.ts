import { pureCircuits } from '@lixi/contract';
import {
  addEnvelope,
  deriveEnvelope,
  kdf,
  newVault,
  nextIndex,
  privateStateOf,
  type EnvelopeKind,
  type SenderVault,
  type SplitMode,
} from '@lixi/sdk';
import type { Ledger } from '@lixi/contract';
import type { LixiChain } from '../chain/port';
import { DURATION_MARGIN_SECONDS } from '../lib/time';
import type { VaultStore } from '../lib/storage';

export type CreateForm = {
  readonly total: bigint;
  readonly count: number;
  readonly split: SplitMode;
  readonly kind: EnvelopeKind;
  readonly durationSeconds: number;
};

/** The vault to create into: the saved one, or a fresh one that is saved right away. */
export const loadOrCreateVault = (store: VaultStore): SenderVault => {
  const saved = store.load();
  if (saved) return saved;
  const vault = newVault();
  store.save(vault);
  store.setBackedUp(false);
  return vault;
};

/**
 * First index at or after `nextIndex` whose envelope id is not on chain yet (skips orphans of lost
 * vault entries). The Create page previews the amounts at this index, so the preview is what gets sealed.
 */
export const freeIndex = (vault: SenderVault, ledger: Pick<Ledger, 'envelopes'>): number => {
  let index = nextIndex(vault);
  while (ledger.envelopes.member(pureCircuits.envelopeId(kdf(vault.seed, 'nonce', index)))) index++;
  return index;
};

/**
 * Creates an envelope. The vault entry is saved *before* the transaction, so a closed tab or a
 * failed submission never loses the record of what was (maybe) put on chain. Given the index the
 * page previewed, it refuses to seal any other ('amounts changed'), so the preview is what gets sealed.
 */
export const createEnvelope = async (
  chain: LixiChain,
  store: VaultStore,
  form: CreateForm,
  refundAddress: Uint8Array,
  now: number,
  previewedIndex?: number,
): Promise<{ id: Uint8Array; txId: string }> => {
  const ledger = await chain.readLedger();
  const min = Number(ledger.minDuration) + DURATION_MARGIN_SECONDS;
  const max = Number(ledger.maxDuration) - DURATION_MARGIN_SECONDS;
  if (form.durationSeconds < min || form.durationSeconds > max) throw new Error('expiry out of range');
  const vault = loadOrCreateVault(store);
  const spec = {
    index: freeIndex(vault, ledger),
    total: form.total,
    count: form.count,
    kind: form.kind,
    split: form.split,
  };
  if (previewedIndex !== undefined && spec.index !== previewedIndex) throw new Error('amounts changed');
  const d = deriveEnvelope(vault.seed, spec); // throws on a bad count, total or group + random
  const expiry = BigInt(now + form.durationSeconds);
  const next = addEnvelope(vault, { ...spec, expiry, labels: [] });
  store.save(next);
  return chain.create(privateStateOf(next), {
    nonce: d.nonce,
    expiry,
    refundAddress,
    onePerAddress: form.kind === 'group',
  });
};

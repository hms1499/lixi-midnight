import {
  checkRefund,
  deriveEnvelope,
  nextIndex,
  privateStateOf,
  recoverVault,
  seedFromBackup,
  type RefundCheck,
  type SenderVault,
} from '@lixi/sdk';
import type { LixiChain, LixiReader } from '../chain/port';
import type { VaultStore } from '../lib/storage';

export type RefundResult = { readonly ok: true; readonly txHash: string } | Extract<RefundCheck, { ok: false }>;

/** Refunds the unclaimed rest of a vault envelope to its refund address, after the same checks the contract runs. */
export const refundEnvelope = async (
  chain: LixiChain,
  vault: SenderVault,
  index: number,
  now: number,
): Promise<RefundResult> => {
  const saved = vault.envelopes.find((e) => e.index === index);
  if (!saved) throw new Error('unknown envelope');
  const { id } = deriveEnvelope(vault.seed, saved);
  const check = checkRefund(await chain.readLedger(), id, now);
  if (!check.ok) return check;
  return { ok: true, txHash: await chain.refund(privateStateOf(vault), id) };
};

/** Drops a vault entry whose envelope never reached the chain, and keeps its index from being sealed again. */
export const forgetEnvelope = (store: VaultStore, index: number): void => {
  store.raiseFloor(index + 1);
  const vault = store.load();
  if (vault) store.save({ ...vault, envelopes: vault.envelopes.filter((e) => e.index !== index) });
};

export type RestoreResult =
  | { readonly ok: true; readonly found: number }
  | { readonly ok: false; readonly reason: 'not a backup' | 'different seed' };

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Empty indices a restore scans past. Every failed seal keeps its index, so a run of them leaves a gap on chain. */
const RESTORE_GAP = 64;

/**
 * Rebuilds the vault from a backup string by scanning the chain (spec §4.4). Restoring the same seed
 * keeps the entries the scan cannot see (never on chain, or a split it cannot match). Replacing a vault
 * that holds envelopes under a *different* seed needs `replaceDifferent`, because that seed is then gone.
 * An unreadable saved vault may always be replaced: restoring is the way out of 'corrupt vault'.
 */
export const restoreVault = async (
  reader: LixiReader,
  store: VaultStore,
  backup: string,
  options: { readonly replaceDifferent: boolean },
): Promise<RestoreResult> => {
  let seed: Uint8Array;
  try {
    seed = seedFromBackup(backup);
  } catch {
    return { ok: false, reason: 'not a backup' };
  }
  let current: SenderVault | undefined;
  try {
    current = store.load();
  } catch {
    current = undefined;
  }
  if (current && current.envelopes.length > 0 && !sameBytes(current.seed, seed) && !options.replaceDifferent) {
    return { ok: false, reason: 'different seed' };
  }
  const kept = current && sameBytes(current.seed, seed) ? current.envelopes : [];
  const ledger = await reader.readLedger();
  const found = recoverVault(
    seed,
    (id) => (ledger.envelopes.member(id) ? ledger.envelopes.lookup(id) : undefined),
    RESTORE_GAP + nextIndex({ seed, envelopes: kept }),
  );
  const unseen = kept.filter((e) => !found.envelopes.some((f) => f.index === e.index));
  store.save({ seed, envelopes: [...found.envelopes, ...unseen].sort((a, b) => a.index - b.index) });
  store.setBackedUp(true);
  return { ok: true, found: found.envelopes.length };
};

/** How far one sub-wallet has synced: a percentage, or the applied event count while the total is unknown. */
export type SubProgress = { readonly percent?: number; readonly applied?: bigint; readonly complete: boolean };
export type WalletSyncProgress = {
  readonly unshielded: SubProgress;
  readonly dust: SubProgress;
  readonly shielded: SubProgress;
};

type Indexed = { appliedIndex: bigint; highestIndex: bigint; isStrictlyComplete(): boolean };
type ById = { appliedId: bigint; highestTransactionId: bigint; isStrictlyComplete(): boolean };

/** The parts of the wallet SDK's `FacadeState` that report sync progress. */
export type SyncView = {
  readonly unshielded: { readonly progress: ById };
  readonly dust: { readonly state: { readonly progress: Indexed } };
  readonly shielded: { readonly state: { readonly progress: Indexed } };
};

const sub = (applied: bigint, highest: bigint, complete: boolean): SubProgress => {
  if (highest > 0n) return { percent: Number((applied * 1000n) / highest) / 10, complete };
  // An empty chain is done; otherwise the indexer has not reported its tip yet.
  return complete || applied === 0n ? { percent: 100, complete } : { percent: undefined, applied, complete };
};

const show = (p: SubProgress): string => (p.percent === undefined ? `${p.applied} events` : `${p.percent}%`);

export const syncProgress = (s: SyncView): WalletSyncProgress => {
  const u = s.unshielded.progress;
  const d = s.dust.state.progress;
  const z = s.shielded.state.progress;
  return {
    unshielded: sub(u.appliedId, u.highestTransactionId, u.isStrictlyComplete()),
    dust: sub(d.appliedIndex, d.highestIndex, d.isStrictlyComplete()),
    shielded: sub(z.appliedIndex, z.highestIndex, z.isStrictlyComplete()),
  };
};

export const describeSync = (p: WalletSyncProgress): string =>
  `unshielded ${show(p.unshielded)} · DUST ${show(p.dust)} · shielded ${show(p.shielded)} (not needed)`;

/**
 * Lixi only moves unshielded NIGHT and pays fees in DUST, so a wallet is ready once those two
 * sub-wallets have synced. Shielded sync replays the chain's whole history and can take far longer
 * on Preprod, so nothing waits for it.
 */
export const feeSyncReady = (s: SyncView): boolean =>
  s.unshielded.progress.isStrictlyComplete() && s.dust.state.progress.isStrictlyComplete();

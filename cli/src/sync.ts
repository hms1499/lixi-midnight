/** How far one sub-wallet has synced. */
export type SubProgress = { readonly percent: number; readonly complete: boolean };
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

const sub = (applied: bigint, highest: bigint, complete: boolean): SubProgress => ({
  percent: highest > 0n ? Number((applied * 1000n) / highest) / 10 : 100,
  complete,
});

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
  `unshielded ${p.unshielded.percent}% · DUST ${p.dust.percent}% · shielded ${p.shielded.percent}% (not needed)`;

/**
 * Lixi only moves unshielded NIGHT and pays fees in DUST, so a wallet is ready once those two
 * sub-wallets have synced. Shielded sync replays the chain's whole history and can take far longer
 * on Preprod, so nothing waits for it.
 */
export const feeSyncReady = (s: SyncView): boolean =>
  s.unshielded.progress.isStrictlyComplete() && s.dust.state.progress.isStrictlyComplete();

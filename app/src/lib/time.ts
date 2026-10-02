/** Expiry choices offered when creating an envelope, in seconds from now. */
export const EXPIRY_PRESETS = [
  { label: '2 hours', seconds: 2 * 3600 },
  { label: '1 day', seconds: 86400 },
  { label: '3 days', seconds: 3 * 86400 },
  { label: '7 days', seconds: 7 * 86400 },
] as const;

/**
 * Margin kept from the contract's duration bounds, so block time drifting from the
 * browser clock while the transaction is proved and included cannot break them.
 */
export const DURATION_MARGIN_SECONDS = 600;

/** "in 2 h 5 min", "3 days ago": coarse, for envelope lists. */
export const formatRelative = (secondsFromNow: number): string => {
  const abs = Math.abs(secondsFromNow);
  const text =
    abs >= 2 * 86400
      ? `${Math.floor(abs / 86400)} days`
      : abs >= 3600
        ? `${Math.floor(abs / 3600)} h ${Math.floor((abs % 3600) / 60)} min`
        : `${Math.max(1, Math.floor(abs / 60))} min`;
  return secondsFromNow >= 0 ? `in ${text}` : `${text} ago`;
};

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

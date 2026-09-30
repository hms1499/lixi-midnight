/** Shares per envelope (real + zero-amount padding). Must match `Vector<16, Share>` in lixi.compact. */
export const MAX_SHARES = 16;
/** log2(MAX_SHARES). Must match `Vector<4, PathEntry>` in lixi.compact. */
export const TREE_DEPTH = 4;

export const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

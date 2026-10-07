/** How long to wait for the indexer to name a landed transaction's hash before giving up on the link. */
export const TX_HASH_TIMEOUT_MS = 15_000;

/**
 * The hash explorers look a transaction up by (midnight-js hands back its identifier). It returns ''
 * on an error or after the timeout: the transaction has landed, and only the explorer link is lost.
 */
export const lookupTxHash = async (
  watch: (id: string) => Promise<{ readonly txHash: string }>,
  id: string,
  timeoutMs = TX_HASH_TIMEOUT_MS,
): Promise<string> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(''), timeoutMs);
  });
  try {
    return await Promise.race([watch(id).then((data) => data.txHash), timedOut]);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
};

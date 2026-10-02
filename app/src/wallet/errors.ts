export const messageOf = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error);

/** DApp Connector errors are plain objects tagged with `type`, not Error subclasses. */
const connectorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && (error as { type?: unknown }).type === 'DAppConnectorAPIError'
    ? String((error as { code?: unknown }).code)
    : undefined;

export const PROOF_SERVER_COMMAND =
  'docker run -p 127.0.0.1:6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server';

/**
 * One sentence for the user about a failed wallet, prover or chain call (spec §4.6). Error messages
 * from these layers never contain link secrets, so passing the text through is safe.
 */
export const friendlyError = (error: unknown): string => {
  const code = connectorCode(error);
  const text = messageOf(error);
  if (code === 'Rejected' || code === 'PermissionRejected') return 'You declined the request in your wallet.';
  if (code === 'Disconnected') return 'Your wallet disconnected. Connect it again.';
  if (text === 'connect timed out')
    return 'Your wallet did not answer. Open it from the browser’s extensions menu, approve the connection, then try again.';
  if (text === 'wrong network') return 'Your wallet is on another network. Switch it to Preprod, then connect again.';
  if (text === 'proof server unreachable')
    return `The local proof server is not running. Start it with “${PROOF_SERVER_COMMAND}”, or prove in your wallet instead.`;
  if (text === 'corrupt vault')
    return 'Your saved Lixi data cannot be read. Restore it from your backup string on the Dashboard.';
  if (text === 'expiry out of range') return 'That expiry is outside what the contract allows. Pick another one.';
  if (text === 'amounts changed') return 'The amounts just changed. Check them, then seal again.';
  if (/syncing/i.test(text))
    return 'Your wallet is still syncing with the network. Open it, wait until the sync finishes (a new wallet can take a while), then try again.';
  // Node error 171 is OutOfDustValidityWindow: the wallet built its DUST fee on a stale view of the chain
  // (seen on Preprod 2026-10-02 while 1AM's DUST sync was stale). The node rejects it, so nothing lands.
  if (/Custom error: 171\b/.test(text))
    return 'The network refused the fee your wallet added, because the wallet’s DUST is out of date. Nothing was sent. Open your wallet, let it finish syncing, and try again in a few minutes.';
  // 1AM allows one pending transaction at a time; its own message says what to do (spike S4).
  if (/already pending/i.test(text)) return text;
  return `${text.replace(/\.$/, '')}. If your wallet just sent another transaction, wait about 30 seconds and try again.`;
};

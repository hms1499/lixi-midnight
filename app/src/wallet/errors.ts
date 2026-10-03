import { redactUrl } from '@lixi/sdk/network';

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

/** Reads go to the network's public indexer, not the wallet, so a failed read gets no wallet advice. */
export const READ_FAILED = 'Lixi could not reach the Midnight network. Check your connection, then reload the page.';

export const PROOF_SERVER_COMMAND =
  'docker run -p 127.0.0.1:6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server';

/**
 * One sentence for the user about a failed wallet, prover or chain call (spec §4.6). Error messages
 * from these layers never contain link secrets, so passing the text through is safe.
 */
export const friendlyError = (error: unknown): string => {
  const code = connectorCode(error);
  const text = redactUrl(messageOf(error));
  // Lace reports a locked wallet with the same code as a declined request.
  if (code === 'Rejected' && /locked/i.test(text)) return 'Your wallet is locked. Unlock it, then try again.';
  if (code === 'Rejected' || code === 'PermissionRejected') return 'You declined the request in your wallet.';
  if (code === 'Disconnected') return 'Your wallet disconnected. Connect it again.';
  if (text === 'connect timed out')
    return 'Your wallet did not answer. Open it from the browser’s extensions menu, approve the connection, then try again.';
  if (text === 'wrong network') return 'Your wallet is on another network. Switch it to Preprod, then connect again.';
  if (text === 'proof server unreachable')
    return `The local proof server is not running. Start it with “${PROOF_SERVER_COMMAND}”, or prove in your wallet instead.`;
  // The ledger wraps a failed fetch from the prover's /check or /prove, whichever prover was chosen. Seen when
  // the proof server is down, and when the CSP blocks a wallet's proof server that is not local (audit H4).
  if (/returned an error: TypeError: Failed to fetch/.test(text))
    return `A proof server could not be reached. Start the local one with “${PROOF_SERVER_COMMAND}”. If your wallet makes the proofs, set it to that local proof server (in Lace: Midnight Settings, Proof Server, Local).`;
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
  // The SDK wraps whatever the prover or wallet threw; only the wallet's part means anything to the user.
  const said = text.replace(/^Unexpected error submitting scoped transaction '[^']*': (Error: ?)?/, '');
  if (said === 'no dust')
    return 'Your wallet has no DUST to pay the fee. Nothing was sent. Designate your NIGHT to generate DUST (in Lace: NIGHT, then Generate DUST), wait until your DUST balance is above zero, then try again.';
  const retry = 'If your wallet just sent another transaction, wait about 30 seconds and try again.';
  if (said === '' || said === 'Error') return `Your wallet could not finish the transaction. ${retry}`;
  return `${said.replace(/\.$/, '')}. ${retry}`;
};

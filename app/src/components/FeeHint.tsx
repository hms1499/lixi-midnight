import { feeNote, feeWarnings } from '../wallet/balances';
import type { ConnectedWallet } from '../wallet/WalletContext';
import { Notice } from './ui';

/** Above a button that sends a transaction: who pays the fee, then warnings from the wallet's last known balances. */
export const FeeHint = ({ wallet, needNight }: { readonly wallet: ConnectedWallet; readonly needNight?: bigint }) => {
  const note = feeNote(wallet.name);
  return (
    <>
      {note && <Notice>{note}</Notice>}
      {feeWarnings(wallet, needNight).map((warning) => (
        <Notice key={warning} tone="warn">
          {warning}
        </Notice>
      ))}
    </>
  );
};

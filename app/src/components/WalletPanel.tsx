import { useId, useState, type ReactNode } from 'react';
import type { ProverChoice } from '../chain/port';
import { LINKS } from '../lib/links';
import { loadProver, saveProver } from '../lib/storage';
import { useServices } from '../services';
import { PROOF_SERVER_COMMAND } from '../wallet/errors';
import { useDetectedWallets, useWallet, type ConnectedWallet } from '../wallet/WalletContext';
import { Button, Notice, Working } from './ui';

type PanelProps = {
  /** Completes "Connect a Midnight wallet …", for example "to open it". */
  readonly purpose: string;
  /** The connect button's text for a wallet; defaults to "Connect <name>". */
  readonly cta?: (walletName: string) => string;
};

/** Lace connects and claims with the local proof server (spike S4 retest); it is not a footer place like 1AM. */
const LACE_HREF = 'https://www.lace.io';

/** Lists injected wallets, lets the user choose where proofs are made, and connects (spec §6.6). */
export const WalletPanel = ({ purpose, cta = (name) => `Connect ${name}` }: PanelProps) => {
  const { storage } = useServices();
  const { state, connect } = useWallet();
  const wallets = useDetectedWallets();
  const [prover, setProver] = useState<ProverChoice>(() => loadProver(storage));
  // The header and a page can both show a panel; each needs its own radio group.
  const group = useId();
  const choose = (p: ProverChoice) => {
    setProver(p);
    saveProver(storage, p);
  };

  if (state.status === 'connecting') return <Working>Approve the connection in {state.name}…</Working>;
  return (
    <div className="space-y-4">
      <p className="text-paper-soft">Connect a Midnight wallet {purpose}.</p>
      {state.status === 'failed' && <Notice tone="error">{state.message}</Notice>}
      {wallets.length === 0 ? (
        <Notice tone="warn">
          No Midnight wallet found in this browser. Install{' '}
          <a className="underline underline-offset-4" href={LINKS.wallet.href} target="_blank" rel="noreferrer">
            1AM
          </a>{' '}
          or{' '}
          <a className="underline underline-offset-4" href={LACE_HREF} target="_blank" rel="noreferrer">
            Lace
          </a>
          , set it to Preprod, then reload this page.
        </Notice>
      ) : (
        <div className="flex flex-wrap gap-3">
          {wallets.map((w) => (
            <Button key={w.rdns} type="button" onClick={() => connect(w, prover)}>
              {cta(w.name)}
            </Button>
          ))}
        </div>
      )}
      <fieldset className="space-y-1 text-sm text-paper-soft">
        <legend className="mb-1 font-semibold text-paper">Where proofs are made</legend>
        <label className="flex gap-2">
          <input type="radio" name={group} checked={prover === 'wallet'} onChange={() => choose('wallet')} />
          In my wallet
        </label>
        <label className="flex gap-2">
          <input type="radio" name={group} checked={prover === 'local'} onChange={() => choose('local')} />
          On this computer, with the local proof server
        </label>
        {prover === 'local' && (
          <input
            readOnly
            aria-label="Command that starts the proof server"
            value={PROOF_SERVER_COMMAND}
            className="mt-1 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-xs text-paper"
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
      </fieldset>
    </div>
  );
};

/** Renders `children` with the connected wallet, or the wallet panel until there is one. */
export const RequireWallet = ({
  purpose,
  cta,
  children,
}: PanelProps & { children: (wallet: ConnectedWallet) => ReactNode }) => {
  const { state } = useWallet();
  return state.status === 'connected' ? <>{children(state.wallet)}</> : <WalletPanel purpose={purpose} cta={cta} />;
};

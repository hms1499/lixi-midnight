import { useId, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import type { ProverChoice } from '../chain/port';
import { LINKS } from '../lib/links';
import { loadProver, saveProver } from '../lib/storage';
import { useServices } from '../services';
import { PROOF_SERVER_COMMAND } from '../wallet/errors';
import { useDetectedWallets, useWallet, type ConnectedWallet } from '../wallet/WalletContext';
import { CopyButton } from './CopyButton';
import { Button, Notice, Working } from './ui';

type PanelProps = {
  /** Completes "Connect a Midnight wallet …", for example "to open it". */
  readonly purpose: string;
  /** The connect button's text for a wallet; defaults to "Connect <name>". */
  readonly cta?: (walletName: string) => string;
};

/** A phone with no wallet: Lixi needs the 1AM extension, so the link goes to a computer (UX polish spec §3.2). */
const DesktopOnly = () => {
  const { origin } = useServices();
  const { pathname, search, hash } = useLocation();
  const url = `${origin}${pathname}${search}${hash}`;
  return (
    <div className="space-y-3">
      <p className="font-semibold text-paper">Open this on a computer.</p>
      <p className="text-paper-soft">
        Lixi needs Chrome on a computer with the 1AM extension. Copy the link and open it there.
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          aria-label="Link to open on a computer"
          value={url}
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton text={url} label="Copy link" />
      </div>
    </div>
  );
};

/** Lists injected wallets, lets the user choose where proofs are made, and connects (spec §6.6). */
export const WalletPanel = ({ purpose, cta = (name) => `Connect ${name}` }: PanelProps) => {
  const { storage, isMobile } = useServices();
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
  if (wallets.length === 0 && isMobile()) return <DesktopOnly />;
  return (
    <div className="space-y-4">
      <p className="text-paper-soft">Connect a Midnight wallet {purpose}.</p>
      {state.status === 'failed' && <Notice tone="error">{state.message}</Notice>}
      {wallets.length === 0 ? (
        <Notice tone="warn">
          No Midnight wallet found in this browser. Install{' '}
          <a className="underline underline-offset-4" href={LINKS.wallet.href} target="_blank" rel="noreferrer">
            1AM
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

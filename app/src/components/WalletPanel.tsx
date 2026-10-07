import { useId, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import type { ProverChoice } from '../chain/port';
import { LINKS } from '../lib/links';
import { loadProver, saveProver } from '../lib/storage';
import { useServices } from '../services';
import { PROOF_SERVER_COMMAND } from '../wallet/errors';
import { useDetectedWallets, useWallet, type ConnectedWallet } from '../wallet/WalletContext';
import { useRegisterWalletPanel } from '../wallet/WalletPanelPresence';
import { CopyButton } from './CopyButton';
import { Button, Notice, Working } from './ui';

type PanelProps = {
  /** Completes "Connect your 1AM wallet …", for example "to open it". */
  readonly purpose: string;
  /** The connect button's text for a wallet; defaults to "Connect <name>". */
  readonly cta?: (walletName: string) => string;
  /** One more line under the install steps, for this page (UX polish spec §3.4). */
  readonly hint?: ReactNode;
  /** The header's own dropdown panel, which does not hide the header's Connect button. */
  readonly inHeader?: boolean;
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

/** No wallet in a desktop browser: how to get 1AM, then a reload so it can inject itself (UX polish spec §3.4). */
const InstallSteps = ({ hint }: { hint?: ReactNode }) => {
  const { reload } = useServices();
  return (
    <div className="space-y-3">
      <Notice tone="warn">No 1AM wallet found in this browser.</Notice>
      <ol className="list-decimal space-y-1 pl-5 text-paper-soft">
        <li>
          <a className="underline underline-offset-4" href={LINKS.wallet.href} target="_blank" rel="noreferrer">
            Install 1AM for Chrome
          </a>
          .
        </li>
        <li>Create a wallet and set it to Preprod.</li>
        <li>Reload this page.</li>
      </ol>
      {hint && <p className="text-sm text-paper-soft">{hint}</p>}
      <Button tone="quiet" type="button" onClick={reload}>
        I installed 1AM, reload
      </Button>
    </div>
  );
};

/** Lists the 1AM wallet, folds away where proofs are made, and connects (spec §6.6, UX polish spec §3). */
export const WalletPanel = ({ purpose, cta = (name) => `Connect ${name}`, hint, inHeader = false }: PanelProps) => {
  const { storage, isMobile } = useServices();
  const { state, connect } = useWallet();
  const wallets = useDetectedWallets();
  const [prover, setProver] = useState<ProverChoice>(() => loadProver(storage));
  // Open at first only for someone who chose the local proof server; after that it follows the user, and it
  // survives the connect attempt, which swaps the panel for "Approve the connection" and back.
  const [advancedOpen, setAdvancedOpen] = useState(() => loadProver(storage) === 'local');
  // The header and a page can both show a panel; each needs its own radio group.
  const group = useId();
  useRegisterWalletPanel(!inHeader);
  const choose = (p: ProverChoice) => {
    setProver(p);
    saveProver(storage, p);
  };

  if (state.status === 'connecting') return <Working>Approve the connection in {state.name}…</Working>;
  if (wallets.length === 0 && isMobile()) return <DesktopOnly />;
  if (wallets.length === 0) return <InstallSteps hint={hint} />;
  return (
    <div className="space-y-4">
      <p className="text-paper-soft">Connect your 1AM wallet {purpose}.</p>
      {state.status === 'failed' && <Notice tone="error">{state.message}</Notice>}
      <div className="flex flex-wrap gap-3">
        {wallets.map((w) => (
          <Button key={w.rdns} type="button" onClick={() => connect(w, prover)}>
            {cta(w.name)}
          </Button>
        ))}
      </div>
      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
        className="text-sm text-paper-soft"
      >
        <summary className="cursor-pointer">Advanced: where proofs are made</summary>
        <fieldset className="mt-2 space-y-1">
          <legend className="sr-only">Where proofs are made</legend>
          <label className="flex gap-2">
            <input type="radio" name={group} checked={prover === 'wallet'} onChange={() => choose('wallet')} />
            In 1AM (default)
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
      </details>
    </div>
  );
};

/** Renders `children` with the connected wallet, or the wallet panel until there is one. */
export const RequireWallet = ({
  purpose,
  cta,
  hint,
  children,
}: PanelProps & { children: (wallet: ConnectedWallet) => ReactNode }) => {
  const { state } = useWallet();
  return state.status === 'connected' ? (
    <>{children(state.wallet)}</>
  ) : (
    <WalletPanel purpose={purpose} cta={cta} hint={hint} />
  );
};

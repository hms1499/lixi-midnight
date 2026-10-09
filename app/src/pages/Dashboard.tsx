import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Ledger } from '@lixi/contract';
import type { SenderVault } from '@lixi/sdk';
import { BackupString } from '../components/BackupPanel';
import { Page } from '../components/Layout';
import { Light, type LightState } from '../components/Light';
import { Toasts, useOpenedNews } from '../components/Toasts';
import { TxProgress } from '../components/TxProgress';
import { WalletPanel } from '../components/WalletPanel';
import { Button, ButtonLink, Notice, Working } from '../components/ui';
import type { TxStage } from '../chain/port';
import { forgetEnvelope, refundEnvelope, restoreVault } from '../flows/manage';
import { envelopeView, type EnvelopeView } from '../lib/status';
import { localVaultStore } from '../lib/storage';
import { formatRelative } from '../lib/time';
import { txUrl } from '../lib/links';
import { formatNight } from '../lib/units';
import { useServices } from '../services';
import { READ_FAILED, friendlyError } from '../wallet/errors';
import { useWallet } from '../wallet/WalletContext';

export const VIEW_KEY = 'lixi.dashboard.view';
/** How often the page reads the chain again, so lights change while it is open (frontend spec §7). */
export const REFRESH_MS = 20_000;
type View = 'lights' | 'list';

/** What each light of a row shows (spec §3, §6.5). */
const lightOf = (view: EnvelopeView, opened: boolean): { state: LightState; word: string } => {
  if (view.state === 'missing') return { state: 'ghost', word: 'not on chain' };
  if (opened) return { state: 'out', word: 'opened' };
  if (view.state === 'refundable') return { state: 'home', word: 'coming home' };
  if (view.state === 'refunded') return { state: 'out', word: 'came home' };
  return { state: 'lit', word: 'waiting' };
};

/** Why the contract would refuse a refund, in words. */
const NOT_HOME: Record<'no envelope' | 'refunded' | 'not expired', string> = {
  'no envelope': 'It is not on chain.',
  refunded: 'It already came home.',
  'not expired': 'It cannot come home before it expires.',
};

const summary = ({ saved }: EnvelopeView) =>
  `${formatNight(saved.total)} tNIGHT in ${saved.count} lì xì, ${
    saved.kind === 'group' ? 'group link' : saved.split === 'random' ? 'lucky' : 'equal'
  }`;

const statusLine = (view: EnvelopeView, now: number): string => {
  const left = Number(view.saved.expiry) - now;
  const waiting = view.saved.count - view.claimed;
  switch (view.state) {
    case 'open':
      return `${view.claimed} opened. Comes home ${formatRelative(left)} if nobody opens the rest.`;
    case 'refundable':
      return `Expired ${formatRelative(left)}. ${view.claimed} opened; ${waiting} can come home.`;
    case 'refunded':
      return `Came home: ${formatNight(view.unclaimedAmount)} tNIGHT.`;
    case 'empty':
      return 'All opened.';
    case 'missing':
      return 'Not on chain. The wallet declined, or it is still on its way.';
  }
};

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

const Row = ({
  view,
  mode,
  now,
  onChanged,
}: {
  view: EnvelopeView;
  mode: View;
  now: number;
  onChanged: () => void;
}) => {
  const services = useServices();
  const { state } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [txHash, setTxHash] = useState<string>();
  const [stage, setStage] = useState<TxStage>();
  const { saved } = view;
  const labels = view.shares.map((s, n) => {
    const { state: light, word } = lightOf(view, s.opened);
    return { n, light, text: `Lì xì ${n + 1}: ${formatNight(s.amount)} tNIGHT, ${word}` };
  });

  const bringHome = async () => {
    const vault = localVaultStore(services.storage).load();
    if (state.status !== 'connected' || !vault) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await refundEnvelope(state.wallet.chain, vault, saved.index, services.now(), setStage);
      if (result.ok) setTxHash(result.txHash);
      else setError(NOT_HOME[result.reason]);
      onChanged();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setStage(undefined);
    }
  };

  const remove = () => {
    if (!window.confirm('This envelope is not on chain. Remove it from this browser?')) return;
    forgetEnvelope(localVaultStore(services.storage), saved.index);
    onChanged();
  };

  return (
    <li className="grid gap-x-6 gap-y-3 border-t border-white/10 py-5 sm:grid-cols-[1fr_auto]">
      <div className="space-y-3">
        {mode === 'lights' ? (
          <div className="flex flex-wrap items-center gap-3">
            {labels.map(({ n, light, text }) => (
              // Keyed by position, so a light changes state in place and animates (frontend spec §7).
              <Light key={n} state={busy ? 'pending' : light} label={text} focusable />
            ))}
          </div>
        ) : (
          <p className="text-sm text-paper-soft">{labels.map((l) => l.text).join('. ')}.</p>
        )}
        <div>
          <p className={view.state === 'empty' ? 'text-paper-dim' : ''}>{summary(view)}</p>
          <p className="text-sm text-paper-dim">{statusLine(view, now)}</p>
          {view.state === 'refunded' && txHash && (
            <a className="text-sm underline underline-offset-4" href={txUrl(txHash)} target="_blank" rel="noreferrer">
              View transaction
            </a>
          )}
        </div>
        {view.state === 'refundable' &&
          state.status === 'connected' &&
          view.refundAddress &&
          !sameBytes(view.refundAddress, state.wallet.recipient) && (
            <p className="text-sm text-paper-soft">
              It comes home to the wallet that sealed it, not to {state.wallet.name}. {state.wallet.name} only pays the
              fee.
            </p>
          )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
      <div className="flex items-start gap-3 sm:justify-end">
        {busy && state.status === 'connected' && (
          <div className="min-w-64">
            <TxProgress stage={stage} prover={state.wallet.prover} />
          </div>
        )}
        {!busy && (view.state === 'open' || view.state === 'empty') && (
          <ButtonLink to={`/share/${view.idHex}`} tone="quiet">
            Show links
          </ButtonLink>
        )}
        {!busy && view.state === 'refundable' && (
          <Button tone="home" type="button" onClick={bringHome} disabled={state.status !== 'connected'}>
            {state.status === 'connected'
              ? `Bring ${formatNight(view.unclaimedAmount)} tNIGHT home`
              : 'Connect a wallet to bring it home'}
          </Button>
        )}
        {!busy && view.state === 'missing' && (
          <Button tone="quiet" type="button" onClick={remove}>
            Remove
          </Button>
        )}
      </div>
    </li>
  );
};

const Restore = ({ onRestored }: { onRestored: () => void }) => {
  const services = useServices();
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(false);
  const [needsReplace, setNeedsReplace] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string }>();
  const [busy, setBusy] = useState(false);

  const restore = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await restoreVault(services.reader, localVaultStore(services.storage), text, {
        replaceDifferent: replace,
      });
      if (result.ok) {
        setMessage({ tone: 'info', text: `Restored ${result.found} envelope(s).` });
        setText('');
        setNeedsReplace(false);
        onRestored();
      } else if (result.reason === 'different seed') {
        setNeedsReplace(true);
        setMessage({
          tone: 'error',
          text: 'This browser holds envelopes from a different backup string. Restoring replaces them.',
        });
      } else {
        setMessage({ tone: 'error', text: 'That is not a Lixi backup string. It starts with “lixi_”.' });
      }
    } catch {
      setMessage({ tone: 'error', text: READ_FAILED });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={restore} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm text-paper-soft">Restore from a backup string</span>
        <input
          className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2.5"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
        />
      </label>
      {needsReplace && (
        <label className="flex gap-2 text-sm">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />I saved the backup
          string of the envelopes in this browser; replace them
        </label>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {busy ? (
        <Working>Looking for your envelopes on chain…</Working>
      ) : (
        <Button tone="quiet" type="submit" disabled={text.trim() === ''}>
          Restore envelopes
        </Button>
      )}
    </form>
  );
};

export const Dashboard = () => {
  const services = useServices();
  const { state } = useWallet();
  const [vault, setVault] = useState<{ vault?: SenderVault; error?: string }>({});
  const [ledger, setLedger] = useState<Ledger | string>();
  const [show, setShow] = useState<'none' | 'backup' | 'restore'>('none');
  const [mode, setMode] = useState<View>(() => (services.storage.getItem(VIEW_KEY) === 'list' ? 'list' : 'lights'));
  const choose = (m: View) => {
    setMode(m);
    services.storage.setItem(VIEW_KEY, m);
  };

  const reload = useCallback(() => {
    try {
      setVault({ vault: localVaultStore(services.storage).load() });
    } catch (error) {
      setVault({ error: friendlyError(error) });
      setShow('restore'); // the only way past an unreadable vault
    }
    services.reader
      .readLedger()
      .then(setLedger)
      .catch(() => setLedger(READ_FAILED));
  }, [services]);
  useEffect(reload, [reload]);

  // Read the chain again while the page is open; a failed background read keeps what is shown.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      services.reader
        .readLedger()
        .then(setLedger)
        .catch(() => undefined);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [services]);

  // News for the sender (spec §3.6): the views of every envelope, newest first, once per read.
  const newsViews = useMemo((): EnvelopeView[] | undefined => {
    const v = vault.vault;
    if (!v || !ledger || typeof ledger === 'string') return undefined;
    const now = services.now();
    return [...v.envelopes].sort((a, b) => b.index - a.index).map((e) => envelopeView(ledger, v.seed, e, now));
  }, [ledger, vault.vault, services]);
  const { toasts, closeToast } = useOpenedNews(newsViews);

  const now = services.now();
  const envelopes = vault.vault?.envelopes ?? [];
  const views =
    vault.vault && ledger && typeof ledger !== 'string'
      ? [...envelopes].sort((a, b) => b.index - a.index).map((e) => envelopeView(ledger, vault.vault!.seed, e, now))
      : [];

  return (
    <Page>
      <div className="max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="mr-auto space-y-1">
            <h1 className="text-4xl">Your envelopes</h1>
            {envelopes.length > 0 && (
              <p className="text-sm text-paper-dim">
                Sealed in this browser, whichever wallet is connected. Lì xì you opened are in your wallet, not here.
              </p>
            )}
          </div>
          {envelopes.length > 0 && (
            <div
              role="group"
              aria-label="View"
              className="flex overflow-hidden rounded-md border border-white/15 text-sm"
            >
              {(['lights', 'list'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => choose(m)}
                  className={`px-3 py-1.5 ${mode === m ? 'bg-white/10 text-paper' : 'text-paper-soft'}`}
                >
                  {m === 'lights' ? 'Lights' : 'List'}
                </button>
              ))}
            </div>
          )}
          {envelopes.length > 0 && <ButtonLink to="/create">Fill another envelope</ButtonLink>}
        </div>

        {vault.error && <Notice tone="error">{vault.error}</Notice>}
        {typeof ledger === 'string' && <Notice tone="error">{ledger}</Notice>}
        {envelopes.length > 0 && ledger === undefined && <Working>Reading the chain…</Working>}
        {!vault.error && envelopes.length === 0 && (
          <div className="space-y-4 py-6 text-center">
            <Light state="ghost" size="lg" />
            <p className="text-paper-soft">No envelopes in this browser yet.</p>
            <div className="flex justify-center gap-3">
              <ButtonLink to="/create">Fill an envelope</ButtonLink>
              <Button tone="quiet" type="button" onClick={() => setShow('restore')}>
                Restore from a backup string
              </Button>
            </div>
          </div>
        )}
        {views.some((v) => v.state === 'refundable') && state.status !== 'connected' && (
          <div className="rounded-lg border border-white/10 p-5">
            <WalletPanel purpose="to bring unopened lì xì home" />
          </div>
        )}
        {views.length > 0 && (
          <ul>
            {views.map((v) => (
              <Row key={v.idHex} view={v} mode={mode} now={now} onChanged={reload} />
            ))}
          </ul>
        )}

        {/* Empty: no backup box, only the restore form once the empty state's button (or an unreadable vault)
            opens it. One box either way, so a restore that fills the list keeps its form and message. */}
        {(envelopes.length > 0 || show === 'restore') && (
          <div className="space-y-5 rounded-lg border border-white/10 p-5">
            {envelopes.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="mr-auto text-sm text-paper-soft">
                  <span className="font-semibold text-paper">Your backup string</span> rebuilds every envelope here on
                  another device.
                </p>
                {vault.vault && (
                  <Button tone="quiet" type="button" onClick={() => setShow(show === 'backup' ? 'none' : 'backup')}>
                    Show
                  </Button>
                )}
                <Button tone="quiet" type="button" onClick={() => setShow(show === 'restore' ? 'none' : 'restore')}>
                  Restore
                </Button>
              </div>
            )}
            {show === 'backup' && vault.vault && <BackupString vault={vault.vault} />}
            {show === 'restore' && <Restore onRestored={reload} />}
          </div>
        )}
      </div>
      <Toasts toasts={toasts} onClose={closeToast} />
    </Page>
  );
};

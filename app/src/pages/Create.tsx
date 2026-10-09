import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { MAX_SHARES, toHex } from '@lixi/contract';
import { deriveEnvelope, nextIndex, type EnvelopeKind, type SenderVault, type SplitMode } from '@lixi/sdk';
import { BackupStep } from '../components/BackupPanel';
import { Page } from '../components/Layout';
import { Light } from '../components/Light';
import { FeeHint } from '../components/FeeHint';
import { TxProgress } from '../components/TxProgress';
import { WalletPanel } from '../components/WalletPanel';
import { Button, Notice } from '../components/ui';
import type { TxStage } from '../chain/port';
import { createEnvelope, freeIndex, loadOrCreateVault } from '../flows/create';
import { LINKS } from '../lib/links';
import { localVaultStore } from '../lib/storage';
import { EXPIRY_PRESETS } from '../lib/time';
import { formatNight, parseNight } from '../lib/units';
import { useServices } from '../services';
import { friendlyError } from '../wallet/errors';
import { useWallet } from '../wallet/WalletContext';

/** Where the live field places up to 16 lights: [left %, top %]. */
const SLOTS: Array<[number, number]> = [
  [14, 18],
  [42, 6],
  [68, 22],
  [88, 8],
  [26, 46],
  [54, 36],
  [80, 50],
  [8, 72],
  [36, 70],
  [62, 80],
  [90, 76],
  [18, 92],
  [48, 96],
  [74, 98],
  [4, 40],
  [96, 34],
];

const fill = 'ml-1.5 inline-block border-b-2 border-lantern bg-transparent px-0.5 text-center font-semibold text-white';

type Preview = { readonly amounts: bigint[] } | undefined;

/** The envelope taking shape: one light per lì xì, sized by its share when amounts are lucky (spec §6.2). */
const LiveField = ({
  preview,
  count,
  kind,
  sealing,
}: {
  preview: Preview;
  count?: number;
  kind: EnvelopeKind;
  sealing: boolean;
}) => {
  const n = preview?.amounts.length ?? count ?? 0;
  if (n === 0) return <div className="h-44 md:h-64" aria-hidden="true" />;
  const amounts = preview?.amounts ?? [];
  const [min, max] = amounts.length
    ? [amounts.reduce((a, b) => (a < b ? a : b)), amounts.reduce((a, b) => (a > b ? a : b))]
    : [0n, 0n];
  const scale = (a: bigint) => (max === min ? 1 : 0.8 + (0.5 * Number(a - min)) / Number(max - min));
  const state = sealing ? 'pending' : preview ? 'lit' : 'ghost';
  if (kind === 'group')
    return (
      <div
        className="relative flex h-44 items-center justify-center gap-4 md:h-64"
        aria-label={`${n} lì xì, one group link`}
        role="img"
      >
        <span className="absolute inset-x-6 top-1/2 h-px bg-lantern/40" />
        {Array.from({ length: n }, (_, k) => (
          <Light key={k} state={state} className="relative" />
        ))}
      </div>
    );
  return (
    <div className="relative h-44 md:h-64" role="img" aria-label={`${n} lì xì`}>
      {Array.from({ length: n }, (_, k) => {
        const [left, top] = SLOTS[k];
        const s = amounts[k] !== undefined ? scale(amounts[k]) : 1;
        return (
          <span
            key={k}
            className="absolute -translate-x-1/2 text-center"
            style={{ left: `${left}%`, top: `${top * 0.78}%` } as CSSProperties}
          >
            <Light state={state} style={{ transform: `scale(${s})`, transition: 'transform .3s' }} />
            {amounts[k] !== undefined && (
              <span className="block pt-1.5 text-xs text-paper-soft">{formatNight(amounts[k])}</span>
            )}
          </span>
        );
      })}
    </div>
  );
};

export const Create = () => {
  const services = useServices();
  const store = localVaultStore(services.storage);
  const navigate = useNavigate();
  const { state } = useWallet();
  const wallet = state.status === 'connected' ? state.wallet : undefined;
  const [vault] = useState<{ ok: true; vault: SenderVault } | { ok: false; message: string }>(() => {
    try {
      return { ok: true, vault: loadOrCreateVault(store) };
    } catch (error) {
      return { ok: false, message: friendlyError(error) };
    }
  });
  const [index, setIndex] = useState(() => (vault.ok ? Math.max(nextIndex(vault.vault), store.floor()) : 0));
  const [backedUp, setBackedUp] = useState(() => store.backedUp());
  const [amount, setAmount] = useState('10');
  const [countText, setCountText] = useState('4');
  const [kind, setKind] = useState<EnvelopeKind>('personal');
  const [split, setSplit] = useState<SplitMode>('random');
  const [duration, setDuration] = useState<number>(EXPIRY_PRESETS[1].seconds);
  const [status, setStatus] = useState<{ sealing: boolean; stage?: TxStage; error?: string }>({ sealing: false });
  const [askBackup, setAskBackup] = useState(false);

  // Preview the index createEnvelope will use, skipping any already on chain.
  useEffect(() => {
    if (!vault.ok) return;
    services.reader
      .readLedger()
      .then((ledger) => setIndex(freeIndex(vault.vault, ledger, store.floor())))
      .catch(() => undefined);
  }, [services.reader, vault]);

  if (!vault.ok)
    return (
      <Page>
        <Notice tone="error">{vault.message}</Notice>
      </Page>
    );
  let total: bigint | undefined;
  try {
    total = parseNight(amount);
  } catch {
    total = undefined;
  }
  const count = /^\d+$/.test(countText) && +countText >= 1 && +countText <= MAX_SHARES ? +countText : undefined;
  const amountError = amount !== '' && (total === undefined || total < BigInt(count ?? 1));
  const effectiveSplit: SplitMode = kind === 'group' ? 'equal' : split;
  let preview: Preview;
  try {
    preview =
      total !== undefined && count !== undefined
        ? {
            amounts: deriveEnvelope(vault.vault.seed, { index, total, count, kind, split: effectiveSplit })
              .shares.slice(0, count)
              .map((s) => s.amount),
          }
        : undefined;
  } catch {
    preview = undefined;
  }

  const seal = async () => {
    if (!wallet || total === undefined || count === undefined) return;
    setStatus({ sealing: true });
    try {
      const form = { total, count, kind, split: effectiveSplit, durationSeconds: duration };
      const { id } = await createEnvelope(wallet.chain, store, form, wallet.recipient, services.now(), index, (stage) =>
        setStatus({ sealing: true, stage }),
      );
      navigate(`/share/${toHex(id)}`);
    } catch (error) {
      setStatus({ sealing: false, error: friendlyError(error) });
      // A failed seal keeps its vault entry and its index, so the preview moves on to the next free one.
      services.reader
        .readLedger()
        .then((ledger) => setIndex(freeIndex(store.load() ?? vault.vault, ledger, store.floor())))
        .catch(() => undefined);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // The first seal asks for the backup string first (UX polish spec §3.6).
    if (!backedUp) setAskBackup(true);
    else void seal();
  };

  // field-sizing keeps each choice as wide as its text, so the sentence reads without gaps (Chromium; others fall back).
  const select = `${fill} cursor-pointer appearance-none [field-sizing:content]`;
  return (
    <Page>
      <form onSubmit={submit} className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
        <div className="order-2 space-y-5 md:order-1">
          <h1 className="sr-only">Fill an envelope</h1>
          <p className="text-2xl leading-[2.1] font-light sm:text-[1.7rem]">
            Put
            <input
              aria-label="Total tNIGHT"
              inputMode="decimal"
              className={fill}
              style={{ width: `${Math.max(2, amount.length + 1)}ch` }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={amountError}
            />
            tNIGHT into
            <input
              aria-label="Number of lì xì"
              inputMode="numeric"
              className={fill}
              style={{ width: `${Math.max(2, countText.length + 1)}ch` }}
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              aria-invalid={count === undefined}
            />
            lì xì,
            <select
              aria-label="Amounts"
              className={select}
              value={effectiveSplit}
              disabled={kind === 'group'}
              onChange={(e) => setSplit(e.target.value as SplitMode)}
            >
              <option value="random">lucky amounts</option>
              <option value="equal">equal amounts</option>
            </select>
            , with
            <select
              aria-label="Links"
              className={select}
              value={kind}
              onChange={(e) => setKind(e.target.value as EnvelopeKind)}
            >
              <option value="personal">one link each</option>
              <option value="group">one group link</option>
            </select>
            . What nobody opens comes home after
            <select
              aria-label="Comes home after"
              className={select}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {EXPIRY_PRESETS.map((p) => (
                <option key={p.seconds} value={p.seconds}>
                  {p.label}
                </option>
              ))}
            </select>
            .
          </p>
          {amountError && <p className="text-sm text-error">Enter an amount like 10 or 2.5.</p>}
          {count === undefined && <p className="text-sm text-error">Choose 1 to {MAX_SHARES}.</p>}
          <p className="text-sm text-paper-soft">
            {kind === 'group'
              ? 'A group link gives the same amount to each person, one per wallet.'
              : 'Lucky amounts are random; everyone gets at least a little.'}
          </p>
          {status.error && <Notice tone="error">{status.error}</Notice>}
          {!wallet ? (
            <WalletPanel
              purpose="to fund the envelope"
              hint={
                <>
                  You need tNIGHT to fill an envelope:{' '}
                  <a className="underline underline-offset-4" href={LINKS.faucet.href} target="_blank" rel="noreferrer">
                    {LINKS.faucet.label}
                  </a>
                  .
                </>
              }
            />
          ) : status.sealing ? (
            <div className="space-y-4">
              <p className="text-paper-soft">Sealing your envelope. Keep this tab open.</p>
              <TxProgress stage={status.stage} prover={wallet.prover} />
            </div>
          ) : askBackup ? (
            <BackupStep
              vault={vault.vault}
              count={count}
              ready={total !== undefined && count !== undefined && !amountError}
              onBack={() => setAskBackup(false)}
              onSaved={() => {
                store.setBackedUp(true);
                setBackedUp(true);
                setAskBackup(false);
                void seal();
              }}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-full space-y-3 empty:hidden">
                <FeeHint wallet={wallet} needNight={total} />
              </div>
              <Button type="submit" disabled={total === undefined || count === undefined || amountError}>
                Seal {count ?? ''} lì xì
              </Button>
              {total !== undefined && (
                <span className="text-sm text-paper-dim">
                  Your wallet pays {formatNight(total)} tNIGHT. 1AM pays the fee.
                </span>
              )}
            </div>
          )}
        </div>
        <div className="order-1 md:order-2">
          <LiveField preview={preview} count={count} kind={kind} sealing={status.sealing} />
        </div>
      </form>
    </Page>
  );
};

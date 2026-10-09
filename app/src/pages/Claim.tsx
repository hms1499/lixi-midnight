import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { encodeLink, parseClaimInput, type ClaimLink } from '@lixi/sdk';
import { Envelope, EnvelopeChecking, type EnvelopeState } from '../components/Envelope';
import { Page } from '../components/Layout';
import { Light } from '../components/Light';
import { FeeHint } from '../components/FeeHint';
import { Blossoms, PrivacyReceipt, SlipAmount } from '../components/Opened';
import { TxProgress } from '../components/TxProgress';
import { RequireWallet } from '../components/WalletPanel';
import { Button, ButtonLink, Greeting, Notice, buttonClass } from '../components/ui';
import type { ProverChoice, TxStage } from '../chain/port';
import { claimWithLink, previewClaim, type ClaimPreview, type ClaimRefusal } from '../flows/claim';
import { txUrl } from '../lib/links';
import { formatNight } from '../lib/units';
import { useServices } from '../services';
import { READ_FAILED, friendlyError } from '../wallet/errors';
import { useDetectedWallets } from '../wallet/WalletContext';

/** Why a lì xì can’t be opened, and what to do about it (spec §6.4, moment 4). */
const REFUSAL: Record<ClaimRefusal, { heading: string; help: string }> = {
  'already claimed': {
    heading: 'This lì xì was already opened',
    help: 'Each link opens once. If you did not open it, the link reached someone else first; ask the sender.',
  },
  expired: {
    heading: 'This envelope has expired',
    help: 'Unopened lì xì go back to the sender after the expiry they chose.',
  },
  refunded: {
    heading: 'The sender already took back what nobody opened',
    help: 'The envelope expired, and its unopened lì xì went back to the sender.',
  },
  'address already claimed': {
    heading: 'This wallet already opened one from this group',
    help: 'A group link gives one lì xì per wallet.',
  },
  'all shares claimed': {
    heading: 'Every lì xì in this envelope has been opened',
    help: 'Others opened them all before this link reached you.',
  },
  'no envelope': {
    heading: 'This envelope is not on this network',
    help: 'The link may belong to another Lixi deployment or another network.',
  },
  'invalid link': {
    heading: 'This link is damaged',
    help: 'Part of it is missing. Ask the sender to send it again, and copy the whole link.',
  },
};

const Centre = ({ children }: { children: ReactNode }) => (
  <Page>
    <div className="mx-auto max-w-xl space-y-5 text-center">{children}</div>
  </Page>
);

const Refused = ({ reason }: { reason: ClaimRefusal }) => (
  <Centre>
    <Envelope state="out" label="An envelope that cannot be opened" />
    <h1 className="pt-4 text-3xl">{REFUSAL[reason].heading}</h1>
    <p className="text-paper-soft">{REFUSAL[reason].help}</p>
    <ButtonLink to="/c" tone="quiet">
      Open a different link
    </ButtonLink>
  </Centre>
);

/** No fragment: the recipient pastes the link they were sent. */
const PasteLink = () => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const open = (e: FormEvent) => {
    e.preventDefault();
    try {
      navigate(`/c#${encodeLink(parseClaimInput(text))}`);
    } catch {
      setError(true);
    }
  };
  return (
    <Centre>
      <Light state="lit" size="lg" />
      <h1 className="text-3xl">Open a lì xì</h1>
      <form onSubmit={open} className="space-y-4 text-left">
        <label className="block space-y-1">
          <span className="text-sm text-paper-soft">Paste the link you were sent</span>
          <input
            className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2.5"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(false);
            }}
          />
        </label>
        {error && (
          <Notice tone="error">That is not a Lixi link. Copy the whole link from the message and try again.</Notice>
        )}
        <Button type="submit" disabled={text.trim() === ''}>
          Open link
        </Button>
      </form>
    </Centre>
  );
};

type Phase =
  | { readonly step: 'checking' }
  | { readonly step: 'ready'; readonly preview: Extract<ClaimPreview, { ok: true }>; readonly error?: string }
  | { readonly step: 'opening'; readonly prover: ProverChoice; readonly stage?: TxStage }
  | { readonly step: 'opened'; readonly amount: bigint; readonly total: bigint; readonly txHash: string }
  | { readonly step: 'refused'; readonly reason: ClaimRefusal }
  | { readonly step: 'failed'; readonly message: string };

const Claimer = ({ link }: { link: ClaimLink }) => {
  const services = useServices();
  const wallets = useDetectedWallets();
  const [phase, setPhase] = useState<Phase>({ step: 'checking' });

  useEffect(() => {
    let live = true;
    services.reader
      .readLedger()
      .then((ledger) => {
        if (!live) return;
        const preview = previewClaim(ledger, link, services.now());
        setPhase(preview.ok ? { step: 'ready', preview } : { step: 'refused', reason: preview.reason });
      })
      .catch(() => live && setPhase({ step: 'failed', message: READ_FAILED }));
    return () => {
      live = false;
    };
  }, [services, link]);

  if (phase.step === 'refused') return <Refused reason={phase.reason} />;
  if (phase.step === 'checking')
    return (
      <Centre>
        <EnvelopeChecking />
      </Centre>
    );
  if (phase.step === 'failed')
    return (
      <Centre>
        <Envelope state="out" label="An envelope that could not be read" />
        <Notice tone="error">{phase.message}</Notice>
      </Centre>
    );
  if (phase.step === 'opened')
    return (
      <Page>
        <div className="relative mx-auto max-w-xl space-y-5 text-center">
          <Blossoms />
          {/* Room above for the slip, which rises ~62 px out of the envelope; below the sticky header. */}
          <div className="pt-24">
            <Envelope state="opened" label={`An opened lì xì: ${formatNight(phase.amount)} tNIGHT`}>
              <SlipAmount amount={phase.amount} />
            </Envelope>
          </div>
          <h1 className="sr-only">You opened {formatNight(phase.amount)} tNIGHT</h1>
          <Greeting className="pt-4">An khang thịnh vượng</Greeting>
          <PrivacyReceipt amount={phase.amount} total={phase.total} kind={link.kind} />
          <div className="flex flex-wrap justify-center gap-3">
            {phase.txHash && (
              <a className={buttonClass('quiet')} href={txUrl(phase.txHash)} target="_blank" rel="noreferrer">
                See it on the explorer
              </a>
            )}
            <ButtonLink to="/create" tone="quiet">
              Send lì xì of your own
            </ButtonLink>
          </div>
        </div>
      </Page>
    );

  const opening = phase.step === 'opening';
  const preview = phase.step === 'ready' ? phase.preview : undefined;
  const expires = preview ? new Date((services.now() + preview.secondsLeft) * 1000) : undefined;
  const envelopeState: EnvelopeState = opening ? 'opening' : 'sealed';
  const open = async (chain: Parameters<typeof claimWithLink>[0], recipient: Uint8Array, prover: ProverChoice) => {
    const before = phase;
    setPhase({ step: 'opening', prover });
    try {
      const result = await claimWithLink(chain, link, recipient, services.now, (stage) =>
        setPhase({ step: 'opening', prover, stage }),
      );
      setPhase(
        result.ok
          ? { step: 'opened', amount: result.amount, total: result.total, txHash: result.txHash }
          : { step: 'refused', reason: result.reason },
      );
    } catch (error) {
      if (before.step === 'ready') setPhase({ ...before, error: friendlyError(error) });
    }
  };

  return (
    <Centre>
      <Envelope state={envelopeState} label="A sealed lì xì" />
      <Greeting className="pt-4">Chúc mừng năm mới</Greeting>
      {opening ? (
        <>
          <h1 className="text-3xl">Opening your lì xì</h1>
          <p className="text-paper-soft">
            Your wallet is proving that you hold this link, without showing the link to anyone.
          </p>
          {phase.step === 'opening' && (
            <div className="mx-auto max-w-xs pt-2">
              <TxProgress stage={phase.stage} prover={phase.prover} />
            </div>
          )}
        </>
      ) : (
        preview && (
          <>
            <h1 className="text-3xl">Someone sent you a lì xì</h1>
            <p className="text-paper-soft">
              {link.kind === 'group' ? 'One lì xì from a group envelope, ' : ''}
              {formatNight(preview.amount)} tNIGHT is sealed inside. Open it before{' '}
              {expires?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.
            </p>
            {preview.expiringSoon && (
              <Notice tone="warn">Less than 10 minutes are left. Opening takes about 30 seconds, so start now.</Notice>
            )}
            {phase.step === 'ready' && phase.error && <Notice tone="error">{phase.error}</Notice>}
            <p className="text-sm text-paper-dim">
              Opening it needs the 1AM wallet. 1AM pays the fee, so you need no tNIGHT or DUST.
            </p>
            <div className="flex justify-center text-left">
              <RequireWallet
                purpose="to open it"
                hint="Your link stays in the address bar when you reload."
                cta={(name) => (wallets.length === 1 ? `Connect ${name} to open it` : `Connect ${name}`)}
              >
                {(wallet) => (
                  <div className="space-y-4">
                    <FeeHint wallet={wallet} />
                    <Button type="button" onClick={() => open(wallet.chain, wallet.recipient, wallet.prover)}>
                      Open the lì xì
                    </Button>
                  </div>
                )}
              </RequireWallet>
            </div>
          </>
        )
      )}
    </Centre>
  );
};

export const Claim = () => {
  const { hash } = useLocation();
  const fragment = hash.slice(1);
  // One link object per fragment: a new object on every render would make the Claimer read the chain again.
  const link = useMemo((): ClaimLink | undefined => {
    try {
      return parseClaimInput(fragment);
    } catch {
      return undefined;
    }
  }, [fragment]);
  if (fragment === '') return <PasteLink />;
  if (!link) return <Refused reason="invalid link" />;
  return <Claimer key={fragment} link={link} />;
};

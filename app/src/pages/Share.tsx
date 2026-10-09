import { useEffect, useMemo, useState } from 'react';
import type { Ledger } from '@lixi/contract';
import { useParams } from 'react-router';
import { toHex } from '@lixi/contract';
import { claimUrl, deriveEnvelope, linksFor, type SavedEnvelope } from '@lixi/sdk';
import { CopyButton } from '../components/CopyButton';
import { Page } from '../components/Layout';
import { Light } from '../components/Light';
import { Toasts, useOpenedNews } from '../components/Toasts';
import { Button, ButtonLink, Greeting, Notice, Working } from '../components/ui';
import { GREETING_MAX, loadGreeting, saveGreeting, shareMessage } from '../lib/greeting';
import { envelopeView } from '../lib/status';
import { localVaultStore } from '../lib/storage';
import { formatNight } from '../lib/units';
import { useServices } from '../services';
import { READ_FAILED, friendlyError } from '../wallet/errors';

/** While the envelope is on its way, how often the page looks again, and when it says it is taking long (§3.7). */
export const SHARE_POLL_MS = 5_000;
export const SHARE_SLOW_MS = 120_000;
/** Once on chain, how often the page reads again, so opened lì xì show as opened (as My envelopes does). */
export const SHARE_REFRESH_MS = 20_000;

/** Links for one envelope, shown only once the envelope is on chain (spec §6.3). */
export const Share = () => {
  const { id } = useParams();
  const services = useServices();
  const [onChain, setOnChain] = useState<boolean | string>();
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);
  const [ledger, setLedger] = useState<Ledger>();
  const [greeting, setGreeting] = useState(() => loadGreeting(services.storage));
  const changeGreeting = (text: string) => {
    const next = text.slice(0, GREETING_MAX);
    setGreeting(next);
    saveGreeting(services.storage, next);
  };

  // Derived once per envelope: a fresh id array on every render would make the effects below read the chain again.
  const { found, saved, seed, unreadable } = useMemo((): {
    found?: ReturnType<typeof deriveEnvelope>;
    saved?: SavedEnvelope;
    seed?: Uint8Array;
    unreadable?: string;
  } => {
    try {
      const vault = localVaultStore(services.storage).load();
      const saved = vault?.envelopes.find((e) => toHex(deriveEnvelope(vault.seed, e).id) === id);
      return { found: saved && vault ? deriveEnvelope(vault.seed, saved) : undefined, saved, seed: vault?.seed };
    } catch (error) {
      return { unreadable: friendlyError(error) };
    }
  }, [services.storage, id]);
  const envelopeId = found?.id;

  useEffect(() => {
    if (!envelopeId) return;
    let live = true;
    services.reader
      .readLedger()
      // Once found, it stays found: a slower read cannot take the links away again.
      .then((ledger) => {
        if (!live) return;
        setLedger(ledger);
        setOnChain((was) => was === true || ledger.envelopes.member(envelopeId));
      })
      // Only a failed first look is an error; a failed Check again keeps the page where it was.
      .catch(() => live && setOnChain((was) => (was === undefined || typeof was === 'string' ? READ_FAILED : was)));
    return () => {
      live = false;
    };
  }, [services.reader, envelopeId, attempt]);

  // Not on chain yet: look again every few seconds. A failed background read waits for the next tick.
  useEffect(() => {
    if (!envelopeId || onChain !== false) return;
    const poll = setInterval(() => {
      services.reader
        .readLedger()
        .then((ledger) => {
          setLedger(ledger);
          if (ledger.envelopes.member(envelopeId)) setOnChain(true);
        })
        .catch(() => undefined);
    }, SHARE_POLL_MS);
    const late = setTimeout(() => setSlow(true), SHARE_SLOW_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(late);
    };
  }, [services.reader, envelopeId, onChain]);

  // On chain: read again while the page is open, so links that were opened show as opened.
  useEffect(() => {
    if (onChain !== true) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      services.reader
        .readLedger()
        .then(setLedger)
        .catch(() => undefined);
    }, SHARE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [services.reader, onChain]);

  // Which of this envelope's lì xì are opened, from the last read; it feeds the rows and the sender's news.
  const view = useMemo(
    () =>
      ledger && saved && seed && ledger.envelopes.member(envelopeId!)
        ? envelopeView(ledger, seed, saved, services.now())
        : undefined,
    [ledger, saved, seed, envelopeId, services],
  );
  const views = useMemo(() => (view ? [view] : undefined), [view]);
  const { toasts, closeToast } = useOpenedNews(views);

  if (!found)
    return (
      <Page>
        <Notice tone="error">{unreadable ?? 'This envelope is not in this browser’s saved envelopes.'}</Notice>
      </Page>
    );
  if (onChain === undefined)
    return (
      <Page>
        <Working>Looking for your envelope on chain…</Working>
      </Page>
    );
  if (typeof onChain === 'string')
    return (
      <Page>
        <div className="space-y-4">
          <Notice tone="error">{onChain}</Notice>
          <Button tone="quiet" type="button" onClick={() => setAttempt((n) => n + 1)}>
            Check again
          </Button>
        </div>
      </Page>
    );
  if (!onChain)
    return (
      <Page>
        <div className="space-y-4">
          <Working>Your envelope is on its way to the chain…</Working>
          {slow && (
            <Notice tone="warn">
              Still not on chain. If your wallet shows the transaction failed or was declined, go back and seal again.
              Your envelope list keeps this attempt as Not on chain.
            </Notice>
          )}
          <Button tone="quiet" type="button" onClick={() => setAttempt((n) => n + 1)}>
            Check again
          </Button>
        </div>
      </Page>
    );

  const { spec } = found;
  const opened = (n: number, kind: 'personal' | 'group') =>
    kind === 'group' ? (view?.claimed ?? 0) === spec.count : (view?.shares[n]?.opened ?? false);
  const links = linksFor(found).map((link, n) => ({
    link,
    url: claimUrl(services.origin, link),
    opened: opened(n, link.kind),
  }));
  const unopened = links.filter((l) => !l.opened);
  const expiry = new Date(Number(saved!.expiry) * 1000);
  return (
    <Page>
      <div className="max-w-3xl space-y-6">
        <div>
          <Greeting>Sealed</Greeting>
          <h1 className="mt-1 text-4xl">{spec.count} lì xì, ready to hand out</h1>
        </div>
        <Notice tone="warn">
          A link is like cash: whoever opens it first gets the lì xì. Send each one to one person, in a private chat.
        </Notice>
        <label className="block max-w-md space-y-1">
          <span className="text-sm text-paper-soft">Greeting</span>
          <input
            className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2.5"
            value={greeting}
            maxLength={GREETING_MAX}
            onChange={(e) => changeGreeting(e.target.value)}
          />
        </label>
        <ul>
          {links.map(({ link, url, opened }, n) => {
            const name =
              link.kind === 'group'
                ? `One link for ${spec.count} people, ${formatNight(spec.total / BigInt(spec.count))} tNIGHT each, one per wallet`
                : `Lì xì ${n + 1}`;
            return (
              <li key={url} className="flex flex-wrap items-center gap-4 border-t border-white/10 py-3">
                <Light state={opened ? 'out' : 'lit'} size={link.kind === 'group' ? 'lg' : 'md'} />
                <span className="flex-1">
                  {name}
                  {link.kind === 'personal' ? (
                    <span className="block text-sm text-paper-dim">
                      {formatNight(link.share.amount)} tNIGHT{opened ? ' · opened' : ''}
                    </span>
                  ) : (
                    view && (
                      <span className="block text-sm text-paper-dim">
                        {view.claimed} of {spec.count} opened
                      </span>
                    )
                  )}
                </span>
                {!opened && (
                  <span className="flex flex-wrap justify-end gap-2">
                    <CopyButton
                      text={shareMessage({ greeting, url, expiry })}
                      label="Copy message"
                      name={name}
                      strong
                    />
                    <CopyButton text={url} label="Copy link" name={name} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-3">
          {unopened.length > 1 && (
            <CopyButton
              text={unopened.map((l) => l.url).join('\n')}
              label={
                unopened.length === links.length
                  ? `Copy all ${links.length} links`
                  : `Copy all ${unopened.length} unopened links`
              }
            />
          )}
          <ButtonLink to="/dashboard" tone="quiet">
            See them in My envelopes
          </ButtonLink>
        </div>
      </div>
      <Toasts toasts={toasts} onClose={closeToast} />
    </Page>
  );
};

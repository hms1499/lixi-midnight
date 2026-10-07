import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { toHex } from '@lixi/contract';
import { claimUrl, deriveEnvelope, linksFor } from '@lixi/sdk';
import { CopyButton } from '../components/CopyButton';
import { Page } from '../components/Layout';
import { Light } from '../components/Light';
import { Button, ButtonLink, Greeting, Notice, Working } from '../components/ui';
import { localVaultStore } from '../lib/storage';
import { formatNight } from '../lib/units';
import { useServices } from '../services';
import { READ_FAILED, friendlyError } from '../wallet/errors';

/** While the envelope is on its way, how often the page looks again, and when it says it is taking long (§3.7). */
export const SHARE_POLL_MS = 5_000;
export const SHARE_SLOW_MS = 120_000;

/** Links for one envelope, shown only once the envelope is on chain (spec §6.3). */
export const Share = () => {
  const { id } = useParams();
  const services = useServices();
  const [onChain, setOnChain] = useState<boolean | string>();
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);

  // Derived once per envelope: a fresh id array on every render would make the effects below read the chain again.
  const { found, unreadable } = useMemo((): {
    found?: ReturnType<typeof deriveEnvelope>;
    unreadable?: string;
  } => {
    try {
      const vault = localVaultStore(services.storage).load();
      const saved = vault?.envelopes.find((e) => toHex(deriveEnvelope(vault.seed, e).id) === id);
      return { found: saved && vault ? deriveEnvelope(vault.seed, saved) : undefined };
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
      .then((ledger) => live && setOnChain((was) => was === true || ledger.envelopes.member(envelopeId)))
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
  const links = linksFor(found).map((link) => ({ link, url: claimUrl(services.origin, link) }));
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
        <ul>
          {links.map(({ link, url }, n) => {
            const name =
              link.kind === 'group'
                ? `One link for ${spec.count} people, ${formatNight(spec.total / BigInt(spec.count))} tNIGHT each, one per wallet`
                : `Lì xì ${n + 1}`;
            return (
              <li key={url} className="flex items-center gap-4 border-t border-white/10 py-3">
                <Light state="lit" size={link.kind === 'group' ? 'lg' : 'md'} />
                <span className="flex-1">
                  {name}
                  {link.kind === 'personal' && (
                    <span className="block text-sm text-paper-dim">{formatNight(link.share.amount)} tNIGHT</span>
                  )}
                </span>
                <CopyButton text={url} label="Copy link" name={name} />
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-3">
          {links.length > 1 && (
            <CopyButton text={links.map((l) => l.url).join('\n')} label={`Copy all ${links.length} links`} />
          )}
          <ButtonLink to="/dashboard" tone="quiet">
            See them in My envelopes
          </ButtonLink>
        </div>
      </div>
    </Page>
  );
};

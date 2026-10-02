import { useEffect, useState } from 'react';
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
import { friendlyError } from '../wallet/errors';

/** Links for one envelope, shown only once the envelope is on chain (spec §6.3). */
export const Share = () => {
  const { id } = useParams();
  const services = useServices();
  const [onChain, setOnChain] = useState<boolean | string>();
  const [attempt, setAttempt] = useState(0);

  let found: ReturnType<typeof deriveEnvelope> | undefined;
  try {
    const vault = localVaultStore(services.storage).load();
    const saved = vault?.envelopes.find((e) => toHex(deriveEnvelope(vault.seed, e).id) === id);
    found = saved && vault ? deriveEnvelope(vault.seed, saved) : undefined;
  } catch {
    found = undefined;
  }
  const envelopeId = found?.id;

  useEffect(() => {
    if (!envelopeId) return;
    let live = true;
    services.reader
      .readLedger()
      .then((ledger) => live && setOnChain(ledger.envelopes.member(envelopeId)))
      .catch((error) => live && setOnChain(friendlyError(error)));
    return () => {
      live = false;
    };
  }, [services.reader, envelopeId, attempt]);

  if (!found)
    return (
      <Page>
        <Notice tone="error">This envelope is not in this browser’s saved envelopes.</Notice>
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
        <Notice tone="error">{onChain}</Notice>
      </Page>
    );
  if (!onChain)
    return (
      <Page>
        <div className="space-y-4">
          <Working>Your envelope is on its way to the chain…</Working>
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

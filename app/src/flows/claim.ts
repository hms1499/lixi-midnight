import { pureCircuits, type Ledger } from '@lixi/contract';
import {
  EXPIRY_WARNING_SECONDS,
  checkClaim,
  resolveClaim,
  type ClaimArgs,
  type ClaimLink,
  type ClaimRejection,
} from '@lixi/sdk';
import type { LixiChain } from '../chain/port';

export type ClaimRefusal = ClaimRejection | 'all shares claimed';

type Ready = { readonly ok: true; readonly args: ClaimArgs; readonly amount: bigint; readonly secondsLeft: number };
type Refused = { readonly ok: false; readonly reason: ClaimRefusal };

export type ClaimPreview =
  | { readonly ok: true; readonly amount: bigint; readonly secondsLeft: number; readonly expiringSoon: boolean }
  | Refused;

export type ClaimResult = { readonly ok: true; readonly amount: bigint; readonly txId: string } | Refused;

/** Any address will do before a wallet is connected: only group envelopes look at it. */
const NO_ADDRESS = new Uint8Array(32);

const prepare = (ledger: Ledger, link: ClaimLink, recipient: Uint8Array, now: number): Ready | Refused => {
  // Envelope-level refusals first: "expired" or "refunded" explain more than "claimed".
  if (!ledger.envelopes.member(link.id)) return { ok: false, reason: 'no envelope' };
  const env = ledger.envelopes.lookup(link.id);
  if (env.refunded) return { ok: false, reason: 'refunded' };
  if (now >= Number(env.expiry)) return { ok: false, reason: 'expired' };
  let args: ClaimArgs;
  try {
    args = resolveClaim(link, (nf) => ledger.nullifiers.member(nf));
  } catch {
    return { ok: false, reason: link.kind === 'group' ? 'all shares claimed' : 'already claimed' };
  }
  const check = checkClaim(ledger, args, recipient, now);
  return check.ok ? { ok: true, args, amount: check.amount, secondsLeft: check.secondsLeft } : check;
};

/** What the recipient sees before connecting a wallet. */
export const previewClaim = (ledger: Ledger, link: ClaimLink, now: number): ClaimPreview => {
  const ready = prepare(ledger, link, NO_ADDRESS, now);
  if (!ready.ok) return ready;
  return {
    ok: true,
    amount: ready.amount,
    secondsLeft: ready.secondsLeft,
    expiringSoon: ready.secondsLeft < EXPIRY_WARNING_SECONDS,
  };
};

/**
 * Claims one share for `recipient`. Every attempt re-runs the contract's checks first (spec §4.6), so
 * a doomed claim costs no proof. If a submission fails because someone else took the share meanwhile,
 * a personal link reports "already claimed" and a group link retries with another share (spec §4.6:
 * at most `tries` attempts). Any other failure is rethrown for the page to explain.
 */
export const claimWithLink = async (
  chain: LixiChain,
  link: ClaimLink,
  recipient: Uint8Array,
  now: () => number,
  tries = 3,
): Promise<ClaimResult> => {
  for (let attempt = 1; ; attempt++) {
    const ready = prepare(await chain.readLedger(), link, recipient, now());
    if (!ready.ok) return ready;
    try {
      const txId = await chain.claim({ ...ready.args, recipient });
      return { ok: true, amount: ready.amount, txId };
    } catch (error) {
      const ledger = await chain.readLedger().catch(() => undefined);
      if (!ledger) throw error;
      // A group records each paid address. If ours is there now, our transaction landed although the call failed.
      if (link.kind === 'group' && ledger.addrClaims.member(pureCircuits.addrKey(ready.args.id, { bytes: recipient })))
        return { ok: true, amount: ready.amount, txId: '' };
      const taken = ledger.nullifiers.member(pureCircuits.nullifierOf(ready.args.id, ready.args.share.secret));
      if (taken && link.kind === 'group' && attempt < tries) continue;
      const again = prepare(ledger, link, recipient, now());
      if (!again.ok) return again;
      throw error;
    }
  }
};

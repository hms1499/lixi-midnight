import { pureCircuits, type Ledger } from '@lixi/contract';
import type { ClaimArgs } from './claim.js';

/** Recipients get a warning when less than this many seconds remain (spec §4.6). */
export const EXPIRY_WARNING_SECONDS = 600;

export type ClaimRejection =
  'no envelope' | 'refunded' | 'expired' | 'invalid link' | 'already claimed' | 'address already claimed';

export type ClaimCheck =
  | { readonly ok: true; readonly amount: bigint; readonly secondsLeft: number; readonly expiringSoon: boolean }
  | { readonly ok: false; readonly reason: ClaimRejection };

type ClaimView = Pick<Ledger, 'envelopes' | 'nullifiers' | 'addrClaims'>;

/**
 * Runs every check `claim` would run, against a ledger snapshot, so the app can refuse a doomed
 * claim before spending time and fees on a proof. `now` is unix seconds.
 */
export const checkClaim = (ledger: ClaimView, args: ClaimArgs, recipient: Uint8Array, now: number): ClaimCheck => {
  const { id, share, path } = args;
  if (!ledger.envelopes.member(id)) return { ok: false, reason: 'no envelope' };
  const env = ledger.envelopes.lookup(id);
  if (env.refunded) return { ok: false, reason: 'refunded' };
  const secondsLeft = Number(env.expiry) - now;
  if (secondsLeft <= 0) return { ok: false, reason: 'expired' };
  if (share.amount <= 0n || pureCircuits.rootFromPath(pureCircuits.leafHash(id, share), path) !== env.root) {
    return { ok: false, reason: 'invalid link' };
  }
  if (ledger.nullifiers.member(pureCircuits.nullifierOf(id, share.secret)))
    return { ok: false, reason: 'already claimed' };
  if (env.onePerAddress && ledger.addrClaims.member(pureCircuits.addrKey(id, { bytes: recipient }))) {
    return { ok: false, reason: 'address already claimed' };
  }
  return { ok: true, amount: share.amount, secondsLeft, expiringSoon: secondsLeft < EXPIRY_WARNING_SECONDS };
};

export type RefundCheck =
  { readonly ok: true } | { readonly ok: false; readonly reason: 'no envelope' | 'refunded' | 'not expired' };

/** The checks `refund` would run, so the dashboard only offers Refund when it can succeed. */
export const checkRefund = (ledger: Pick<Ledger, 'envelopes'>, id: Uint8Array, now: number): RefundCheck => {
  if (!ledger.envelopes.member(id)) return { ok: false, reason: 'no envelope' };
  const env = ledger.envelopes.lookup(id);
  if (env.refunded) return { ok: false, reason: 'refunded' };
  if (now < Number(env.expiry)) return { ok: false, reason: 'not expired' };
  return { ok: true };
};

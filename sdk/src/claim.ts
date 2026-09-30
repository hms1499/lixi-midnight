import { buildTree, pureCircuits, type PathEntry, type Share } from '@lixi/contract';
import { groupShares } from './envelope.js';
import type { ClaimLink } from './link.js';

export type ClaimArgs = { readonly id: Uint8Array; readonly share: Share; readonly path: PathEntry[] };

/**
 * Turns a link into claim arguments. For a group link, picks a random share whose
 * nullifier is not yet on-chain. Throws when nothing is left to claim.
 */
export const resolveClaim = (
  link: ClaimLink,
  isClaimed: (nullifier: bigint) => boolean,
  random: () => number = Math.random,
): ClaimArgs => {
  if (link.kind === 'personal') {
    if (isClaimed(pureCircuits.nullifierOf(link.id, link.share.secret))) throw new Error('already claimed');
    return { id: link.id, share: link.share, path: link.path };
  }
  const shares = groupShares(link.groupSecret, link.count, link.total);
  const open = shares
    .map((share, index) => ({ share, index }))
    .filter(({ share }) => share.amount > 0n && !isClaimed(pureCircuits.nullifierOf(link.id, share.secret)));
  if (open.length === 0) throw new Error('all shares claimed');
  const pick = open[Math.floor(random() * open.length)];
  return { id: link.id, share: pick.share, path: buildTree(link.id, shares).pathFor(pick.index) };
};

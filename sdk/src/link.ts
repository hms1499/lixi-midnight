import { MAX_SHARES, TREE_DEPTH, type PathEntry, type Share } from '@lixi/contract';
import { bigintToBytes, bytesToBigint, fromBase64Url, toBase64Url } from './bytes.js';

export type PersonalLink = { kind: 'personal'; id: Uint8Array; share: Share; path: PathEntry[] };
export type GroupLink = { kind: 'group'; id: Uint8Array; groupSecret: Uint8Array; count: number; total: bigint };
export type ClaimLink = PersonalLink | GroupLink;

const PERSONAL = 'v1.';
const GROUP = 'g1.';
const PERSONAL_LEN = 32 + 32 + 8 + TREE_DEPTH * 33;
const GROUP_LEN = 32 + 32 + 1 + 16;

export const encodeLink = (link: ClaimLink): string => {
  if (link.kind === 'group') {
    const body = new Uint8Array(GROUP_LEN);
    body.set(link.id, 0);
    body.set(link.groupSecret, 32);
    body[64] = link.count;
    body.set(bigintToBytes(link.total, 16), 65);
    return GROUP + toBase64Url(body);
  }
  if (link.path.length !== TREE_DEPTH) throw new Error('bad path length');
  const body = new Uint8Array(PERSONAL_LEN);
  body.set(link.id, 0);
  body.set(link.share.secret, 32);
  body.set(bigintToBytes(link.share.amount, 8), 64);
  link.path.forEach((e, d) => {
    body.set(bigintToBytes(e.sibling, 32), 72 + d * 33);
    body[72 + d * 33 + 32] = e.goesLeft ? 1 : 0;
  });
  return PERSONAL + toBase64Url(body);
};

/** Parses the URL fragment (without '#'). Throws on anything malformed. */
export const decodeLink = (fragment: string): ClaimLink => {
  if (fragment.startsWith(GROUP)) {
    const body = fromBase64Url(fragment.slice(GROUP.length));
    if (body.length !== GROUP_LEN) throw new Error('invalid link');
    const count = body[64];
    if (count < 1 || count > MAX_SHARES) throw new Error('invalid link');
    return {
      kind: 'group',
      id: body.slice(0, 32),
      groupSecret: body.slice(32, 64),
      count,
      total: bytesToBigint(body.slice(65)),
    };
  }
  if (fragment.startsWith(PERSONAL)) {
    const body = fromBase64Url(fragment.slice(PERSONAL.length));
    if (body.length !== PERSONAL_LEN) throw new Error('invalid link');
    const path = Array.from({ length: TREE_DEPTH }, (_, d) => {
      const flag = body[72 + d * 33 + 32];
      if (flag > 1) throw new Error('invalid link');
      return { sibling: bytesToBigint(body.slice(72 + d * 33, 72 + d * 33 + 32)), goesLeft: flag === 1 };
    });
    const amount = bytesToBigint(body.slice(64, 72));
    if (amount === 0n) throw new Error('invalid link');
    return { kind: 'personal', id: body.slice(0, 32), share: { secret: body.slice(32, 64), amount }, path };
  }
  throw new Error('invalid link');
};

export const claimUrl = (origin: string, link: ClaimLink): string => `${origin}/c#${encodeLink(link)}`;

/**
 * Accepts what people actually paste: a full URL, a bare fragment, surrounding whitespace,
 * or trailing punctuation added by chat apps ("…abc)." ). Throws 'invalid link' otherwise.
 */
export const parseClaimInput = (text: string): ClaimLink => {
  const afterHash = text.trim().split('#').pop() ?? '';
  return decodeLink(afterHash.replace(/[^A-Za-z0-9_-]+$/, ''));
};

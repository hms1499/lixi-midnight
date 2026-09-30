import { describe, expect, it } from 'vitest';
import { deriveEnvelope, linksFor } from '../src/envelope.js';
import { claimUrl, decodeLink, encodeLink, parseClaimInput, type PersonalLink } from '../src/link.js';

const seed = crypto.getRandomValues(new Uint8Array(32));

describe('claim links', () => {
  it('round-trips personal links', () => {
    const d = deriveEnvelope(seed, { index: 0, total: 1000n, count: 5, kind: 'personal', split: 'random' });
    const links = linksFor(d);
    expect(links).toHaveLength(5);
    for (const link of links) expect(decodeLink(encodeLink(link))).toEqual(link);
  });

  it('round-trips group links', () => {
    const d = deriveEnvelope(seed, { index: 1, total: 900n, count: 3, kind: 'group', split: 'equal' });
    const [link] = linksFor(d);
    expect(decodeLink(encodeLink(link))).toEqual(link);
    expect(encodeLink(link).length).toBeLessThan(120);
  });

  it('keeps personal links short enough for chat apps', () => {
    const d = deriveEnvelope(seed, { index: 2, total: 10n, count: 1, kind: 'personal', split: 'equal' });
    expect(claimUrl('https://lixi.example', linksFor(d)[0]).length).toBeLessThan(320);
  });

  it('rejects malformed fragments', () => {
    const d = deriveEnvelope(seed, { index: 3, total: 10n, count: 1, kind: 'personal', split: 'equal' });
    const good = encodeLink(linksFor(d)[0]);
    expect(() => decodeLink('')).toThrow(/invalid link/);
    expect(() => decodeLink('x1.' + good.slice(3))).toThrow(/invalid link/);
    expect(() => decodeLink(good.slice(0, -4))).toThrow(/invalid link/);
    expect(() => decodeLink(good + '!')).toThrow(/base64url/);
    const zeroAmount: PersonalLink = { ...(linksFor(d)[0] as PersonalLink) };
    zeroAmount.share = { ...zeroAmount.share, amount: 0n };
    expect(() => decodeLink(encodeLink(zeroAmount))).toThrow(/invalid link/);
  });

  it('accepts pasted URLs with whitespace and trailing punctuation', () => {
    const d = deriveEnvelope(seed, { index: 4, total: 10n, count: 1, kind: 'personal', split: 'equal' });
    const link = linksFor(d)[0];
    const url = claimUrl('https://lixi.example', link);
    expect(parseClaimInput(`  ${url}).\n`)).toEqual(link);
    expect(parseClaimInput(encodeLink(link))).toEqual(link);
    expect(() => parseClaimInput('https://lixi.example/c')).toThrow(/invalid link/);
  });
});

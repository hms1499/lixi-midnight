import type { EnvelopeView } from './status';
import { formatNight } from './units';

/** One piece of news: the lì xì of one envelope opened since the last read. */
export type News = { readonly idHex: string; readonly text: string };

/**
 * What the sender has not heard yet (user moments spec §3.6): for each envelope in both reads, the lì xì
 * opened since `before`. Envelopes new to `after` say nothing, and so does any change that opens nothing
 * (a refund, a landing). The news follows `after`'s order.
 */
export const newlyOpened = (before: readonly EnvelopeView[], after: readonly EnvelopeView[]): News[] => {
  const was = new Map(before.map((v) => [v.idHex, v]));
  const news: News[] = [];
  for (const v of after) {
    const old = was.get(v.idHex);
    if (!old) continue;
    const fresh = v.shares.filter((s, i) => s.opened && !old.shares[i]?.opened);
    if (fresh.length === 0) continue;
    const total = formatNight(fresh.reduce((sum, s) => sum + s.amount, 0n));
    news.push({
      idHex: v.idHex,
      text:
        fresh.length === 1
          ? `A lì xì was just opened: ${total} tNIGHT.`
          : `${fresh.length} lì xì were just opened: ${total} tNIGHT.`,
    });
  }
  return news;
};

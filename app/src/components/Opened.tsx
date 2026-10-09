import type { CSSProperties } from 'react';
import { MAX_SHARES } from '@lixi/contract';
import { useCountUp } from '../lib/countup';
import { formatFixed, formatNight } from '../lib/units';

/**
 * Font size by length, so the amount fits the ~105 px slip less its padding. Fraunces' digits are not
 * tabular, so the widest (all 9s) were measured: ~9.5 px per character at 16 px (final review).
 */
export const sizeFor = (text: string): string =>
  text.length <= 4
    ? 'text-3xl'
    : text.length <= 7
      ? 'text-xl'
      : text.length <= 10
        ? 'text-base'
        : text.length === 11
          ? 'text-sm'
          : 'text-xs';

/**
 * Whether an equal split of the public `total` could have produced `amount`: some count n of up to
 * MAX_SHARES gives each share floor(total / n) or one unit more. Then one opening gives away the count
 * and every other size, so the receipt must not claim them (user moments review). A lucky split that
 * happens to look equal only makes the receipt say less.
 */
export const mayBeEqualSplit = (amount: bigint, total: bigint): boolean => {
  for (let n = 1n; n <= BigInt(MAX_SHARES); n++) {
    const q = total / n;
    if (amount === q || amount === q + 1n) return true;
  }
  return false;
};

/** The amount on the slip that rises out of the envelope, counting up from 0 (user moments spec §3.5). */
export const SlipAmount = ({ amount }: { amount: bigint }) => {
  const final = formatNight(amount);
  const decimals = final.split('.')[1]?.length ?? 0;
  const shown = formatFixed(useCountUp(amount), decimals);
  return (
    <span className="flex h-full flex-col items-center justify-start overflow-hidden px-1 pt-2 text-center">
      <span className={`font-semibold text-lantern-deep ${sizeFor(final)}`}>{shown}</span>
      <span className="text-[10px] tracking-wide text-seal-ink">tNIGHT</span>
    </span>
  );
};

/** Five petals and a dark centre: one hoa mai. */
const Blossom = () => (
  <svg viewBox="-10 -10 20 20" width="16" height="16">
    {[0, 72, 144, 216, 288].map((r) => (
      <ellipse key={r} cx="0" cy="-5" rx="3.2" ry="5" transform={`rotate(${r})`} />
    ))}
    <circle r="2" />
  </svg>
);

/** Twelve apricot blossoms that fall once when a lì xì opens. Decoration, not lights; hidden under reduced motion. */
export const Blossoms = () => (
  <div className="blossoms" aria-hidden="true">
    {Array.from({ length: 12 }, (_, i) => (
      <span
        key={i}
        className="blossom"
        style={{ '--i': i, '--x': `${(i * 37 + 7) % 96}%`, '--drift': `${((i * 53) % 60) - 30}px` } as CSSProperties}
      >
        <Blossom />
      </span>
    ))}
  </div>
);

const Column = ({ title, tone, items }: { title: string; tone: string; items: string[] }) => (
  <div className="space-y-2 bg-night p-4">
    <h2 className={`font-semibold ${tone}`}>{title}</h2>
    <ul className="list-disc space-y-1 pl-4 text-paper-soft">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  </div>
);

/**
 * What the chain saw of this opening, and what it never saw (user moments spec §3.5; README privacy
 * model). The total is public, so an equal split (every group, and any personal envelope whose amount
 * looks equal) gives away the count and the other sizes with its first opening: those rows go.
 */
export const PrivacyReceipt = ({
  amount,
  total,
  kind,
}: {
  amount: bigint;
  total: bigint;
  kind: 'personal' | 'group';
}) => {
  const never =
    kind === 'group'
      ? ['which lì xì in the envelope you got', 'the secret inside your link']
      : [
          'which link you opened',
          'the secret inside your link',
          ...(mayBeEqualSplit(amount, total)
            ? []
            : ['what the unopened lì xì hold', 'how many lì xì this envelope holds']),
        ];
  return (
    <div className="receipt grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 text-left text-sm sm:grid-cols-2">
      <Column
        title="The chain saw"
        tone="text-paper"
        items={[`${formatNight(amount)} tNIGHT paid to your wallet`, 'that this envelope paid out once more']}
      />
      <Column title="It never saw" tone="text-seal" items={never} />
    </div>
  );
};

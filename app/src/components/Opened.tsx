import type { CSSProperties } from 'react';
import { useCountUp } from '../lib/countup';
import { formatFixed, formatNight } from '../lib/units';

/** Font size by length, so up to "12345.123456" fits the ~105 px slip. */
const sizeFor = (text: string) => (text.length <= 4 ? 'text-3xl' : text.length <= 7 ? 'text-xl' : 'text-base');

/** The amount on the slip that rises out of the envelope, counting up from 0 (user moments spec §3.5). */
export const SlipAmount = ({ amount }: { amount: bigint }) => {
  const final = formatNight(amount);
  const decimals = final.split('.')[1]?.length ?? 0;
  const shown = formatFixed(useCountUp(amount), decimals);
  return (
    <span className="flex h-full flex-col items-center justify-start pt-2 text-center">
      <span className={`font-semibold text-lantern-deep ${sizeFor(final)}`}>{shown}</span>
      <span className="text-[10px] tracking-wide text-seal-ink uppercase">tNIGHT</span>
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
 * model). A group splits equally, so its first opening reveals the count and every other amount:
 * its column leaves those out.
 */
export const PrivacyReceipt = ({ amount, kind }: { amount: bigint; kind: 'personal' | 'group' }) => (
  <div className="receipt grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 text-left text-sm sm:grid-cols-2">
    <Column
      title="The chain saw"
      tone="text-paper"
      items={[`${formatNight(amount)} tNIGHT paid to your wallet`, 'that this envelope paid out once more']}
    />
    <Column
      title="It never saw"
      tone="text-seal"
      items={
        kind === 'personal'
          ? [
              'which link you opened',
              'the secret inside your link',
              'what the other lì xì hold',
              'how many lì xì this envelope holds',
            ]
          : ['which lì xì in the envelope you got', 'the secret inside your link']
      }
    />
  </div>
);

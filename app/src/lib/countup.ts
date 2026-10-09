import { useEffect, useState } from 'react';

/** True without matchMedia (tests, old browsers) or with reduced motion: show end states. */
const prefersStill = () => typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts from 0 up to `target` over `ms`, easing out, starting `delay` ms from now, and lands exactly on
 * `target` (user moments spec §3.5). Reduced motion shows `target` at once.
 */
export const useCountUp = (target: bigint, ms = 900, delay = 200): bigint => {
  const [still] = useState(prefersStill);
  const [value, setValue] = useState(() => (still ? target : 0n));
  useEffect(() => {
    if (still) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / ms));
      const eased = 1 - (1 - p) ** 3;
      setValue(p >= 1 ? target : (target * BigInt(Math.round(eased * 1_000_000))) / 1_000_000n);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms, delay, still]);
  return value;
};

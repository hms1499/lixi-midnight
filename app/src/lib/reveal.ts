import { useEffect, type RefObject } from 'react';

/**
 * Marks each `[data-reveal]` element inside `root` with `data-in` the first time 35% of it is on
 * screen; CSS plays that section's moment from there (frontend spec §7). Without IntersectionObserver,
 * or with reduced motion, every section is marked at once and shows its end state.
 */
export const useReveal = (root: RefObject<HTMLElement | null>): void => {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      for (const t of targets) t.dataset.in = '';
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.in = '';
          io.unobserve(e.target);
        }
      },
      { threshold: 0.35 },
    );
    for (const t of targets) io.observe(t);
    return () => io.disconnect();
  }, [root]);
};

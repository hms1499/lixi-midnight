import { useCallback, useEffect, useRef, useState } from 'react';
import { newlyOpened } from '../lib/news';
import type { EnvelopeView } from '../lib/status';
import { Light } from './Light';

export const TOAST_MS = 6_000;
export type Toast = { readonly key: number; readonly text: string };

const Item = ({ toast, onClose }: { toast: Toast; onClose: (key: number) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.key), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast.key, onClose]);
  return (
    <li className="toast pointer-events-auto flex items-center gap-3 rounded-lg border border-white/10 bg-night-deep px-4 py-3 shadow-lg">
      <Light state="out" size="sm" />
      <span className="flex-1 text-sm text-paper">{toast.text}</span>
      <button
        type="button"
        onClick={() => onClose(toast.key)}
        aria-label="Close"
        className="px-1 text-paper-dim hover:text-paper"
      >
        ×
      </button>
    </li>
  );
};

/** Short news at the bottom of the page (user moments spec §3.6). Each goes after 6 s, or on its close button. */
export const Toasts = ({ toasts, onClose }: { toasts: readonly Toast[]; onClose: (key: number) => void }) => (
  <div
    role="status"
    aria-live="polite"
    className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4"
  >
    <ul className="w-full max-w-sm space-y-2">
      {toasts.map((t) => (
        <Item key={t.key} toast={t} onClose={onClose} />
      ))}
    </ul>
  </div>
);

/**
 * News for the sender (user moments spec §3.6): compares each new set of envelope views with the one
 * before and makes a toast per envelope with newly opened lì xì. The first views only set the baseline.
 * At most three toasts show; the oldest goes first.
 */
export const useOpenedNews = (views: readonly EnvelopeView[] | undefined) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<readonly EnvelopeView[] | undefined>(undefined);
  const nextKey = useRef(0);
  const closeToast = useCallback((key: number) => setToasts((t) => t.filter((x) => x.key !== key)), []);
  useEffect(() => {
    if (!views) return;
    if (seen.current) {
      const news = newlyOpened(seen.current, views);
      if (news.length > 0)
        setToasts((t) => [...t, ...news.map((n) => ({ key: nextKey.current++, text: n.text }))].slice(-3));
    }
    seen.current = views;
  }, [views]);
  return { toasts, closeToast };
};

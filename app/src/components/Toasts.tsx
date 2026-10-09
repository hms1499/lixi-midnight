import { useEffect } from 'react';
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

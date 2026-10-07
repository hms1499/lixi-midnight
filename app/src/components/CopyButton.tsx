import { useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';

type Copy = 'idle' | 'copied' | 'failed';

/** Copies `text`; once copied it stays "Copied" for the visit, so a sender can see which links are out. */
export const CopyButton = ({ text, label = 'Copy', name }: { text: string; label?: string; name?: string }) => {
  const [state, setState] = useState<Copy>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      // No Clipboard API (an insecure origin, an old browser) or permission denied: say so, never fail silently.
      setState('failed');
    }
  };
  const shown = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed: select it and copy' : label;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={name ? `${shown}: ${name}` : undefined}
      className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
        state === 'copied'
          ? 'border-seal/60 text-seal'
          : state === 'failed'
            ? 'border-error/60 text-error'
            : 'border-white/15 text-paper hover:border-lantern'
      }`}
    >
      {state === 'copied' ? <CheckIcon /> : <CopyIcon />}
      {shown}
    </button>
  );
};

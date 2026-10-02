import { useState } from 'react';
import { CheckIcon, CopyIcon } from './icons';

/** Copies `text`; once copied it stays "Copied" for the visit, so a sender can see which links are out. */
export const CopyButton = ({ text, label = 'Copy', name }: { text: string; label?: string; name?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={name ? `${copied ? 'Copied' : label}: ${name}` : undefined}
      className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
        copied ? 'border-seal/60 text-seal' : 'border-white/15 text-paper hover:border-lantern'
      }`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied' : label}
    </button>
  );
};

import { useState } from 'react';
import { backupString, type SenderVault } from '@lixi/sdk';
import { CopyButton } from './CopyButton';
import { Button, Notice } from './ui';

/** The vault's backup string, presented like a private key (Plan 1 carry-over). */
export const BackupString = ({ vault }: { vault: SenderVault }) => {
  const text = backupString(vault);
  return (
    <div className="space-y-3">
      <Notice tone="warn">
        Treat this like a private key. Anyone who has it can open every lì xì you have not handed out yet. Keep it where
        only you can read it, never in a chat.
      </Notice>
      <div className="flex items-center gap-2">
        <input
          readOnly
          aria-label="Backup string"
          value={text}
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <CopyButton text={text} />
      </div>
    </div>
  );
};

/** The first Seal asks for the backup string before anything is sealed (UX polish spec §3.6). */
export const BackupStep = ({
  vault,
  count,
  onSaved,
  onBack,
}: {
  vault: SenderVault;
  count?: number;
  onSaved: () => void;
  onBack: () => void;
}) => {
  const [saved, setSaved] = useState(false);
  return (
    <div className="w-full space-y-4 rounded-lg border border-white/10 p-5">
      <h2 className="text-2xl">Keep your backup string</h2>
      <p className="text-paper-soft">
        Your envelopes are rebuilt from this one string. If this browser loses its data, it is the only way to see them
        again and bring home what nobody opened.
      </p>
      <BackupString vault={vault} />
      <label className="flex gap-2">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I saved my backup string
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={!saved} onClick={onSaved}>
          Saved, seal {count ?? ''} lì xì
        </Button>
        <Button tone="quiet" type="button" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
};

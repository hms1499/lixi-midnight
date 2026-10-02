import { useState } from 'react';
import { backupString, type SenderVault } from '@lixi/sdk';
import { CopyButton } from './CopyButton';
import { Button, Greeting, Notice } from './ui';

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

/** First visit to Create: the user must keep the backup string before sealing anything (spec §6.2). */
export const BackupGate = ({ vault, onDone }: { vault: SenderVault; onDone: () => void }) => {
  const [saved, setSaved] = useState(false);
  return (
    <div className="max-w-2xl space-y-5">
      <Greeting>Before you seal one</Greeting>
      <h1 className="text-4xl">Keep your backup string</h1>
      <p className="text-paper-soft">
        Your envelopes are rebuilt from this one string. If this browser loses its data, it is the only way to see them
        again and bring home what nobody opened.
      </p>
      <BackupString vault={vault} />
      <label className="flex gap-2">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I saved my backup string
      </label>
      <Button type="button" disabled={!saved} onClick={onDone}>
        Continue
      </Button>
    </div>
  );
};

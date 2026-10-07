/** Places outside the app, shown as icon links (frontend spec §5.4). */
export const LINKS = {
  github: { label: 'Source on GitHub', href: 'https://github.com/hms1499/lixi-midnight' },
  contract: {
    label: 'Contract on Preprod',
    href: 'https://github.com/hms1499/lixi-midnight/blob/main/deployments/preprod.json',
  },
  midnight: { label: 'Midnight Network', href: 'https://midnight.network' },
  wallet: { label: '1AM wallet', href: 'https://1am.xyz' },
  faucet: { label: 'Preprod faucet', href: 'https://midnight-tmnight-preprod.nethermind.dev/' },
  notes: {
    label: 'Design and audit notes',
    href: 'https://github.com/hms1499/lixi-midnight/blob/main/docs/superpowers/specs/2026-09-30-lixi-design.md',
  },
} as const;

export type LinkKey = keyof typeof LINKS;

/** The Preprod explorer. It is not in LINKS, because every entry there is a footer icon. */
export const EXPLORER = 'https://preprod.midnightexplorer.com';

/** A transaction on the explorer, which looks transactions up by hash (UX polish spec §3.9). */
export const txUrl = (hash: string): string => `${EXPLORER}/transactions/0x${hash.replace(/^0x/, '')}`;

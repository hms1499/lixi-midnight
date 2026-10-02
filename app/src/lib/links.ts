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

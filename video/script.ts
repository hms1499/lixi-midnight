// The storyboard (demo video spec §3). Every other file reads the scenes from here.
export type Scene = {
  id: string;
  title: string;
  kind: 'card' | 'capture' | 'live';
  narration: string;
  /** Scene 5 only: said instead when the live recording is not available. */
  fallbackNarration?: string;
  /** A corner label for the whole scene. */
  label?: string;
};

/** The macOS voice, chosen by the user (2026-10-09). */
export const VOICE = 'Samantha';
export const SIM_LABEL = 'Local simulator running the compiled contract (no proofs)';
export const LIVE_LABEL = 'Live on Preprod · 1AM';

export const SCENES: Scene[] = [
  {
    id: 's1',
    title: 'Hook',
    kind: 'card',
    narration:
      'In Vietnam, at Tết, you give lì xì: lucky money in a red envelope. Only the person who opens it sees what is inside. This is Lixi, private red envelopes on Midnight. You seal tNIGHT into an envelope and share it as links, one lì xì per link.',
  },
  {
    id: 's2',
    title: 'Problem',
    kind: 'card',
    narration:
      'Red packets already exist on EVM, Solana and BSC, but they are fully public. The split and every claim code sit on chain, so anyone can see who gets what. Lixi keeps the part of lì xì that matters: the link stays secret.',
  },
  {
    id: 's3',
    title: 'Seal',
    kind: 'capture',
    label: SIM_LABEL,
    narration:
      "Let's fill one. Ten tNIGHT, four lì xì, lucky amounts, expiring in a day. The split is drawn in the browser and stays there. On chain, the contract keeps only a Merkle root of the lì xì, the deposit, the expiry and the refund address. Sealing is one transaction. Each lì xì is then a link, and its secret lives only in the URL fragment, which browsers never send to a server. Copy a link with a greeting and send it in any chat.",
  },
  {
    id: 's4',
    title: 'Open',
    kind: 'capture',
    label: SIM_LABEL,
    narration:
      'A recipient opens the link and sees what is inside before connecting a wallet. They connect and open it, and a zero-knowledge proof shows they hold a valid lì xì in this envelope, without saying which one. A one-time nullifier stops the link paying twice, and the tNIGHT lands in their wallet. The receipt says what stayed private for this envelope. Opening the same link again is refused. A group link is one link for everyone, and each wallet can open one lì xì.',
  },
  {
    id: 's5',
    title: 'Live on Preprod',
    kind: 'live',
    label: LIVE_LABEL,
    narration:
      'That was a local simulator running the compiled contract. Here is the same opening live on Preprod, with the 1AM wallet, which pays the fee. The proof takes a while, so we have sped it up. And here is the transaction on the Midnight explorer.',
    fallbackNarration:
      'That was a local simulator running the compiled contract. Here is a real opening on Preprod, made with the 1AM wallet, which pays the fee: the transaction on the Midnight explorer.',
  },
  {
    id: 's6',
    title: 'Dashboard',
    kind: 'capture',
    label: SIM_LABEL,
    narration:
      'The sender gets a dashboard. A lit lantern is still waiting; one that has gone out was opened. After the expiry, the sender brings everything unopened home in one transaction, to the address that sealed it. A backup string re-derives every envelope.',
  },
  {
    id: 's7',
    title: 'How it works',
    kind: 'card',
    narration:
      "Under the hood is one Compact contract with three circuits: createEnvelope, claim and refund. The claim circuit takes the share and its Merkle path as private witnesses. It checks the path against the envelope's root, records a one-time nullifier, and pays the share out as unshielded tNIGHT. So the payout is public, while which link paid it stays private. The chain sees that an envelope exists, its total, and each payout. With lucky amounts, it never learns how many lì xì a personal envelope holds, or what the unopened ones contain.",
  },
  {
    id: 's8',
    title: 'Engineering',
    kind: 'card',
    narration:
      'The repo has four packages: the Compact contract, an SDK, a CLI for deploys and smoke tests, and the React app. {N} tests run on every push against the real compiled contract, plus a devnet end-to-end suite with concurrent claims. The page ships a strict content security policy, and the contract gave up its maintenance authority at deploy, so nobody can change it.',
  },
  {
    id: 's9',
    title: 'Market, limits, roadmap',
    kind: 'card',
    narration:
      'Vietnamese families give lì xì every Tết, at weddings and birthdays, and across the diaspora. Today Lixi runs on Preprod, in desktop Chrome with 1AM, and payouts are public. Wave 3 brings the 1AM mobile app, a fee sponsor so any wallet can open a lì xì, shielded payouts, and QR codes for giving in person.',
  },
  {
    id: 's10',
    title: 'Outro',
    kind: 'card',
    narration: 'Lixi. Private red envelopes on Midnight. Try it at lixi-3nv.pages.dev.',
  },
];

/** The words said in a scene: the test count filled in, and scene 5's fallback when there is no live recording. */
export const narrationFor = (scene: Scene, testCount: number, live: boolean): string =>
  (!live && scene.fallbackNarration ? scene.fallbackNarration : scene.narration).replace('{N}', String(testCount));

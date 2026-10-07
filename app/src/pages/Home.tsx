import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { BookIcon, ContractIcon, GitHubIcon } from '../components/icons';
import { Light, type LightState } from '../components/Light';
import { ButtonLink, Greeting, IconLink } from '../components/ui';
import { LINKS } from '../lib/links';
import { useReveal } from '../lib/reveal';

/** Decorative hero lights: [left %, top px, state, size, scale]. */
const HERO_LIGHTS: Array<[number, number, LightState, 'sm' | 'md', number]> = [
  [14, 44, 'lit', 'md', 1],
  [29, 84, 'out', 'md', 1],
  [47, 30, 'lit', 'md', 1.45],
  [66, 86, 'lit', 'md', 1],
  [82, 48, 'out', 'md', 1],
  [39, 112, 'lit', 'sm', 1],
  [58, 126, 'out', 'sm', 1],
];

const JOURNEY = [
  ['Sealed', 'You fill the envelope. The chain keeps a fingerprint of the split, never the split.'],
  ['Handed out', 'Each link carries one lì xì’s secret, in the part of the URL no server ever sees.'],
  ['Opened', 'A proof says “I hold a valid lì xì” without saying which. What nobody opens comes back to you.'],
] as const;

const SEEN = [
  'that an envelope exists, its total and its expiry',
  'whether it uses a group link',
  'your address, as the sender',
  'each opening: who received, and how much',
];
const DARK = [
  'how many lì xì, and the size of each',
  'who the links went to',
  'the secrets inside the links',
  'which lì xì are still unopened',
];

const FLOW = [
  ['The link', 'Secret and Merkle path, in the URL fragment.'],
  ['The proof', 'Made in your wallet or on your machine. It binds the payout to your address.'],
  ['The contract', 'Checks the root, spends a one-time nullifier, never sees the secret.'],
  ['Your wallet', 'Receives the tNIGHT. The same link cannot pay twice.'],
] as const;

const FACTS = [
  ['~30 s', 'from “Open” to tNIGHT in your wallet, proof included'],
  ['Up to 16', 'lì xì per envelope, split equally or at random'],
  ['No admin key', 'the contract’s maintenance key was given up at deploy, so nobody can change it'],
] as const;

const MOMENTS = [
  ['Tết', 'lucky amounts'],
  ['Weddings', 'one link each'],
  ['Birthdays', ''],
  ['Team bonuses', 'equal amounts'],
  ['Community giveaways', 'group link, one per wallet'],
] as const;

const FAQ = [
  [
    'Do I need a wallet to open a lì xì?',
    'Yes: the 1AM wallet, set to Preprod. 1AM pays the fee, so you need no tNIGHT or DUST. You can see what is inside before you connect.',
  ],
  [
    'What if a link leaks?',
    'Whoever opens it first gets that lì xì, like cash. Send each link to one person, privately.',
  ],
  [
    'Can the sender take a lì xì back early?',
    'No. Before expiry, money only leaves through valid links. After expiry, what nobody opened goes back to the sender’s address, and nowhere else.',
  ],
  [
    'What happens to lì xì nobody opens?',
    'After the expiry the sender chose, the sender can bring them home in one transaction. Until then they wait for their links.',
  ],
  ['Is this real money?', 'No. Lixi runs on the Preprod test network; tNIGHT has no value.'],
] as const;

const Section = ({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) => (
  <section id={id} data-reveal className="border-t border-white/10">
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-14 lg:py-14">
      <div className="reveal-head mb-6">
        <h2 className="text-3xl">{title}</h2>
        {lede && <p className="mt-1.5 max-w-xl text-paper-soft">{lede}</p>}
      </div>
      {children}
    </div>
  </section>
);

const i = (n: number) => ({ '--i': n }) as CSSProperties;

export const Home = () => {
  const root = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  useReveal(root);
  // Header links from any page land on their section (`/#faq`).
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div ref={root}>
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_130%,var(--color-ember)_0%,var(--color-night)_62%)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40">
          {HERO_LIGHTS.map(([left, top, state, size, scale], n) => (
            <Light
              key={n}
              state={state}
              size={size}
              className="absolute"
              style={{ left: `${left}%`, top, transform: `scale(${scale})` }}
            />
          ))}
        </div>
        <div className="relative mx-auto max-w-3xl px-4 pt-44 pb-16 text-center">
          <Greeting>Chúc mừng năm mới</Greeting>
          <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">
            Every light is one lì xì.
            <br />
            Only its link knows whose.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-paper-soft">
            Put tNIGHT in a red envelope, split it into lì xì and send each person a link. They open it with a
            zero-knowledge proof; the link’s secret never touches the chain.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/create">Fill an envelope</ButtonLink>
            <ButtonLink to="/c" tone="quiet">
              Open a link
            </ButtonLink>
          </div>
        </div>
      </section>

      <Section id="how" title="How it works" lede="One lì xì, from your wallet to theirs.">
        <ol className="journey relative grid gap-8 sm:grid-cols-3 sm:gap-0">
          <span className="wire absolute top-4 right-[16%] left-[16%] hidden h-px bg-lantern/50 sm:block" />
          {JOURNEY.map(([title, text], n) => (
            <li key={title} className="relative px-4 text-center">
              <Light state="out" className={n === JOURNEY.length - 1 ? 'last' : ''} style={i(n)} />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-paper-soft">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="privacy" title="Privacy, plainly" lede="What a red envelope on Midnight shows, and what it keeps.">
        <div className="grid overflow-hidden rounded-lg border border-white/10 sm:grid-cols-2">
          <div className="p-5">
            <h3 className="mb-2 font-semibold">What the chain sees</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-paper-soft">
              {SEEN.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="veil relative border-t border-white/10 p-5 sm:border-t-0 sm:border-l">
            <h3 className="relative z-10 mb-2 font-semibold text-seal">What stays in the dark</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-paper-soft">
              {DARK.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-sm text-paper-dim">
          Payouts are unshielded tNIGHT, so each opening is public. A link works like cash: whoever opens it first gets
          the lì xì.
        </p>
      </Section>

      <Section
        id="midnight"
        title="Built on Midnight"
        lede="A Compact contract holds every envelope. Your browser and wallet do the private work."
      >
        <div className="relative">
          <span className="absolute inset-x-0 top-0 h-0.5 bg-white/10" />
          <span className="fuse absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-lantern via-lantern to-seal" />
          <ol className="grid gap-6 pt-4 sm:grid-cols-4 sm:gap-0">
            {FLOW.map(([title, text]) => (
              <li key={title} className="text-sm text-paper-soft sm:px-4">
                <span className="mb-1 block font-semibold text-paper">{title}</span>
                {text}
              </li>
            ))}
          </ol>
        </div>
        <dl className="mt-8 grid gap-6 sm:grid-cols-3">
          {FACTS.map(([value, text]) => (
            <div key={value}>
              <dt className="text-2xl">{value}</dt>
              <dd className="mt-1 text-sm text-paper-soft">{text}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex gap-2.5">
          <IconLink {...LINKS.github}>
            <GitHubIcon />
          </IconLink>
          <IconLink {...LINKS.contract}>
            <ContractIcon />
          </IconLink>
          <IconLink {...LINKS.notes}>
            <BookIcon />
          </IconLink>
        </div>
      </Section>

      <Section
        id="moments"
        title="For every red-envelope moment"
        lede="Personal links for family, one group link for a crowd."
      >
        <ul className="flex flex-wrap gap-2.5">
          {MOMENTS.map(([name, hint], n) => (
            <li key={name} className="chip rounded-full border border-white/10 px-3.5 py-2 text-sm" style={i(n)}>
              {name}
              {hint && <span className="ml-1.5 text-xs text-paper-dim">{hint}</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="faq" title="Questions">
        <div className="max-w-3xl">
          {FAQ.map(([q, a], n) => (
            <details key={q} open={n === 0} className="border-t border-white/10 py-4">
              <summary className="flex cursor-pointer justify-between gap-4">
                {q}
                <span className="plus text-paper-dim" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm text-paper-soft">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section
        data-reveal
        className="border-t border-white/10 bg-[radial-gradient(ellipse_at_50%_100%,var(--color-ember)_0%,var(--color-night)_70%)] px-4 py-16 text-center"
      >
        <Light state="out" className="cta-light" />
        <h2 className="reveal-head mt-3 mb-5 text-3xl">Fill your first envelope</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink to="/create">Fill an envelope</ButtonLink>
          <ButtonLink to="/c" tone="quiet">
            Open a link
          </ButtonLink>
        </div>
      </section>
    </div>
  );
};

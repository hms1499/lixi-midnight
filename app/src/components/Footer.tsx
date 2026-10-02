import { Link } from 'react-router';
import { LINKS } from '../lib/links';
import { BookIcon, ContractIcon, DropletIcon, GitHubIcon, MoonIcon, WalletIcon } from './icons';
import { Light } from './Light';
import { IconLink } from './ui';

/** Shared site footer (frontend spec §5.3): words for in-app actions, icons for places elsewhere. */
export const Footer = () => (
  <footer className="border-t border-white/10 bg-night-deep">
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:grid-cols-[1.3fr_1fr_1.2fr] sm:px-6 lg:px-14">
      <div className="space-y-3">
        <Link to="/" className="flex items-center gap-2.5 text-xl font-bold">
          <Light state="lit" size="sm" />
          Lixi
        </Link>
        <p className="max-w-64 text-sm text-paper-dim">
          Private red envelopes on Midnight. Built for the Midnight Buildathon.
        </p>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold">Use Lixi</h2>
        <ul className="space-y-2 text-sm text-paper-soft">
          <li>
            <Link to="/create" className="hover:text-paper">
              Fill an envelope
            </Link>
          </li>
          <li>
            <Link to="/c" className="hover:text-paper">
              Open a link
            </Link>
          </li>
          <li>
            <Link to="/dashboard" className="hover:text-paper">
              My envelopes
            </Link>
          </li>
        </ul>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-semibold">Find us</h2>
        <div className="flex flex-wrap gap-2.5">
          <IconLink {...LINKS.github}>
            <GitHubIcon />
          </IconLink>
          <IconLink {...LINKS.contract}>
            <ContractIcon />
          </IconLink>
          <IconLink {...LINKS.midnight}>
            <MoonIcon />
          </IconLink>
          <IconLink {...LINKS.wallet}>
            <WalletIcon />
          </IconLink>
          <IconLink {...LINKS.faucet}>
            <DropletIcon />
          </IconLink>
          <IconLink {...LINKS.notes}>
            <BookIcon />
          </IconLink>
        </div>
      </div>
    </div>
    <div className="border-t border-white/5">
      <div className="mx-auto flex max-w-6xl justify-between gap-4 px-4 py-4 text-xs text-paper-dim sm:px-6 lg:px-14">
        <span>Testnet only. tNIGHT has no value.</span>
        <span>Apache-2.0</span>
      </div>
    </div>
  </footer>
);

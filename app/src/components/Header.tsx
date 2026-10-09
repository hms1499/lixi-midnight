import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { formatBalanceDust, formatBalanceNight } from '../lib/units';
import { useWallet } from '../wallet/WalletContext';
import { usePagePanelShown } from '../wallet/WalletPanelPresence';
import { MenuIcon } from './icons';
import { Light } from './Light';
import { Button } from './ui';
import { WalletPanel } from './WalletPanel';

export const SECTIONS = [
  ['how', 'How it works'],
  ['privacy', 'Privacy'],
  ['midnight', 'Built on Midnight'],
  ['faq', 'FAQ'],
] as const;

/** On the home page, the id of the section in view (scroll spy). */
const useActiveSection = (onHome: boolean): string | undefined => {
  const [active, setActive] = useState<string>();
  useEffect(() => {
    setActive(undefined);
    if (!onHome || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-40% 0px -55% 0px' },
    );
    for (const [id] of SECTIONS) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [onHome]);
  return active;
};

const WalletControl = () => {
  const { state, disconnect } = useWallet();
  const pagePanel = usePagePanelShown();
  const { pathname } = useLocation();
  // Create and claim pages are built around their own wallet panel, so the header hides its button there from
  // the first render, before that panel mounts; elsewhere a mounted page panel hides it (§3.8).
  const hidden = pathname === '/create' || pathname === '/c' || pagePanel;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state.status === 'connected') setOpen(false);
  }, [state.status]);
  // A hidden dropdown does not come back open on the next page.
  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);
  if (state.status === 'connected') {
    const { name, address: a, balances } = state.wallet;
    return (
      <span className="flex items-center gap-2 text-sm">
        {/* Once the balances are known they take the address's place (its tooltip keeps it), on one line;
            a phone drops the wallet's name too and uses smaller type, so the menu button stays on screen. */}
        <span
          title={`${name}: ${a}${balances ? ` (fees paid by ${name})` : ''}`}
          className={
            balances
              ? 'flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 px-2.5 py-1.5 text-xs sm:px-3 sm:text-sm'
              : 'rounded-full border border-white/15 px-3 py-1.5'
          }
        >
          {balances ? (
            <span className="hidden sm:inline">{name}</span>
          ) : (
            <>
              {name}: {a.slice(0, 12)}…{a.slice(-4)}
            </>
          )}
          {balances && (
            <>
              <span aria-hidden="true" className="hidden text-paper-dim sm:inline">
                ·
              </span>
              {/* Below xl the header has no room for DUST; 1AM pays the fees anyway. One of the two shows. */}
              <span className="hidden xl:inline">{`${formatBalanceNight(balances.night)} tNIGHT · ${formatBalanceDust(balances.dust)} DUST`}</span>
              <span className="xl:hidden">{`${formatBalanceNight(balances.night)} tNIGHT`}</span>
            </>
          )}
        </span>
        <button
          type="button"
          className="whitespace-nowrap text-paper-soft underline-offset-4 hover:underline"
          onClick={disconnect}
        >
          Disconnect
        </button>
      </span>
    );
  }
  // The page shows its own wallet panel; a second Connect button would only compete with it (§3.8).
  if (hidden) return null;
  return (
    <span className="relative">
      <Button tone="quiet" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Connect wallet
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-white/10 bg-night p-5 shadow-2xl">
          <WalletPanel purpose="to use Lixi" inHeader />
        </div>
      )}
    </span>
  );
};

/** Sticky site header shared by every page (frontend spec §5.2). */
export const Header = () => {
  const { pathname } = useLocation();
  const active = useActiveSection(pathname === '/');
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (menu) panel.current?.querySelector<HTMLElement>('a')?.focus();
  }, [menu]);

  // The open menu keeps Tab inside it and closes on Escape.
  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setMenu(false);
      menuButton.current?.focus();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>('a'));
    const [first, last] = [items[0], items.at(-1)];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  const links = (
    <>
      {SECTIONS.map(([id, label]) => (
        <Link
          key={id}
          to={{ pathname: '/', hash: `#${id}` }}
          className={`border-b py-1 transition-colors ${active === id ? 'border-lantern text-paper' : 'border-transparent text-paper-soft hover:text-paper'}`}
        >
          {label}
        </Link>
      ))}
    </>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-night/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6 lg:px-14">
        <Link to="/" className="flex items-center gap-2.5 text-xl font-bold">
          <Light state="lit" size="sm" />
          Lixi
        </Link>
        <nav aria-label="Sections" className="hidden gap-5 text-sm whitespace-nowrap lg:flex">
          {links}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden rounded-full border border-seal/40 px-2.5 py-1 text-xs whitespace-nowrap text-seal sm:inline">
            Preprod testnet
          </span>
          <Link to="/dashboard" className="hidden whitespace-nowrap hover:text-paper lg:inline">
            My envelopes
          </Link>
          <WalletControl />
          <button
            ref={menuButton}
            type="button"
            className="icon-link lg:hidden"
            aria-label="Menu"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <MenuIcon />
          </button>
        </div>
      </div>
      {menu && (
        <div ref={panel} onKeyDown={onMenuKey} className="border-t border-white/10 px-4 py-4 lg:hidden">
          <nav aria-label="Menu" className="flex flex-col gap-3 text-base">
            {links}
            <Link to="/dashboard" className="py-1">
              My envelopes
            </Link>
          </nav>
          <p className="mt-3 text-xs text-seal sm:hidden">Preprod testnet</p>
        </div>
      )}
    </header>
  );
};

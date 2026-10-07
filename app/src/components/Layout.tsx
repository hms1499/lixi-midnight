import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { WalletPanelPresenceProvider } from '../wallet/WalletPanelPresence';
import { Footer } from './Footer';
import { Header } from './Header';

export const Layout = () => (
  <WalletPanelPresenceProvider>
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  </WalletPanelPresenceProvider>
);

/** The width and gutters app pages use; Home lays out its own full-width sections. */
export const Page = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-14">{children}</div>
);

import './polyfills';
import '@fontsource-variable/fraunces/opsz.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { App, preloadPages } from './App';
import type { LixiReader } from './chain/port';
import { appConfig } from './config';
import { isMobile } from './lib/device';
import { loadOnce } from './lib/lazy-once';
import { nowSeconds } from './lib/time';
import { ServicesProvider, type Services } from './services';
import { detectWallets } from './wallet/connector';
import { WalletProvider } from './wallet/WalletContext';

const config = appConfig(import.meta.env);
setNetworkId(config.network); // before any provider is created

// The chain module pulls in ~4.8 MB of WASM. Load it on first use, so pages paint before it arrives (user moments
// spec §3.1). A failed load is forgotten, so the next read or connect tries again.
const loadChain = loadOnce(() => import('./chain/midnight'));
const loadReader = loadOnce(async (): Promise<LixiReader> => (await loadChain()).publicReader(config));

const services: Services = {
  config,
  reader: { readLedger: async () => (await loadReader()).readLedger() },
  storage: window.localStorage,
  now: nowSeconds,
  origin: window.location.origin,
  detectWallets: () => detectWallets(window.midnight),
  isMobile: () => isMobile(navigator),
  reload: () => window.location.reload(),
  openChain: async (api, prover) => (await loadChain()).walletChain(api, config, prover),
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <WalletProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </WalletProvider>
    </ServicesProvider>
  </StrictMode>,
);

// Once the page has painted, fetch the rest while the browser is idle, so a later click rarely waits.
const whenIdle = (run: () => void) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(run) : setTimeout(run, 1000);
whenIdle(() => {
  loadChain().catch(() => undefined); // a later read or connect retries and reports it
  preloadPages();
});

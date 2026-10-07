import './polyfills';
import '@fontsource-variable/fraunces/opsz.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { App } from './App';
import { walletChain, publicReader } from './chain/midnight';
import { appConfig } from './config';
import { isMobile } from './lib/device';
import { nowSeconds } from './lib/time';
import { ServicesProvider, type Services } from './services';
import { detectWallets } from './wallet/connector';
import { WalletProvider } from './wallet/WalletContext';

const config = appConfig(import.meta.env);
setNetworkId(config.network); // before any provider is created

const services: Services = {
  config,
  reader: publicReader(config),
  storage: window.localStorage,
  now: nowSeconds,
  origin: window.location.origin,
  detectWallets: () => detectWallets(window.midnight),
  isMobile: () => isMobile(navigator),
  reload: () => window.location.reload(),
  openChain: (api, prover) => walletChain(api, config, prover),
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

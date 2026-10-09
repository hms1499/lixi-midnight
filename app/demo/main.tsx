import '../src/polyfills';
import '@fontsource-variable/fraunces/opsz.css';
import '../src/index.css';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { App } from '../src/App';
import { ServicesProvider } from '../src/services';
import { WalletProvider, useWallet } from '../src/wallet/WalletContext';
import { createDemo, demoLinks, sealGroup } from './demo';

type DemoControls = {
  go(path: string): void;
  disconnect(): void;
  advance(seconds: number): void;
  links(envelope: number): string[];
  sealGroup(): Promise<string>;
};

declare global {
  interface Window {
    demo?: DemoControls;
  }
}

setNetworkId('undeployed');
window.localStorage.clear(); // every recording starts from an empty vault
const demo = createDemo({
  stageMs: 1200,
  storage: window.localStorage,
  origin: window.location.origin,
  startSeconds: Math.floor(Date.now() / 1000),
});

/** Remounts the app on every `go`, so a claim page always starts fresh; the wallet stays connected. */
const Driven = () => {
  const navigate = useNavigate();
  const { disconnect } = useWallet();
  const [mount, setMount] = useState(0);
  useEffect(() => {
    window.demo = {
      go: (path) => {
        navigate(path);
        setMount((n) => n + 1);
      },
      disconnect,
      advance: demo.advance,
      links: (envelope) => demoLinks(demo, envelope),
      sealGroup: () => sealGroup(demo),
    };
  }, [navigate, disconnect]);
  return <App key={mount} />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={demo.services}>
      <WalletProvider>
        <BrowserRouter>
          <Driven />
        </BrowserRouter>
      </WalletProvider>
    </ServicesProvider>
  </StrictMode>,
);

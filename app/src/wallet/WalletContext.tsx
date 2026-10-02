import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { userAddressBytes } from '@lixi/sdk';
import type { LixiChain, ProverChoice } from '../chain/port';
import { useServices } from '../services';
import { connectWallet } from './connector';
import { friendlyError } from './errors';

export type ConnectedWallet = {
  readonly name: string;
  /** Bech32m unshielded address, for display. */
  readonly address: string;
  /** The same address as contract `UserAddress` bytes: where claims pay and refunds go. */
  readonly recipient: Uint8Array;
  readonly chain: LixiChain;
};

export type WalletState =
  | { readonly status: 'idle' }
  | { readonly status: 'connecting'; readonly name: string }
  | { readonly status: 'connected'; readonly wallet: ConnectedWallet }
  | { readonly status: 'failed'; readonly message: string };

type WalletContextValue = {
  readonly state: WalletState;
  connect(wallet: InitialAPI, prover: ProverChoice): Promise<void>;
  disconnect(): void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const services = useServices();
  const [state, setState] = useState<WalletState>({ status: 'idle' });

  const connect = useCallback(
    async (initial: InitialAPI, prover: ProverChoice) => {
      setState({ status: 'connecting', name: initial.name });
      try {
        const api = await connectWallet(initial, services.config.network);
        const { unshieldedAddress } = await api.getUnshieldedAddress();
        let recipient: Uint8Array;
        try {
          recipient = userAddressBytes(unshieldedAddress, services.config.network);
        } catch {
          throw new Error('wrong network');
        }
        const chain = await services.openChain(api, prover);
        setState({ status: 'connected', wallet: { name: initial.name, address: unshieldedAddress, recipient, chain } });
      } catch (error) {
        setState({ status: 'failed', message: friendlyError(error) });
      }
    },
    [services],
  );

  const value = useMemo(() => ({ state, connect, disconnect: () => setState({ status: 'idle' }) }), [state, connect]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = (): WalletContextValue => {
  const value = useContext(WalletContext);
  if (!value) throw new Error('WalletProvider missing');
  return value;
};

/** Injected wallets. Extensions can inject a moment after page load, so look again for a few seconds. */
export const useDetectedWallets = (): InitialAPI[] => {
  const { detectWallets } = useServices();
  const [wallets, setWallets] = useState(detectWallets);
  useEffect(() => {
    if (wallets.length > 0) return;
    let tries = 0;
    const timer = setInterval(() => {
      const found = detectWallets();
      if (found.length > 0 || ++tries >= 6) clearInterval(timer);
      if (found.length > 0) setWallets(found);
    }, 500);
    return () => clearInterval(timer);
  }, [detectWallets, wallets.length]);
  return wallets;
};

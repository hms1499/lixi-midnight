import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { LixiChain, ProverChoice } from '../chain/port';
import { useServices } from '../services';
import { readBalances, type Balances } from './balances';
import { connectWallet } from './connector';
import { friendlyError } from './errors';

export type ConnectedWallet = {
  readonly name: string;
  /** Bech32m unshielded address, for display. */
  readonly address: string;
  /** The same address as contract `UserAddress` bytes: where claims pay and refunds go. */
  readonly recipient: Uint8Array;
  readonly chain: LixiChain;
  /** The wallet's last known tNIGHT and DUST; absent until read, or when the wallet cannot say. */
  readonly balances?: Balances;
  /** Where this connection makes proofs, chosen when connecting (shown in transaction progress). */
  readonly prover: ProverChoice;
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

/** Reads the balances again after every transaction, whether it landed or failed. */
const rereadingAfter = (chain: LixiChain, reread: () => void): LixiChain => ({
  readLedger: () => chain.readLedger(),
  create: (privateState, args, onStage) => chain.create(privateState, args, onStage).finally(reread),
  claim: (args, onStage) => chain.claim(args, onStage).finally(reread),
  refund: (privateState, id, onStage) => chain.refund(privateState, id, onStage).finally(reread),
});

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const services = useServices();
  const [state, setState] = useState<WalletState>({ status: 'idle' });
  const api = useRef<ConnectedAPI | undefined>(undefined);

  /** Reads the connected wallet's balances; a wallet that disconnected meanwhile is left alone. */
  const refreshBalances = useCallback(async () => {
    const asked = api.current;
    if (!asked) return;
    const balances = await readBalances(asked);
    if (api.current !== asked) return;
    setState((s) => (s.status === 'connected' ? { status: 'connected', wallet: { ...s.wallet, balances } } : s));
  }, []);

  const connect = useCallback(
    async (initial: InitialAPI, prover: ProverChoice) => {
      api.current = undefined;
      setState({ status: 'connecting', name: initial.name });
      try {
        const connected = await connectWallet(initial, services.config.network);
        const { unshieldedAddress } = await connected.getUnshieldedAddress();
        // The SDK pulls in the ledger WASM; load it only once a wallet connects, so the shell paints first (user moments spec §3.1).
        const { userAddressBytes } = await import('@lixi/sdk');
        let recipient: Uint8Array;
        try {
          recipient = userAddressBytes(unshieldedAddress, services.config.network);
        } catch {
          throw new Error('wrong network');
        }
        const opened = await services.openChain(connected, prover);
        const chain = rereadingAfter(opened, () => void refreshBalances());
        api.current = connected;
        setState({
          status: 'connected',
          wallet: { name: initial.name, address: unshieldedAddress, recipient, chain, prover },
        });
        void refreshBalances(); // a hint: connecting does not wait for it
      } catch (error) {
        setState({ status: 'failed', message: friendlyError(error) });
      }
    },
    [services, refreshBalances],
  );

  // Balances change outside the page too (DUST grows, other apps spend), so read them again on return.
  const isConnected = state.status === 'connected';
  useEffect(() => {
    if (!isConnected) return;
    const onFocus = () => void refreshBalances();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isConnected, refreshBalances]);

  const value = useMemo(
    () => ({
      state,
      connect,
      disconnect: () => {
        api.current = undefined;
        setState({ status: 'idle' });
      },
    }),
    [state, connect],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = (): WalletContextValue => {
  const value = useContext(WalletContext);
  if (!value) throw new Error('WalletProvider missing');
  return value;
};

/** How long to keep looking for an extension that injects after page load: a cold start can take several seconds. */
const DETECT_EVERY_MS = 500;
const DETECT_FOR_MS = 30_000;

/** Injected wallets. Extensions can inject after page load, so look again for a while. */
export const useDetectedWallets = (): InitialAPI[] => {
  const { detectWallets } = useServices();
  const [wallets, setWallets] = useState(detectWallets);
  useEffect(() => {
    if (wallets.length > 0) return;
    let tries = 0;
    const timer = setInterval(() => {
      const found = detectWallets();
      if (found.length > 0 || ++tries >= DETECT_FOR_MS / DETECT_EVERY_MS) clearInterval(timer);
      if (found.length > 0) setWallets(found);
    }, DETECT_EVERY_MS);
    return () => clearInterval(timer);
  }, [detectWallets, wallets.length]);
  return wallets;
};

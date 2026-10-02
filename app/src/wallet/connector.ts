import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { messageOf } from './errors';

/** Lace's connect() can hang without an error (spike S4), so connecting gives up after this long. */
export const CONNECT_TIMEOUT_MS = 60_000;

/** The DApp Connector API major version this app is built against (4.0.1). */
const API_MAJOR = '4.';

/** Wallets that injected a compatible DApp Connector API into `window.midnight`, one per wallet. */
export const detectWallets = (injected: Record<string, InitialAPI> | undefined): InitialAPI[] => {
  const byRdns = new Map<string, InitialAPI>();
  for (const w of Object.values(injected ?? {})) {
    const compatible = typeof w?.connect === 'function' && String(w.apiVersion).startsWith(API_MAJOR);
    if (compatible && !byRdns.has(w.rdns)) byRdns.set(w.rdns, w);
  }
  return [...byRdns.values()];
};

/**
 * 1AM fails the first call after ~1 min idle with "Request failed", and an immediate retry
 * succeeds (spike S4). Every connector call therefore gets one retry on exactly that error, and so
 * does the proving provider the wallet hands out, whose `prove` is often the first call after idle.
 */
export const retryingOnce = <T extends object>(api: T): T =>
  new Proxy(api, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      const call = async (...args: unknown[]) => {
        try {
          return await value.apply(target, args);
        } catch (error) {
          if (!messageOf(error).includes('Request failed')) throw error;
          return value.apply(target, args);
        }
      };
      return prop === 'getProvingProvider' ? async (...args: unknown[]) => retryingOnce(await call(...args)) : call;
    },
  });

/** Connects to `wallet` for `networkId`, giving up with 'connect timed out' after `timeoutMs`. */
export const connectWallet = async (
  wallet: InitialAPI,
  networkId: string,
  timeoutMs = CONNECT_TIMEOUT_MS,
): Promise<ConnectedAPI> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('connect timed out')), timeoutMs);
  });
  try {
    return retryingOnce(await Promise.race([wallet.connect(networkId), timedOut]));
  } finally {
    clearTimeout(timer);
  }
};

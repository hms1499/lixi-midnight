import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { messageOf } from './errors';

/** A wallet that never answers connect() would leave the page waiting, so connecting gives up after this long. */
export const CONNECT_TIMEOUT_MS = 60_000;

/** The DApp Connector API major version this app is built against (4.0.1). */
const API_MAJOR = '4.';

/** Lixi connects 1AM only (UX polish spec §3.1): Lace proved unstable on Preprod. */
const SUPPORTED = /1am/i;

/** 1AM wallets that injected a compatible DApp Connector API into `window.midnight`, one per wallet. */
export const detectWallets = (injected: Record<string, InitialAPI> | undefined): InitialAPI[] => {
  const byRdns = new Map<string, InitialAPI>();
  for (const w of Object.values(injected ?? {})) {
    const compatible = typeof w?.connect === 'function' && String(w.apiVersion).startsWith(API_MAJOR);
    const supported = SUPPORTED.test(String(w?.name)) || SUPPORTED.test(String(w?.rdns));
    if (compatible && supported && !byRdns.has(w.rdns)) byRdns.set(w.rdns, w);
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

/**
 * Has the wallet add the DUST fee to `tx`. A wallet paying with its own DUST and holding none fails
 * here with a bare Error (spike S4 retest), so a failure asks the wallet for its DUST and reports
 * 'no dust' when there is none. It asks only after a failure: 1AM normally pays through its sponsor.
 */
export const balanceOrExplain = async (api: ConnectedAPI, tx: string): Promise<string> => {
  try {
    return (await api.balanceUnsealedTransaction(tx)).tx;
  } catch (error) {
    const dust = await api.getDustBalance().catch(() => undefined);
    throw dust?.balance === 0n ? new Error('no dust') : error;
  }
};

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

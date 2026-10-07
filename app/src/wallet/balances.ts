import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { formatBalanceNight, formatNight } from '../lib/units';

/** What a connected wallet holds: tNIGHT in base units, DUST in SPECK. */
export type Balances = { readonly night: bigint; readonly dust: bigint };

/** NIGHT's token type in a wallet's unshielded balances: the native token, all zeros. */
const NIGHT_TOKEN = '0'.repeat(64);

/** The wallet's tNIGHT and DUST, or undefined when it cannot say. Balances are a hint, never an error. */
export const readBalances = async (api: ConnectedAPI): Promise<Balances | undefined> => {
  try {
    const [unshielded, dust] = await Promise.all([api.getUnshieldedBalances(), api.getDustBalance()]);
    return { night: unshielded[NIGHT_TOKEN] ?? 0n, dust: dust.balance };
  } catch {
    return undefined;
  }
};

/** 1AM pays fees through its own sponsor (spike S4), so the wallet's DUST says nothing about fees. */
export const feeNote = (walletName: string): string => `Fees are paid by ${walletName}, so your wallet needs no DUST.`;

/**
 * Early warnings to show above a button that sends a transaction. They never block it: a wallet's
 * balances can lag the chain.
 */
export const feeWarnings = (wallet: { readonly balances?: Balances }, needNight?: bigint): string[] => {
  const { balances } = wallet;
  if (!balances || needNight === undefined || balances.night >= needNight) return [];
  return [
    `Your wallet shows ${formatBalanceNight(balances.night)} tNIGHT, less than the ${formatNight(needNight)} tNIGHT this envelope needs.`,
  ];
};

import { nativeToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { LixiProviders, NetworkConfig } from '@lixi/sdk';
import { HeadlessWallet } from '../src/wallet.js';

export { GENESIS_SEED } from '../src/secret.js';

export const randomSeed = (): string => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries a submission the node rejected, after a block, because a wallet that just paid a fee can
 * briefly select a DUST coin the chain already spent.
 */
export const retrySubmission = async <T>(submit: () => Promise<T>, attempts = 3): Promise<T> => {
  for (let i = 1; ; i++) {
    try {
      return await submit();
    } catch (error) {
      if (i >= attempts || !String(error).includes('SubmissionError')) throw error;
      console.warn(`submission rejected (attempt ${i}), retrying after a block`);
      await sleep(7_000);
    }
  }
};

/** Starts a fresh wallet funded by `funder`; with `dust`, it also registers the NIGHT so it can pay fees. */
export const fundedWallet = async (
  config: NetworkConfig,
  funder: HeadlessWallet,
  night: bigint,
  dust: boolean,
): Promise<HeadlessWallet> => {
  const wallet = await HeadlessWallet.start(config, randomSeed());
  await retrySubmission(() => funder.sendNight(wallet, night));
  await wallet.waitFor((s) => s.unshielded.availableCoins.length > 0, 120_000, 'NIGHT');
  if (dust) await wallet.registerForDust();
  return wallet;
};

/** Waits until the wallet's unshielded NIGHT balance is exactly `expected`. */
export const waitForNight = (wallet: HeadlessWallet, expected: bigint) =>
  wallet.waitFor((s) => (s.unshielded.balances[nativeToken().raw] ?? 0n) === expected, 120_000, `NIGHT = ${expected}`);

/** Proving times per label, for spike S2. */
export const proofTimes: Array<{ label: string; seconds: number }> = [];

export const timeProofs = (providers: LixiProviders, label: string): LixiProviders => ({
  ...providers,
  proofProvider: {
    proveTx: async (tx, cfg) => {
      const start = performance.now();
      const proven = await providers.proofProvider.proveTx(tx, cfg);
      proofTimes.push({ label, seconds: (performance.now() - start) / 1000 });
      return proven;
    },
  },
});

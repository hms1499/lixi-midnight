import { fileURLToPath } from 'node:url';
import type { NetworkName } from '@lixi/sdk';
import { cliNetwork } from './network.js';
import { deployerSeed } from './secret.js';
import { HeadlessWallet } from './wallet.js';
import { cacheFileFor } from './wallet-cache.js';

/** Gitignored; holds wallet sync state, which can include key material. */
export const WALLET_CACHE_DIR = fileURLToPath(new URL('../.wallet-cache/', import.meta.url));

/**
 * The operator wallet for `deploy`, `smoke` and `sponsor`. Off the devnet it keeps a sync cache,
 * because a fresh Preprod wallet spends hours replaying DUST history. The devnet is reset often,
 * so it never uses one.
 */
export const startDeployer = (network: NetworkName): Promise<HeadlessWallet> => {
  const config = cliNetwork(network);
  return HeadlessWallet.start(
    config,
    deployerSeed(network),
    network === 'undeployed'
      ? undefined
      : (address) => cacheFileFor(WALLET_CACHE_DIR, network, config.indexer, address),
  );
};

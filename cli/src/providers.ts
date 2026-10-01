import { fileURLToPath } from 'node:url';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { memoryPrivateStateProvider, type LixiCircuit, type LixiProviders, type NetworkConfig } from '@lixi/sdk';
import type { HeadlessWallet } from './wallet.js';

/** Compiled contract output with proving keys (`npm run compact`). */
export const ZK_CONFIG_PATH = fileURLToPath(new URL('../../contract/src/managed/lixi', import.meta.url));

/** Node providers for one wallet, proving on the local proof server. */
export const nodeProviders = (config: NetworkConfig, wallet: HeadlessWallet): LixiProviders => {
  const zkConfigProvider = new NodeZkConfigProvider<LixiCircuit>(ZK_CONFIG_PATH);
  return {
    privateStateProvider: memoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider: wallet,
    midnightProvider: wallet,
  };
};

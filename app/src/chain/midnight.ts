import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { createProofProvider, type ProofProvider } from '@midnight-ntwrk/midnight-js-types';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  NETWORKS,
  claimTx,
  networkConfig,
  createEnvelopeTx,
  memoryPrivateStateProvider,
  readLedger,
  refundTx,
  type LixiCircuit,
  type LixiProviders,
} from '@lixi/sdk';
import type { AppConfig } from '../config';
import { balanceOrExplain } from '../wallet/connector';
import type { LixiChain, LixiReader, ProverChoice } from './port';
import { lookupTxHash } from './tx-hash';

type WebSocketCtor = Parameters<typeof indexerPublicDataProvider>[2];

/**
 * Reads go to the network's public indexer, not the wallet's: the page can show an envelope before
 * any wallet connects, and the CSP can name every host the page talks to.
 */
const publicData = (config: AppConfig) => {
  const n = networkConfig(config.network, config.projectId);
  // The provider is typed against the `ws` package; the browser's WebSocket is what it needs here.
  return indexerPublicDataProvider(n.indexer, n.indexerWS, WebSocket as unknown as WebSocketCtor);
};

export const publicReader = (config: AppConfig): LixiReader => {
  const provider = publicData(config);
  return { readLedger: () => readLedger(provider, config.contractAddress) };
};

/** The local proof server, with "not running" reported as such rather than as a bare fetch error. */
const localProver = (url: string, zk: FetchZkConfigProvider<LixiCircuit>): ProofProvider => {
  const inner = httpClientProofProvider(url, zk);
  return {
    proveTx: async (tx, cfg) => {
      try {
        return await inner.proveTx(tx, cfg);
      } catch (error) {
        throw error instanceof TypeError ? new Error('proof server unreachable') : error;
      }
    },
  };
};

/** A LixiChain whose transactions the connected browser wallet balances, pays for and submits (spike S4). */
export const walletChain = async (api: ConnectedAPI, config: AppConfig, prover: ProverChoice): Promise<LixiChain> => {
  const zk = new FetchZkConfigProvider<LixiCircuit>(window.location.origin, fetch.bind(window));
  const shielded = await api.getShieldedAddresses();
  const publicDataProvider = publicData(config);
  const providers: LixiProviders = {
    privateStateProvider: memoryPrivateStateProvider(),
    publicDataProvider,
    zkConfigProvider: zk,
    proofProvider:
      prover === 'wallet' && typeof api.getProvingProvider === 'function'
        ? createProofProvider(await api.getProvingProvider(zk))
        : localProver(NETWORKS[config.network].proofServer, zk),
    walletProvider: {
      getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
      balanceTx: async (tx) => {
        const balanced = await balanceOrExplain(api, toHex(tx.serialize()));
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balanced));
      },
    },
    midnightProvider: {
      submitTx: async (tx) => {
        await api.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };
  const address = config.contractAddress;
  return {
    readLedger: () => readLedger(publicDataProvider, address),
    create: (privateState, args) => createEnvelopeTx(providers, address, privateState, args),
    claim: async (args) =>
      lookupTxHash((txId) => publicDataProvider.watchForTxData(txId), await claimTx(providers, address, args)),
    refund: async (privateState, id) =>
      lookupTxHash(
        (txId) => publicDataProvider.watchForTxData(txId),
        await refundTx(providers, address, privateState, id),
      ),
  };
};

// Spike S4: can a browser wallet prove, balance and submit a Lixi claim?
// Throwaway page. Plan 3 builds the real wallet bridge from what this shows.
import './polyfills.js';
import '@midnight-ntwrk/dapp-connector-api';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { Transaction, type FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { createProofProvider, type UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  checkClaim,
  memoryPrivateStateProvider,
  parseClaimInput,
  proveClaimTx,
  readLedger,
  resolveClaim,
  userAddressBytes,
  type LixiCircuit,
  type LixiProviders,
} from '@lixi/sdk';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const log = (line: string) => {
  $('log').textContent += `${new Date().toISOString().slice(11, 19)} ${line}\n`;
};
const deserialize = (hex: string): FinalizedTransaction =>
  Transaction.deserialize('signature', 'proof', 'binding', fromHex(hex));

let api: ConnectedAPI | undefined;

const wallets = (): InitialAPI[] => Object.values(window.midnight ?? {});

$('detect').onclick = () => {
  const found = wallets();
  log(
    found.length ? found.map((w) => `found ${w.name} (${w.rdns}) api ${w.apiVersion}`).join('\n') : 'no wallet found',
  );
  $<HTMLSelectElement>('wallet').innerHTML = found.map((w, i) => `<option value="${i}">${w.name}</option>`).join('');
};

$('connect').onclick = async () => {
  const network = $<HTMLSelectElement>('network').value;
  setNetworkId(network);
  api = await wallets()[Number($<HTMLSelectElement>('wallet').value)].connect(network);
  const config = await api.getConfiguration();
  log(`connected: indexer ${config.indexerUri}, prover ${config.proverServerUri ?? '(none)'}`);
  log(`unshielded ${(await api.getUnshieldedAddress()).unshieldedAddress}`);
  const dust = await api.getDustBalance();
  log(`DUST balance ${dust.balance} / cap ${dust.cap}`);
  log(`getProvingProvider: ${typeof api.getProvingProvider}`);
};

$('claim').onclick = async () => {
  if (!api) return log('connect first');
  const network = $<HTMLSelectElement>('network').value;
  const proving = $<HTMLSelectElement>('proving').value;
  const payFees = $<HTMLSelectElement>('fees').value === 'wallet';
  const address = $<HTMLInputElement>('contract').value.trim();
  const config = await api.getConfiguration();
  const zk = new FetchZkConfigProvider<LixiCircuit>(window.location.origin, fetch.bind(window));
  const connected = api;
  const shielded = await connected.getShieldedAddresses();
  const providers: LixiProviders = {
    privateStateProvider: memoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(
      config.indexerUri,
      config.indexerWsUri,
      // The provider is typed against the `ws` package; the browser's WebSocket is what it needs here.
      WebSocket as unknown as Parameters<typeof indexerPublicDataProvider>[2],
    ),
    zkConfigProvider: zk,
    proofProvider:
      proving === 'wallet'
        ? createProofProvider(await connected.getProvingProvider(zk))
        : httpClientProofProvider('http://127.0.0.1:6300', zk),
    walletProvider: {
      getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction) =>
        deserialize((await connected.balanceUnsealedTransaction(toHex(tx.serialize()), { payFees })).tx),
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction) => {
        await connected.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };

  const recipient = userAddressBytes((await api.getUnshieldedAddress()).unshieldedAddress, network);
  const ledger = await readLedger(providers.publicDataProvider, address);
  const args = resolveClaim(parseClaimInput($<HTMLInputElement>('link').value), (nf) => ledger.nullifiers.member(nf));
  const check = checkClaim(ledger, args, recipient, Math.floor(Date.now() / 1000));
  log(`pre-check: ${JSON.stringify(check, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`);
  if (!check.ok) return;

  let t = performance.now();
  const proven = await proveClaimTx(providers, address, { ...args, recipient });
  log(`proved with ${proving} prover in ${((performance.now() - t) / 1000).toFixed(1)}s`);
  t = performance.now();
  const balanced = await providers.walletProvider.balanceTx(proven);
  log(`wallet balanced (payFees=${payFees}) in ${((performance.now() - t) / 1000).toFixed(1)}s`);
  if (!payFees) {
    $<HTMLTextAreaElement>('txhex').value = toHex(balanced.serialize());
    return log('copy the hex into a file and run: npm run sponsor -w @lixi/cli -- --network <net> <file>');
  }
  log(`submitted: ${await providers.midnightProvider.submitTx(balanced)}`);
};

window.addEventListener('error', (e) => log(`error: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => log(`error: ${String(e.reason)}`));

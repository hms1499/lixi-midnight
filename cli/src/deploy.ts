import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { deployLixi, readLedger, relinquishAuthority, type NetworkName } from '@lixi/sdk';
import { nodeProviders } from './providers.js';
import { startDeployer } from './deployer.js';
import { cliNetwork } from './network.js';
import { redactOutput } from './redact-output.js';

// Endpoint URLs carry the Blockfrost project id; keep it out of everything this script prints.
redactOutput();

const DAY = 86400n;
/** Spec §3.4: minDuration 60 s on the devnet, 3600 s on Preprod; maxDuration 30 days. */
const DURATIONS: Record<NetworkName, { minDuration: bigint; maxDuration: bigint }> = {
  undeployed: { minDuration: 60n, maxDuration: 30n * DAY },
  preprod: { minDuration: 3600n, maxDuration: 30n * DAY },
};
const DEPLOYMENTS_DIR = fileURLToPath(new URL('../../deployments/', import.meta.url));

const { values } = parseArgs({ options: { network: { type: 'string', default: 'undeployed' } } });
const network = values.network as NetworkName;
const config = cliNetwork(network);

setNetworkId(config.networkId);
const wallet = await startDeployer(network);
try {
  console.log(`deployer address: ${wallet.bech32Address()}`);
  console.log('syncing wallet (a fresh Preprod wallet can take several minutes)...');
  if ((await wallet.nightBalance()) === 0n) {
    throw new Error('the deployer has no tNIGHT: fund the address above from the faucet, then run again');
  }
  await wallet.registerForDust(30 * 60_000);

  const providers = nodeProviders(config, wallet);
  const params = DURATIONS[network];
  const contractAddress = await deployLixi(providers, params);
  console.log(`deployed: ${contractAddress}`);
  await relinquishAuthority(providers, contractAddress);
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!state || state.maintenanceAuthority.committee.length !== 0) throw new Error('authority was not relinquished');
  const ledger = await readLedger(providers.publicDataProvider, contractAddress);
  console.log(
    `maintenance authority relinquished; minDuration=${ledger.minDuration} maxDuration=${ledger.maxDuration}`,
  );

  const record = {
    network,
    contractAddress,
    minDuration: Number(params.minDuration),
    maxDuration: Number(params.maxDuration),
    deployedAt: new Date().toISOString(),
  };
  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  writeFileSync(`${DEPLOYMENTS_DIR}${network}.json`, JSON.stringify(record, null, 2) + '\n');
  console.log(`wrote deployments/${network}.json`);
} finally {
  await wallet.stop();
}

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NETWORKS, type NetworkName } from '@lixi/sdk';
import { startDeployer } from './deployer.js';

/**
 * Pays the DUST fee for a claim a recipient proved and bound in the browser (spike S5).
 * Usage: npm run sponsor -w @lixi/cli -- --network preprod <file with the transaction hex>
 */
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { network: { type: 'string', default: 'undeployed' } },
});
const network = values.network as NetworkName;
const config = NETWORKS[network];
if (positionals.length !== 1) throw new Error('pass the file that holds the transaction hex');

setNetworkId(config.networkId);
const sponsor = await startDeployer(network);
try {
  console.log(`sponsored tx: ${await sponsor.sponsor(readFileSync(positionals[0], 'utf8'))}`);
} finally {
  await sponsor.stop();
}

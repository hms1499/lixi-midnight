import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  addEnvelope,
  checkClaim,
  claimTx,
  createEnvelopeTx,
  deriveEnvelope,
  linksFor,
  newVault,
  privateStateOf,
  readLedger,
  type NetworkName,
  type PersonalLink,
} from '@lixi/sdk';
import { nodeProviders } from './providers.js';
import { startDeployer } from './deployer.js';
import { cliNetwork } from './network.js';
import { redactOutput } from './redact-output.js';

// Endpoint URLs carry the Blockfrost project id; keep it out of everything this script prints.
redactOutput();

/**
 * Smoke test against a deployed contract: create a two-share envelope, then claim both shares back
 * to the deployer. Proves the deployment end to end without a browser wallet.
 */
const { values } = parseArgs({ options: { network: { type: 'string', default: 'undeployed' } } });
const network = values.network as NetworkName;
const config = cliNetwork(network);
const { contractAddress } = JSON.parse(
  readFileSync(fileURLToPath(new URL(`../../deployments/${network}.json`, import.meta.url)), 'utf8'),
) as { contractAddress: string };

setNetworkId(config.networkId);
const wallet = await startDeployer(network);
try {
  // A wallet restored from the sync cache must catch up before balancing, as deploy does.
  await wallet.waitForFeeSync();
  const providers = nodeProviders(config, wallet);
  const me = await wallet.userAddress();
  const spec = { index: 0, total: 2_000_000n, count: 2, kind: 'personal', split: 'random' } as const;
  const minDuration = (await readLedger(providers.publicDataProvider, contractAddress)).minDuration;
  const expiry = BigInt(Math.floor(Date.now() / 1000)) + minDuration + 600n;
  const vault = addEnvelope(newVault(), { ...spec, expiry, labels: [] });
  const envelope = deriveEnvelope(vault.seed, spec);

  console.log('creating a 2-share envelope of 2 tNIGHT...');
  const created = await createEnvelopeTx(providers, contractAddress, privateStateOf(vault), {
    nonce: envelope.nonce,
    expiry,
    refundAddress: me,
    onePerAddress: false,
  });
  console.log(`create tx: ${created.txId}`);

  // Claim both shares back, so nothing stays locked in the envelope.
  for (const link of linksFor(envelope) as PersonalLink[]) {
    const ledger = await readLedger(providers.publicDataProvider, contractAddress);
    const check = checkClaim(ledger, link, me, Math.floor(Date.now() / 1000));
    if (!check.ok) throw new Error(`pre-check failed: ${check.reason}`);
    const claimHash = await claimTx(providers, contractAddress, { ...link, recipient: me });
    console.log(`claim tx hash: ${claimHash} (${check.amount} base units)`);
  }
  console.log(`envelope id: ${Buffer.from(envelope.id).toString('hex')}`);
} finally {
  await wallet.stop();
}

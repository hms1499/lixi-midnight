import { NETWORKS, networkConfig, type NetworkConfig, type NetworkName } from '@lixi/sdk';

/**
 * Endpoints for the chain scripts. Preprod needs a Blockfrost project id from
 * `BLOCKFROST_PROJECT_ID` in cli/.env. Never log the result: its URLs carry the id.
 */
export const cliNetwork = (
  network: NetworkName,
  env: Record<string, string | undefined> = process.env,
): NetworkConfig => {
  if (!(network in NETWORKS)) throw new Error(`unknown network ${network}; use undeployed or preprod`);
  try {
    return networkConfig(network, env.BLOCKFROST_PROJECT_ID);
  } catch {
    // networkConfig only throws for a missing id.
    throw new Error('set BLOCKFROST_PROJECT_ID in cli/.env to the id of a Blockfrost "Midnight Preprod" project');
  }
};

import { NETWORKS, networkConfig, type NetworkName } from '@lixi/sdk/network';
import preprod from '../../deployments/preprod.json' with { type: 'json' };

export type AppConfig = {
  readonly network: NetworkName;
  readonly contractAddress: string;
  readonly projectId?: string;
};

/**
 * Build-time config. Preprod by default, using the committed deployment record and the Blockfrost
 * project id from VITE_BLOCKFROST_PROJECT_ID (app/.env.local; the id ships in the page, as any
 * browser-side Blockfrost id does). A local devnet build sets VITE_LIXI_NETWORK=undeployed and
 * VITE_LIXI_CONTRACT.
 */
export const appConfig = (env: Record<string, string | undefined>): AppConfig => {
  const network = env.VITE_LIXI_NETWORK ?? 'preprod';
  if (!(network in NETWORKS)) throw new Error(`unknown network ${network}`);
  const contractAddress = env.VITE_LIXI_CONTRACT ?? (network === 'preprod' ? preprod.contractAddress : '');
  if (!/^[0-9a-f]{64}$/.test(contractAddress)) throw new Error(`set VITE_LIXI_CONTRACT for ${network}`);
  const projectId = env.VITE_BLOCKFROST_PROJECT_ID?.trim() || undefined;
  try {
    networkConfig(network as NetworkName, projectId); // only throws for a missing id
  } catch {
    throw new Error(
      'set VITE_BLOCKFROST_PROJECT_ID in app/.env.local to the id of a Blockfrost "Midnight Preprod" project',
    );
  }
  return { network: network as NetworkName, contractAddress, projectId };
};

import { NETWORKS, type NetworkName } from '@lixi/sdk/network';
import preprod from '../../deployments/preprod.json';

export type AppConfig = { readonly network: NetworkName; readonly contractAddress: string };

/**
 * Build-time config. Preprod by default, using the committed deployment record; a local devnet
 * build sets VITE_LIXI_NETWORK=undeployed and VITE_LIXI_CONTRACT.
 */
export const appConfig = (env: Record<string, string | undefined>): AppConfig => {
  const network = env.VITE_LIXI_NETWORK ?? 'preprod';
  if (!(network in NETWORKS)) throw new Error(`unknown network ${network}`);
  const contractAddress = env.VITE_LIXI_CONTRACT ?? (network === 'preprod' ? preprod.contractAddress : '');
  if (!/^[0-9a-f]{64}$/.test(contractAddress)) throw new Error(`set VITE_LIXI_CONTRACT for ${network}`);
  return { network: network as NetworkName, contractAddress };
};

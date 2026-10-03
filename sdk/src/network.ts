/** Endpoints for one Midnight network. The proof server is always local (audit H4). */
export type NetworkConfig = {
  readonly networkId: 'undeployed' | 'preprod';
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
};

/**
 * Bare endpoints, which the CSP lists. Preprod goes through Blockfrost because Midnight is shutting
 * down its official Preprod indexer and RPC (midnight-wallet#781). Every Blockfrost call needs the
 * project id, which `networkConfig` adds.
 */
export const NETWORKS = {
  undeployed: {
    networkId: 'undeployed',
    indexer: 'http://127.0.0.1:8088/api/v4/graphql',
    indexerWS: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    node: 'http://127.0.0.1:9944',
    proofServer: 'http://127.0.0.1:6300',
  },
  preprod: {
    networkId: 'preprod',
    indexer: 'https://midnight-preprod.blockfrost.io/api/v0',
    indexerWS: 'wss://midnight-preprod.blockfrost.io/api/v0/ws',
    node: 'https://rpc.midnight-preprod.blockfrost.io',
    proofServer: 'http://127.0.0.1:6300',
  },
} as const satisfies Record<string, NetworkConfig>;

export type NetworkName = keyof typeof NETWORKS;

/** Networks whose endpoints are Blockfrost's and need its project id. */
const ON_BLOCKFROST: Record<NetworkName, boolean> = { undeployed: false, preprod: true };

/**
 * The endpoints to call. On Blockfrost the project id goes on the indexer and node URLs as
 * `?project_id=`, because browser WebSockets cannot send headers. The local proof server never
 * gets it. Never log the result: its URLs carry the id.
 */
export const networkConfig = (network: NetworkName, projectId?: string): NetworkConfig => {
  const base = NETWORKS[network];
  if (!ON_BLOCKFROST[network]) return base;
  const id = projectId?.trim();
  if (!id) throw new Error('missing Blockfrost project id');
  const keyed = (url: string) => `${url}?project_id=${encodeURIComponent(id)}`;
  return { ...base, indexer: keyed(base.indexer), indexerWS: keyed(base.indexerWS), node: keyed(base.node) };
};

/** Hides Blockfrost project ids in text that may quote an endpoint URL. */
export const redactUrl = (text: string): string => text.replace(/project_id=[^&\s"'<>]+/g, 'project_id=<redacted>');

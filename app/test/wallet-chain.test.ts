// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

const watchForTxData = vi.fn(async () => ({ txHash: 'looked-up' }));
vi.mock('@midnight-ntwrk/midnight-js-indexer-public-data-provider', () => ({
  indexerPublicDataProvider: () => ({ watchForTxData }),
}));
vi.mock('@lixi/sdk', async (original) => ({
  ...(await original<typeof import('@lixi/sdk')>()),
  claimTx: vi.fn(async () => 'claim-hash'),
  refundTx: vi.fn(async () => 'refund-hash'),
}));

const { walletChain } = await import('../src/chain/midnight');

const api = {
  getShieldedAddresses: async () => ({ shieldedCoinPublicKey: 'cpk', shieldedEncryptionPublicKey: 'epk' }),
} as unknown as ConnectedAPI;
const config = { network: 'undeployed' as const, contractAddress: 'ab'.repeat(32) };

describe('walletChain', () => {
  it('hands back the hash a claim or refund returned, without polling the indexer for it', async () => {
    const chain = await walletChain(api, config, 'local');
    expect(await chain.claim({} as never)).toBe('claim-hash');
    expect(await chain.refund({} as never, new Uint8Array(32))).toBe('refund-hash');
    expect(watchForTxData).not.toHaveBeenCalled();
  });

  it('reports a call’s stages to that call’s listener only', async () => {
    const sdk = await import('@lixi/sdk');
    const waits = async (providers: unknown) => {
      await (
        providers as { publicDataProvider: { watchForTxData(id: string): Promise<unknown> } }
      ).publicDataProvider.watchForTxData('tx');
      return 'hash';
    };
    vi.mocked(sdk.claimTx).mockImplementationOnce(waits as never);
    vi.mocked(sdk.refundTx).mockImplementationOnce(waits as never);
    const chain = await walletChain(api, config, 'local');
    const seen: string[] = [];
    expect(await chain.claim({} as never, (s) => seen.push(s))).toBe('hash');
    expect(seen).toEqual(['waiting']);
    await chain.refund({} as never, new Uint8Array(32)); // no listener: nothing more is reported
    expect(seen).toEqual(['waiting']);
  });
});

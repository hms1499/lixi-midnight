import { describe, expect, it, vi } from 'vitest';
import type { LixiProviders } from '@lixi/sdk';
import type { TxStage } from '../src/chain/port';
import { withStages } from '../src/chain/stages';

const stub = () =>
  ({
    privateStateProvider: {},
    zkConfigProvider: {},
    proofProvider: { proveTx: vi.fn(async () => 'proven') },
    walletProvider: {
      getCoinPublicKey: () => 'cpk',
      getEncryptionPublicKey: () => 'epk',
      balanceTx: vi.fn(async () => 'balanced'),
    },
    midnightProvider: { submitTx: vi.fn(async () => 'tx-id') },
    publicDataProvider: { watchForTxData: vi.fn(async () => ({ txHash: 'h' })), queryContractState: vi.fn() },
  }) as unknown as LixiProviders;

describe('withStages', () => {
  it('reports proving, confirm, sending and waiting as each provider starts, and passes results through', async () => {
    const seen: TxStage[] = [];
    const p = withStages(stub(), () => (s) => seen.push(s));
    expect(await p.proofProvider.proveTx('unproven' as never)).toBe('proven');
    expect(await p.walletProvider.balanceTx('proven' as never)).toBe('balanced');
    expect(await p.midnightProvider.submitTx('balanced' as never)).toBe('tx-id');
    expect(await p.publicDataProvider.watchForTxData('tx-id')).toEqual({ txHash: 'h' });
    expect(seen).toEqual(['proving', 'confirm', 'sending', 'waiting']);
  });

  it('reports the stage a provider failed in, and nothing after it', async () => {
    const s = stub();
    vi.mocked(s.walletProvider.balanceTx).mockRejectedValueOnce(new Error('declined'));
    const seen: TxStage[] = [];
    const p = withStages(s, () => (x) => seen.push(x));
    await p.proofProvider.proveTx('unproven' as never);
    await expect(p.walletProvider.balanceTx('proven' as never)).rejects.toThrow('declined');
    expect(seen).toEqual(['proving', 'confirm']);
  });

  it('keeps every other provider method, and works with no listener', async () => {
    const p = withStages(stub(), () => undefined);
    expect(p.walletProvider.getCoinPublicKey()).toBe('cpk');
    expect(typeof p.publicDataProvider.queryContractState).toBe('function');
    await expect(p.midnightProvider.submitTx('balanced' as never)).resolves.toBe('tx-id');
  });
});

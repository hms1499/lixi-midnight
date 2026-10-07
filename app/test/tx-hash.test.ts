import { describe, expect, it, vi } from 'vitest';
import { TX_HASH_TIMEOUT_MS, lookupTxHash } from '../src/chain/tx-hash';
import { txUrl } from '../src/lib/links';

describe('lookupTxHash', () => {
  it('returns the hash the indexer reports for an identifier', async () => {
    expect(await lookupTxHash(async (id) => ({ txHash: `hash-of-${id}` }), 'abc')).toBe('hash-of-abc');
  });

  it('returns nothing when the lookup fails', async () => {
    expect(await lookupTxHash(() => Promise.reject(new Error('indexer down')), 'abc')).toBe('');
  });

  it('gives up after the timeout when the indexer never answers (Review Focus 4)', async () => {
    vi.useFakeTimers();
    try {
      const found = lookupTxHash(() => new Promise(() => undefined), 'abc');
      await vi.advanceTimersByTimeAsync(TX_HASH_TIMEOUT_MS);
      expect(await found).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('txUrl', () => {
  it('links a hash on the Preprod explorer, with or without 0x', () => {
    expect(txUrl('ab12')).toBe('https://preprod.midnightexplorer.com/transactions/0xab12');
    expect(txUrl('0xab12')).toBe('https://preprod.midnightexplorer.com/transactions/0xab12');
  });
});

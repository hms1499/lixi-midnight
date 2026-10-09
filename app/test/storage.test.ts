import { describe, expect, it } from 'vitest';
import { newVault, serializeVault } from '@lixi/sdk';
import { loadProver, saveProver } from '../src/lib/prefs';
import { VAULT_KEY, localVaultStore } from '../src/lib/storage';
import { MemoryStorage } from './helpers';

describe('localVaultStore', () => {
  it('round-trips a vault and the backed-up flag', () => {
    const store = localVaultStore(new MemoryStorage());
    expect(store.load()).toBeUndefined();
    const vault = newVault();
    store.save(vault);
    expect(store.load()?.seed).toEqual(vault.seed);
    expect(store.backedUp()).toBe(false);
    store.setBackedUp(true);
    expect(store.backedUp()).toBe(true);
  });

  it('reports unreadable data as a corrupt vault and leaves it in place', () => {
    const storage = new MemoryStorage();
    const store = localVaultStore(storage);
    for (const bad of [
      '{not json',
      '{"seed":"AAAA","envelopes":[]}',
      serializeVault(newVault()).replace('"envelopes":[]', '"envelopes":7'),
    ]) {
      storage.setItem(VAULT_KEY, bad);
      expect(() => store.load(), bad).toThrow('corrupt vault');
      expect(storage.getItem(VAULT_KEY)).toBe(bad);
    }
  });

  it('remembers where proofs are made, defaulting to the wallet', () => {
    const storage = new MemoryStorage();
    expect(loadProver(storage)).toBe('wallet');
    saveProver(storage, 'local');
    expect(loadProver(storage)).toBe('local');
  });
});

import { deserializeVault, serializeVault, type SenderVault } from '@lixi/sdk';
import type { ProverChoice } from '../chain/port';

export const VAULT_KEY = 'lixi.vault.v1';
export const BACKED_UP_KEY = 'lixi.vault.backedUp';

/** Where the sender's vault lives between visits. */
export type VaultStore = {
  /** The saved vault, or undefined if there is none. Throws 'corrupt vault' if the saved data cannot be read. */
  load(): SenderVault | undefined;
  save(vault: SenderVault): void;
  /** Whether the user confirmed saving the backup string of the current vault. */
  backedUp(): boolean;
  setBackedUp(done: boolean): void;
};

/**
 * Vault in localStorage. A vault that fails to parse is never overwritten here: the only way
 * past 'corrupt vault' is an explicit restore from the backup string.
 */
export const localVaultStore = (storage: Storage): VaultStore => ({
  load() {
    const raw = storage.getItem(VAULT_KEY);
    if (raw === null) return undefined;
    try {
      return deserializeVault(raw);
    } catch {
      throw new Error('corrupt vault');
    }
  },
  save(vault) {
    storage.setItem(VAULT_KEY, serializeVault(vault));
  },
  backedUp: () => storage.getItem(BACKED_UP_KEY) === 'yes',
  setBackedUp(done) {
    storage.setItem(BACKED_UP_KEY, done ? 'yes' : 'no');
  },
});

export const PROVER_KEY = 'lixi.prover';

/** Proving in the wallet is the default; 'local' needs the Docker proof server (audit H4). */
export const loadProver = (storage: Storage): ProverChoice =>
  storage.getItem(PROVER_KEY) === 'local' ? 'local' : 'wallet';

export const saveProver = (storage: Storage, prover: ProverChoice): void => storage.setItem(PROVER_KEY, prover);

import { deserializeVault, serializeVault, type SenderVault } from '@lixi/sdk';

export const VAULT_KEY = 'lixi.vault.v1';
export const BACKED_UP_KEY = 'lixi.vault.backedUp';
export const FLOOR_KEY = 'lixi.vault.floor';

/** Where the sender's vault lives between visits. */
export type VaultStore = {
  /** The saved vault, or undefined if there is none. Throws 'corrupt vault' if the saved data cannot be read. */
  load(): SenderVault | undefined;
  save(vault: SenderVault): void;
  /** Whether the user confirmed saving the backup string of the current vault. */
  backedUp(): boolean;
  setBackedUp(done: boolean): void;
  /** Lowest index a new envelope may use. A removed entry's transaction may still land, so its index is never reused. */
  floor(): number;
  raiseFloor(index: number): void;
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
  floor() {
    const n = Number(storage.getItem(FLOOR_KEY));
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  },
  raiseFloor(index) {
    if (index > this.floor()) storage.setItem(FLOOR_KEY, String(index));
  },
});

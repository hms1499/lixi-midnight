import type { PrivateStateId, PrivateStateProvider } from '@midnight-ntwrk/midnight-js-types';

/**
 * In-memory private state. Lixi needs nothing durable here: the sender's vault re-derives
 * every share from the seed, and `chain.ts` writes the private state right before each call.
 * The maintenance signing key only lives between deploy and `relinquishAuthority`.
 */
export const memoryPrivateStateProvider = <PSI extends PrivateStateId, PS>(): PrivateStateProvider<PSI, PS> => {
  const states = new Map<string, PS>();
  const keys = new Map<string, string>();
  let address: string | undefined;
  const scoped = (id: PSI): string => {
    if (address === undefined) throw new Error('call setContractAddress first');
    return `${address}:${id}`;
  };
  const unsupported = (): Promise<never> => Promise.reject(new Error('not supported by the in-memory provider'));
  return {
    setContractAddress: (a) => {
      address = a;
    },
    set: async (id, state) => {
      states.set(scoped(id), state);
    },
    get: async (id) => states.get(scoped(id)) ?? null,
    remove: async (id) => {
      states.delete(scoped(id));
    },
    clear: async () => states.clear(),
    setSigningKey: async (a, key) => {
      keys.set(a, key);
    },
    getSigningKey: async (a) => keys.get(a) ?? null,
    removeSigningKey: async (a) => {
      keys.delete(a);
    },
    clearSigningKeys: async () => keys.clear(),
    exportPrivateStates: unsupported,
    importPrivateStates: unsupported,
    exportSigningKeys: unsupported,
    importSigningKeys: unsupported,
  };
};

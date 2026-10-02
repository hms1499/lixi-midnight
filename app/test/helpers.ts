import { LixiSimulator, T0 } from '@lixi/contract/testing';
import type { LixiChain } from '../src/chain/port';

export { T0 };
export const HOUR = 3600;
export const rnd = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32));

/** A LixiChain backed by the real compiled contract running in-process. */
export const simChain = (sim: LixiSimulator): LixiChain & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    readLedger: async () => sim.ledger(),
    create: async (privateState, a) => {
      calls.push('create');
      sim.privateState = privateState;
      return { id: sim.create(a.nonce, a.expiry, a.refundAddress, a.onePerAddress), txId: `tx${calls.length}` };
    },
    claim: async (a) => {
      calls.push('claim');
      sim.claim(a.id, a.share, a.path, a.recipient);
      return `tx${calls.length}`;
    },
    refund: async (privateState, id) => {
      calls.push('refund');
      sim.privateState = privateState;
      sim.refund(id);
      return `tx${calls.length}`;
    },
  };
};

/** In-memory Web Storage, for tests that run outside a browser. */
export class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(i: number) {
    return [...this.items.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

export { LixiSimulator };

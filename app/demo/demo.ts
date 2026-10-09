import { LixiSimulator } from '@lixi/contract/testing';
import { claimUrl, deriveEnvelope, linksFor } from '@lixi/sdk';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { LixiChain } from '../src/chain/port';
import { createEnvelope } from '../src/flows/create';
import { localVaultStore } from '../src/lib/storage';
import type { Services } from '../src/services';
import { demoChain } from './chain';

/** An undeployed-network unshielded address (the same one the app tests use). */
const DEMO_ADDRESS = 'mn_addr_undeployed1c5c054q33elswjfesnhcccjcsrvckauhdv9fv5wfze0v42nkdfzskcza5a';
export const DEMO_WALLET = 'Demo wallet';
const HOUR = 3600;

/** A wallet that connects at once and holds 5,000 tNIGHT and 10 DUST. */
export const demoWallet = (): InitialAPI => ({
  rdns: 'demo.wallet',
  name: DEMO_WALLET,
  icon: '',
  apiVersion: '4.0.1',
  connect: async () =>
    ({
      getUnshieldedAddress: async () => ({ unshieldedAddress: DEMO_ADDRESS }),
      getUnshieldedBalances: async () => ({ ['0'.repeat(64)]: 5_000_000_000n }),
      getDustBalance: async () => ({ balance: 10n * 10n ** 15n, cap: 0n }),
    }) as unknown as ConnectedAPI,
});

export type Demo = { services: Services; sim: LixiSimulator; chain: LixiChain; advance(seconds: number): void };

/** The app's services on the real compiled contract, run in-page by the simulator (demo video spec §5.4). */
export const createDemo = (opts: { stageMs: number; storage: Storage; origin: string; startSeconds: number }): Demo => {
  const sim = new LixiSimulator(BigInt(HOUR));
  sim.now = opts.startSeconds;
  const chain = demoChain(sim, opts.stageMs);
  const services: Services = {
    config: { network: 'undeployed', contractAddress: 'ab'.repeat(32) },
    reader: chain,
    storage: opts.storage,
    now: () => sim.now,
    origin: opts.origin,
    detectWallets: () => [demoWallet()],
    isMobile: () => false,
    reload: () => undefined,
    openChain: async () => chain,
  };
  return {
    services,
    sim,
    chain,
    advance: (seconds) => {
      sim.now += seconds;
    },
  };
};

/** The claim paths (`/c#…`) of the vault's envelope number `envelope`. */
export const demoLinks = (demo: Demo, envelope: number): string[] => {
  const vault = localVaultStore(demo.services.storage).load();
  if (!vault || !vault.envelopes[envelope]) throw new Error(`no envelope ${envelope} in the demo vault`);
  return linksFor(deriveEnvelope(vault.seed, vault.envelopes[envelope])).map((link) => claimUrl('', link));
};

/** Seals 6 tNIGHT as one group link for 3 wallets, off camera, and returns its claim path. */
export const sealGroup = async (demo: Demo): Promise<string> => {
  const store = localVaultStore(demo.services.storage);
  const form = { total: 6_000_000n, count: 3, split: 'equal', kind: 'group', durationSeconds: 86400 } as const;
  await createEnvelope(demo.chain, store, form, crypto.getRandomValues(new Uint8Array(32)), demo.sim.now);
  const vault = store.load()!;
  return demoLinks(demo, vault.envelopes.length - 1)[0];
};

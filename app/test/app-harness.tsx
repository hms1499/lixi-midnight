import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { deriveEnvelope, linksFor } from '@lixi/sdk';
import { App } from '../src/App';
import { createEnvelope, type CreateForm } from '../src/flows/create';
import { localVaultStore } from '../src/lib/storage';
import { ServicesProvider, type Services } from '../src/services';
import { WalletProvider } from '../src/wallet/WalletContext';
import { HOUR, LixiSimulator, MemoryStorage, rnd, simChain } from './helpers';

// An undeployed-network unshielded address (from sdk/test/address.test.ts).
const ADDRESS = 'mn_addr_undeployed1c5c054q33elswjfesnhcccjcsrvckauhdv9fv5wfze0v42nkdfzskcza5a';
export const ORIGIN = 'https://lixi.test';

const fakeWallet = (): InitialAPI => ({
  rdns: 'test.wallet',
  name: 'Test Wallet',
  icon: '',
  apiVersion: '4.0.1',
  connect: async () =>
    ({ getUnshieldedAddress: async () => ({ unshieldedAddress: ADDRESS }) }) as unknown as ConnectedAPI,
});

/** The whole app on a MemoryRouter, wired to the simulator and a fake wallet. */
export const setup = (overrides: Partial<Services> = {}) => {
  const sim = new LixiSimulator(BigInt(HOUR));
  const chain = simChain(sim);
  const storage = new MemoryStorage();
  const store = localVaultStore(storage);
  const services: Services = {
    config: { network: 'undeployed', contractAddress: 'ab'.repeat(32) },
    reader: chain,
    storage,
    now: () => sim.now,
    origin: ORIGIN,
    detectWallets: () => [fakeWallet()],
    openChain: async () => chain,
    ...overrides,
  };
  const show = (path: string) =>
    render(
      <ServicesProvider services={services}>
        <WalletProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </WalletProvider>
      </ServicesProvider>,
    );
  const create = async (form: Partial<CreateForm> = {}) => {
    await createEnvelope(
      chain,
      store,
      { total: 2_000_000n, count: 2, split: 'equal', kind: 'personal', durationSeconds: 2 * HOUR, ...form },
      rnd(),
      sim.now,
    );
    store.setBackedUp(true);
    const vault = store.load()!;
    return linksFor(deriveEnvelope(vault.seed, vault.envelopes.at(-1)!));
  };
  return { sim, chain, storage, store, show, create };
};

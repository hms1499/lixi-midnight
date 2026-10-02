import { createContext, useContext, type ReactNode } from 'react';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { AppConfig } from './config';
import type { LixiChain, LixiReader, ProverChoice } from './chain/port';

/** Everything the pages need from the outside world, injected so tests can run pages against the simulator. */
export type Services = {
  readonly config: AppConfig;
  readonly reader: LixiReader;
  readonly storage: Storage;
  /** Unix seconds. */
  readonly now: () => number;
  /** Origin that claim links point to. */
  readonly origin: string;
  readonly detectWallets: () => InitialAPI[];
  readonly openChain: (api: ConnectedAPI, prover: ProverChoice) => Promise<LixiChain>;
};

const ServicesContext = createContext<Services | null>(null);

export const ServicesProvider = ({ services, children }: { services: Services; children: ReactNode }) => (
  <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
);

export const useServices = (): Services => {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('ServicesProvider missing');
  return services;
};

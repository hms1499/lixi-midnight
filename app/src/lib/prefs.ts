import type { ProverChoice } from '../chain/port';

export const PROVER_KEY = 'lixi.prover';

/** Proving in the wallet is the default; 'local' needs the Docker proof server (audit H4). */
export const loadProver = (storage: Storage): ProverChoice =>
  storage.getItem(PROVER_KEY) === 'local' ? 'local' : 'wallet';

export const saveProver = (storage: Storage, prover: ProverChoice): void => storage.setItem(PROVER_KEY, prover);

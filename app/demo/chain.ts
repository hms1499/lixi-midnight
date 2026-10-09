import type { LixiSimulator } from '@lixi/contract/testing';
import { TX_STAGES, type LixiChain, type OnStage } from '../src/chain/port';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A 64-hex stand-in for a transaction hash. The demo never opens it on an explorer. */
const fakeHash = (n: number): string => n.toString(16).padStart(64, '0');

/**
 * A LixiChain on the in-page simulator. The simulator call runs first, so a refusal fails at once like a
 * failed proof; then each stage is reported and held for `stageMs`, so TxProgress shows it on camera.
 */
export const demoChain = (sim: LixiSimulator, stageMs: number): LixiChain => {
  let count = 0;
  const stages = async (onStage?: OnStage): Promise<string> => {
    for (const stage of TX_STAGES) {
      onStage?.(stage);
      await sleep(stageMs);
    }
    count += 1;
    return fakeHash(count);
  };
  return {
    readLedger: async () => sim.ledger(),
    create: async (privateState, a, onStage) => {
      sim.privateState = privateState;
      const id = sim.create(a.nonce, a.expiry, a.refundAddress, a.onePerAddress);
      return { id, txId: await stages(onStage) };
    },
    claim: async (a, onStage) => {
      sim.claim(a.id, a.share, a.path, a.recipient);
      return stages(onStage);
    },
    refund: async (privateState, id, onStage) => {
      sim.privateState = privateState;
      sim.refund(id);
      return stages(onStage);
    },
  };
};

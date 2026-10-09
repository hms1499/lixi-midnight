import type { Ledger, LixiPrivateState } from '@lixi/contract';
import type { ClaimTxArgs, CreateArgs } from '@lixi/sdk';

/** Where a transaction is (user moments spec §3.4), in the order midnight-js runs them. */
export const TX_STAGES = ['proving', 'confirm', 'sending', 'waiting'] as const;
export type TxStage = (typeof TX_STAGES)[number];
export type OnStage = (stage: TxStage) => void;

/** Read access to the deployed contract's public ledger. */
export type LixiReader = { readLedger(): Promise<Ledger> };

/**
 * A wallet-backed handle on the deployed contract: each call proves, balances and submits a transaction,
 * telling `onStage` where it is.
 */
export type LixiChain = LixiReader & {
  create(
    privateState: LixiPrivateState,
    args: CreateArgs,
    onStage?: OnStage,
  ): Promise<{ id: Uint8Array; txId: string }>;
  /** Resolves to the transaction hash, which explorers look up (UX polish spec §3.9). */
  claim(args: ClaimTxArgs, onStage?: OnStage): Promise<string>;
  /** Resolves to the transaction hash. */
  refund(privateState: LixiPrivateState, id: Uint8Array, onStage?: OnStage): Promise<string>;
  /** Where this chain really makes proofs, when it knows: a wallet without a prover falls back to the local one. */
  readonly prover?: ProverChoice;
};

/** Where proofs are made (audit H4): in the wallet (1AM), or by the proof server on this machine. */
export type ProverChoice = 'wallet' | 'local';

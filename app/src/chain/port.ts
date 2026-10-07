import type { Ledger, LixiPrivateState } from '@lixi/contract';
import type { ClaimTxArgs, CreateArgs } from '@lixi/sdk';

/** Read access to the deployed contract's public ledger. */
export type LixiReader = { readLedger(): Promise<Ledger> };

/** A wallet-backed handle on the deployed contract: each call proves, balances and submits a transaction. */
export type LixiChain = LixiReader & {
  create(privateState: LixiPrivateState, args: CreateArgs): Promise<{ id: Uint8Array; txId: string }>;
  /** Resolves to the transaction hash, which explorers look up (UX polish spec §3.9). */
  claim(args: ClaimTxArgs): Promise<string>;
  /** Resolves to the transaction hash. */
  refund(privateState: LixiPrivateState, id: Uint8Array): Promise<string>;
};

/** Where proofs are made (audit H4): in the wallet (1AM), or by the proof server on this machine. */
export type ProverChoice = 'wallet' | 'local';

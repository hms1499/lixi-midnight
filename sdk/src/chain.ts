import {
  Contract,
  emptyPrivateState,
  ledger,
  witnesses,
  type Ledger,
  type LixiPrivateState,
  type PathEntry,
  type Share,
} from '@lixi/contract';
import { createUnprovenCallTx, deployContract, submitCallTx, submitTx } from '@midnight-ntwrk/midnight-js-contracts';
import { getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import {
  ContractMaintenanceAuthority,
  Intent,
  MaintenanceUpdate,
  ReplaceAuthority,
  Transaction,
  signData,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { SucceedEntirely, type MidnightProviders, type PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';

export type LixiCircuit = 'createEnvelope' | 'claim' | 'refund';
export const LIXI_PRIVATE_STATE_ID = 'lixi';
export type LixiProviders = MidnightProviders<LixiCircuit, typeof LIXI_PRIVATE_STATE_ID, LixiPrivateState>;

export const lixiContract = CompiledContract.make<Contract<LixiPrivateState>>('lixi', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('./managed/lixi'),
);

export type DeployParams = { readonly minDuration: bigint; readonly maxDuration: bigint };

/** Deploys a fresh Lixi contract and returns its address. */
export const deployLixi = async (providers: LixiProviders, params: DeployParams): Promise<string> => {
  const deployed = await deployContract(providers, {
    compiledContract: lixiContract,
    privateStateId: LIXI_PRIVATE_STATE_ID,
    initialPrivateState: emptyPrivateState(),
    args: [params.minDuration, params.maxDuration],
  });
  return deployed.deployTxData.public.contractAddress;
};

/**
 * Replaces the maintenance authority with an empty committee (threshold 1), which no
 * signature set can satisfy, so the circuits can never change again (audit H5).
 */
export const relinquishAuthority = async (providers: LixiProviders, address: string): Promise<void> => {
  const state = await providers.publicDataProvider.queryContractState(address);
  if (!state) throw new Error('contract not found');
  const key = await providers.privateStateProvider.getSigningKey(address);
  if (!key) throw new Error('no maintenance key for this contract');
  const counter = state.maintenanceAuthority.counter;
  const update = new MaintenanceUpdate(
    address,
    [new ReplaceAuthority(new ContractMaintenanceAuthority([], 1, counter + 1n))],
    counter,
  );
  const signed = update.addSignature(0n, signData(key, update.dataToSign));
  const unprovenTx = Transaction.fromParts(
    getNetworkId(),
    undefined,
    undefined,
    Intent.new(ttlOneHour()).addMaintenanceUpdate(signed),
  );
  const result = await submitTx(providers, { unprovenTx });
  if (result.status !== SucceedEntirely) throw new Error(`relinquish failed: ${result.status}`);
  await providers.privateStateProvider.removeSigningKey(address);
};

/** Public ledger state of the contract, read through the indexer. */
export const readLedger = async (publicData: PublicDataProvider, address: string): Promise<Ledger> => {
  const state = await publicData.queryContractState(address);
  if (!state) throw new Error('contract not found');
  return ledger(state.data);
};

/** Private state goes in right before each call; the vault, not this provider, is the source of truth. */
const callOptions = async (
  providers: LixiProviders,
  address: string,
  privateState: LixiPrivateState,
): Promise<{ compiledContract: typeof lixiContract; contractAddress: string; privateStateId: 'lixi' }> => {
  providers.privateStateProvider.setContractAddress(address);
  await providers.privateStateProvider.set(LIXI_PRIVATE_STATE_ID, privateState);
  return { compiledContract: lixiContract, contractAddress: address, privateStateId: LIXI_PRIVATE_STATE_ID };
};

export type CreateArgs = {
  readonly nonce: Uint8Array;
  readonly expiry: bigint;
  readonly refundAddress: Uint8Array;
  readonly onePerAddress: boolean;
};

/** Proves and submits `createEnvelope`. `privateState` must hold this envelope's 16 shares. */
export const createEnvelopeTx = async (
  providers: LixiProviders,
  address: string,
  privateState: LixiPrivateState,
  args: CreateArgs,
): Promise<{ id: Uint8Array; txId: string }> => {
  const tx = await submitCallTx(providers, {
    ...(await callOptions(providers, address, privateState)),
    circuitId: 'createEnvelope',
    args: [args.nonce, args.expiry, { bytes: args.refundAddress }, args.onePerAddress],
  });
  return { id: tx.private.result, txId: tx.public.txId };
};

export type ClaimTxArgs = {
  readonly id: Uint8Array;
  readonly share: Share;
  readonly path: PathEntry[];
  /** Unshielded user address bytes (see `userAddressBytes`). */
  readonly recipient: Uint8Array;
};

/** Proves and submits `claim`, paying the share to `recipient`. */
export const claimTx = async (providers: LixiProviders, address: string, args: ClaimTxArgs): Promise<string> => {
  const tx = await submitCallTx(providers, {
    ...(await callOptions(providers, address, emptyPrivateState())),
    circuitId: 'claim',
    args: [args.id, args.share, args.path, { bytes: args.recipient }],
  });
  return tx.public.txId;
};

/** Proves and submits `refund`. `privateState` must hold this envelope's 16 shares. */
export const refundTx = async (
  providers: LixiProviders,
  address: string,
  privateState: LixiPrivateState,
  id: Uint8Array,
): Promise<string> => {
  const tx = await submitCallTx(providers, {
    ...(await callOptions(providers, address, privateState)),
    circuitId: 'refund',
    args: [id],
  });
  return tx.public.txId;
};

/**
 * Builds and proves a `claim` without balancing or submitting it. A wallet with no DUST can
 * then balance its own side and hand the bound transaction to a fee sponsor.
 */
export const proveClaimTx = async (providers: LixiProviders, address: string, args: ClaimTxArgs) => {
  const unproven = await createUnprovenCallTx(providers, {
    ...(await callOptions(providers, address, emptyPrivateState())),
    circuitId: 'claim',
    args: [args.id, args.share, args.path, { bytes: args.recipient }],
  });
  return providers.proofProvider.proveTx(unproven.private.unprovenTx);
};

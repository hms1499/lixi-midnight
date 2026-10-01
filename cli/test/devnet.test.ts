import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { submitRemoveVerifierKeyTx } from '@midnight-ntwrk/midnight-js-contracts';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { pureCircuits } from '@lixi/contract';
import {
  NETWORKS,
  addEnvelope,
  checkClaim,
  checkRefund,
  claimTx,
  createEnvelopeTx,
  deployLixi,
  deriveEnvelope,
  linksFor,
  lixiContract,
  newVault,
  privateStateOf,
  proveClaimTx,
  readLedger,
  refundTx,
  relinquishAuthority,
  type LixiProviders,
  type PersonalLink,
} from '@lixi/sdk';
import { nodeProviders } from '../src/providers.js';
import { HeadlessWallet } from '../src/wallet.js';
import { readWalletCache } from '../src/wallet-cache.js';
import {
  GENESIS_SEED,
  fundedWallet,
  randomSeed,
  nowSeconds,
  proofTimes,
  sleep,
  timeProofs,
  waitForNight,
} from './harness.js';

const config = NETWORKS.undeployed;
const NIGHT = 1_000_000n; // 1 tNIGHT in base units

describe.sequential('Lixi on the local devnet', () => {
  let sender: HeadlessWallet, alice: HeadlessWallet, bob: HeadlessWallet, carol: HeadlessWallet;
  let ps: LixiProviders;
  let address: string;
  let vault = newVault();
  const spec = { index: 0, total: 4n * NIGHT, count: 4, kind: 'personal', split: 'equal' } as const;
  const envelope = deriveEnvelope(vault.seed, spec);
  const links = linksFor(envelope) as PersonalLink[];
  let expiry: bigint;
  let senderNightBeforeCreate: bigint;

  beforeAll(async () => {
    setNetworkId('undeployed');
    sender = await HeadlessWallet.start(config, GENESIS_SEED);
    await sender.registerForDust();
    alice = await fundedWallet(config, sender, 1000n * NIGHT, true);
    bob = await fundedWallet(config, sender, 1000n * NIGHT, true);
    carol = await HeadlessWallet.start(config, randomSeed());
    ps = timeProofs(nodeProviders(config, sender), 'sender');
  });

  afterAll(async () => {
    console.table(proofTimes.map((p) => ({ ...p, seconds: p.seconds.toFixed(2) })));
    await Promise.all([sender, alice, bob, carol].filter(Boolean).map((w) => w.stop()));
  });

  it('deploys, then relinquishes the maintenance authority for good (H5)', async () => {
    address = await deployLixi(ps, { minDuration: 60n, maxDuration: 30n * 86400n });
    const oldKey = (await ps.privateStateProvider.getSigningKey(address))!;
    await relinquishAuthority(ps, address);

    const state = (await ps.publicDataProvider.queryContractState(address))!;
    expect(state.maintenanceAuthority.committee).toHaveLength(0);
    expect(state.maintenanceAuthority.threshold).toBe(1);
    await ps.privateStateProvider.setSigningKey(address, oldKey);
    await expect(submitRemoveVerifierKeyTx(ps, lixiContract, address, 'claim')).rejects.toThrow();
  });

  it('creates an envelope whose public state shows the deposit but not the split', async () => {
    expiry = BigInt(nowSeconds() + 240);
    vault = addEnvelope(vault, { ...spec, expiry, labels: [] });
    senderNightBeforeCreate = await sender.nightBalance();
    const { id } = await createEnvelopeTx(ps, address, privateStateOf(vault), {
      nonce: envelope.nonce,
      expiry,
      refundAddress: await sender.userAddress(),
      onePerAddress: false,
    });
    expect(id).toEqual(envelope.id);
    const onChain = (await readLedger(ps.publicDataProvider, address)).envelopes.lookup(id);
    expect(Object.keys(onChain).sort()).toEqual([
      'deposit',
      'expiry',
      'onePerAddress',
      'refundAddress',
      'refunded',
      'root',
    ]);
    expect(onChain.deposit).toBe(spec.total);
  });

  it('pays two concurrent claims from different wallets (S1)', async () => {
    const [aBefore, bBefore] = [await alice.nightBalance(), await bob.nightBalance()];
    const claimFor = async (wallet: HeadlessWallet, link: PersonalLink, label: string) =>
      claimTx(timeProofs(nodeProviders(config, wallet), label), address, {
        id: link.id,
        share: link.share,
        path: link.path,
        recipient: await wallet.userAddress(),
      });
    await Promise.all([claimFor(alice, links[0], 'alice'), claimFor(bob, links[1], 'bob')]);
    await waitForNight(alice, aBefore + NIGHT);
    await waitForNight(bob, bBefore + NIGHT);
  });

  it('refuses a reused link before any proof is made', async () => {
    const ledger = await readLedger(ps.publicDataProvider, address);
    expect(checkClaim(ledger, links[0], await carol.userAddress(), nowSeconds())).toEqual({
      ok: false,
      reason: 'already claimed',
    });
  });

  it('lets a sponsor pay the fee for a recipient with no NIGHT and no DUST (S5)', async () => {
    const pc = timeProofs(nodeProviders(config, carol), 'carol');
    const recipient = await carol.userAddress();
    expect((await carol.waitForFeeSync()).dust.balance(new Date())).toBe(0n);

    const proven = await proveClaimTx(pc, address, { ...links[2], recipient });
    const bound = await carol.balanceWithoutFees(proven); // recipient side: no DUST touched
    const txId = await sender.sponsor(toHex(bound.serialize())); // sponsor side, across a hex boundary
    await ps.publicDataProvider.watchForTxData(txId);
    await waitForNight(carol, NIGHT);
    const ledger = await readLedger(ps.publicDataProvider, address);
    expect(ledger.nullifiers.member(pureCircuits.nullifierOf(envelope.id, links[2].share.secret))).toBe(true);
  });

  it('refunds exactly the unclaimed remainder after expiry', async () => {
    const early = await readLedger(ps.publicDataProvider, address);
    expect(checkRefund(early, envelope.id, nowSeconds())).toEqual({ ok: false, reason: 'not expired' });
    while (nowSeconds() < Number(expiry) + 12) await sleep(5_000);

    await refundTx(ps, address, privateStateOf(vault), envelope.id);
    const ledger = await readLedger(ps.publicDataProvider, address);
    expect(ledger.envelopes.lookup(envelope.id).refunded).toBe(true);
    // Deposit 4, three claims paid out 3, so the refund returns the 1 unclaimed share.
    await waitForNight(sender, senderNightBeforeCreate - 3n * NIGHT);
  });

  it('restores a synced wallet from its cache file, so a later run skips the full sync', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'lixi-cache-')), 'genesis.json');
    const first = await HeadlessWallet.start(config, GENESIS_SEED, file);
    const balance = await first.nightBalance();
    await first.stop();
    expect(readWalletCache(file)).toBeDefined();

    const restored = await HeadlessWallet.start(config, GENESIS_SEED, file);
    expect(await restored.nightBalance()).toBe(balance);
    expect(restored.bech32Address()).toBe(first.bech32Address());
    await restored.stop();
  });
});

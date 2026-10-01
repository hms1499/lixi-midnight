import { Buffer } from 'node:buffer';
import {
  DustSecretKey,
  LedgerParameters,
  Transaction,
  type Binding,
  type Proof,
  type SignatureEnabled,
  ZswapSecretKeys,
  nativeToken,
  type FinalizedTransaction,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { MidnightProvider, UnboundTransaction, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { fromHex, ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import {
  DustWallet,
  HDWallet,
  NoOpTransactionHistoryStorage,
  PublicKey,
  Roles,
  ShieldedWallet,
  UnshieldedWallet,
  WalletFacade,
  createKeystore,
  type FacadeState,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk';
import type { NetworkConfig } from '@lixi/sdk';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import { describeSync, feeSyncReady, syncProgress } from './sync.js';
import { readWalletCache, writeWalletCache } from './wallet-cache.js';

// The wallet SDK's indexer client needs a global WebSocket in Node.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

/** A headless wallet for scripts and tests. Never log `seed`. */
export class HeadlessWallet implements WalletProvider, MidnightProvider {
  private saveTimer: ReturnType<typeof setInterval> | undefined;

  private constructor(
    readonly facade: WalletFacade,
    private readonly shieldedSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
    readonly keystore: UnshieldedKeystore,
    private readonly cacheFile: string | undefined,
  ) {}

  /**
   * Starts and syncs a wallet. With `cacheFile`, sync state is restored from it, saved every minute
   * and on `stop()`, so a later run only syncs what is new (a fresh Preprod sync takes hours).
   */
  static async start(
    config: NetworkConfig,
    seedHex: string,
    cacheFile?: string | ((bech32Address: string) => string),
  ): Promise<HeadlessWallet> {
    const hd = HDWallet.fromSeed(Buffer.from(seedHex, 'hex'));
    if (hd.type !== 'seedOk') throw new Error('invalid wallet seed');
    const derived = hd.hdWallet
      .selectAccount(0)
      .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
      .deriveKeysAt(0);
    if (derived.type !== 'keysDerived') throw new Error('key derivation failed');
    hd.hdWallet.clear();
    const keys = derived.keys;

    const shieldedSecretKeys = ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
    const dustSecretKey = DustSecretKey.fromSeed(keys[Roles.Dust]);
    const keystore = createKeystore(keys[Roles.NightExternal], config.networkId);
    const file = typeof cacheFile === 'function' ? cacheFile(keystore.getBech32Address().asString()) : cacheFile;
    const cached = file ? readWalletCache(file) : undefined;
    const indexerClientConnection = { indexerHttpUrl: config.indexer, indexerWsUrl: config.indexerWS };
    const facade = await WalletFacade.init({
      configuration: {
        networkId: config.networkId,
        indexerClientConnection,
        provingServerUrl: new URL(config.proofServer),
        relayURL: new URL(config.node.replace(/^http/, 'ws')),
        txHistoryStorage: new NoOpTransactionHistoryStorage(),
        costParameters: { additionalFeeOverhead: 1_000n, feeBlocksMargin: 5 },
      },
      shielded: (cfg) =>
        cached
          ? ShieldedWallet(cfg).restore(cached.shielded)
          : ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
      unshielded: (cfg) =>
        cached
          ? UnshieldedWallet(cfg).restore(cached.unshielded)
          : UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(keystore)),
      dust: (cfg) =>
        cached
          ? DustWallet(cfg).restore(cached.dust)
          : DustWallet(cfg).startWithSecretKey(dustSecretKey, LedgerParameters.initialParameters().dust),
    });
    await facade.start(shieldedSecretKeys, dustSecretKey);
    const wallet = new HeadlessWallet(facade, shieldedSecretKeys, dustSecretKey, keystore, file);
    if (file) wallet.saveTimer = setInterval(() => void wallet.saveState().catch(() => undefined), 60_000);
    return wallet;
  }

  /** Writes the current sync state to the cache file, if this wallet has one. */
  async saveState(): Promise<void> {
    if (!this.cacheFile) return;
    const [shielded, unshielded, dust] = await Promise.all([
      this.facade.shielded.serializeState(),
      this.facade.unshielded.serializeState(),
      this.facade.dust.serializeState(),
    ]);
    writeWalletCache(this.cacheFile, { shielded, unshielded, dust });
  }

  /** Unshielded address as the 32 bytes the contract's `UserAddress` expects. */
  async userAddress(): Promise<Uint8Array> {
    return new Uint8Array((await this.facade.unshielded.getAddress()).data);
  }

  bech32Address(): string {
    return this.keystore.getBech32Address().asString();
  }

  async nightBalance(): Promise<bigint> {
    const state = await this.waitForFeeSync();
    return state.unshielded.balances[nativeToken().raw] ?? 0n;
  }

  /**
   * Waits until the unshielded and DUST sub-wallets have synced, which is all Lixi needs, and logs
   * progress every 30 s. Shielded sync is not awaited: on Preprod it replays the whole chain history.
   */
  waitForFeeSync(timeoutMs = 60 * 60_000, log: (line: string) => void = console.log): Promise<FacadeState> {
    const progress = this.facade
      .state()
      .pipe(Rx.throttleTime(30_000))
      .subscribe((s) => {
        if (!feeSyncReady(s)) log(`sync: ${describeSync(syncProgress(s))}`);
      });
    return this.waitFor(feeSyncReady, timeoutMs, 'unshielded and DUST sync').finally(() => progress.unsubscribe());
  }

  getCoinPublicKey() {
    return this.shieldedSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey() {
    return this.shieldedSecretKeys.encryptionPublicKey;
  }

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    // Lixi never moves shielded tokens, so balancing never needs the (slow) shielded sync.
    const recipe = await this.facade.balanceUnboundTransaction(tx, this.secretKeys(), {
      ttl,
      tokenKindsToBalance: ['unshielded', 'dust'],
    });
    const signed = await this.facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    return this.facade.finalizeRecipe(signed);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.facade.submitTransaction(tx);
  }

  /** Fee sponsorship, user side: balance only unshielded value (no DUST), sign and bind. */
  async balanceWithoutFees(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.facade.balanceUnboundTransaction(tx, this.secretKeys(), {
      ttl,
      tokenKindsToBalance: ['unshielded'],
    });
    const signed = await this.facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    return this.facade.finalizeRecipe(signed);
  }

  /** Fee sponsorship, sponsor side: add a DUST fee offer to someone else's bound transaction. */
  async addDustFee(tx: FinalizedTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.facade.balanceFinalizedTransaction(tx, this.secretKeys(), {
      ttl,
      tokenKindsToBalance: ['dust'],
    });
    const signed = await this.facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    return this.facade.finalizeRecipe(signed);
  }

  /**
   * Fee sponsorship, sponsor side, across the network boundary: takes the hex of a transaction
   * the recipient already proved, balanced and bound, pays its DUST fee and submits it.
   */
  async sponsor(boundTxHex: string): Promise<string> {
    const tx: FinalizedTransaction = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
      'signature',
      'proof',
      'binding',
      fromHex(boundTxHex.trim()),
    );
    return this.submitTx(await this.addDustFee(tx));
  }

  /** Sends unshielded NIGHT to another wallet and returns the transaction id. */
  async sendNight(to: HeadlessWallet, amount: bigint): Promise<string> {
    const recipe = await this.facade.transferTransaction(
      [
        {
          type: 'unshielded',
          outputs: [{ type: nativeToken().raw, receiverAddress: await to.facade.unshielded.getAddress(), amount }],
        },
      ],
      this.secretKeys(),
      { ttl: ttlOneHour() },
    );
    const signed = await this.facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    return this.facade.submitTransaction(await this.facade.finalizeRecipe(signed));
  }

  /** Registers every unregistered NIGHT UTXO for DUST generation, then waits for a spendable DUST coin. */
  async registerForDust(timeoutMs = 180_000): Promise<void> {
    const state = await this.waitForFeeSync();
    const unregistered = state.unshielded.availableCoins.filter((c) => !c.meta.registeredForDustGeneration);
    if (unregistered.length > 0) {
      // The registration pays its own fee from DUST its NIGHT has generated, so wait for enough.
      const { fee } = await this.facade.estimateRegistration(unregistered);
      await this.facade.waitForGeneratedDust(unregistered, fee, { timeoutMs });
      const recipe = await this.facade.registerNightUtxosForDustGeneration(
        unregistered,
        this.keystore.getPublicKey(),
        (payload) => this.keystore.signData(payload),
      );
      await this.facade.submitTransaction(await this.facade.finalizeRecipe(recipe));
    }
    await this.waitFor((s) => s.dust.availableCoins.length > 0, timeoutMs, 'spendable DUST');
  }

  /** Resolves once the wallet state satisfies `predicate`. */
  waitFor(predicate: (s: FacadeState) => boolean, timeoutMs: number, label: string): Promise<FacadeState> {
    return Rx.firstValueFrom(
      this.facade.state().pipe(
        Rx.filter(predicate),
        Rx.timeout({
          first: timeoutMs,
          with: () => Rx.throwError(() => new Error(`timed out waiting for ${label}`)),
        }),
      ),
    );
  }

  async stop(): Promise<void> {
    clearInterval(this.saveTimer);
    await this.saveState().catch(() => undefined);
    await this.facade.stop();
  }

  private secretKeys() {
    return { shieldedSecretKeys: this.shieldedSecretKeys, dustSecretKey: this.dustSecretKey };
  }
}

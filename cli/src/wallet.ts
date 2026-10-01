import { Buffer } from 'node:buffer';
import {
  DustSecretKey,
  LedgerParameters,
  ZswapSecretKeys,
  nativeToken,
  type FinalizedTransaction,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { MidnightProvider, UnboundTransaction, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
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

// The wallet SDK's indexer client needs a global WebSocket in Node.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

/** A headless wallet for scripts and tests. Never log `seed`. */
export class HeadlessWallet implements WalletProvider, MidnightProvider {
  private constructor(
    readonly facade: WalletFacade,
    private readonly shieldedSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
    readonly keystore: UnshieldedKeystore,
  ) {}

  static async start(config: NetworkConfig, seedHex: string): Promise<HeadlessWallet> {
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
      shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(shieldedSecretKeys),
      unshielded: (cfg) => UnshieldedWallet(cfg).startWithPublicKey(PublicKey.fromKeyStore(keystore)),
      dust: (cfg) => DustWallet(cfg).startWithSecretKey(dustSecretKey, LedgerParameters.initialParameters().dust),
    });
    await facade.start(shieldedSecretKeys, dustSecretKey);
    return new HeadlessWallet(facade, shieldedSecretKeys, dustSecretKey, keystore);
  }

  /** Unshielded address as the 32 bytes the contract's `UserAddress` expects. */
  async userAddress(): Promise<Uint8Array> {
    return new Uint8Array((await this.facade.unshielded.getAddress()).data);
  }

  bech32Address(): string {
    return this.keystore.getBech32Address().asString();
  }

  async nightBalance(): Promise<bigint> {
    const state = await this.facade.waitForSyncedState();
    return state.unshielded.balances[nativeToken().raw] ?? 0n;
  }

  getCoinPublicKey() {
    return this.shieldedSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey() {
    return this.shieldedSecretKeys.encryptionPublicKey;
  }

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.facade.balanceUnboundTransaction(tx, this.secretKeys(), { ttl });
    const signed = await this.facade.signRecipe(recipe, (payload) => this.keystore.signData(payload));
    return this.facade.finalizeRecipe(signed);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.facade.submitTransaction(tx);
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
    const state = await this.facade.waitForSyncedState();
    const unregistered = state.unshielded.availableCoins.filter((c) => !c.meta.registeredForDustGeneration);
    if (unregistered.length > 0) {
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

  stop(): Promise<void> {
    return this.facade.stop();
  }

  private secretKeys() {
    return { shieldedSecretKeys: this.shieldedSecretKeys, dustSecretKey: this.dustSecretKey };
  }
}

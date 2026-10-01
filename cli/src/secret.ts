import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import type { NetworkName } from '@lixi/sdk';

/** The devnet genesis wallet: public, pre-funded, and only meaningful on `undeployed`. */
export const GENESIS_SEED = '0'.repeat(63) + '1';

/**
 * A wallet seed (hex) from either a 64-hex seed or a BIP39 recovery phrase as Lace and 1AM show it.
 * Phrases become their BIP39 seed (empty passphrase), the same input the wallet SDK's HD derivation takes.
 * Never log the input or the result.
 */
export const walletSeed = (secret: string): string => {
  const trimmed = secret.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  const phrase = trimmed.toLowerCase().split(/\s+/).join(' ');
  if (!validateMnemonic(phrase, wordlist)) throw new Error('not a 64-hex seed or a valid recovery phrase');
  return Buffer.from(mnemonicToSeedSync(phrase)).toString('hex');
};

/** The deployer's seed: `LIXI_DEPLOYER_MNEMONIC`, else `LIXI_DEPLOYER_SEED`, else the genesis seed on the devnet. */
export const deployerSeed = (network: NetworkName, env: Record<string, string | undefined> = process.env): string => {
  const secret = env.LIXI_DEPLOYER_MNEMONIC ?? env.LIXI_DEPLOYER_SEED;
  if (secret) return walletSeed(secret);
  if (network === 'undeployed') return GENESIS_SEED;
  throw new Error('set LIXI_DEPLOYER_MNEMONIC (recovery phrase) or LIXI_DEPLOYER_SEED (64 hex) in cli/.env');
};

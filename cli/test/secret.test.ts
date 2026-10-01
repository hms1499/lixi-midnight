import { describe, expect, it } from 'vitest';
import { GENESIS_SEED, deployerSeed, walletSeed } from '../src/secret.js';

// BIP39 reference vector (empty passphrase): PBKDF2-HMAC-SHA512(phrase, "mnemonic", 2048).
const PHRASE = `${'abandon '.repeat(11)}about`;
const PHRASE_SEED =
  '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4';
const HEX = 'ab'.repeat(32);

describe('walletSeed', () => {
  it('passes a 64-hex seed through, lower-cased', () => {
    expect(walletSeed(` ${HEX.toUpperCase()}\n`)).toBe(HEX);
  });

  it('turns a recovery phrase into its BIP39 seed, tolerating case and extra spaces', () => {
    expect(walletSeed(PHRASE)).toBe(PHRASE_SEED);
    expect(walletSeed(`  ${PHRASE.toUpperCase().replaceAll(' ', '   ')}\n`)).toBe(PHRASE_SEED);
  });

  it('rejects a phrase with a bad checksum without echoing it', () => {
    const bad = `${'abandon '.repeat(11)}abandon`;
    expect(() => walletSeed(bad)).toThrow('not a 64-hex seed or a valid recovery phrase');
    try {
      walletSeed(bad);
    } catch (e) {
      expect(String(e)).not.toContain('abandon');
    }
  });
});

describe('deployerSeed', () => {
  it('prefers the recovery phrase, then the hex seed', () => {
    expect(deployerSeed('preprod', { LIXI_DEPLOYER_MNEMONIC: PHRASE, LIXI_DEPLOYER_SEED: HEX })).toBe(PHRASE_SEED);
    expect(deployerSeed('preprod', { LIXI_DEPLOYER_SEED: HEX })).toBe(HEX);
  });

  it('always uses the public genesis seed on the devnet, even when a Preprod secret is set', () => {
    expect(deployerSeed('undeployed', {})).toBe(GENESIS_SEED);
    expect(deployerSeed('undeployed', { LIXI_DEPLOYER_MNEMONIC: PHRASE, LIXI_DEPLOYER_SEED: HEX })).toBe(GENESIS_SEED);
    expect(() => deployerSeed('preprod', {})).toThrow(/LIXI_DEPLOYER_MNEMONIC/);
  });
});

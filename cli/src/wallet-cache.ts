import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Serialized state of the three sub-wallets, as the wallet SDK's `serializeState()` returns it. */
export type WalletCache = { readonly shielded: string; readonly unshielded: string; readonly dust: string };

/**
 * One cache file per network and wallet, named from the public address. The contents can include
 * key material, so the file is owner-only and lives in a gitignored directory.
 */
export const cacheFileFor = (dir: string, network: string, bech32Address: string): string => {
  const data = bech32Address.slice(bech32Address.lastIndexOf('1') + 1);
  return join(dir, `${network}-${data.slice(0, 24)}.json`);
};

export const readWalletCache = (file: string): WalletCache | undefined => {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<WalletCache>;
    const ok = [raw.shielded, raw.unshielded, raw.dust].every((s) => typeof s === 'string');
    return ok ? (raw as WalletCache) : undefined;
  } catch {
    return undefined;
  }
};

/** Writes atomically (temp file, then rename), so a crash mid-write never leaves a torn cache. */
export const writeWalletCache = (file: string, cache: WalletCache): void => {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(cache), { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
};

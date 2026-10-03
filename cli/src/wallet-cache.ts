import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Serialized state of the three sub-wallets, as the wallet SDK's `serializeState()` returns it. */
export type WalletCache = { readonly shielded: string; readonly unshielded: string; readonly dust: string };

/**
 * One cache file per network, indexer and wallet. Sync cursors are the indexer's own event ids, so a
 * cache written against one indexer replays the wrong events on another (midnight-wallet#781). The
 * name holds the indexer's host, never its URL, which carries the Blockfrost project id. The rest of
 * the name comes from the public address. The contents can include key material, so the file is
 * owner-only and lives in a gitignored directory.
 */
export const cacheFileFor = (dir: string, network: string, indexerUrl: string, bech32Address: string): string => {
  const data = bech32Address.slice(bech32Address.lastIndexOf('1') + 1);
  return join(dir, `${network}-${new URL(indexerUrl).host}-${data.slice(0, 24)}.json`);
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

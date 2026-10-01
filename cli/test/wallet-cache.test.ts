import { mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cacheFileFor, readWalletCache, writeWalletCache } from '../src/wallet-cache.js';

const dir = () => mkdtempSync(join(tmpdir(), 'lixi-cache-'));
const STATE = { shielded: 's', unshielded: 'u', dust: 'd' };

describe('wallet sync cache', () => {
  it('names the file by network and address, never by secret', () => {
    expect(cacheFileFor('/c', 'preprod', 'mn_addr_preprod1mx4lng3nm3wkn0jejmevfsywzf2xd5')).toBe(
      '/c/preprod-mx4lng3nm3wkn0jejmevfsyw.json',
    );
  });

  it('round-trips the three serialized sub-wallet states in an owner-only file', () => {
    const file = join(dir(), 'nested', 'w.json');
    writeWalletCache(file, STATE);
    expect(readWalletCache(file)).toEqual(STATE);
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('treats a missing or unreadable cache as no cache', () => {
    const d = dir();
    expect(readWalletCache(join(d, 'none.json'))).toBeUndefined();
    writeWalletCache(join(d, 'bad.json'), { shielded: 's' } as never);
    expect(readWalletCache(join(d, 'bad.json'))).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { txUrl } from '../src/lib/links';

describe('txUrl', () => {
  it('links a hash on the Preprod explorer, with or without 0x', () => {
    expect(txUrl('ab12')).toBe('https://preprod.midnightexplorer.com/transactions/0xab12');
    expect(txUrl('0xab12')).toBe('https://preprod.midnightexplorer.com/transactions/0xab12');
  });
});

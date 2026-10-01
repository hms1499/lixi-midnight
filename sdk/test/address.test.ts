import { describe, expect, it } from 'vitest';
import { toHex } from '@lixi/contract';
import { userAddressBytes } from '../src/address.js';

// Generated with the wallet SDK: createKeystore(secret, 'undeployed').getBech32Address() and .getAddress().
const BECH32 = 'mn_addr_undeployed1c5c054q33elswjfesnhcccjcsrvckauhdv9fv5wfze0v42nkdfzskcza5a';
const HEX = 'c530fa54118e7f07493984ef8c625880d98b77976b0a9651c9165ecaaa766a45';

describe('userAddressBytes', () => {
  it('decodes an unshielded address to the 32 contract bytes', () => {
    expect(toHex(userAddressBytes(BECH32, 'undeployed'))).toBe(HEX);
    expect(toHex(userAddressBytes(`  ${BECH32}\n`, 'undeployed'))).toBe(HEX);
  });

  it('rejects an address from another network', () => {
    expect(() => userAddressBytes(BECH32, 'preprod')).toThrow(/preprod/);
  });

  it('rejects text that is not an address', () => {
    expect(() => userAddressBytes('mn_addr_undeployed1nope', 'undeployed')).toThrow();
  });
});

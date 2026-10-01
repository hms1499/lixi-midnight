import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';

/**
 * The 32 bytes the contract's `UserAddress` expects, from a wallet's Bech32m unshielded address
 * (`mn_addr_<network>1…`). Throws on another network's address or any other address type.
 */
export const userAddressBytes = (bech32: string, networkId: string): Uint8Array =>
  new Uint8Array(MidnightBech32m.parse(bech32.trim()).decode(UnshieldedAddress, networkId).data);

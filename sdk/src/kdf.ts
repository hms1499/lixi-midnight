import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { bigintToBytes } from './bytes.js';

const u32 = (n: number): Uint8Array => {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new Error(`label out of range: ${n}`);
  return bigintToBytes(BigInt(n), 4);
};

/** HMAC-SHA256(key, "lixi/v1" ‖ len‖label …). Every secret Lixi uses is derived through this. */
export const kdf = (key: Uint8Array, ...labels: (string | number)[]): Uint8Array => {
  const parts: Uint8Array[] = [utf8ToBytes('lixi/v1')];
  for (const label of labels) {
    const bytes = typeof label === 'number' ? u32(label) : utf8ToBytes(label);
    parts.push(u32(bytes.length), bytes);
  }
  return hmac(sha256, key, concatBytes(...parts));
};

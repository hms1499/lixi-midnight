export const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const fromBase64Url = (text: string): Uint8Array => {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('invalid base64url');
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

/** Big-endian fixed-width encoding of a non-negative bigint. */
export const bigintToBytes = (value: bigint, width: number): Uint8Array => {
  if (value < 0n || value >= 1n << BigInt(8 * width)) throw new Error(`value does not fit in ${width} bytes`);
  const out = new Uint8Array(width);
  for (let i = width - 1, v = value; i >= 0; i--, v >>= 8n) out[i] = Number(v & 0xffn);
  return out;
};

export const bytesToBigint = (bytes: Uint8Array): bigint =>
  bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);

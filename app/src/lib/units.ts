/** tNIGHT has 6 decimals: 1 tNIGHT = 1,000,000 base units. */
export const NIGHT_DECIMALS = 6;
const SCALE = 10n ** BigInt(NIGHT_DECIMALS);

/** Parses a user-typed tNIGHT amount ("1.5") into base units. Throws 'invalid amount'. */
export const parseNight = (text: string): bigint => {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim());
  if (!m) throw new Error('invalid amount');
  return BigInt(m[1]) * SCALE + BigInt((m[2] ?? '').padEnd(NIGHT_DECIMALS, '0'));
};

/** Formats base units as tNIGHT without trailing zeros: 1500000n → "1.5". */
export const formatNight = (units: bigint): string => {
  const whole = units / SCALE;
  const frac = (units % SCALE).toString().padStart(NIGHT_DECIMALS, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
};

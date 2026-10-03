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

/** Groups a whole number's thousands: 4996n → "4,996". */
const grouped = (whole: bigint): string => whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A wallet's tNIGHT for display, with thousands grouped: 4996000000n → "4,996". */
export const formatBalanceNight = (units: bigint): string => {
  const [whole, frac] = formatNight(units).split('.');
  return frac ? `${grouped(BigInt(whole))}.${frac}` : grouped(BigInt(whole));
};

/** 1 DUST = 10^15 SPECK, the unit wallets report DUST in. */
const SPECK_PER_DUST = 10n ** 15n;

/** A wallet's DUST in whole units for display, "<1" for a sliver: 5430130207768000000n → "5,430". */
export const formatBalanceDust = (specks: bigint): string =>
  specks > 0n && specks < SPECK_PER_DUST ? '<1' : grouped(specks / SPECK_PER_DUST);

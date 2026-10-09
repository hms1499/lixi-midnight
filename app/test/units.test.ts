import { describe, expect, it } from 'vitest';
import { formatBalanceDust, formatBalanceNight, formatFixed, formatNight, parseNight } from '../src/lib/units';
import { formatRelative } from '../src/lib/time';

describe('tNIGHT units', () => {
  it('parses whole and fractional amounts into base units', () => {
    expect(parseNight('2')).toBe(2_000_000n);
    expect(parseNight(' 1.5 ')).toBe(1_500_000n);
    expect(parseNight('0.000001')).toBe(1n);
  });

  it('rejects anything that is not a plain non-negative decimal with at most 6 places', () => {
    for (const bad of ['', '-1', '1.2345678', '1,5', 'abc', '1e3', '.5']) {
      expect(() => parseNight(bad), bad).toThrow('invalid amount');
    }
  });

  it('formats base units without trailing zeros', () => {
    expect(formatNight(2_000_000n)).toBe('2');
    expect(formatNight(1_059_505n)).toBe('1.059505');
    expect(formatNight(1n)).toBe('0.000001');
    expect(formatNight(parseNight('12.34'))).toBe('12.34');
  });

  it('formats with a fixed number of decimals, for amounts that count up without changing width', () => {
    expect(formatFixed(1_277_978n, 6)).toBe('1.277978');
    expect(formatFixed(638_989n, 6)).toBe('0.638989');
    expect(formatFixed(1n, 6)).toBe('0.000001');
    expect(formatFixed(12_345_123_456n, 6)).toBe('12345.123456');
    expect(formatFixed(1_500_000n, 1)).toBe('1.5');
    expect(formatFixed(750_000n, 1)).toBe('0.7');
    expect(formatFixed(2_000_000n, 0)).toBe('2');
  });
});

describe('wallet balances', () => {
  it('shows tNIGHT with thousands grouped and no trailing zeros', () => {
    expect(formatBalanceNight(4_996_000_000n)).toBe('4,996');
    expect(formatBalanceNight(1_500_000n)).toBe('1.5');
    expect(formatBalanceNight(12_345_678_900_000n)).toBe('12,345,678.9');
    expect(formatBalanceNight(0n)).toBe('0');
  });

  it('shows DUST in whole units grouped, and a sliver below one DUST as <1 (1 DUST = 10^15 SPECK)', () => {
    expect(formatBalanceDust(5_430_130_207_768_000_000n)).toBe('5,430');
    expect(formatBalanceDust(10n ** 15n)).toBe('1');
    expect(formatBalanceDust(5n)).toBe('<1');
    expect(formatBalanceDust(0n)).toBe('0');
  });
});

describe('formatRelative', () => {
  it('is coarse and says which way', () => {
    expect(formatRelative(90)).toBe('in 1 min');
    expect(formatRelative(2 * 3600 + 300)).toBe('in 2 h 5 min');
    expect(formatRelative(-3 * 86400)).toBe('3 days ago');
  });
});

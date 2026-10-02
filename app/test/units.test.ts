import { describe, expect, it } from 'vitest';
import { formatNight, parseNight } from '../src/lib/units';
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
});

describe('formatRelative', () => {
  it('is coarse and says which way', () => {
    expect(formatRelative(90)).toBe('in 1 min');
    expect(formatRelative(2 * 3600 + 300)).toBe('in 2 h 5 min');
    expect(formatRelative(-3 * 86400)).toBe('3 days ago');
  });
});

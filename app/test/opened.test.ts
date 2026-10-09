import { describe, expect, it } from 'vitest';
import { mayBeEqualSplit, sizeFor } from '../src/components/Opened';

describe('the opened lì xì', () => {
  it('sizes the amount so even 12 or more characters fit the ~105 px slip', () => {
    expect(sizeFor('1')).toBe('text-3xl');
    expect(sizeFor('1.25')).toBe('text-3xl');
    expect(sizeFor('1.27797')).toBe('text-xl');
    expect(sizeFor('10.277978')).toBe('text-base');
    expect(sizeFor('9999.999999')).toBe('text-sm');
    expect(sizeFor('12345.123456')).toBe('text-xs');
    expect(sizeFor('999999.999999')).toBe('text-xs');
  });

  it('flags an amount an equal split of the public total could have produced', () => {
    expect(mayBeEqualSplit(1_000_000n, 2_000_000n)).toBe(true); // 2 × 1
    expect(mayBeEqualSplit(3_333_333n, 10_000_000n)).toBe(true); // 3 × 3.333333 (+1 unit)
    expect(mayBeEqualSplit(3_333_334n, 10_000_000n)).toBe(true);
    expect(mayBeEqualSplit(625_000n, 10_000_000n)).toBe(true); // 16 × 0.625
    expect(mayBeEqualSplit(1_277_978n, 10_000_000n)).toBe(false);
    expect(mayBeEqualSplit(10_000_000n, 10_000_000n)).toBe(true); // a single lì xì
  });
});

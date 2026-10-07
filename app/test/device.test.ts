import { describe, expect, it } from 'vitest';
import { isMobile } from '../src/lib/device';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('isMobile', () => {
  it('is false for desktop Chrome', () => {
    expect(isMobile({ userAgent: CHROME_MAC, maxTouchPoints: 0 })).toBe(false);
    expect(isMobile({ userAgent: CHROME_MAC, userAgentData: { mobile: false } })).toBe(false);
  });

  it('is true for Android and iPhone', () => {
    expect(
      isMobile({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
      }),
    ).toBe(true);
    expect(
      isMobile({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      }),
    ).toBe(true);
  });

  it('is true when the browser says it is mobile', () => {
    expect(isMobile({ userAgent: 'x', userAgentData: { mobile: true } })).toBe(true);
  });

  it('is true for an iPad that reports a Mac user agent', () => {
    expect(
      isMobile({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });
});

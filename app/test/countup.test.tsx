// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCountUp } from '../src/lib/countup';

afterEach(() => vi.unstubAllGlobals());

describe('useCountUp', () => {
  it('shows the final amount at once without matchMedia, or with reduced motion', () => {
    expect(renderHook(() => useCountUp(1_277_978n)).result.current).toBe(1_277_978n);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(renderHook(() => useCountUp(5n)).result.current).toBe(5n);
  });

  it('counts from 0 to the amount, easing out, and lands exactly on it', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const { result } = renderHook(() => useCountUp(1_000_000n, 900, 0));
    expect(result.current).toBe(0n);
    const t0 = performance.now();
    act(() => frames.shift()!(t0 + 450));
    expect(result.current > 500_000n && result.current < 1_000_000n).toBe(true);
    act(() => frames.shift()!(t0 + 900));
    expect(result.current).toBe(1_000_000n);
  });
});

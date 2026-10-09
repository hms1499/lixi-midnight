// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOpenedNews } from '../src/components/Toasts';
import type { EnvelopeView } from '../src/lib/status';

const view = (idHex: string, opened: boolean, amount: bigint) =>
  ({ idHex, state: 'open', shares: [{ amount, opened }] }) as unknown as EnvelopeView;
/** Five envelopes, newest first, holding 5, 4, 3, 2 and 1 tNIGHT. */
const read = (opened: boolean) => [5, 4, 3, 2, 1].map((n) => view(`e${n}`, opened, BigInt(n) * 1_000_000n));

describe('useOpenedNews', () => {
  it('keeps the newest envelopes’ news when more than three open in one read', () => {
    let views: EnvelopeView[] = read(false);
    const { result, rerender } = renderHook(() => useOpenedNews(views));
    views = read(true);
    act(() => rerender());
    expect(result.current.toasts.map((t) => t.text)).toEqual([
      'A lì xì was just opened: 5 tNIGHT.',
      'A lì xì was just opened: 4 tNIGHT.',
      'A lì xì was just opened: 3 tNIGHT.',
    ]);
  });

  it('drops older toasts before new ones', () => {
    let views: EnvelopeView[] = read(false);
    const { result, rerender } = renderHook(() => useOpenedNews(views));
    views = [view('e5', true, 5_000_000n), ...read(false).slice(1)];
    act(() => rerender());
    views = read(true);
    act(() => rerender());
    expect(result.current.toasts.map((t) => t.text)).toEqual([
      'A lì xì was just opened: 4 tNIGHT.',
      'A lì xì was just opened: 3 tNIGHT.',
      'A lì xì was just opened: 2 tNIGHT.',
    ]);
  });
});

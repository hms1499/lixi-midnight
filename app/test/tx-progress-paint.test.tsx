// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useLayoutEffect, type ReactNode } from 'react';
import type { TxStage } from '../src/chain/port';
import { TxProgress } from '../src/components/TxProgress';

afterEach(cleanup);

/** Records what the DOM shows at layout time: what the browser paints before passive effects run. */
const Painted = ({ children, log }: { children: ReactNode; log: (dom: HTMLElement) => void }) => {
  useLayoutEffect(() => {
    log(document.body);
  });
  return <>{children}</>;
};

describe('TxProgress, as first painted', () => {
  it('never paints the previous stage’s seconds on the next stage', async () => {
    vi.useFakeTimers();
    try {
      const painted: string[] = [];
      const log = (dom: HTMLElement) => painted.push(dom.querySelector('[data-state="now"]')!.textContent ?? '');
      const view = (stage: TxStage) => (
        <Painted log={log}>
          <TxProgress stage={stage} prover="wallet" />
        </Painted>
      );
      const { rerender } = render(view('proving'));
      await act(() => vi.advanceTimersByTimeAsync(3000));
      painted.length = 0;
      rerender(view('confirm'));
      expect(painted[0]).toMatch(/0 s$/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('inserts its live region empty and fills it after, so the first stage is announced', () => {
    const painted: string[] = [];
    render(
      <Painted log={(dom) => painted.push(dom.querySelector('[role="status"]')!.textContent ?? '')}>
        <TxProgress prover="wallet" />
      </Painted>,
    );
    expect(painted[0]).toBe('');
    expect(document.querySelector('[role="status"]')!.textContent).toBe('Making the zero-knowledge proof');
  });
});

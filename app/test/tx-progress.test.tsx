// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { TxProgress } from '../src/components/TxProgress';

afterEach(cleanup);

const states = () =>
  within(screen.getByRole('list', { name: 'Transaction progress' }))
    .getAllByRole('listitem')
    .map((li) => li.dataset.state);

describe('TxProgress', () => {
  it('ticks finished rows, marks the current one, dims the rest, and announces only the current stage', () => {
    render(<TxProgress stage="sending" prover="wallet" />);
    expect(states()).toEqual(['done', 'done', 'now', 'later']);
    expect(screen.getByText('In 1AM')).toBeTruthy();
    expect(screen.getByText('1AM pays the fee.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Sending to Midnight');
  });

  it('starts at the proof before the first stage arrives, and says where the proof is made', () => {
    render(<TxProgress prover="local" />);
    expect(states()).toEqual(['now', 'later', 'later', 'later']);
    expect(screen.getByText('On this computer')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Making the zero-knowledge proof');
  });

  it('counts the seconds of the current stage, and starts again at the next', async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<TxProgress stage="proving" prover="wallet" />);
      await act(() => vi.advanceTimersByTimeAsync(3000));
      expect(screen.getByText('3 s')).toBeTruthy();
      rerender(<TxProgress stage="confirm" prover="wallet" />);
      expect(screen.getByText('0 s')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

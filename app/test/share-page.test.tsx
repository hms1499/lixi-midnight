// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toHex } from '@lixi/contract';
import { claimUrl } from '@lixi/sdk';
import { claimWithLink } from '../src/flows/claim';
import { GREETING_KEY } from '../src/lib/greeting';
import { SHARE_REFRESH_MS } from '../src/pages/Share';
import { ORIGIN, setup } from './app-harness';
import { rnd } from './helpers';

afterEach(cleanup);

describe('share page', () => {
  it('copies a message with the greeting, the expiry and the link alone on the last line', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    const [first] = await create();
    show(`/share/${toHex(first.id)}`);
    await user.click(await screen.findByRole('button', { name: 'Copy message: Lì xì 1' }));
    const lines = (await navigator.clipboard.readText()).split('\n');
    expect(lines[0]).toBe('Chúc mừng năm mới!');
    expect(lines[1]).toMatch(/^A lì xì for you on Lixi\. Open it before .+:$/);
    expect(lines[2]).toBe(claimUrl(ORIGIN, first));
    expect(screen.getByRole('button', { name: 'Copy link: Lì xì 1' })).toBeTruthy();
  });

  it('remembers an edited greeting, and drops the line when it is empty', async () => {
    const user = userEvent.setup();
    const { show, create, storage } = setup();
    const [first] = await create();
    show(`/share/${toHex(first.id)}`);
    const field = await screen.findByLabelText('Greeting');
    await user.clear(field);
    await user.type(field, 'Happy birthday!');
    expect(storage.getItem(GREETING_KEY)).toBe('Happy birthday!');
    await user.click(screen.getByRole('button', { name: 'Copy message: Lì xì 1' }));
    expect((await navigator.clipboard.readText()).split('\n')[0]).toBe('Happy birthday!');
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: 'Copied: Lì xì 1' }));
    expect((await navigator.clipboard.readText()).split('\n')[0]).toMatch(/^A lì xì for you on Lixi/);
  });

  it('marks a lì xì opened while the page is open: its light goes out, its copy buttons go, and a toast says so', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { show, create, chain, sim } = setup();
      const [first] = await create();
      show(`/share/${toHex(first.id)}`);
      const row = (await screen.findByRole('button', { name: 'Copy message: Lì xì 1' })).closest('li')!;
      expect(screen.getByRole('button', { name: 'Copy all 2 links' })).toBeTruthy();
      await claimWithLink(chain, first, rnd(), () => sim.now);
      await act(() => vi.advanceTimersByTimeAsync(SHARE_REFRESH_MS));
      await screen.findByText('1 tNIGHT · opened');
      expect((row.querySelector('.light') as HTMLElement).dataset.state).toBe('out');
      expect(screen.queryByRole('button', { name: 'Copy message: Lì xì 1' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Copy link: Lì xì 1' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Copy message: Lì xì 2' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^Copy all/ })).toBeNull(); // one link left
      await screen.findByText('A lì xì was just opened: 1 tNIGHT.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows links opened before the page loaded as opened, without a toast, and copies only the unopened', async () => {
    const { show, create, chain, sim } = setup();
    const [first] = await create({ count: 3, total: 3_000_000n });
    await claimWithLink(chain, first, rnd(), () => sim.now);
    show(`/share/${toHex(first.id)}`);
    await screen.findByText('1 tNIGHT · opened');
    expect(screen.getByRole('button', { name: 'Copy all 2 unopened links' })).toBeTruthy();
    expect(screen.queryByText(/just opened/)).toBeNull();
  });

  it('counts the openings of a group link, and stops offering it once all are opened', async () => {
    const { show, create, chain, sim } = setup();
    const [group] = await create({ kind: 'group', count: 2, total: 2_000_000n });
    await claimWithLink(chain, group, rnd(), () => sim.now);
    show(`/share/${toHex(group.id)}`);
    await screen.findByText('1 of 2 opened');
    expect(screen.getByRole('button', { name: /^Copy message: One link for 2 people/ })).toBeTruthy();
    cleanup();
    await claimWithLink(chain, group, rnd(), () => sim.now);
    show(`/share/${toHex(group.id)}`);
    await screen.findByText('2 of 2 opened');
    expect(screen.queryByRole('button', { name: /^Copy message/ })).toBeNull();
  });
});

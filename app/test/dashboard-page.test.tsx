// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { backupString, newVault, userAddressBytes } from '@lixi/sdk';
import { refundEnvelope } from '../src/flows/manage';
import { VAULT_KEY } from '../src/lib/storage';
import { REFRESH_MS } from '../src/pages/Dashboard';
import { ADDRESS, setup } from './app-harness';
import { HOUR, T0, rnd } from './helpers';

afterEach(cleanup);

describe('my envelopes', () => {
  it('shows each lì xì as a light, and brings the unopened rest home after expiry', async () => {
    const user = userEvent.setup();
    const { sim, show, create, chain } = setup();
    const [first] = await create();
    if (first.kind !== 'personal') throw new Error('expected a personal link');
    await chain.claim({ ...first, recipient: rnd() });
    sim.now = T0 + 2 * HOUR;
    show('/dashboard');
    await screen.findByText(/1 opened; 1 can come home/);
    expect(screen.getByRole('img', { name: 'Lì xì 1: 1 tNIGHT, opened' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Lì xì 2: 1 tNIGHT, coming home' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Connect a wallet to bring it home' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Bring 1 tNIGHT home' }));
    await screen.findByText('Came home: 1 tNIGHT.');
  });

  it('says the envelopes belong to this browser, not to the connected wallet', async () => {
    const { show, create } = setup();
    await create();
    show('/dashboard');
    await screen.findByText(
      'Sealed in this browser, whichever wallet is connected. Lì xì you opened are in your wallet, not here.',
    );
  });

  it('tells another wallet that what comes home goes to the wallet that sealed it', async () => {
    const user = userEvent.setup();
    const { sim, show, create } = setup();
    await create(); // sealed by some other wallet
    sim.now = T0 + 2 * HOUR;
    show('/dashboard');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await screen.findByRole('button', { name: 'Bring 2 tNIGHT home' });
    screen.getByText('It comes home to the wallet that sealed it, not to Test Wallet. Test Wallet only pays the fee.');
  });

  it('says nothing more when the wallet that sealed it is connected', async () => {
    const user = userEvent.setup();
    const { sim, show, create } = setup();
    await create({}, userAddressBytes(ADDRESS, 'undeployed'));
    sim.now = T0 + 2 * HOUR;
    show('/dashboard');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await screen.findByRole('button', { name: 'Bring 2 tNIGHT home' });
    expect(screen.queryByText(/comes home to the wallet that sealed it/)).toBeNull();
  });

  it('reads the chain again by itself, and a light goes out in place when its lì xì is opened', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { show, create, chain } = setup();
      const [first] = await create();
      if (first.kind !== 'personal') throw new Error('expected a personal link');
      show('/dashboard');
      const light = await screen.findByRole('img', { name: 'Lì xì 1: 1 tNIGHT, waiting' });
      await chain.claim({ ...first, recipient: rnd() });
      await act(() => vi.advanceTimersByTimeAsync(REFRESH_MS));
      expect(await screen.findByRole('img', { name: 'Lì xì 1: 1 tNIGHT, opened' })).toBe(light);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says in words why an envelope cannot come home', async () => {
    const user = userEvent.setup();
    const { sim, show, create, chain, store } = setup();
    await create();
    sim.now = T0 + 2 * HOUR;
    show('/dashboard');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    const bring = await screen.findByRole('button', { name: 'Bring 2 tNIGHT home' });
    await refundEnvelope(chain, store.load()!, 0, sim.now); // another tab got there first
    await user.click(bring);
    await screen.findByText('It already came home.');
  });

  it('the List view says the same thing as text', async () => {
    const user = userEvent.setup();
    const { show, create, storage } = setup();
    await create();
    show('/dashboard');
    await screen.findByText(/0 opened. Comes home in/);
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.queryAllByRole('img', { name: /^Lì xì/ })).toHaveLength(0);
    expect(screen.getByText('Lì xì 1: 1 tNIGHT, waiting. Lì xì 2: 1 tNIGHT, waiting.')).toBeTruthy();
    expect(storage.getItem('lixi.dashboard.view')).toBe('list');
  });

  it('never overwrites an unreadable vault, and restores from the backup string', async () => {
    const user = userEvent.setup();
    const { storage, show, create, store } = setup();
    await create();
    const backup = backupString(store.load()!);
    storage.setItem(VAULT_KEY, 'garbage');
    show('/dashboard');
    await screen.findByText(/cannot be read/);
    expect(storage.getItem(VAULT_KEY)).toBe('garbage');
    await user.type(screen.getByLabelText('Restore from a backup string'), backup);
    await user.click(screen.getByRole('button', { name: 'Restore envelopes' }));
    await screen.findByText('Restored 1 envelope(s).');
    await screen.findByText(/0 opened. Comes home in/);
  });

  it('a backup from another browser does not silently replace this one', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    await create();
    show('/dashboard');
    await screen.findByText(/0 opened/);
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    await user.type(screen.getByLabelText('Restore from a backup string'), backupString(newVault()));
    await user.click(screen.getByRole('button', { name: 'Restore envelopes' }));
    await screen.findByText(/different backup string/);
  });
});

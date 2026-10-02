// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { backupString, newVault } from '@lixi/sdk';
import { VAULT_KEY } from '../src/lib/storage';
import { setup } from './app-harness';
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

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { backupString, deriveEnvelope } from '@lixi/sdk';
import { toHex, type Ledger } from '@lixi/contract';
import { formatNight } from '../src/lib/units';
import { SHARE_POLL_MS, SHARE_SLOW_MS } from '../src/pages/Share';
import { VAULT_KEY } from '../src/lib/storage';
import { ORIGIN, fakeWallet, setup } from './app-harness';

afterEach(cleanup);

describe('create and share', () => {
  it('shows the form at once, asks for the backup at the first Seal, then lists one link per lì xì', async () => {
    const user = userEvent.setup();
    const { show, store } = setup();
    show('/create');
    const total = await screen.findByLabelText('Total tNIGHT');
    expect(screen.queryByRole('heading', { name: 'Keep your backup string' })).toBeNull();
    await user.clear(total);
    await user.type(total, '3');
    const count = screen.getByLabelText('Number of lì xì');
    await user.clear(count);
    await user.type(count, '3');
    await user.selectOptions(screen.getByLabelText('Amounts'), 'equal');
    await user.click(screen.getByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 3 lì xì' }));

    await screen.findByRole('heading', { name: 'Keep your backup string' });
    expect((screen.getByLabelText('Backup string') as HTMLInputElement).value).toBe(backupString(store.load()!));
    expect(store.load()!.envelopes).toHaveLength(0);
    expect((screen.getByRole('button', { name: 'Saved, seal 3 lì xì' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Saved, seal 3 lì xì' }));

    await screen.findByRole('heading', { name: '3 lì xì, ready to hand out' });
    expect(store.backedUp()).toBe(true);
    expect(screen.getAllByText('1 tNIGHT')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Copy link: Lì xì 2' }));
    expect(await navigator.clipboard.readText()).toMatch(new RegExp(`^${ORIGIN}/c#v1\\.`));
    expect(screen.getByRole('button', { name: 'Copied: Lì xì 2' })).toBeTruthy();
  });

  it('Back leaves the backup step, and a later seal skips it', async () => {
    const user = userEvent.setup();
    const { show } = setup();
    show('/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 4 lì xì' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Seal 4 lì xì' }));
    await user.click(await screen.findByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Saved, seal 4 lì xì' }));
    await screen.findByRole('heading', { name: '4 lì xì, ready to hand out' });
    cleanup();
    show('/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 4 lì xì' }));
    await screen.findByRole('heading', { name: '4 lì xì, ready to hand out' });
  });

  it('keeps the backup done when the wallet declines the first seal (Review Focus 2)', async () => {
    const user = userEvent.setup();
    const { show, chain, store } = setup();
    const realCreate = chain.create;
    chain.create = async () => {
      chain.create = realCreate;
      throw new Error('Rejected');
    };
    show('/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 4 lì xì' }));
    await user.click(await screen.findByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Saved, seal 4 lì xì' }));
    await screen.findByText(/^Rejected/);
    expect(store.backedUp()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Seal 4 lì xì' }));
    await screen.findByRole('heading', { name: '4 lì xì, ready to hand out' });
  });

  it('warns before sealing when the wallet shows less tNIGHT than the envelope, without blocking', async () => {
    const user = userEvent.setup();
    const wallet = fakeWallet({ name: '1AM', balances: () => ({ night: 2_500_000n, dust: 10n ** 15n }) });
    const { show } = setup({ detectWallets: () => [wallet] });
    show('/create');
    const total = await screen.findByLabelText('Total tNIGHT');
    await user.clear(total);
    await user.type(total, '3');
    const count = screen.getByLabelText('Number of lì xì');
    await user.clear(count);
    await user.type(count, '3');
    await user.click(screen.getByRole('button', { name: 'Connect 1AM' }));
    await screen.findByText('Your wallet shows 2.5 tNIGHT, less than the 3 tNIGHT this envelope needs.');
    expect((screen.getByRole('button', { name: 'Seal 3 lì xì' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('previews the lucky amounts it will seal, and they add up to the total', async () => {
    const user = userEvent.setup();
    const { show, store } = setup();
    store.save({ seed: new Uint8Array(32).fill(7), envelopes: [] });
    store.setBackedUp(true);
    show('/create');
    const total = await screen.findByLabelText('Total tNIGHT');
    await user.clear(total);
    await user.type(total, '10');
    const field = await screen.findByRole('img', { name: '4 lì xì' });
    const shown = Array.from(field.querySelectorAll('span.block')).map((s) => s.textContent);
    const expected = deriveEnvelope(store.load()!.seed, {
      index: 0,
      total: 10_000_000n,
      count: 4,
      kind: 'personal',
      split: 'random',
    })
      .shares.slice(0, 4)
      .map((s) => s.amount);
    expect(expected.reduce((a, b) => a + b, 0n)).toBe(10_000_000n);
    expect(shown).toEqual(expected.map(formatNight));
  });

  it('after a failed seal, previews the next free index and seals exactly that', async () => {
    const user = userEvent.setup();
    const { show, store, chain } = setup();
    const seed = new Uint8Array(32).fill(7);
    store.save({ seed, envelopes: [] });
    store.setBackedUp(true);
    const realCreate = chain.create;
    chain.create = async () => {
      chain.create = realCreate;
      throw new Error('Rejected');
    };
    const amountsAt = (index: number) =>
      deriveEnvelope(seed, { index, total: 10_000_000n, count: 4, kind: 'personal', split: 'random' })
        .shares.slice(0, 4)
        .map((s) => formatNight(s.amount));
    const shown = () =>
      Array.from(screen.getByRole('img', { name: '4 lì xì' }).querySelectorAll('span.block')).map((s) => s.textContent);
    show('/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 4 lì xì' }));
    await screen.findByText(/^Rejected/);
    await waitFor(() => expect(shown()).toEqual(amountsAt(1)));
    await user.click(screen.getByRole('button', { name: 'Seal 4 lì xì' }));
    await screen.findByRole('heading', { name: '4 lì xì, ready to hand out' });
    expect(store.load()!.envelopes.map((e) => e.index)).toEqual([0, 1]);
  });

  it('the share page says when the saved envelopes cannot be read', async () => {
    const { show, storage } = setup();
    storage.setItem(VAULT_KEY, 'garbage');
    show(`/share/${'ab'.repeat(32)}`);
    await screen.findByText(/cannot be read. Restore it from your backup string/);
  });

  it('a group link forces equal amounts', async () => {
    const user = userEvent.setup();
    const { show, store } = setup();
    store.save({ seed: new Uint8Array(32).fill(9), envelopes: [] });
    store.setBackedUp(true);
    show('/create');
    await user.selectOptions(await screen.findByLabelText('Links'), 'group');
    const amounts = screen.getByLabelText('Amounts') as HTMLSelectElement;
    expect(amounts.disabled).toBe(true);
    expect(amounts.value).toBe('equal');
    expect(screen.getByText('A group link gives the same amount to each person, one per wallet.')).toBeTruthy();
  });
  it('points a sender with no wallet to the faucet, and says 1AM pays the fee', async () => {
    const user = userEvent.setup();
    const { show, store } = setup({ detectWallets: () => [] });
    store.save({ seed: new Uint8Array(32).fill(7), envelopes: [] });
    store.setBackedUp(true);
    show('/create');
    await screen.findByText('No 1AM wallet found in this browser.');
    // The footer has a faucet icon link too, so look inside the hint.
    const hint = screen.getByText(/You need tNIGHT to fill an envelope/);
    expect(within(hint).getByRole('link', { name: 'Preprod faucet' }).getAttribute('href')).toBe(
      'https://midnight-tmnight-preprod.nethermind.dev/',
    );
    cleanup();
    const withWallet = setup();
    withWallet.store.save({ seed: new Uint8Array(32).fill(7), envelopes: [] });
    withWallet.store.setBackedUp(true);
    withWallet.show('/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet' }));
    await screen.findByText('Your wallet pays 10 tNIGHT. 1AM pays the fee.');
  });
  it('looks for an envelope on its way by itself, and says so when it takes long', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let landed = false;
      const notYet = { envelopes: { member: () => false } } as unknown as Ledger;
      let read: () => Promise<Ledger> = async () => notYet;
      const { show, create, chain, store } = setup({
        reader: { readLedger: () => (landed ? read() : Promise.resolve(notYet)) },
      });
      read = () => chain.readLedger();
      await create();
      const vault = store.load()!;
      show(`/share/${toHex(deriveEnvelope(vault.seed, vault.envelopes[0]).id)}`);
      await screen.findByText('Your envelope is on its way to the chain…');
      await act(() => vi.advanceTimersByTimeAsync(SHARE_SLOW_MS));
      await screen.findByText(/^Still not on chain\./);
      landed = true;
      await act(() => vi.advanceTimersByTimeAsync(SHARE_POLL_MS));
      await screen.findByRole('heading', { name: '2 lì xì, ready to hand out' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays on its way, without an error, while background reads fail (Review Focus 3)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let reads = 0;
      const notYet = { envelopes: { member: () => false } } as unknown as Ledger;
      const { show, create, store } = setup({
        reader: {
          readLedger: async () => {
            if (reads++ === 0) return notYet;
            throw new TypeError('Failed to fetch');
          },
        },
      });
      await create();
      const vault = store.load()!;
      show(`/share/${toHex(deriveEnvelope(vault.seed, vault.envelopes[0]).id)}`);
      await screen.findByText('Your envelope is on its way to the chain…');
      await act(() => vi.advanceTimersByTimeAsync(3 * SHARE_POLL_MS));
      expect(reads).toBeGreaterThan(1);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

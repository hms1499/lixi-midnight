// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { backupString, deriveEnvelope } from '@lixi/sdk';
import { formatNight } from '../src/lib/units';
import { ORIGIN, setup } from './app-harness';

afterEach(cleanup);

describe('create and share', () => {
  it('asks for the backup first, then seals the envelope and lists one link per lì xì', async () => {
    const user = userEvent.setup();
    const { show, store } = setup();
    show('/create');
    await screen.findByRole('heading', { name: 'Keep your backup string' });
    expect((screen.getByLabelText('Backup string') as HTMLInputElement).value).toBe(backupString(store.load()!));
    await user.click(screen.getByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const total = await screen.findByLabelText('Total tNIGHT');
    await user.clear(total);
    await user.type(total, '3');
    const count = screen.getByLabelText('Number of lì xì');
    await user.clear(count);
    await user.type(count, '3');
    await user.selectOptions(screen.getByLabelText('Amounts'), 'equal');
    await user.click(screen.getByRole('button', { name: 'Connect Test Wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 3 lì xì' }));

    await screen.findByRole('heading', { name: '3 lì xì, ready to hand out' });
    expect(screen.getAllByText('1 tNIGHT')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Copy link: Lì xì 2' }));
    expect(await navigator.clipboard.readText()).toMatch(new RegExp(`^${ORIGIN}/c#v1\\.`));
    expect(screen.getByRole('button', { name: 'Copied: Lì xì 2' })).toBeTruthy();
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
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toHex } from '@lixi/contract';
import { claimUrl } from '@lixi/sdk';
import { GREETING_KEY } from '../src/lib/greeting';
import { ORIGIN, setup } from './app-harness';

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
});

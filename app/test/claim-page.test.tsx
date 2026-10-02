// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { claimUrl } from '@lixi/sdk';
import { setup } from './app-harness';
import { rnd } from './helpers';

afterEach(cleanup);

describe('claim page', () => {
  it('shows what is sealed inside before connecting, then opens the lì xì', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    await user.click(screen.getByRole('button', { name: 'Connect Test Wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    await screen.findByText('It is in your wallet. The link’s secret never touched the chain.');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('1 tNIGHT');
    expect(screen.getByRole('img', { name: 'An opened lì xì' })).toBeTruthy();
  });

  it('says why a lì xì cannot be opened', async () => {
    const { show, create, chain } = setup();
    const [link] = await create();
    if (link.kind !== 'personal') throw new Error('expected a personal link');
    await chain.claim({ ...link, recipient: rnd() });
    show(claimUrl('', link));
    await screen.findByRole('heading', { name: 'This lì xì was already opened' });
    expect(screen.getByRole('link', { name: 'Open a different link' }).getAttribute('href')).toBe('/c');
    cleanup();
    show('/c#v1.AAAA');
    await screen.findByRole('heading', { name: 'This link is damaged' });
  });

  it('opens a pasted link even with chat punctuation around it', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    const [link] = await create();
    show('/c');
    await user.type(
      screen.getByLabelText('Paste the link you were sent'),
      `Here: ${claimUrl('https://lixi.test', link)}).`,
    );
    await user.click(screen.getByRole('button', { name: 'Open link' }));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    cleanup();
    show('/c');
    await user.type(screen.getByLabelText('Paste the link you were sent'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Open link' }));
    await screen.findByText(/not a Lixi link/);
  });

  it('tells a recipient whose wallet is on another network', async () => {
    const user = userEvent.setup();
    const { show, create } = setup({ config: { network: 'preprod', contractAddress: 'ab'.repeat(32) } });
    const [link] = await create();
    show(claimUrl('', link));
    await user.click(await screen.findByRole('button', { name: 'Connect Test Wallet to open it' }));
    await screen.findByText(/Your wallet is on another network/);
  });
});

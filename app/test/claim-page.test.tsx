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

  it('names both wallets that work when none is installed', async () => {
    const { show, create } = setup({ detectWallets: () => [] });
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText(/No Midnight wallet found in this browser/);
    expect(screen.getByRole('link', { name: '1AM' }).getAttribute('href')).toBe('https://1am.xyz');
    expect(screen.getByRole('link', { name: 'Lace' }).getAttribute('href')).toBe('https://www.lace.io');
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

  it('shows the same choice of where proofs are made in both wallet panels', async () => {
    const user = userEvent.setup();
    const { show, create } = setup();
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    await user.click(screen.getByRole('button', { name: 'Connect wallet' }));
    const radios = screen.getAllByRole('radio', { name: 'In my wallet' }) as HTMLInputElement[];
    expect(radios.map((r) => r.checked)).toEqual([true, true]);
  });

  it('says the network could not be reached when reading the envelope fails, without wallet advice', async () => {
    const { show, create } = setup({
      reader: {
        readLedger: async () => {
          throw new TypeError('Failed to fetch');
        },
      },
    });
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText('Lixi could not reach the Midnight network. Check your connection, then reload the page.');
  });

  it('does not read the envelope again when the page re-renders', async () => {
    const { show, create, chain } = setup();
    const [link] = await create();
    const page = show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    let reads = 0;
    const read = chain.readLedger;
    chain.readLedger = () => {
      reads++;
      return read();
    };
    page.rerender();
    await screen.findByText(/1 tNIGHT is sealed inside/);
    expect(reads).toBe(0);
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

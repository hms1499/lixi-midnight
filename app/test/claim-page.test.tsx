// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { claimUrl } from '@lixi/sdk';
import { PROVER_KEY } from '../src/lib/storage';
import { detectWallets } from '../src/wallet/connector';
import { ORIGIN, fakeWallet, setup } from './app-harness';
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

  it('shows the wallet’s balances once connected, and reads them again after opening', async () => {
    const user = userEvent.setup();
    let dust = 0n;
    const wallet = fakeWallet({ name: '1AM', balances: () => ({ night: 4_996_000_000n, dust }) });
    const { show, create } = setup({ detectWallets: () => [wallet] });
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    await user.click(screen.getByRole('button', { name: 'Connect 1AM to open it' }));
    await screen.findByText('4,996 tNIGHT · 0 DUST');
    dust = 2n * 10n ** 15n;
    await user.click(screen.getByRole('button', { name: 'Open the lì xì' }));
    await screen.findByText('It is in your wallet. The link’s secret never touched the chain.');
    await screen.findByText('4,996 tNIGHT · 2 DUST');
  });

  it('never warns 1AM about DUST, and reads the balances again when the tab gets focus back', async () => {
    const user = userEvent.setup();
    let night = 120_000_000n;
    const wallet = fakeWallet({ name: '1AM', balances: () => ({ night, dust: 0n }) });
    const { show, create } = setup({ detectWallets: () => [wallet] });
    const [link] = await create();
    show(claimUrl('', link));
    await user.click(await screen.findByRole('button', { name: 'Connect 1AM to open it' }));
    await screen.findByText('120 tNIGHT · 0 DUST');
    expect(screen.getByText('Fees are paid by 1AM, so your wallet needs no DUST.')).toBeTruthy();
    expect(screen.queryByText(/Your wallet shows 0 DUST/)).toBeNull();
    night = 1_250_000_000n;
    fireEvent.focus(window);
    await screen.findByText('1,250 tNIGHT · 0 DUST');
  });

  it('lists the steps to get 1AM when no wallet is installed, and reloads', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const { show, create } = setup({ detectWallets: () => [], reload });
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText('No 1AM wallet found in this browser.');
    expect(screen.getByRole('link', { name: 'Install 1AM for Chrome' }).getAttribute('href')).toBe('https://1am.xyz');
    expect(screen.getByText('Your link stays in the address bar when you reload.')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Lace/);
    await user.click(screen.getByRole('button', { name: 'I installed 1AM, reload' }));
    expect(reload).toHaveBeenCalledOnce();
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
    const radios = screen.getAllByRole('radio', { name: 'In 1AM (default)', hidden: true }) as HTMLInputElement[];
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
  it('on a phone with no wallet, still shows what is inside and offers the link for a computer', async () => {
    const user = userEvent.setup();
    const { show, create } = setup({ detectWallets: () => [], isMobile: () => true });
    const [link] = await create();
    const path = claimUrl('', link);
    show(path);
    await screen.findByText(/1 tNIGHT is sealed inside/);
    expect(screen.getByText('Open this on a computer.')).toBeTruthy();
    expect(screen.queryByText(/No Midnight wallet found/)).toBeNull();
    // Without a Clipboard API the link can still be copied by hand (Review Focus 5).
    expect((screen.getByLabelText('Link to open on a computer') as HTMLInputElement).value).toBe(`${ORIGIN}${path}`);
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(await navigator.clipboard.readText()).toBe(`${ORIGIN}${path}`);
  });

  it('on a phone that does have 1AM, connects as usual', async () => {
    const { show, create } = setup({ detectWallets: () => [fakeWallet({ name: '1AM' })], isMobile: () => true });
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByRole('button', { name: 'Connect 1AM to open it' });
    expect(screen.queryByText('Open this on a computer.')).toBeNull();
  });
  it('ignores a wallet that is not 1AM, as if none were installed', async () => {
    const { show, create } = setup({
      detectWallets: () => detectWallets({ lace: fakeWallet({ name: 'Lace' }) }),
    });
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText('No 1AM wallet found in this browser.');
  });

  it('swaps the install steps for the Connect button when 1AM injects a moment late', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let injected = false;
      const { show, create } = setup({ detectWallets: () => (injected ? [fakeWallet({ name: '1AM' })] : []) });
      const [link] = await create();
      show(claimUrl('', link));
      await screen.findByText('No 1AM wallet found in this browser.');
      injected = true;
      await act(() => vi.advanceTimersByTimeAsync(600));
      await screen.findByRole('button', { name: 'Connect 1AM to open it' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('says 1AM pays the fee, so opening needs no tNIGHT or DUST', async () => {
    const { show, create } = setup();
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText('Opening it needs the 1AM wallet. 1AM pays the fee, so you need no tNIGHT or DUST.');
    expect(screen.queryByText(/a little DUST/)).toBeNull();
  });

  it('folds where proofs are made under Advanced, open only when the local proof server was chosen', async () => {
    const { show, create, storage } = setup();
    const [link] = await create();
    show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    const details = screen.getByText('Advanced: where proofs are made').closest('details')!;
    expect(details.open).toBe(false);
    expect(
      (within(details).getByRole('radio', { name: 'In 1AM (default)', hidden: true }) as HTMLInputElement).checked,
    ).toBe(true);
    cleanup();
    storage.setItem(PROVER_KEY, 'local');
    show(claimUrl('', link));
    await screen.findByText(/1 tNIGHT is sealed inside/);
    expect(screen.getByText('Advanced: where proofs are made').closest('details')!.open).toBe(true);
  });
});

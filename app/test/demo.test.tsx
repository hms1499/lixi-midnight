// @vitest-environment jsdom
import { afterEach, describe, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { App } from '../src/App';
import { ServicesProvider } from '../src/services';
import { WalletProvider } from '../src/wallet/WalletContext';
import { createDemo, demoLinks, sealGroup, type Demo } from '../demo/demo';
import { MemoryStorage } from './helpers';

afterEach(cleanup);

const start = () =>
  createDemo({ stageMs: 0, storage: new MemoryStorage(), origin: 'https://lixi.test', startSeconds: 1_800_000_000 });

const show = (demo: Demo, path: string) =>
  render(
    <ServicesProvider services={demo.services}>
      <WalletProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </WalletProvider>
    </ServicesProvider>,
  );

describe('demo entry (demo video spec §5.4)', () => {
  it('seals through the UI, opens a personal link, and brings the rest home after expiry', async () => {
    const user = userEvent.setup();
    const demo = start();
    show(demo, '/create');
    await user.click(await screen.findByRole('button', { name: 'Connect Demo wallet' }));
    await user.click(await screen.findByRole('button', { name: 'Seal 4 lì xì' }));
    await user.click(await screen.findByLabelText('I saved my backup string'));
    await user.click(screen.getByRole('button', { name: 'Saved, seal 4 lì xì' }));
    await screen.findByRole('heading', { name: '4 lì xì, ready to hand out' });
    cleanup();

    const [first] = demoLinks(demo, 0);
    show(demo, first);
    await user.click(await screen.findByRole('button', { name: 'Connect Demo wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    await screen.findByRole('img', { name: /^An opened lì xì/ });
    cleanup();

    demo.advance(2 * 86400);
    show(demo, '/dashboard');
    await user.click(await screen.findByRole('button', { name: 'Connect Demo wallet' }));
    await user.click(await screen.findByRole('button', { name: /^Bring .* home$/ }));
    await screen.findByText(/^Came home:/);
  });

  it('a group link opens once per wallet', async () => {
    const user = userEvent.setup();
    const demo = start();
    const link = await sealGroup(demo);
    show(demo, link);
    await user.click(await screen.findByRole('button', { name: 'Connect Demo wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    await screen.findByRole('img', { name: /^An opened lì xì/ });
    cleanup();
    show(demo, link);
    // The page learns the address only from the wallet, so the refusal comes when this wallet tries to open it.
    await user.click(await screen.findByRole('button', { name: 'Connect Demo wallet to open it' }));
    await user.click(await screen.findByRole('button', { name: 'Open the lì xì' }));
    await screen.findByRole('heading', { name: 'This wallet already opened one from this group' });
  });
});

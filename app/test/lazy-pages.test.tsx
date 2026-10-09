// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadBoundary } from '../src/components/LoadBoundary';
import { setup } from './app-harness';

afterEach(cleanup);

describe('lazy pages', () => {
  // Keep this test first: a lazy page shows its fallback only until its module has loaded once in this file.
  it('shows the sealed envelope at once on a claim link, before the claim page has loaded', async () => {
    const { show } = setup();
    show('/c#v1.garbage');
    expect(screen.getByRole('img', { name: 'A sealed lì xì' })).toBeTruthy();
    expect(screen.getByText('Looking at the envelope…')).toBeTruthy();
    await screen.findByRole('heading', { name: 'This link is damaged' });
  });

  it('offers a reload when a page’s code cannot load, instead of a blank page', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const Broken = () => {
      throw new Error('Failed to fetch dynamically imported module');
    };
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined); // React logs the caught error
    try {
      render(
        <LoadBoundary onReload={reload}>
          <Broken />
        </LoadBoundary>,
      );
      expect(
        screen.getByText('This page could not load. Lixi may have been updated since you opened it.'),
      ).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Reload' }));
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      logged.mockRestore();
    }
  });
});

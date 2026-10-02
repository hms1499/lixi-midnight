// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { LINKS } from '../src/lib/links';
import { setup } from './app-harness';

afterEach(cleanup);

describe('site shell and home page', () => {
  it('has a header that links to every home section, and a footer', async () => {
    const { show } = setup();
    show('/');
    await screen.findByRole('heading', { name: /Every light is one lì xì/ });
    const sections = screen.getByRole('navigation', { name: 'Sections' });
    for (const [name, hash] of [
      ['How it works', '#how'],
      ['Privacy', '#privacy'],
      ['Built on Midnight', '#midnight'],
      ['FAQ', '#faq'],
    ]) {
      expect(within(sections).getByRole('link', { name }).getAttribute('href')).toBe(`/${hash}`);
      expect(document.getElementById(hash.slice(1))).not.toBeNull();
    }
    expect(screen.getByText('Preprod testnet')).toBeTruthy();
    expect(screen.getByRole('contentinfo').textContent).toContain('Testnet only. tNIGHT has no value.');
  });

  it('shows places outside the app as named icon links', async () => {
    const { show } = setup();
    show('/');
    await screen.findByRole('heading', { name: /Every light is one lì xì/ });
    for (const { label, href } of Object.values(LINKS)) {
      const links = screen.getAllByRole('link', { name: label });
      expect(links.length, label).toBeGreaterThan(0);
      for (const a of links) {
        expect(a.getAttribute('href')).toBe(href);
        expect(a.getAttribute('rel')).toBe('noreferrer');
      }
    }
  });

  it('shows every section at once when it cannot watch scrolling (no IntersectionObserver)', async () => {
    const { show } = setup();
    show('/');
    await screen.findByRole('heading', { name: /Every light is one lì xì/ });
    const revealed = document.querySelectorAll('[data-reveal]');
    expect(revealed.length).toBe(6);
    for (const s of Array.from(revealed)) expect(s.hasAttribute('data-in')).toBe(true);
  });

  it('answers the questions a first visitor has', async () => {
    const { show } = setup();
    show('/');
    for (const q of ['Do I need a wallet to open a lì xì?', 'What if a link leaks?', 'Is this real money?'])
      expect(await screen.findByText(q)).toBeTruthy();
  });

  it('has a friendly not-found page', async () => {
    const { show } = setup();
    show('/nope');
    await screen.findByRole('heading', { name: 'Nothing here' });
  });
});

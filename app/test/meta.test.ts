import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_URL, siteUrl, withSiteUrl } from '../src/meta';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('link previews', () => {
  it('describes the site and points to a 1200 × 630 image on the site, the same for every URL', () => {
    // Whitespace collapsed, so Prettier may wrap the tags however it likes.
    const page = withSiteUrl(html, 'https://lixi.example').replace(/\s+/g, ' ');
    for (const tag of [
      '<meta name="description" content="Red envelopes (lì xì) on Midnight. Open yours with a zero-knowledge proof: only its link knows whose." />',
      '<meta property="og:type" content="website" />',
      '<meta property="og:site_name" content="Lixi" />',
      '<meta property="og:title" content="Lixi: private red envelopes on Midnight" />',
      '<meta property="og:image" content="https://lixi.example/og.png" />',
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />',
      '<meta name="twitter:card" content="summary_large_image" />',
    ])
      expect(page).toContain(tag);
    expect(page).toMatch(/<meta property="og:description" content="[^"]+" \/>/);
    expect(page).toMatch(/<meta property="og:image:alt" content="[^"]+" \/>/);
    expect(page).not.toContain('__SITE_URL__');
  });

  it('builds against the live site unless VITE_SITE_URL says otherwise, and only for an https origin', () => {
    expect(siteUrl({})).toBe(DEFAULT_SITE_URL);
    expect(siteUrl({ VITE_SITE_URL: ' https://lixi.example/ ' })).toBe('https://lixi.example');
    expect(() => siteUrl({ VITE_SITE_URL: 'http://lixi.example' })).toThrow('VITE_SITE_URL');
    expect(() => siteUrl({ VITE_SITE_URL: 'https://lixi.example/app' })).toThrow('VITE_SITE_URL');
  });

  it('ships og.png as a 1200 × 630 PNG under 300 KB', () => {
    const file = new URL('../public/og.png', import.meta.url);
    const png = readFileSync(file);
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(statSync(file).size).toBeLessThan(300 * 1024);
  });
});

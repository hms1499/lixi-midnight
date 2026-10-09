/** Where the site is served. Link previews need an absolute image URL (user moments spec §3.2). */
export const DEFAULT_SITE_URL = 'https://lixi-3nv.pages.dev';

export const siteUrl = (env: Record<string, string | undefined>): string => {
  const url = (env.VITE_SITE_URL ?? DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^/\s]+$/.test(url))
    throw new Error('VITE_SITE_URL must be an https origin, like https://lixi.example');
  return url;
};

/** Fills the `__SITE_URL__` placeholders in index.html. */
export const withSiteUrl = (html: string, url: string): string => html.replaceAll('__SITE_URL__', url);

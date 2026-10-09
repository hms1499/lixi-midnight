import { chromium, type Browser, type BrowserContext } from 'playwright';

/** 1280×720 CSS pixels at scale 1.5: the app renders at a readable size and every frame is 1920×1080. */
export const VIEWPORT = { width: 1280, height: 720 } as const;
export const SCALE = 1.5;

/**
 * Uses the installed Google Chrome: Playwright's own Chromium downloads too slowly here (~55 KB/s).
 * `fileAccess` lets file:// card pages load their fonts and images.
 */
export const launch = (opts: { fileAccess?: boolean } = {}): Promise<Browser> =>
  chromium.launch({ channel: 'chrome', args: opts.fileAccess ? ['--allow-file-access-from-files'] : [] });

export const newContext = (browser: Browser): Promise<BrowserContext> =>
  browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, colorScheme: 'dark' });

// One-time setup (spec §5.5): a Chromium profile with the 1AM extension. The user imports a TEST wallet by hand;
// the seed never passes through this script.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { chromium } from 'playwright';
import { SCALE, VIEWPORT } from './lib/browser.ts';
import { VIDEO } from './lib/paths.ts';

const SOURCE = `${homedir()}/Library/Application Support/Google/Chrome/Default/Extensions/bphnkdkcnfhompoegfpgnkidcjfbojjp/6.3.24_0`;
/** Chrome itself ignores --load-extension, so this uses the Chromium already in Playwright's cache. */
const CHROMIUM = `${homedir()}/Library/Caches/ms-playwright/chromium-1187/chrome-mac/Chromium.app/Contents/MacOS/Chromium`;
export const EXTENSION = `${VIDEO}.profile-1am-extension`;
export const PROFILE = `${VIDEO}.profile-1am`;

export const launch1am = () =>
  chromium.launchPersistentContext(PROFILE, {
    executablePath: CHROMIUM,
    headless: false,
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync(SOURCE)) throw new Error('1AM 6.3.24 is not installed in Chrome’s Default profile');
  if (!existsSync(CHROMIUM)) throw new Error('Chromium 1187 is not in the Playwright cache');
  rmSync(EXTENSION, { recursive: true, force: true });
  cpSync(SOURCE, EXTENSION, { recursive: true });
  rmSync(`${EXTENSION}/_metadata`, { recursive: true, force: true }); // Chromium refuses unpacked copies with it
  const context = await launch1am();
  console.log('In the browser that opened: open 1AM from the extensions menu, import a TEST wallet, choose Preprod,');
  console.log('and wait until it shows a balance. Then close the browser window.');
  await new Promise((resolve) => context.on('close', resolve));
}

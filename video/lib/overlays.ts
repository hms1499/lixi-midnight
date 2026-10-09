import { pathToFileURL } from 'node:url';
import { launch, newContext } from './browser.ts';
import { VIDEO } from './paths.ts';

type Show = { show(text: string, label: string): void };

/** Renders each caption or label as a transparent 1920×1080 PNG. Either text may be empty. */
export const renderOverlays = async (items: { text: string; label: string; file: string }[]): Promise<void> => {
  const browser = await launch({ fileAccess: true });
  const page = await (await newContext(browser)).newPage();
  await page.goto(pathToFileURL(`${VIDEO}scenes/overlay.html`).href);
  await page.evaluate(() => document.fonts.ready);
  for (const item of items) {
    await page.evaluate(([t, l]) => (window as unknown as Show).show(t, l), [item.text, item.label] as const);
    await page.screenshot({ path: item.file, omitBackground: true });
  }
  await browser.close();
};

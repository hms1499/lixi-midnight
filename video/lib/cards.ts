import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Browser } from 'playwright';
import { TOKENS } from '../../app/src/theme.ts';
import { newContext } from './browser.ts';
import { OUT, VIDEO } from './paths.ts';
import { FPS } from './timing.ts';

/** The app's colour tokens as CSS variables, so the video looks like the product. */
export const tokensCss = (): string =>
  `:root {\n${Object.entries(TOKENS)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n')}\n}\n`;

export const writeTokens = (): void => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}tokens.css`, tokensCss());
};

type CardPage = { setData(data: unknown): void; seek(t: number, d: number): void };

/** Screenshots a card scene at 30 fps into `dir/%05d.jpg`. */
export const renderCard = async (
  browser: Browser,
  o: { scene: string; seconds: number; data: unknown; dir: string },
): Promise<void> => {
  mkdirSync(o.dir, { recursive: true });
  const page = await (await newContext(browser)).newPage();
  await page.goto(`${pathToFileURL(`${VIDEO}scenes/cards.html`).href}?scene=${o.scene}`);
  await page.evaluate((d) => (window as unknown as CardPage).setData(d), o.data);
  await page.evaluate(() => document.fonts.ready);
  const frames = Math.ceil(o.seconds * FPS);
  for (let i = 0; i < frames; i++) {
    await page.evaluate(([t, d]) => (window as unknown as CardPage).seek(t, d), [i / FPS, o.seconds] as const);
    await page.screenshot({ path: `${o.dir}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
  await page.close();
};

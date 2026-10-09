import type { Browser, Page } from 'playwright';
import { newContext } from './browser.ts';
import { DEMO_URL, startDemoServer } from './demo-server.ts';
import type { Shot } from './frames.ts';
import { startScreencast } from './screencast.ts';

type Window = { start: number; end: number };
type Demo = {
  go(path: string): void;
  disconnect(): void;
  advance(seconds: number): void;
  links(envelope: number): string[];
  sealGroup(): Promise<string>;
};

const now = () => Date.now() / 1000;
const beat = (page: Page, ms: number) => page.waitForTimeout(ms);
const demo = <T>(page: Page, run: (d: Demo) => T | Promise<T>): Promise<T> =>
  page.evaluate(`(${run.toString()})(window.demo)`) as Promise<T>;
const go = (page: Page, path: string) => page.evaluate((p) => (window as unknown as { demo: Demo }).demo.go(p), path);

/** Drives scenes 3, 4 and 6 on the simulator demo in one session, returning one recording and each scene's window. */
export const captureDemo = async (
  browser: Browser,
): Promise<{ shots: Shot[]; scenes: Record<'s3' | 's4' | 's6', Window> }> => {
  const stopServer = await startDemoServer();
  try {
    const context = await newContext(browser);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: DEMO_URL });
    const page = await context.newPage();
    await page.goto(`${DEMO_URL}/`);
    await page.getByText('Fill an envelope').first().waitFor();
    await beat(page, 800);
    const cast = await startScreencast(page);

    // Scene 3: seal 10 tNIGHT as 4 lucky lì xì, then copy a message.
    const s3 = { start: now(), end: 0 };
    await beat(page, 2500);
    await page.getByText('Fill an envelope').first().click();
    await page.getByRole('button', { name: 'Connect Demo wallet' }).click();
    await beat(page, 1200);
    const total = page.getByLabel('Total tNIGHT');
    await total.fill('');
    await total.pressSequentially('10', { delay: 180 });
    const count = page.getByLabel('Number of lì xì');
    await count.fill('');
    await count.pressSequentially('4', { delay: 180 });
    await page.getByLabel('Amounts').selectOption('random');
    await page.getByLabel('Comes home after').selectOption({ label: '1 day' });
    await beat(page, 2500);
    await page.getByRole('button', { name: 'Seal 4 lì xì' }).click();
    await beat(page, 2000);
    await page.getByLabel('I saved my backup string').check();
    await beat(page, 700);
    await page.getByRole('button', { name: 'Saved, seal 4 lì xì' }).click();
    await page.getByRole('heading', { name: '4 lì xì, ready to hand out' }).waitFor({ timeout: 60_000 });
    await beat(page, 3000);
    await page
      .getByRole('button', { name: /^Copy message/ })
      .first()
      .click();
    await beat(page, 3000);
    s3.end = now();

    // Off camera: the recipient's view starts on a fresh claim page, with no wallet connected.
    const [first] = await demo(page, (d) => d.links(0));
    const group = await demo(page, (d) => d.sealGroup());
    await demo(page, (d) => d.disconnect());
    await go(page, first);
    await page.getByRole('heading', { name: 'Someone sent you a lì xì' }).waitFor();
    await beat(page, 600);

    // Scene 4: open it, show the receipt, refuse it again, then a group link once per wallet.
    const s4 = { start: now(), end: 0 };
    await beat(page, 3500);
    await page.getByRole('button', { name: 'Connect Demo wallet to open it' }).click();
    await beat(page, 1500);
    await page.getByRole('button', { name: 'Open the lì xì' }).click();
    await page.getByRole('img', { name: /^An opened lì xì/ }).waitFor({ timeout: 60_000 });
    await beat(page, 5000);
    await page.mouse.wheel(0, 500);
    await beat(page, 4000);
    await go(page, first);
    await page.getByRole('heading', { name: 'This lì xì was already opened' }).waitFor();
    await beat(page, 3000);
    await go(page, group);
    await page.getByRole('button', { name: 'Open the lì xì' }).click();
    await page.getByRole('img', { name: /^An opened lì xì/ }).waitFor({ timeout: 60_000 });
    await beat(page, 3000);
    // The page learns the address only from the wallet, so the refusal comes when this wallet tries again.
    await go(page, group);
    await page.getByRole('button', { name: 'Open the lì xì' }).click();
    await page.getByRole('heading', { name: 'This wallet already opened one from this group' }).waitFor({
      timeout: 60_000,
    });
    await beat(page, 3000);
    s4.end = now();

    // Scene 6: the dashboard before and after the expiry; bring the unopened home; the backup.
    await go(page, '/dashboard');
    await page
      .getByRole('img', { name: /^Lì xì 1:/ })
      .first()
      .waitFor();
    await beat(page, 600);
    const s6 = { start: now(), end: 0 };
    await beat(page, 3500);
    await demo(page, (d) => d.advance(2 * 86400));
    await go(page, '/dashboard');
    await page
      .getByRole('button', { name: /^Bring .* home$/ })
      .first()
      .waitFor();
    await beat(page, 2500);
    await page
      .getByRole('button', { name: /^Bring .* home$/ })
      .first()
      .click();
    await page.getByText(/^Came home:/).waitFor({ timeout: 60_000 });
    await beat(page, 3000);
    await page.mouse.wheel(0, 800);
    await beat(page, 3000);
    s6.end = now();

    const shots = await cast.stop();
    await context.close();
    return { shots, scenes: { s3, s4, s6 } };
  } finally {
    stopServer();
  }
};

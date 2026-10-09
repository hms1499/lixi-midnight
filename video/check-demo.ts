// Spec §5.4 "first risk": does LixiSimulator run in a real browser? Seals 4 lì xì through the demo UI.
import { launch, newContext } from './lib/browser.ts';
import { DEMO_URL, startDemoServer } from './lib/demo-server.ts';

const stop = await startDemoServer();
try {
  const browser = await launch();
  const page = await (await newContext(browser)).newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${DEMO_URL}/create`);
  await page.getByRole('button', { name: 'Connect Demo wallet' }).click();
  await page.getByRole('button', { name: 'Seal 4 lì xì' }).click();
  await page.getByLabel('I saved my backup string').check();
  await page.getByRole('button', { name: 'Saved, seal 4 lì xì' }).click();
  await page.getByRole('heading', { name: '4 lì xì, ready to hand out' }).waitFor({ timeout: 60_000 });
  const links = await page.evaluate(() =>
    (window as unknown as { demo: { links(n: number): string[] } }).demo.links(0),
  );
  await browser.close();
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log(`check-demo: sealed ${links.length} lì xì on the simulator in a real browser`);
} finally {
  stop();
}

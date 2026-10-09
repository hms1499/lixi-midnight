// Records scene 5 on the live site with the real 1AM (spec §5.5). The user approves each 1AM popup.
// Sealing happens before recording starts, so the backup string never reaches a frame (Review Focus 4).
// Prints no page console output and no URLs.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { clip, concatList, retime, writeFrames, type Segment } from './lib/frames.ts';
import { OUT } from './lib/paths.ts';
import { withoutUrls } from './lib/redact.ts';
import { startScreencast } from './lib/screencast.ts';
import type { Locator } from 'playwright';
import { launch1am } from './setup-1am.ts';

const SITE = 'https://lixi-3nv.pages.dev';
const WAIT = 5 * 60_000; // a proof plus the user's approval
const now = () => Date.now() / 1000;
const say = (s: string) => console.log(`→ ${s}`);
/** Waits up to `ms` for a locator to show; false if it never does (isVisible() alone does not wait). */
const shows = (l: Locator, ms: number) =>
  l.waitFor({ state: 'visible', timeout: ms }).then(
    () => true,
    () => false,
  );

const context = await launch1am();
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
const page = context.pages()[0] ?? (await context.newPage());

// Off camera: seal 1 tNIGHT as 1 lì xì and copy its link.
await page.goto(`${SITE}/create`);
const total = page.getByLabel('Total tNIGHT');
await total.waitFor({ timeout: 60_000 });
const connect = page.getByRole('button', { name: 'Connect 1AM' });
if (await shows(connect, 5000)) {
  say('Approve the connection in 1AM');
  await connect.click();
  await page.getByRole('button', { name: /^Seal \d+ lì xì$/ }).waitFor({ timeout: WAIT });
}
await total.fill('1');
await page.getByLabel('Number of lì xì').fill('1');
await page.getByRole('button', { name: 'Seal 1 lì xì' }).click({ timeout: WAIT });
const saved = page.getByLabel('I saved my backup string');
if (await shows(saved, 5000)) {
  await saved.check();
  await page.getByRole('button', { name: 'Saved, seal 1 lì xì' }).click();
}
say('Approve the seal in 1AM');
await page.getByRole('heading', { name: '1 lì xì, ready to hand out' }).waitFor({ timeout: WAIT });
await page.getByRole('button', { name: 'Copy link: Lì xì 1' }).click();
const link = await page.evaluate(() => navigator.clipboard.readText());
await page.goto(link).catch((e: unknown) => {
  throw withoutUrls(e); // the link's fragment is its secret
});
await page.getByRole('heading', { name: 'Someone sent you a lì xì' }).waitFor({ timeout: 60_000 });
await page.waitForTimeout(800);

// On camera: open it, speed up the proof wait, then the explorer.
const cast = await startScreencast(page);
const start = now();
await page.waitForTimeout(3000);
// After a reload 1AM injects late, so wait for whichever button the page settles on.
const connectToOpen = page.getByRole('button', { name: /^Connect .* to open it$/ });
const open = page.getByRole('button', { name: 'Open the lì xì' });
await connectToOpen.or(open).first().waitFor({ timeout: 60_000 });
if (await connectToOpen.isVisible()) {
  say('Approve the connection in 1AM');
  await connectToOpen.click();
}
await open.waitFor({ timeout: WAIT });
await page.waitForTimeout(1200);
say('Approve the opening in 1AM');
await open.click();
const waitFrom = now();
await page.getByRole('img', { name: /^An opened lì xì/ }).waitFor({ timeout: WAIT });
const waitTo = now();
await page.waitForTimeout(6000);
const indexFrom = now();
await page.waitForTimeout(30_000); // let the explorer index the transaction; cut from the video below
const indexTo = now();
const href = await page.getByRole('link', { name: 'See it on the explorer' }).getAttribute('href');
// The explorer keeps polling, so 'networkidle' never comes: wait for the load, then give it a few seconds.
await page.goto(href!, { waitUntil: 'load' }).catch(() => undefined);
await page.waitForTimeout(8000);
const end = now();
const shots = await cast.stop();
await context.close();

// The proof wait plays in about 4 s; the indexing pause in about 0.5 s.
const segments: Segment[] = [
  { from: waitFrom, to: waitTo, factor: Math.max(1, (waitTo - waitFrom) / 4) },
  { from: indexFrom, to: indexTo, factor: (indexTo - indexFrom) / 0.5 },
];
const t = (x: number) => retime(x, segments) - retime(start, segments);
const dir = `${OUT}s5`;
rmSync(`${dir}/frames`, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const retimed = shots.map((s) => ({ ...s, at: retime(s.at, segments) }));
const frames = writeFrames(clip(retimed, retime(start, segments), retime(end, segments)), `${dir}/frames`);
writeFileSync(`${dir}/frames.txt`, concatList(frames, t(end)));
const factor = Math.round(segments[0].factor);
writeFileSync(
  `${dir}/live.json`,
  JSON.stringify({ seconds: t(end), spedUp: factor > 1 ? [{ start: t(waitFrom), end: t(waitTo), factor }] : [] }),
);
console.log(`scene 5 recorded: ${t(end).toFixed(1)} s`);

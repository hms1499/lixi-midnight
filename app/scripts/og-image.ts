// Renders og/og.html to public/og.png at 1200 × 630 with headless Chrome (user moments spec §3.2).
// Set CHROME to the Chrome binary if it is not at the macOS default. A throwaway profile keeps the
// user's own Chrome profile untouched.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const html = new URL('../og/og.html', import.meta.url).href;
const out = fileURLToPath(new URL('../public/og.png', import.meta.url));
const profile = mkdtempSync(join(tmpdir(), 'lixi-og-'));
try {
  execFileSync(chrome, [
    '--headless=new',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    '--virtual-time-budget=3000',
    `--screenshot=${out}`,
    html,
  ]);
} finally {
  rmSync(profile, { recursive: true, force: true });
}
console.log('wrote public/og.png');

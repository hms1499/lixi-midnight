import { spawn } from 'node:child_process';
import { ROOT } from './paths.ts';

const COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/** Sums vitest's per-workspace "Tests  N passed" lines; throws if any workspace failed. */
export const countTests = (output: string): number => {
  const plain = output.replace(COLOUR, '');
  if (/Tests\s+\d+ failed/.test(plain)) throw new Error('npm test reported failures');
  const counts = [...plain.matchAll(/Tests\s+(\d+) passed/g)].map((m) => Number(m[1]));
  if (counts.length === 0) throw new Error('no vitest summary found in the npm test output');
  return counts.reduce((a, b) => a + b, 0);
};

export type TestLine = { at: number; text: string };

/** Runs the real `npm test` at the repo root, recording each output line with its time since the start. */
export const recordTestRun = (): Promise<{ lines: TestLine[]; count: number; seconds: number }> =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn('npm', ['test'], { cwd: ROOT, env: { ...process.env, FORCE_COLOR: '0', CI: '1' } });
    const lines: TestLine[] = [];
    let all = '';
    let partial = '';
    const take = (chunk: Buffer) => {
      all += chunk;
      const parts = (partial + chunk).split('\n');
      partial = parts.pop()!;
      for (const text of parts) lines.push({ at: (Date.now() - started) / 1000, text: text.replace(COLOUR, '') });
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`npm test exited with ${code}`));
      try {
        resolve({ lines, count: countTests(all), seconds: (Date.now() - started) / 1000 });
      } catch (e) {
        reject(e);
      }
    });
  });

/** What the terminal card shows: paths relative to the repo (no home folder on screen), no sourcemap noise. */
export const terminalLines = (lines: string[], root: string): string[] =>
  lines
    .filter((l) => !l.startsWith('Sourcemap for '))
    .map((l) => l.replaceAll(root, '').replaceAll(root.replace(/\/$/, ''), '.'));

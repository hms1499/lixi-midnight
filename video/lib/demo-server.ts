import { spawn } from 'node:child_process';
import { ROOT } from './paths.ts';

export const DEMO_URL = 'http://localhost:5180';

/** Starts the app's dev-only demo server; resolves with a stop function once it answers. */
export const startDemoServer = async (): Promise<() => void> => {
  const child = spawn('npx', ['vite', '--config', 'vite.demo.config.ts'], { cwd: `${ROOT}app`, stdio: 'ignore' });
  const stop = () => child.kill();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(DEMO_URL, { headers: { accept: 'text/html' } })).ok) return stop;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  stop();
  throw new Error('the demo server did not answer within 60 s');
};

import { spawn } from 'node:child_process';

/** Runs a command and resolves with its stdout; rejects with the tail of its stderr when it fails. */
export const run = (cmd: string, args: string[], opts: { cwd?: string } = {}): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited with ${code}: ${err.slice(-2000)}`)),
    );
  });

import { format } from 'node:util';
import { redactUrl } from '@lixi/sdk';

const METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;

/**
 * Makes every console line pass through `redactUrl`. Endpoint URLs carry the Blockfrost project id,
 * and libraries print them on their own: polkadot's RPC logger on every disconnect, and error causes
 * that quote the URL. Arguments are formatted as console would, then redacted.
 */
export const redactConsole = (target: Pick<Console, (typeof METHODS)[number]> = console): void => {
  for (const method of METHODS) {
    const original = target[method].bind(target);
    target[method] = (...args: unknown[]) => original(redactUrl(format(...args)));
  }
};

/**
 * Call first in every chain script. A failed top-level await is reported through the redacted
 * console too, instead of by Node, which would print the raw error.
 */
export const redactOutput = (): void => {
  redactConsole();
  process.on('uncaughtException', (error) => {
    console.error(error);
    process.exit(1);
  });
};

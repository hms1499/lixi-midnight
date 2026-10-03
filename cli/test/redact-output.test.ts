import { logger } from '@polkadot/util';
import { afterEach, describe, expect, it } from 'vitest';
import { redactConsole } from '../src/redact-output.js';

const KEYED = 'wss://rpc.midnight-preprod.blockfrost.io/?project_id=preprodSECRET';
const METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;
const saved = Object.fromEntries(METHODS.map((m) => [m, console[m]]));

afterEach(() => Object.assign(console, saved));

describe('redactConsole', () => {
  it('hides the project id in every console method, including errors whose cause quotes a URL', () => {
    const lines: string[] = [];
    const target = Object.fromEntries(METHODS.map((m) => [m, (...a: unknown[]) => lines.push(a.join(' '))]));
    redactConsole(target as unknown as Console);
    target.log(`connected to ${KEYED}`);
    target.error(new Error('submission failed', { cause: new Error(`RPC ${KEYED} closed`) }));
    for (const m of ['info', 'warn', 'debug'] as const) target[m]('x', { url: KEYED });
    expect(lines).toHaveLength(5);
    expect(lines.join('\n')).not.toContain('preprodSECRET');
    expect(lines.join('\n')).toContain('project_id=<redacted>');
  });

  it('also covers what polkadot prints on a disconnect, because its logger looks console up at call time', () => {
    const lines: string[] = [];
    for (const m of METHODS) console[m] = (...a: unknown[]) => void lines.push(a.join(' '));
    redactConsole();
    logger('RPC-CORE').error(`subscribeRuntimeVersion(): disconnected from ${KEYED} 1000:: Normal Closure`);
    expect(lines.join('\n')).toContain('project_id=<redacted>');
    expect(lines.join('\n')).not.toContain('preprodSECRET');
  });
});

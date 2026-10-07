import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { appConfig } from '../src/config';
import { cspFor } from '../src/csp';

describe('appConfig', () => {
  it('defaults to Preprod and the committed deployment, with the Blockfrost project id', () => {
    const deployment = JSON.parse(readFileSync(new URL('../../deployments/preprod.json', import.meta.url), 'utf8'));
    expect(appConfig({ VITE_BLOCKFROST_PROJECT_ID: ' preprodX ' })).toEqual({
      network: 'preprod',
      contractAddress: deployment.contractAddress,
      projectId: 'preprodX',
    });
  });

  it('refuses a Preprod build without a Blockfrost project id, naming the variable and the file', () => {
    expect(() => appConfig({})).toThrow('set VITE_BLOCKFROST_PROJECT_ID in app/.env.local');
    expect(() => appConfig({ VITE_BLOCKFROST_PROJECT_ID: '  ' })).toThrow('set VITE_BLOCKFROST_PROJECT_ID');
  });

  it('needs an explicit contract address, and no project id, for a local devnet build', () => {
    expect(() => appConfig({ VITE_LIXI_NETWORK: 'undeployed' })).toThrow(/VITE_LIXI_CONTRACT/);
    expect(appConfig({ VITE_LIXI_NETWORK: 'undeployed', VITE_LIXI_CONTRACT: 'ab'.repeat(32) }).network).toBe(
      'undeployed',
    );
    expect(() => appConfig({ VITE_LIXI_NETWORK: 'mainnet' })).toThrow(/unknown network/);
  });
});

describe('CSP', () => {
  it('allows only our origin, the Blockfrost indexer and the local proof server', () => {
    const policy = cspFor('preprod');
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(policy).toContain(
      "connect-src 'self' https://midnight-preprod.blockfrost.io wss://midnight-preprod.blockfrost.io http://127.0.0.1:6300;",
    );
    expect(policy).not.toContain('localhost');
    expect(policy).not.toMatch(/'unsafe-inline'|'unsafe-eval'|\*|project_id/);
  });

  it('is the same policy the Vercel deployment sends as a header, plus frame-ancestors', () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const header = vercel.headers[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy');
    expect(header.value).toBe(`${cspFor('preprod')}; frame-ancestors 'none'`);
  });
});

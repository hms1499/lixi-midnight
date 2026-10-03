import { describe, expect, it } from 'vitest';
import { NETWORKS, networkConfig, redactUrl } from '../src/network.js';

describe('networkConfig', () => {
  it('puts the Blockfrost project id on the Preprod indexer and node URLs, never on the proof server', () => {
    const c = networkConfig('preprod', 'preprodAbC123');
    expect(c.indexer).toBe('https://midnight-preprod.blockfrost.io/api/v0?project_id=preprodAbC123');
    expect(c.indexerWS).toBe('wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=preprodAbC123');
    expect(c.node).toBe('https://rpc.midnight-preprod.blockfrost.io?project_id=preprodAbC123');
    expect(c.proofServer).toBe('http://127.0.0.1:6300');
  });

  it('trims the id and encodes characters a URL would misread', () => {
    expect(networkConfig('preprod', ' a+b/c= \n').indexer).toBe(
      'https://midnight-preprod.blockfrost.io/api/v0?project_id=a%2Bb%2Fc%3D',
    );
  });

  it('refuses a missing or blank id for Preprod', () => {
    expect(() => networkConfig('preprod')).toThrow('missing Blockfrost project id');
    expect(() => networkConfig('preprod', '  \n')).toThrow('missing Blockfrost project id');
  });

  it('leaves the local devnet as it is, with or without an id', () => {
    expect(networkConfig('undeployed')).toEqual(NETWORKS.undeployed);
    expect(networkConfig('undeployed', 'x')).toEqual(NETWORKS.undeployed);
  });
});

describe('redactUrl', () => {
  it('hides every project id in a message, wherever the URL sits', () => {
    const out = redactUrl(
      'GET https://midnight-preprod.blockfrost.io/api/v0?project_id=preprodSECRET1 failed; ws "wss://h/ws?a=1&project_id=preprodSECRET2"',
    );
    expect(out).not.toContain('SECRET');
    expect(out.match(/project_id=<redacted>/g)).toHaveLength(2);
  });

  it('leaves text without a project id unchanged', () => {
    expect(redactUrl('proof server unreachable')).toBe('proof server unreachable');
  });
});

import { describe, expect, it } from 'vitest';
import { cliNetwork } from '../src/network.js';

describe('cliNetwork', () => {
  it('reads the Blockfrost project id for Preprod from BLOCKFROST_PROJECT_ID', () => {
    expect(cliNetwork('preprod', { BLOCKFROST_PROJECT_ID: 'preprodX' }).indexerWS).toBe(
      'wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=preprodX',
    );
  });

  it('says which variable and file to set when the id is missing or blank', () => {
    expect(() => cliNetwork('preprod', {})).toThrow('set BLOCKFROST_PROJECT_ID in cli/.env');
    expect(() => cliNetwork('preprod', { BLOCKFROST_PROJECT_ID: ' ' })).toThrow(
      'set BLOCKFROST_PROJECT_ID in cli/.env',
    );
  });

  it('needs no id for the local devnet', () => {
    expect(cliNetwork('undeployed', {}).indexer).toBe('http://127.0.0.1:8088/api/v4/graphql');
  });

  it('rejects an unknown network', () => {
    expect(() => cliNetwork('mainnet' as never, {})).toThrow('unknown network mainnet; use undeployed or preprod');
  });
});

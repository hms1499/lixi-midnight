import { describe, expect, it } from 'vitest';
import { addEnvelope, deserializeVault, newVault, serializeVault } from '../src/vault.js';

const saved = addEnvelope(newVault(), {
  index: 0,
  total: 3_000_000n,
  count: 3,
  kind: 'group',
  split: 'equal',
  expiry: 1_800_007_200n,
  labels: ['for Mom'],
});
const json = serializeVault(saved);
const tamper = (edit: (raw: { seed: string; envelopes: Record<string, unknown>[] }) => void): string => {
  const raw = JSON.parse(json);
  edit(raw);
  return JSON.stringify(raw);
};

describe('deserializeVault', () => {
  it('round-trips', () => {
    expect(deserializeVault(json)).toEqual(saved);
  });

  it('rejects anything that is not a whole, valid vault', () => {
    const bad = [
      '',
      'null',
      '{not json',
      '[]',
      tamper((r) => (r.seed = 'AAAA')),
      tamper((r) => (r.seed = '!!')),
      tamper((r) => ((r as Record<string, unknown>).envelopes = 7)),
      tamper((r) => ((r.envelopes as unknown[])[0] = null)),
      tamper((r) => (r.envelopes[0].count = 17)),
      tamper((r) => (r.envelopes[0].count = 0)),
      tamper((r) => (r.envelopes[0].index = -1)),
      tamper((r) => (r.envelopes[0].total = '2')),
      tamper((r) => (r.envelopes[0].total = 3_000_000)),
      tamper((r) => (r.envelopes[0].expiry = 'soon')),
      tamper((r) => (r.envelopes[0].kind = 'secret')),
      tamper((r) => (r.envelopes[0].split = 'random')),
      tamper((r) => (r.envelopes[0].labels = [1])),
    ];
    for (const text of bad) expect(() => deserializeVault(text), text).toThrow('invalid vault');
  });

  it('accepts a vault saved before labels existed', () => {
    expect(deserializeVault(tamper((r) => delete r.envelopes[0].labels)).envelopes[0].labels).toEqual([]);
  });
});

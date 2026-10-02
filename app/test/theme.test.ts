import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOKENS, contrast, type Token } from '../src/theme';

describe('colour tokens', () => {
  it('are the same values index.css gives Tailwind', () => {
    const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
    for (const [name, hex] of Object.entries(TOKENS)) expect(css, name).toContain(`--color-${name}: ${hex};`);
  });

  it('keep every text pair at WCAG AA (4.5:1), and red text for large type at 3:1', () => {
    const pairs: Array<[Token | '#ffffff', Token]> = [
      ['paper', 'night'],
      ['paper-soft', 'night'],
      ['paper-dim', 'night'],
      ['paper-dim', 'night-deep'],
      ['seal', 'night'],
      ['error', 'night'],
      ['paper', 'ember'],
      ['paper-soft', 'ember'],
      ['seal-ink', 'seal'],
      ['#ffffff', 'lantern-deep'],
    ];
    const hex = (t: Token | '#ffffff') => (t.startsWith('#') ? t : TOKENS[t as Token]);
    for (const [fg, bg] of pairs) expect(contrast(hex(fg), TOKENS[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOKENS.lantern, TOKENS.night)).toBeGreaterThanOrEqual(3);
  });
});

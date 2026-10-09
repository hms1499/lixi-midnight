import { describe, expect, it } from 'vitest';
import { staticGraph, wasmInEntry, type Manifest } from '../scripts/entry-graph.ts';

const files: Record<string, string> = {
  'assets/index.js': 'import "./shell.js"; const Claim = () => import("./Claim.js");',
  'assets/shell.js': 'export const shell = 1;',
  'assets/Claim.js': 'import "./ledger.js";',
  'assets/ledger.js':
    'await WebAssembly.instantiateStreaming(fetch(new URL("midnight_ledger_wasm_bg.wasm", import.meta.url)));',
};
const read = (file: string) => files[file];

const lazy: Manifest = {
  'index.html': {
    file: 'assets/index.js',
    isEntry: true,
    imports: ['_shell.js'],
    dynamicImports: ['src/pages/Claim.tsx'],
  },
  '_shell.js': { file: 'assets/shell.js' },
  'src/pages/Claim.tsx': { file: 'assets/Claim.js', imports: ['_ledger.js'] },
  '_ledger.js': { file: 'assets/ledger.js' },
};

describe('entry graph', () => {
  it('follows static imports only, from the entry', () => {
    expect(staticGraph(lazy)).toEqual(['assets/index.js', 'assets/shell.js']);
  });

  it('passes when only a lazy chunk reaches the WASM', () => {
    expect(wasmInEntry(lazy, read)).toBeUndefined();
  });

  it('names the static chunk that reaches it', () => {
    const eager: Manifest = { ...lazy, '_shell.js': { file: 'assets/shell.js', imports: ['_ledger.js'] } };
    expect(wasmInEntry(eager, read)).toBe('assets/ledger.js');
  });

  it('catches a .wasm asset listed on a static chunk', () => {
    const asset: Manifest = { ...lazy, '_shell.js': { file: 'assets/shell.js', assets: ['assets/x_bg.wasm'] } };
    expect(wasmInEntry(asset, read)).toBe('assets/x_bg.wasm');
  });

  it('refuses a manifest with no entry', () => {
    expect(() => staticGraph({ a: { file: 'a.js' } })).toThrow('no entry chunk in the manifest');
  });
});

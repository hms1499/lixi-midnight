// Fails the build when the first paint would wait for WebAssembly (user moments spec §3.1).
import { readFileSync } from 'node:fs';
import { wasmInEntry, type Manifest } from './entry-graph.ts';

const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8')) as Manifest;
const culprit = wasmInEntry(manifest, (file) => readFileSync(new URL(file, dist), 'utf8'));
if (culprit) {
  console.error(
    `check-entry: ${culprit} loads WebAssembly before the first paint. Keep @lixi/sdk, @lixi/contract and chain/midnight.ts out of the shell.`,
  );
  process.exit(1);
}
console.log('check-entry: the first paint loads no WebAssembly');

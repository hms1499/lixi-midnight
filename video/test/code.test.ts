import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimCircuit } from '../lib/code.ts';
import { ROOT } from '../lib/paths.ts';

test('cuts the claim circuit out of the contract, from its signature to its closing brace', () => {
  const src = 'x\nexport circuit claim(id: Bytes<32>): [] {\n  a;\n}\n\nexport circuit refund() {\n}\n';
  assert.equal(claimCircuit(src), 'export circuit claim(id: Bytes<32>): [] {\n  a;\n}');
});

test('finds it in the real lixi.compact', () => {
  const code = claimCircuit(readFileSync(`${ROOT}contract/src/lixi.compact`, 'utf8'));
  assert.match(code, /^export circuit claim\(/);
  assert.match(code, /nullifiers\.insert\(nf\);/);
  assert.match(code, /sendUnshielded/);
});

test('says so when the circuit is missing', () => {
  assert.throws(() => claimCircuit('nothing here'), /claim circuit not found/);
});

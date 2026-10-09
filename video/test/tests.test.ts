import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countTests, terminalLines } from '../lib/tests.ts';

const ESC = String.fromCharCode(27);

test('adds up the passed tests of every workspace, ignoring colour codes', () => {
  const out = [
    ` ${ESC}[32mTests${ESC}[39m  32 passed (32)`,
    '      Tests  44 passed (44)',
    '      Tests  17 passed | 2 skipped (19)',
    '      Tests  169 passed (169)',
  ].join('\n');
  assert.equal(countTests(out), 262);
});

test('refuses a run with any failure, so the video never claims a count from a red run', () => {
  assert.throws(() => countTests('      Tests  1 failed | 168 passed (169)'), /failures/);
});

test('refuses output with no vitest summary', () => {
  assert.throws(() => countTests('npm ERR! missing script'), /no vitest summary/);
});

test('the terminal shows repo-relative paths and drops sourcemap warnings', () => {
  const root = '/home/me/lixi/';
  const lines = [
    ' RUN  v4.1.11 /home/me/lixi/sdk',
    'Sourcemap for "/home/me/lixi/contract/src/managed/lixi/contract/index.js" points to missing source files',
    '      Tests  44 passed (44)',
    '> lixi@0.1.0 test /home/me/lixi',
  ];
  assert.deepEqual(terminalLines(lines, root), [
    ' RUN  v4.1.11 sdk',
    '      Tests  44 passed (44)',
    '> lixi@0.1.0 test .',
  ]);
});

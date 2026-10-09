import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, SIM_LABEL, narrationFor } from '../script.ts';

const words = (t: string) => t.split(/\s+/).length;

test('ten scenes, in order, each with narration', () => {
  assert.deepEqual(
    SCENES.map((s) => s.id),
    ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'],
  );
  for (const s of SCENES) assert.ok(s.narration.length > 20, s.id);
});

test('simulator scenes are labelled, and the live scene has a fallback', () => {
  for (const id of ['s3', 's4', 's6']) assert.equal(SCENES.find((s) => s.id === id)!.label, SIM_LABEL);
  assert.ok(SCENES.find((s) => s.id === 's5')!.fallbackNarration);
});

test('the test count is filled in from the run, never left as a placeholder', () => {
  const s8 = SCENES.find((s) => s.id === 's8')!;
  assert.match(narrationFor(s8, 213, true), /^.* 213 tests run on every push/s);
  for (const s of SCENES) assert.doesNotMatch(narrationFor(s, 213, true), /\{N\}/);
});

test('the narration fits a 3:30–4:15 video at the voice’s pace', () => {
  const total = SCENES.reduce((n, s) => n + words(narrationFor(s, 213, true)), 0);
  assert.ok(total >= 480 && total <= 640, `${total} words`);
});

test('on-screen and spoken privacy claims stay within the README: the chain, not everyone, never learns which link paid', async () => {
  const { readFileSync } = await import('node:fs');
  const cards = readFileSync(new URL('../scenes/cards.html', import.meta.url), 'utf8');
  assert.doesNotMatch(cards, /Nobody can tell which link paid/);
  const s7 = SCENES.find((s) => s.id === 's7')!.narration;
  assert.match(s7, /which link paid it stays private on chain/);
});

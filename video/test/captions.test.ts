import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cueTimes, sentences, toSrt } from '../lib/captions.ts';
import { sceneSeconds } from '../lib/timing.ts';

test('splits narration into sentences, keeping the punctuation', () => {
  assert.deepEqual(sentences('Lixi. Private red envelopes on Midnight. Try it!'), [
    'Lixi.',
    'Private red envelopes on Midnight.',
    'Try it!',
  ]);
});

test('cues tile the whole scene: first from 0, last to the end, no gaps, spans by word count', () => {
  const cues = cueTimes('One two three. Four.', 0.3, 4, 6);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 0);
  assert.equal(cues[0].end, 0.3 + 3);
  assert.equal(cues[1].start, cues[0].end);
  assert.equal(cues[1].end, 6);
});

test('a one-sentence scene shows its caption the whole time', () => {
  assert.deepEqual(cueTimes('Lixi.', 0.3, 1, 2), [{ start: 0, end: 2, text: 'Lixi.' }]);
});

test('SRT timestamps use hours, minutes, seconds and milliseconds', () => {
  assert.equal(toSrt([{ start: 61.5, end: 3725.25, text: 'Hi.' }]), '1\n00:01:01,500 --> 01:02:05,250\nHi.\n');
});

test('a scene lasts for its voice plus padding, or its footage if longer', () => {
  assert.equal(sceneSeconds(10), 10.9);
  assert.equal(sceneSeconds(10, 20), 20);
});

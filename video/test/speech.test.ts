import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spoken } from '../lib/speech.ts';

test('says the words the built-in voices mangle, and leaves the rest', () => {
  assert.equal(spoken('In Vietnam, at Tết, you give lì xì.'), 'In Vietnam, at Tet, you give lee see.');
  assert.equal(spoken('This is Lixi.'), 'This is Lee see.');
  assert.equal(spoken('ten tNIGHT with 1AM on Preprod'), 'ten tee night with one A M on pre prod');
  assert.equal(spoken('Try it at lixi-3nv dot pages dot dev.'), 'Try it at lixi dash 3 N V, dot pages dot dev.');
  assert.equal(
    spoken('three circuits: createEnvelope, claim and refund'),
    'three circuits: create envelope, claim and refund',
  );
});

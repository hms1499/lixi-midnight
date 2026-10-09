import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enableExpr, labelSpans } from '../lib/ffmpeg.ts';

test('an overlay shows from its start up to, not including, its end, so cues never overlap on a frame', () => {
  assert.equal(enableExpr(1, 2.5), 'gte(t,1.000)*lt(t,2.500)');
});

test('the scene label steps aside while a sped-up label takes its place', () => {
  assert.deepEqual(labelSpans(20, [{ start: 4, end: 8 }]), [
    { start: 0, end: 4 },
    { start: 8, end: 20 },
  ]);
  assert.deepEqual(labelSpans(20, []), [{ start: 0, end: 20 }]);
});

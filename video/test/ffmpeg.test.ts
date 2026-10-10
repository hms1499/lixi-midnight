import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enableExpr, labelSpans, musicFilter } from '../lib/ffmpeg.ts';

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

test('the music runs the whole video: cut to its length, faded in at the start and out at the very end', () => {
  assert.equal(
    musicFilter(221.9),
    'atrim=duration=221.900,afade=in:st=0:d=2,afade=out:st=218.900:d=3,loudnorm=I=-18:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo',
  );
});

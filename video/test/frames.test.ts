import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clip, concatList, retime } from '../lib/frames.ts';

test('clip keeps the shots inside the window, rebased, with the last earlier shot standing in at 0', () => {
  const shots = [{ at: 10 }, { at: 12 }, { at: 15 }, { at: 21 }];
  assert.deepEqual(clip(shots, 13, 20), [{ at: 0 }, { at: 2 }]);
});

test('retime plays a segment faster and shifts what follows', () => {
  const segs = [{ from: 10, to: 30, factor: 10 }];
  assert.equal(retime(5, segs), 5);
  assert.equal(retime(20, segs), 11);
  assert.equal(retime(30, segs), 12);
  assert.equal(retime(40, segs), 22);
});

test('the concat list holds each frame until the next, and the last until the end', () => {
  const list = concatList(
    [
      { file: '/a/0.jpg', at: 0 },
      { file: '/a/1.jpg', at: 1.5 },
    ],
    4,
  );
  assert.equal(
    list,
    "ffconcat version 1.0\nfile '/a/0.jpg'\nduration 1.5000\nfile '/a/1.jpg'\nduration 2.5000\nfile '/a/1.jpg'\n",
  );
});

test('an empty recording is an error, not a silent black scene', () => {
  assert.throws(() => concatList([], 3), /no frames/);
});

import { mkdirSync, writeFileSync } from 'node:fs';
import { FPS } from './timing.ts';

export type Shot = { data: Buffer; at: number };
export type Frame = { file: string; at: number };
/** Recording-clock seconds [from, to) played `factor` times faster. */
export type Segment = { from: number; to: number; factor: number };

/** The shots in [start, end), rebased to start; the last shot before start stands in at 0. */
export const clip = <T extends { at: number }>(shots: T[], start: number, end: number): T[] => {
  const before = shots.filter((s) => s.at <= start).at(-1);
  const inside = shots.filter((s) => s.at > start && s.at < end);
  return [...(before ? [{ ...before, at: start }] : []), ...inside].map((s) => ({ ...s, at: s.at - start }));
};

/** Output time for recording time `t`, given sorted, non-overlapping sped-up segments. */
export const retime = (t: number, segments: Segment[]): number => {
  let shift = 0;
  for (const s of segments) {
    if (t <= s.from) break;
    const inside = Math.min(t, s.to) - s.from;
    shift += inside - inside / s.factor;
  }
  return t - shift;
};

/** An ffconcat list showing each frame until the next one, and the last until `end`. */
export const concatList = (frames: Frame[], end: number): string => {
  if (frames.length === 0) throw new Error('no frames were recorded');
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].at : end;
    lines.push(`file '${f.file}'`, `duration ${Math.max(next - f.at, 1 / FPS).toFixed(4)}`);
  });
  lines.push(`file '${frames.at(-1)!.file}'`); // the concat demuxer only honours the last duration this way
  return `${lines.join('\n')}\n`;
};

/** Writes shots as numbered JPEGs into `dir`. */
export const writeFrames = (shots: Shot[], dir: string): Frame[] => {
  mkdirSync(dir, { recursive: true });
  return shots.map((s, i) => {
    const file = `${dir}/${String(i).padStart(5, '0')}.jpg`;
    writeFileSync(file, s.data);
    return { file, at: s.at };
  });
};

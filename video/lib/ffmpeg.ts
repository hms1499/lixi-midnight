import { writeFileSync } from 'node:fs';
import { run } from './run.ts';
import { OUT } from './paths.ts';
import { FADE, FPS, MUSIC_FADE_IN, MUSIC_FADE_OUT } from './timing.ts';

export type Overlay = { png: string; start: number; end: number };

const f3 = (n: number) => n.toFixed(3);

/** Shown from `start` up to, not including, `end`, so back-to-back overlays never share a frame. */
export const enableExpr = (start: number, end: number): string => `gte(t,${f3(start)})*lt(t,${f3(end)})`;

/** The scene label's spans: the whole scene except where a sped-up label stands in its place. */
export const labelSpans = (
  seconds: number,
  sped: { start: number; end: number }[],
): { start: number; end: number }[] => {
  const spans: { start: number; end: number }[] = [];
  let at = 0;
  for (const s of [...sped].sort((a, b) => a.start - b.start)) {
    if (s.start > at) spans.push({ start: at, end: s.start });
    at = Math.max(at, s.end);
  }
  if (at < seconds) spans.push({ start: at, end: seconds });
  return spans;
};

/** Encodes one scene, silent: its footage held to `seconds`, overlays, and fades at both ends. The music comes at the join. */
export const encodeScene = async (o: {
  video: string[];
  overlays: Overlay[];
  seconds: number;
  out: string;
}): Promise<void> => {
  const n = o.overlays.length;
  const parts = [
    `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0c0a12,setsar=1,fps=${FPS},tpad=stop_mode=clone:stop_duration=${f3(o.seconds)},trim=duration=${f3(o.seconds)},setpts=PTS-STARTPTS[v0]`,
    ...o.overlays.map((x, i) => `[v${i}][${i + 1}:v]overlay=0:0:enable='${enableExpr(x.start, x.end)}'[v${i + 1}]`),
    `[v${n}]fade=in:st=0:d=${FADE},fade=out:st=${f3(o.seconds - FADE)}:d=${FADE},format=yuv420p[vout]`,
  ];
  await run('ffmpeg', [
    '-y',
    ...o.video,
    // Looped, so the overlays survive a filter re-init when the footage changes size (a page with a scrollbar).
    ...o.overlays.flatMap((x) => ['-loop', '1', '-i', x.png]),
    '-filter_complex',
    parts.join(';'),
    '-map',
    '[vout]',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-r',
    String(FPS),
    '-t',
    f3(o.seconds),
    o.out,
  ]);
};

/** The background track's filter: cut to the video's length, faded in and out, at a background loudness. */
export const musicFilter = (seconds: number): string =>
  [
    `atrim=duration=${f3(seconds)}`,
    `afade=in:st=0:d=${MUSIC_FADE_IN}`,
    `afade=out:st=${f3(seconds - MUSIC_FADE_OUT)}:d=${MUSIC_FADE_OUT}`,
    'loudnorm=I=-18:TP=-1.5:LRA=11',
    'aresample=48000',
    'aformat=channel_layouts=stereo',
  ].join(',');

/** Joins the scene files in order and lays one music track under all of them, looped if it is shorter. */
export const joinScenes = async (
  files: string[],
  o: { music: string; seconds: number; out: string },
): Promise<void> => {
  const list = `${OUT}scenes.txt`;
  writeFileSync(list, files.map((f) => `file '${f}'`).join('\n') + '\n');
  await run('ffmpeg', [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-stream_loop',
    '-1',
    '-i',
    o.music,
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:v',
    'copy',
    '-af',
    musicFilter(o.seconds),
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-t',
    f3(o.seconds),
    o.out,
  ]);
};

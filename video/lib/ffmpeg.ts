import { writeFileSync } from 'node:fs';
import { run } from './run.ts';
import { OUT } from './paths.ts';
import { FADE, FPS } from './timing.ts';

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

/** Encodes one scene: its footage held to `seconds`, the voice after `lead`, overlays, and fades at both ends. */
export const encodeScene = async (o: {
  video: string[];
  voice: string;
  lead: number;
  overlays: Overlay[];
  seconds: number;
  out: string;
}): Promise<void> => {
  const n = o.overlays.length;
  const parts = [
    `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0c0a12,setsar=1,fps=${FPS},tpad=stop_mode=clone:stop_duration=${f3(o.seconds)},trim=duration=${f3(o.seconds)},setpts=PTS-STARTPTS[v0]`,
    ...o.overlays.map((x, i) => `[v${i}][${i + 2}:v]overlay=0:0:enable='${enableExpr(x.start, x.end)}'[v${i + 1}]`),
    `[v${n}]fade=in:st=0:d=${FADE},fade=out:st=${f3(o.seconds - FADE)}:d=${FADE},format=yuv420p[vout]`,
    `[1:a]adelay=${Math.round(o.lead * 1000)}:all=1,apad,atrim=duration=${f3(o.seconds)},afade=in:st=0:d=${FADE},afade=out:st=${f3(o.seconds - FADE)}:d=${FADE},aresample=48000,aformat=channel_layouts=stereo[aout]`,
  ];
  await run('ffmpeg', [
    '-y',
    ...o.video,
    '-i',
    o.voice,
    // Looped, so the overlays survive a filter re-init when the footage changes size (a page with a scrollbar).
    ...o.overlays.flatMap((x) => ['-loop', '1', '-i', x.png]),
    '-filter_complex',
    parts.join(';'),
    '-map',
    '[vout]',
    '-map',
    '[aout]',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-r',
    String(FPS),
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-t',
    f3(o.seconds),
    o.out,
  ]);
};

/** Joins the scene files in order and normalises loudness to −16 LUFS. */
export const joinScenes = async (files: string[], out: string): Promise<void> => {
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
    '-c:v',
    'copy',
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    out,
  ]);
};

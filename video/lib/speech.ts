import { run } from './run.ts';

/** How the built-in voices should say words they mangle. Captions keep the written form. Order matters. */
const PRONOUNCE: ReadonlyArray<readonly [RegExp, string]> = [
  [/lixi-3nv\.pages\.dev/g, 'lixi dash 3 N V, dot pages dot dev'],
  [/lì xì/g, 'lee see'],
  [/Lixi/g, 'Lee see'],
  [/Tết/g, 'Tet'],
  [/tNIGHT/g, 'tee night'],
  [/\b1AM\b/g, 'one A M'],
  [/Preprod/g, 'pre prod'],
  [/createEnvelope/g, 'create envelope'],
];

export const spoken = (text: string): string => PRONOUNCE.reduce((t, [re, say]) => t.replace(re, say), text);

/** Speaks `text` with a macOS voice into a 48 kHz 16-bit WAV file. */
export const synthesize = async (text: string, voice: string, file: string): Promise<void> => {
  await run('say', ['-v', voice, '-o', file, '--file-format=WAVE', '--data-format=LEI16@48000', spoken(text)]);
};

export const audioSeconds = async (file: string): Promise<number> =>
  Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).trim());

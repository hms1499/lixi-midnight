export type Cue = { start: number; end: number; text: string };

export const sentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * One cue per sentence, each spanning a share of the speech proportional to its words. The first cue starts at 0
 * and the last ends at `scene`, so exactly one caption is on screen at every moment.
 */
export const cueTimes = (text: string, lead: number, speech: number, scene: number): Cue[] => {
  const parts = sentences(text);
  const words = parts.map((s) => s.split(/\s+/).length);
  const total = words.reduce((a, b) => a + b, 0);
  let at = lead;
  return parts.map((part, i) => {
    const start = i === 0 ? 0 : at;
    at += (speech * words[i]) / total;
    return { start, end: i === parts.length - 1 ? scene : at, text: part };
  });
};

const stamp = (seconds: number): string => {
  const ms = Math.round(seconds * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

export const toSrt = (cues: Cue[]): string =>
  cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n');

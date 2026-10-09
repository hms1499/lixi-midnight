// Renders scene 1's narration in two voices, so the user can pick one (spec §5.2).
import { mkdirSync } from 'node:fs';
import { OUT } from './lib/paths.ts';
import { synthesize } from './lib/speech.ts';

const TEXT =
  'In Vietnam, at Tết, you give lì xì: lucky money in a red envelope. Only the person who opens it sees what is inside. This is Lixi, private red envelopes on Midnight.';
mkdirSync(`${OUT}voice-samples`, { recursive: true });
for (const voice of ['Samantha', 'Daniel']) {
  const file = `${OUT}voice-samples/${voice}.wav`;
  await synthesize(TEXT, voice, file);
  console.log(file);
}

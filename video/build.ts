// Builds the demo video (spec §5). Usage: node build.ts [--scene s3]… [--all] [--fresh-tests] [--fallback-tx <hash>]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { launch } from './lib/browser.ts';
import { cueTimes, toSrt, type Cue } from './lib/captions.ts';
import { renderCard, writeTokens } from './lib/cards.ts';
import { encodeScene, joinScenes, type Overlay } from './lib/ffmpeg.ts';
import { renderOverlays } from './lib/overlays.ts';
import { OUT } from './lib/paths.ts';
import { audioSeconds, synthesize } from './lib/speech.ts';
import { LEAD, sceneSeconds } from './lib/timing.ts';
import { SCENES, VOICE, narrationFor, type Scene } from './script.ts';

const { values } = parseArgs({
  options: {
    scene: { type: 'string', multiple: true, default: [] },
    all: { type: 'boolean', default: false },
    'fresh-tests': { type: 'boolean', default: false },
    'fallback-tx': { type: 'string' },
  },
});

/** What a scene shows: ffmpeg input args, how long the footage runs, and extra timed labels. */
type Visual = { video: string[]; footage: number; labels: Overlay[] };

const named = values.scene!;
const wanted = (s: Scene) =>
  values.all || named.includes(s.id) || (named.length === 0 && !existsSync(`${OUT}${s.id}.mp4`));

writeTokens();
const testCount = 0; // Task 8 replaces this with the real count
const live = false; // Task 10 replaces this

const browser = await launch({ fileAccess: true });
try {
  for (const scene of SCENES.filter(wanted)) {
    const dir = `${OUT}${scene.id}`;
    mkdirSync(dir, { recursive: true });
    const text = narrationFor(scene, testCount, live);
    const voice = `${dir}/voice.wav`;
    await synthesize(text, VOICE, voice);
    const speech = await audioSeconds(voice);

    let visual: Visual;
    let seconds: number;
    if (scene.kind === 'card') {
      seconds = sceneSeconds(speech);
      await renderCard(browser, { scene: scene.id, seconds, data: {}, dir: `${dir}/frames` });
      visual = { video: ['-framerate', '30', '-i', `${dir}/frames/%05d.jpg`], footage: seconds, labels: [] };
    } else {
      throw new Error(`${scene.id}: ${scene.kind} scenes are built in a later task`);
    }

    const cues: Cue[] = cueTimes(text, LEAD, speech, seconds);
    const overlays: Overlay[] = cues.map((c, i) => ({ png: `${dir}/cap-${i}.png`, start: c.start, end: c.end }));
    const items = cues.map((c, i) => ({ text: c.text, label: '', file: overlays[i].png }));
    if (scene.label) {
      items.push({ text: '', label: scene.label, file: `${dir}/label.png` });
      overlays.push({ png: `${dir}/label.png`, start: 0, end: seconds });
    }
    await renderOverlays(items);
    await encodeScene({
      video: visual.video,
      voice,
      lead: LEAD,
      overlays: [...overlays, ...visual.labels],
      seconds,
      out: `${OUT}${scene.id}.mp4`,
    });
    writeFileSync(`${dir}/meta.json`, JSON.stringify({ seconds, cues }));
    console.log(`${scene.id} ${scene.title}: ${seconds.toFixed(1)} s`);
  }
} finally {
  await browser.close();
}

if (SCENES.every((s) => existsSync(`${OUT}${s.id}.mp4`))) {
  let offset = 0;
  const all: Cue[] = [];
  for (const s of SCENES) {
    const meta = JSON.parse(readFileSync(`${OUT}${s.id}/meta.json`, 'utf8')) as { seconds: number; cues: Cue[] };
    all.push(...meta.cues.map((c) => ({ ...c, start: c.start + offset, end: c.end + offset })));
    offset += meta.seconds;
  }
  await joinScenes(
    SCENES.map((s) => `${OUT}${s.id}.mp4`),
    `${OUT}lixi-wave2.mp4`,
  );
  writeFileSync(`${OUT}lixi-wave2.srt`, toSrt(all));
  console.log(`lixi-wave2.mp4: ${offset.toFixed(1)} s`);
}

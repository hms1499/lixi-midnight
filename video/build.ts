// Builds the demo video (spec §5). Usage: node build.ts [--scene s3]… [--all] [--fresh-tests] [--fallback-tx <hash>]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { launch, newContext } from './lib/browser.ts';
import { cueTimes, toSrt, type Cue } from './lib/captions.ts';
import { renderCard, writeTokens } from './lib/cards.ts';
import { encodeScene, joinScenes, type Overlay } from './lib/ffmpeg.ts';
import { renderOverlays } from './lib/overlays.ts';
import { claimCircuit } from './lib/code.ts';
import { OUT, ROOT } from './lib/paths.ts';
import { audioSeconds, synthesize } from './lib/speech.ts';
import { recordTestRun, terminalLines, type TestLine } from './lib/tests.ts';
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
type TestRun = { lines: TestLine[]; count: number; seconds: number };
const testRunFile = `${OUT}test-run.json`;
if (values['fresh-tests'] || !existsSync(testRunFile)) {
  console.log('running npm test for scene 8 (takes a few minutes)…');
  writeFileSync(testRunFile, JSON.stringify(await recordTestRun()));
}
const testRun = JSON.parse(readFileSync(testRunFile, 'utf8')) as TestRun;
const testCount = testRun.count;
const live = false; // Task 10 replaces this

const ciPng = `${OUT}s8/ci.png`;
const cardData = (id: string, seconds: number): unknown => {
  if (id === 's7') return { code: claimCircuit(readFileSync(`${ROOT}contract/src/lixi.compact`, 'utf8')) };
  if (id === 's8') {
    const lines = testRun.lines.filter((l) => l.text.trim() !== '' && !l.text.startsWith('Sourcemap for '));
    const replay = 0.25 * seconds;
    return {
      lines: terminalLines(
        lines.map((l) => l.text),
        ROOT,
      ),
      times: lines.map((l) => l.at / testRun.seconds),
      count: testRun.count,
      speed: Math.max(1, Math.round(testRun.seconds / replay)),
      ci: pathToFileURL(ciPng).href,
    };
  }
  return {};
};

const browser = await launch({ fileAccess: true });
try {
  if (!existsSync(ciPng)) {
    mkdirSync(`${OUT}s8`, { recursive: true });
    const page = await (await newContext(browser)).newPage();
    await page.goto('https://github.com/hms1499/lixi-midnight/actions/workflows/ci.yml', { waitUntil: 'networkidle' });
    await page.screenshot({ path: ciPng });
    await page.close();
  }
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
      await renderCard(browser, { scene: scene.id, seconds, data: cardData(scene.id, seconds), dir: `${dir}/frames` });
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

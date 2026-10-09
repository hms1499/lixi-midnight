# Demo video

Builds `out/lixi-wave2.mp4` and `out/lixi-wave2.srt` from code (spec: `docs/superpowers/specs/2026-10-09-lixi-demo-video-design.md`).

Needs Node 24, ffmpeg, macOS `say`, Google Chrome, and `compact` on `PATH` (scene 8 runs the real `npm test`).

```bash
cd video && npm install
node build.ts                    # builds missing scenes, then joins them
node build.ts --scene s7         # rebuilds one scene (s3, s4, s6 are recorded together)
node build.ts --all --fresh-tests
```

Scene 5 (live on Preprod) needs Playwright's Chromium (Chrome ignores `--load-extension`), a one-time
`node setup-1am.ts` (import a test wallet by hand; on macOS quit Chromium, not just its window), then
`node record-live.ts` while you approve 1AM's popups. Without it, pass `--fallback-tx <claim tx hash>`.

The narration lives in `script.ts`; pronunciation fixes for the voice in `lib/speech.ts`.

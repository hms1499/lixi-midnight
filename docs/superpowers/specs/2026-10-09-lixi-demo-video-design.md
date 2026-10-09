# Lixi demo video: a code-built walkthrough of the whole project

**Design spec · 2026-10-09 · Status: draft, awaiting review**

**Parent specs:** `docs/superpowers/specs/2026-10-07-lixi-wave2-submission-design.md` (the submission needs a demo video) and `docs/superpowers/specs/2026-10-02-lixi-frontend-design.md` (colours, type, the meaning of a light's state). This spec adds a video pipeline and a dev-only demo entry to the app. The contract, the SDK, the CLI and the shipped site do not change.

---

## 1. Why

AKINDO requires a demo video for Wave 2 (due 2026-10-17), and Communication (10%) is scored on "the clarity and structure of the video presentation and slide deck". The video is also the fastest way for a judge to see the other rubric lines: Engineering (40%), QA (15%), Product (15%), UX (15%) and BizDev (5%).

The video covers the whole project: the idea, the full sender and recipient flows, a real Preprod opening, how the contract keeps the link private, the engineering behind it, the market, the limits and the roadmap.

**Done when:** `video/out/lixi-wave2.mp4` (1920×1080, 30 fps, H.264 + AAC, 3:30–4:15 long) and `video/out/lixi-wave2.srt` exist, the user has watched the MP4 and approved it, and they can upload it and paste its link into `docs/submission/wave-2.md`.

## 2. Decisions (brainstorm, 2026-10-09)

| Question | Choice |
|---|---|
| Who does what | The video is built by code. The user only clicks 1AM's approve popup during scene 5 and imports a test wallet once |
| Footage | Hybrid: the app flows run against a local simulator; one opening runs live on Preprod with real 1AM |
| Voice | macOS `say`, a built-in voice (Samantha or Daniel; the user picks after hearing both) |
| Length | 3–4 minutes |
| Language | English narration and on-screen text (judges); captions burned in, plus an `.srt` |
| Honesty | Simulator scenes carry a corner label; the live scene carries "Live on Preprod"; sped-up waits say so |

## 3. Storyboard

Times are targets; each scene's real length is set by its narration (§5.2). Narration drafts follow the privacy wording of the README (§ Privacy model, § Limitations) and must not claim more.

| # | Target | Scene | Visual kind |
|---|---|---|---|
| 1 | 0:00–0:20 | Hook: what lì xì is, what Lixi is | `card` |
| 2 | 0:20–0:40 | Problem: red packets on EVM/Solana/BSC are public | `card` |
| 3 | 0:40–1:15 | Seal: Home → Fill an envelope → 10 tNIGHT, 4 lucky, 1 day → Seal → Share page | `capture` (simulator) |
| 4 | 1:15–1:50 | Open: the claim page shows what is inside → connect → Open → slip and privacy receipt; a second opening is refused; a group link | `capture` (simulator) |
| 5 | 1:50–2:10 | The same opening live on Preprod with 1AM, then the transaction on the explorer | `live` |
| 6 | 2:10–2:25 | Dashboard: lights, Bring home after expiry, backup | `capture` (simulator) |
| 7 | 2:25–3:05 | How it works: Merkle root on chain, private witnesses, nullifier, unshielded payout; the `claim` circuit; the privacy table | `card` (animated diagram + code) |
| 8 | 3:05–3:30 | Engineering: four packages, the real `npm test` run, CI, devnet e2e, CSP, no admin key | `card` + `terminal` + CI screenshot |
| 9 | 3:30–3:50 | Market, limits, Wave 3 roadmap | `card` |
| 10 | 3:50–4:00 | Outro: site, repo, deck | `card` |

### 3.1 Narration drafts

1. *In Vietnam, at Tết, you give lì xì: lucky money in a red envelope. Only the person who opens it sees what is inside. This is Lixi, private red envelopes on Midnight. You seal tNIGHT into an envelope and share it as links, one lì xì per link.*
2. *Red packets already exist on EVM, Solana and BSC, but they are fully public. The split and every claim code sit on chain, so anyone can see who gets what. Lixi keeps the part of lì xì that matters: the link stays secret.*
3. *Let's fill one. Ten tNIGHT, four lì xì, lucky amounts, expiring in a day. The split is drawn in the browser and stays there. On chain, the contract keeps only a Merkle root of the lì xì, the deposit, the expiry and the refund address. Sealing is one transaction. Each lì xì is then a link, and its secret lives only in the URL fragment, which browsers never send to a server. Copy a link with a greeting and send it in any chat.*
4. *A recipient opens the link and sees what is inside before connecting a wallet. They connect and open it, and a zero-knowledge proof shows they hold a valid lì xì in this envelope, without saying which one. A one-time nullifier stops the link paying twice, and the tNIGHT lands in their wallet. The receipt says what stayed private for this envelope. Opening the same link again is refused. A group link is one link for everyone, and each wallet can open one lì xì.*
5. *That was a local simulator running the compiled contract. Here is the same opening live on Preprod, with the 1AM wallet, which pays the fee. The proof takes a while, so we have sped it up. And here is the transaction on the Midnight explorer.*
6. *The sender gets a dashboard. A lit lantern is still waiting; one that has gone out was opened. After the expiry, the sender brings everything unopened home in one transaction, to the address that sealed it. A backup string re-derives every envelope.*
7. *Under the hood is one Compact contract with three circuits: createEnvelope, claim and refund. The claim circuit takes the share and its Merkle path as private witnesses. It checks the path against the envelope's root, records a one-time nullifier, and pays the share out as unshielded tNIGHT. So the payout is public, while which link paid it stays private. The chain sees that an envelope exists, its total, and each payout. With lucky amounts, it never learns how many lì xì a personal envelope holds, or what the unopened ones contain.*
8. *The repo has four packages: the Compact contract, an SDK, a CLI for deploys and smoke tests, and the React app. {N} tests run on every push against the real compiled contract, plus a devnet end-to-end suite with concurrent claims. The page ships a strict content security policy, and the contract gave up its maintenance authority at deploy, so nobody can change it.*
9. *Vietnamese families give lì xì every Tết, at weddings and birthdays, and across the diaspora. Today Lixi runs on Preprod, in desktop Chrome with 1AM, and payouts are public. Wave 3 brings the 1AM mobile app, a fee sponsor so any wallet can open a lì xì, shielded payouts, and QR codes for giving in person.*
10. *Lixi. Private red envelopes on Midnight. Try it at lixi-3nv dot pages dot dev.*

`{N}` is the total test count parsed from the real `npm test` output (§5.6), never typed by hand.

## 4. Layout

```
video/                     # not an npm workspace; CI does not see it
  script.ts                # the storyboard: scenes, narration, visual kind, parameters
  build.ts                 # entry: build all scenes or --scene <n>, then assemble
  setup-1am.ts             # one-time: open the 1AM profile so the user can import a test wallet
  lib/                     # tts, frame capture, screencast, ffmpeg helpers
  scenes/                  # one HTML page per card scene, plus shared CSS
  out/                     # gitignored: per-scene cache, final MP4 and SRT
  .profile-1am/            # gitignored: the Playwright Chromium profile with 1AM
app/demo/index.html        # dev-only entry; not in the Vite build input
app/demo/main.tsx          # the real App wired to LixiSimulator and a demo wallet
```

The scripts are TypeScript run directly by Node 24, like `app/scripts/*.ts`. Playwright comes from the root `node_modules` if it is already there, otherwise it is added as a root dev dependency (the browsers are already in `~/Library/Caches/ms-playwright`). `video/out/` and `video/.profile-1am/` go into `.gitignore`.

## 5. Pipeline

### 5.1 The storyboard file

`video/script.ts` exports the ten scenes. Each has an `id`, `narration`, `kind` (`card` | `capture` | `live` | `terminal`), and kind-specific parameters: a card page and its animation cues, a capture's Playwright steps, or the live scene's steps. Everything else reads from it, so wording changes happen in one place.

### 5.2 Voice and timing

- `say -v <voice> -o out/<id>.aiff <narration>`, then `ffprobe` for the length.
- A scene lasts `max(narration + 0.6 s padding, footage length)`. Footage shorter than the narration holds its last frame; card animations stretch their cues to fit the narration.
- Captions: the narration is split into sentences; each sentence gets a time span proportional to its word count within the scene's speech span. The same cues build the `.srt` and the burned-in captions.
- Voice: default Samantha. The plan's first task renders scene 1 with Samantha and Daniel so the user can pick.

### 5.3 Card scenes (1, 2, 7, 8, 9, 10)

- One HTML page per scene in `video/scenes/`, using the app's `TOKENS` (from `app/src/theme.ts`) and its fonts, so the video looks like the product.
- Animation is a pure function of time: the page exposes `window.seek(t)`, and the capture loop calls it and screenshots at 30 fps. No wall-clock timing, so frames are sharp and every render is the same.
- Scene 7's code panel reads the `claim` circuit from `contract/src/lixi.compact` at build time; nothing is copied by hand.
- Scene 7's diagram shows: envelope → Merkle root on chain; share + path → private witness → proof; nullifier into the spent set; unshielded tNIGHT out. Then the privacy table from the README.

### 5.4 Simulator capture scenes (3, 4, 6)

- `app/demo/main.tsx` renders the real `App` with `Services` wired like `app/test/app-harness.tsx`: `LixiSimulator` (it depends only on `@midnight-ntwrk/compact-runtime`, so it should run in a browser), a `simChain` whose calls wait about 1–2 s per stage so `TxProgress` shows each step, browser `localStorage` as the vault, and a demo wallet named "Demo wallet" that reports balances.
- A small hidden control moves `sim.now` past the expiry for scene 6.
- It is served only by `vite` dev (`/demo/`). The Vite build input stays `index.html`; after `npm run build -w @lixi/app`, `app/dist/` must contain no `demo` file.
- Playwright drives the page by its visible text and roles, the same way the app tests do. Frames come from the Chrome DevTools Protocol screencast (`Page.startScreencast`, JPEG quality ≥ 90, with timestamps) and go to ffmpeg with their real timing, at a 1920×1080 viewport and device scale 1.
- The simulator returns fake transaction ids, so the capture never clicks an explorer link.
- Corner label: *Local simulator running the compiled contract (no proofs)*.
- **First risk to check:** `LixiSimulator` in the browser. If it does not run there, stop and bring it back to the user before going further.

### 5.5 The live scene (5)

- `setup-1am.ts` copies the 1AM 6.3.24 extension from the user's Chrome profile (`~/Library/Application Support/Google/Chrome/Default/Extensions/bphnkdkcnfhompoegfpgnkidcjfbojjp/6.3.24_0`) and launches Playwright's Chromium with it in `video/.profile-1am/` (headed, `--load-extension`). The user imports a test wallet and sets Preprod. The seed never passes through the script or the assistant.
- At build time, the script reuses that profile, headed:
  1. Off camera: seal a small envelope (1 tNIGHT, 1 lì xì) on `https://lixi-3nv.pages.dev`.
  2. On camera: open its link, Connect, Open. The user clicks Approve in 1AM's popup when the script asks; the script waits.
  3. The proof wait is sped up (with a "sped up" label). The slip shows, then the script opens the explorer page by the transaction hash the app shows.
- Corner label: *Live on Preprod*.
- **Fallback:** if 1AM fails (DUST, sponsor, or popup), scene 5 uses a capture of the explorer page for a real claim from Task 11, and its narration drops the "here is the same opening" line. The rest of the video does not wait on 1AM.

### 5.6 Terminal and CI (scene 8)

- The build runs the real `npm test` (Node 24) once, records each output line with its time, and parses the total test count for `{N}`.
- A terminal card replays the recorded lines at a faster speed. The text is the real output; only the pace changes, and the card says so.
- Playwright screenshots the public GitHub Actions page for `ci.yml` on `main`.

### 5.7 Assembly

- Per scene: frames + narration → `out/<id>.mp4` (H.264, yuv420p, 30 fps), cached by a hash of the scene's inputs. `--scene <n>` rebuilds one scene.
- Final: the scenes joined with 0.3 s fades, captions burned in (white on a translucent dark band, in the app's sans font), loudness normalised to −16 LUFS. Outputs: `out/lixi-wave2.mp4` and `out/lixi-wave2.srt`.
- No background music (no licensed track, and the narration carries the video).

## 6. Checks

- Each scene renders without error, and the assistant looks at a frame from the middle of each before showing the user.
- The repo's local gate stays green: format, lint, typecheck, `npm test`, and the app build. The app build has no `demo` file in `app/dist/`.
- The final MP4 is 3:30–4:15 long, 1920×1080, and has audio.
- The user watches the MP4 and approves it, or asks for changes.

## 7. Out of scope

- Uploading the video, or editing `wave-2.md` (the user pastes the link).
- A Vietnamese version, background music, a human voice, cloud TTS.
- Changing the deck. The deck's wording check stays a separate task.
- Shipping the demo entry on the live site.

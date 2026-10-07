# Lixi Wave 2 submission: live site, README, deck, AKINDO entry

**Design spec · 2026-10-07 · Status: approved in chat, pending written-spec review**

**Parent spec:** `docs/superpowers/specs/2026-09-30-lixi-design.md`. This spec covers its tasks T14–T16 and T18, plus acceptance criteria 4 and 5 (§10). The deploy target changes from Vercel to Cloudflare Pages.

---

## 1. Why

Wave 2 closes on **2026-10-17**; judging runs 17–27 October. The official rules (AKINDO wave-hack description, §6 "Submission Requirements" and §7 "Judging") require, through the AKINDO submission page:
- a public GitHub repository with the `midnightntwrk` topic, under Apache-2.0;
- a README covering the project, setup, architecture, Midnight integration, and how judges can test it;
- a **slide deck** (pitch presentation);
- a demo or video pitch.

Missing any of these makes the entry ineligible for judging.

The rubric weights are:

| Criterion | Weight |
|---|---|
| Engineering | 40% |
| QA | 15% |
| Product & Vision | 15% |
| UX (a frontend wired to the contract) | 15% |
| Communication (video and deck) | 10% |
| Business development | 5% |

A live site lets judges try the end-to-end flow themselves, which UX and Product reward.

Already in place:
- the repository is public, with the `midnightntwrk` topic and an Apache-2.0 LICENSE;
- the app works on Preprod with 1AM;
- every test suite passes.

## 2. Decisions (brainstorm, 2026-10-07)

| Question | Choice |
|---|---|
| Live demo | **Cloudflare Pages, free plan.** Static assets have no bandwidth limit. The site fits the limits: 22 files, the largest 9.7 MB against a 25 MiB cap, and a 294-character CSP against a 2,000-character cap. Netlify's free plan pauses every site once its 300 credits run out. Vercel would mean another account; the user preferred Cloudflare. |
| Slide deck | **The claude.ai Slides artifact type.** It has a share link for the submission and downloads as PPTX/PDF. |
| Video | **The user records it and writes it.** This plan only leaves a place for the link in the README, the deck and the submission text. |
| Submission | Claude drafts every field. The user pastes them into AKINDO and submits. |

## 3. Deliverables

### 3.1 Live site on Cloudflare Pages

- **The CSP header.** Add `app/public/_headers`. Vite copies it into `dist/`:
  ```
  /*
    Content-Security-Policy: <cspFor('preprod')>; frame-ancestors 'none'
  ```
  It replaces `app/vercel.json`, which is deleted. So the CSP lives in two places, `app/src/csp.ts` (the meta tag) and `_headers`. `app/test/config.test.ts` checks that `_headers` holds exactly `cspFor('preprod')` plus `; frame-ancestors 'none'`.
- **Routing.** Pages serves `index.html` for unknown paths when there is no `404.html`, so `/create`, `/dashboard` and `/c#…` work without a `_redirects` file. The plan verifies this on the deployed site.
- **The Blockfrost id.** The id ships in the public page, so the public build uses a **separate Blockfrost project**. The user creates it and puts its id in `app/.env.local` before the build. If strangers use up that project's quota, the CLI's project is unaffected. Never print the id.
- **Deploying.**
  - Run `npm run build -w @lixi/app` locally, because Cloudflare's builders have no Compact compiler.
  - Then run `npx wrangler pages deploy app/dist --project-name lixi --branch main`.
  - The first time, the user runs `npx wrangler login`. No Git integration.
  - Claude asks before every deploy, because a deploy publishes the site.
- **Checks on the live URL:**
  - the home page loads;
  - `/create` and a claim link load when opened directly;
  - the console shows no CSP violation;
  - the response carries the CSP header (`curl -sI`);
  - a phone-width view shows the desktop-only notice;
  - the user opens a real lì xì with 1AM on the live site.
- **Docs.** Update the CLAUDE.md invariants (CSP in `csp.ts` and `_headers`) and the parent spec (T14: Cloudflare Pages).

### 3.2 README rewrite

`README.md` is rewritten to meet AKINDO §6 and acceptance criterion 4, so a judge goes from clone to passing tests in under 10 minutes. Its sections, in order:
1. **One-line pitch and links:** **Try it** (the Pages URL), **Video** (`<!-- VIDEO_URL -->`, filled in by the user), **Slides** (the claude.ai share link), and **Contract on Preprod** (`deployments/preprod.json`).
2. **What it does:** the sender seals tNIGHT into up to 16 lì xì and shares links; recipients open them with a ZK proof; what nobody opens goes back to the sender after the expiry. Personal and group links.
3. **Try it in 2 minutes:** Chrome on a computer and 1AM on Preprod. 1AM pays the fee. Faucet link.
4. **Test it in 10 minutes, no wallet:** prerequisites (Node 24, Compact 0.31.1), then `npm ci && npm test`. A table of the suites and their counts at the time of writing: contract 32, sdk 44, cli 19, app 114. CI badge.
5. **Architecture:** a Mermaid diagram of app → SDK → Compact contract, with the 1AM wallet, the local proof server and the Blockfrost indexer. Package roles.
6. **How it uses Midnight:**
   - the Compact contract (`createEnvelope`, `claim`, `refund`);
   - a Merkle root of the shares;
   - nullifiers;
   - the dual ledger: private witnesses against public state, and unshielded payouts;
   - `persistentHash` against `transientHash` (spec §3.2);
   - proving in 1AM or locally (audit H4);
   - the relinquished maintenance authority.
7. **Privacy model:** what the chain sees and what stays dark. This matches the home page lists.
8. **Security and audit notes:** a link to the design spec §6 audit. The CSP. Secrets live only in the URL fragment.
9. **Limitations:**
   - Preprod only, and tNIGHT has no value;
   - 1AM on desktop Chrome only;
   - H4 (where 1AM proves) is unverified;
   - the Blockfrost id ships in the page;
   - payouts are unshielded;
   - one person with many wallets can claim several shares of a group link.
10. **Roadmap (Wave 3):**
    - claiming via 1AM mobile;
    - a sponsor that pays fees for any wallet;
    - shielded payouts;
    - larger envelopes;
    - QR codes for in-person giving.
11. **Develop:** the existing commands, kept and trimmed: devnet, Preprod scripts, Blockfrost setup.
12. **License:** Apache-2.0. Credits.

### 3.3 Slide deck (claude.ai Slides)

10–12 slides, created from the Slides artifact type (quickstart first), in English:
1. Title: Lixi, private red envelopes on Midnight; links to the live site and the repo.
2. Problem: on-chain red packets (EVM, Solana, BSC) are fully public: amounts, recipients and the split.
3. Idea: every lì xì is a link; only its link knows whose.
4. Demo flow: seal → share → open → bring home. Shown with screenshots of the live app.
5. How it works: a Merkle root of the shares, a ZK claim and a nullifier; the secret never touches the chain.
6. Privacy: what the chain sees and what stays dark.
7. Built on Midnight: the Compact contract, the dual ledger, proving in 1AM or locally, and no admin key.
8. Quality: 209 tests across 4 suites, CI on every push, a devnet E2E, an audit with its fixes.
9. Users and market: Tết, weddings, team bonuses and community giveaways. Wave 1 had no red-envelope entry among ~161 submissions.
10. Roadmap: Wave 3 items, as in the README.
11. Links: the live site, the repo, the video (placeholder) and the contract.

The deck's look follows the app: night background, lantern red, seal gold, Fraunces. It uses the design system the quickstart offers only if it fits. The share link goes into the README and the submission.

### 3.4 AKINDO submission text

`docs/submission/wave-2.md` holds ready-to-paste text for each AKINDO field:
- the project name and tagline;
- the description (problem, solution, Midnight integration, what works end to end);
- the links: repo, live site, slides and video (placeholder);
- the team member;
- the tech stack.

This is the team's first wave, so the "changes since the previous submission" field reads "First submission (joined in Wave 2)".

It ends with the **gate checklist**:
- [ ] repo public, with the `midnightntwrk` topic;
- [ ] Apache-2.0;
- [ ] the Compact contract compiles in CI;
- [ ] the README sections;
- [ ] the slides link opens without logging in;
- [ ] the video link;
- [ ] the live site works;
- [ ] the submission is made before 2026-10-17.

## 4. Out of scope

- Recording or scripting the video.
- Vercel and Netlify.
- New app features.
- Mainnet.
- Translating the docs.

## 5. Testing and verification

- **Unit.** `config.test.ts`: `_headers` holds `cspFor('preprod'); frame-ancestors 'none'` for `/*`, and `vercel.json` no longer exists. The full local gate passes: format, lint, typecheck, `npm test` and the build.
- **Live.** Every check in §3.1, recorded in the plan's last task with the URL and the date.
- **Docs.** Every README command was run in this session from a clean `npm ci`, and the counts match the output. Every link in the README and in the submission text resolves. The slides link opens in a private window.

## 6. Order

1. Cloudflare deploy. The README and the deck need the live URL.
2. README.
3. Deck.
4. Submission text and gate checklist.
5. Merge.

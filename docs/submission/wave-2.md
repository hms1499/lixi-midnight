# AKINDO Wave 2 submission: ready to paste

Paste each block into the matching field on the AKINDO submission page. Tick the gate checklist before submitting (deadline 2026-10-17).

## Project name

Lixi

## Tagline

Private red envelopes (lì xì) on Midnight: every link is one lì xì, and only its link knows whose.

## Description

On-chain red packets exist on EVM, Solana and BSC, but all of them are public: the whole split and every claim code are on chain. Lixi brings the Vietnamese lì xì to Midnight with more of the privacy it has in real life: openings are public payouts, but nobody watching the chain can tell which link paid one, and with lucky amounts, how many lì xì a personal envelope holds or what the unopened ones contain.

A sender seals tNIGHT into an envelope of up to 16 lì xì (lucky or equal amounts) and shares one link per lì xì, or one group link. A recipient opens a link, sees what is inside, connects 1AM and opens it with a zero-knowledge proof: the proof shows they hold a valid lì xì without saying which, a one-time nullifier stops the link paying twice, and the tNIGHT lands in their wallet. After the expiry the sender brings everything unopened home in one transaction.

Midnight integration: one Compact contract (`createEnvelope`, `claim`, `refund`) keeps, per envelope, a Merkle root, the deposit, the expiry, the refund address and the group flag; never the split or the link secrets. The split and the link secrets stay in the browser as private witnesses; payouts are unshielded tNIGHT, so the transfer is public while the link stays secret. Proofs are made in 1AM by default or by a proof server on the user's own machine, and the contract's maintenance authority is given up at deploy.

What works end to end on Preprod: sealing, personal and group links, opening, refusing a second opening from the same wallet, and bringing unopened lì xì home after expiry. Concurrent claims from different wallets are covered by the devnet end-to-end suite. 267 tests across the contract, SDK, CLI and app run in CI on every push, plus a devnet end-to-end workflow.

## Links

- GitHub repository: https://github.com/hms1499/lixi-midnight
- Live site: https://lixi-3nv.pages.dev
- Slide deck: https://github.com/hms1499/lixi-midnight/blob/main/docs/slides/lixi-wave2.pdf (PDF)
- Demo video: https://www.youtube.com/watch?v=Wdiv_WxkL34
- Contract on Preprod: https://github.com/hms1499/lixi-midnight/blob/main/deployments/preprod.json
- Announcement on X: https://x.com/YMongne573/status/2108751139630195014

## Changes since the previous submission

First submission (joined in Wave 2).

## Team

hms1499

## Tech stack

Compact 0.31.1 (language 0.23), midnight-js 4, React 19, Vite 8, Tailwind 4, Vitest, 1AM wallet (DApp Connector API 4), Blockfrost indexer, Cloudflare Pages.

## Gate checklist

- [ ] Repository is public and has the `midnightntwrk` topic
- [ ] LICENSE is Apache-2.0
- [ ] The Compact contract compiles (CI is green on `main`)
- [ ] README covers the project, setup, architecture, Midnight integration and how to test
- [ ] Slide deck link opens without logging in (the PDF on GitHub)
- [ ] Demo video link is pasted above and opens
- [ ] Live site opens and a claim link shows what is inside
- [ ] Submitted on AKINDO before 2026-10-17

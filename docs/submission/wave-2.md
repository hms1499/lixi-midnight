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

## About (Markdown)

The AKINDO "About" field takes Markdown. Paste the whole block below.

````markdown
# Lixi: private red envelopes on Midnight

**Every link is one lì xì, and only its link knows whose.**

## The problem
Red envelopes (lì xì, hongbao) went digital years ago: 823 million people sent or received WeChat red packets over Lunar New Year 2019, and more than 8 million MoMo users sent money or lì xì at Tết 2021. On chain, red packets exist too (Mask HappyRedPacket on EVM and Solana, Red Envelopes on BNB Chain), but every one of them is public: the whole split and every claim code sit on chain for anyone to read. A real lì xì is private.

## What Lixi does
- **Seal.** Put tNIGHT into an envelope of up to 16 lì xì, with lucky (random) or equal amounts, and pick when it expires.
- **Share.** One link per lì xì for family and friends, or one group link for a crowd: each wallet opens one.
- **Open.** The recipient sees what is inside, connects 1AM and opens it with a zero-knowledge proof. The tNIGHT lands in their wallet, and the same link can never pay twice. 1AM pays the fee, so recipients need no DUST.
- **Bring home.** After the expiry, the sender brings everything nobody opened back in one transaction.

## What stays private
| The chain sees | It never sees |
|---|---|
| that an envelope exists, its total and its expiry | with lucky amounts, how many lì xì a personal envelope holds |
| whether it uses a group link | with lucky amounts, the sizes of the lì xì nobody has opened |
| the sender's address | which link paid which opening |
| each opening: who received, and how much | the secrets inside the links |

Payouts are unshielded tNIGHT today, so each opening is public. Equal splits and group links reveal the count at their first opening. Shielded payouts are on the roadmap.

## How it uses Midnight
- **One Compact contract** (`createEnvelope`, `claim`, `refund`) stores per envelope a Merkle root of the split, never the split itself, plus the deposit, expiry, refund address and group flag.
- **Private state:** the share and its Merkle path are private witnesses. A claim proves the path to the root and spends a one-time nullifier; the root and the nullifier set are public ledger state.
- **Concurrency by design:** `claim` only reads the envelope, so many people can open lì xì from the same envelope at once.
- **Proving** happens in 1AM or on a local proof server; Lixi never sends a proof to a shared server.
- **No admin key:** the maintenance authority is given up at deploy, so nobody can change the contract.

## Quality
- 267 tests across the contract, SDK, CLI and app, all against the real compiled contract, on every push.
- A devnet end-to-end workflow: deploy, concurrent claims from different wallets, sponsored claim, refund.
- Sealing, personal and group openings, and bringing lì xì home were run on Preprod with real 1AM wallets.

## Try it
1. Open **https://lixi-3nv.pages.dev** in Chrome on a computer with the 1AM wallet set to Preprod.
2. Choose **Fill an envelope**, seal a small one with tNIGHT from the Preprod faucet, and copy a link.
3. Open the link in a second browser profile with another 1AM wallet, and open the lì xì.

No wallet? Clone the repo and run `npm test`: the README shows how in 10 minutes.

## Who it is for and what comes next
Tết lucky money, weddings, birthdays, team bonuses and community giveaways. We start with Midnight community giveaways, then a Tết 2027 campaign for Vietnam's crypto communities once Lixi runs on mainnet, then lì xì inside the wallet. Personal envelopes stay free; companies and communities would pay for branded envelopes and a campaign dashboard.

**Wave 3:** open lì xì from the 1AM mobile app, fees for any wallet, shielded payouts, envelopes larger than 16 lì xì, and QR codes for giving lì xì in person.

## Links
- Live site: https://lixi-3nv.pages.dev
- Code (Apache-2.0): https://github.com/hms1499/lixi-midnight
- Demo video: https://www.youtube.com/watch?v=Wdiv_WxkL34
- Slides: https://github.com/hms1499/lixi-midnight/blob/main/docs/slides/lixi-wave2.pdf
````

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

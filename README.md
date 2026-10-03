# Lixi — private red envelopes on Midnight

Send lì xì (red envelopes) in tNIGHT through claim links. Recipients claim with a zero-knowledge proof: the claim code never touches the chain, the recipient list stays private, and anyone can verify an envelope is fully funded without seeing how it is split.

Built for the [Midnight Buildathon](https://app.akindo.io/wave-hacks/jaMZjqPOBsLXvjdG) (Wave 2).

> Status: in development. Design: [docs/superpowers/specs/2026-09-30-lixi-design.md](docs/superpowers/specs/2026-09-30-lixi-design.md)

## Develop

Prerequisites: Node 24 (`nvm use`) and the Compact toolchain with compiler 0.31.1:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31.1
```

Then:

```bash
npm ci
npm test            # compiles the contract (without proving keys) and runs every test
npm run typecheck
npm run compact     # full compile with proving keys (~1–2 min)
```

Chain work needs Docker:

```bash
docker compose -f devnet/compose.yml up -d --wait   # local node, indexer, proof server
npm run test:devnet -w @lixi/cli                    # deploy → claims → sponsored claim → refund (~7 min)
npm run deploy -w @lixi/cli                         # deploy to the devnet; --network preprod needs cli/.env (below)
```

Preprod goes through [Blockfrost](https://blockfrost.io), because Midnight is shutting down its own Preprod indexer and RPC. Create a free Blockfrost project for the **Midnight Preprod** network and copy its project id. Then:

- **Chain scripts** (`deploy`, `smoke`, `sponsor` with `-- --network preprod`): put `BLOCKFROST_PROJECT_ID=<id>` in `cli/.env`, next to the deployer secret (`LIXI_DEPLOYER_MNEMONIC` or `LIXI_DEPLOYER_SEED`). The first run syncs the wallet from genesis (~35–70 min).
- **The app**: put `VITE_BLOCKFROST_PROJECT_ID=<id>` in `app/.env.local`. Without it, `dev`, `build` and `preview` stop with a message naming that variable. The id ends up in the built page, as any browser-side Blockfrost id does, so a separate project for the app keeps the CLI's quota apart. A Vercel deploy needs the same variable in the project's environment.

Both files are gitignored.

| Package | What it holds |
|---|---|
| `contract/` | `lixi.compact`, generated bindings, Merkle helper, private-state witness, simulator tests |
| `sdk/` | Seed derivation, splits, claim links, sender vault, recovery, midnight-js wrappers, pre-checks |
| `cli/` | Headless wallet, Node providers, deploy/smoke/sponsor scripts, devnet end-to-end tests |
| `app/` | React app: create and share envelopes, claim links, dashboard with refund and backup |
| `deployments/` | Public deployment records (`preprod.json`) |

## Run the app

The app is a static React site. It talks to the Preprod contract in `deployments/preprod.json` through your browser wallet, and reads the chain through Blockfrost. Set `VITE_BLOCKFROST_PROJECT_ID` in `app/.env.local` first (see above).

```bash
npm run build -w @lixi/app && npm run preview -w @lixi/app   # http://localhost:4173, with the production CSP
npm run dev -w @lixi/app                                     # dev server with hot reload (no CSP)
```

You need the [1AM](https://1am.xyz) wallet on Preprod, with tNIGHT from the faucet registered for DUST. To prove on your own machine instead of in the wallet, start the proof server (`docker run -p 127.0.0.1:6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server`) and choose "On this computer" when connecting.

[Lace](https://www.lace.io) 2.4.2 also works, always with that local proof server: set Midnight Settings → Proof Server to Local, or choose "On this computer". Lace pays fees from its own DUST, so designate your NIGHT first (NIGHT → Generate DUST) and wait until Lace shows a DUST balance above zero.

Fonts: Fraunces and Playwrite VN (SIL Open Font License 1.1). Icons adapted from Lucide (ISC).

## License

Apache-2.0

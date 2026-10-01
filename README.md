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
npm run deploy -w @lixi/cli                         # deploy to the devnet; --network preprod needs a deployer secret in cli/.env
```

| Package | What it holds |
|---|---|
| `contract/` | `lixi.compact`, generated bindings, Merkle helper, private-state witness, simulator tests |
| `sdk/` | Seed derivation, splits, claim links, sender vault, recovery, midnight-js wrappers, pre-checks |
| `cli/` | Headless wallet, Node providers, deploy/smoke/sponsor scripts, devnet end-to-end tests |
| `deployments/` | Public deployment records (`preprod.json`) |

## License

Apache-2.0

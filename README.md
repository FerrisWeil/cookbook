# Cookbook

A self-hosted family recipe app for Taylor and his wife. Used only at home. Never exposed to the public internet.

[Chef](https://github.com/FerrisWeil/nas-mcp) is a separate cloud-hosted chatbot (not this repo). After a meal Taylor liked, Chef saves the recipe plus notes through this repo's MCP server. Taylor then browses favorites on desktop or iPhone when planning meals.

This repository is public (portfolio). Recipes and personal notes live only in the Postgres database on the NAS. Secrets live in env files that are never committed.

## Quick start (laptops and cloud agents)

One command starts the web app, API, Postgres, and MCP server, with seed data:

```bash
docker compose up --build
```

| Service | URL |
| --- | --- |
| Web (PWA skeleton) | http://localhost:8080 |
| API health | http://localhost:3000/health |
| API ready (Postgres + seed) | http://localhost:3000/health/ready |
| MCP health | http://localhost:8787/health |
| MCP (bearer token required) | http://localhost:8787/mcp |

Local MCP token (not for the NAS): `local-dev-token-not-for-nas`.

```bash
curl -sS http://localhost:8787/health
curl -sS -H "Authorization: Bearer local-dev-token-not-for-nas" http://localhost:8787/health
```

Stop with `docker compose down`. Data lives in the `cookbook_pg` volume.

## NAS (Unraid)

Access is Tailscale-only, with tag-based grants, plus a bearer token on MCP. See [0001](docs/decisions/0001-self-host-on-unraid.md) and [0002](docs/decisions/0002-tailscale-only.md).

```bash
cp .env.example .env   # set MCP_AUTH_TOKEN, POSTGRES_PASSWORD, TS_AUTHKEY
docker compose --env-file .env -f deploy/nas/docker-compose.yml up --build -d
```

Do not publish host ports on the NAS. Do not enable Tailscale Funnel.

The Docker / Tailscale / bearer-token pattern follows [nas-mcp](https://github.com/FerrisWeil/nas-mcp).

## Layout

```
apps/web            Responsive PWA skeleton (Vite + React)
apps/api            HTTP API, migrations, seed
apps/mcp            Cookbook MCP (hello + bearer auth)
packages/shared     Shared TypeScript types
db/                 SQL migrations and seed
docs/decisions/     ADRs
features/           Per-feature docs
deploy/nas/         Unraid Compose (no host ports)
```

Workspace tooling is pnpm ([0009](docs/decisions/0009-repo-layout.md)). Language, migration tooling, test tooling, the parallel-agent convention, and the security review (including Postgres access) are still **proposed**. See [docs](docs/README.md).

## Development without Docker

Requires Node 22 and Corepack (pnpm is pinned in `package.json`).

```bash
corepack enable
pnpm install
pnpm check
```

API and MCP expect `DATABASE_URL` / `MCP_AUTH_TOKEN` when run on the host. Prefer Compose unless you are iterating on one process.

## Working agreements

See [CONTRIBUTING.md](CONTRIBUTING.md): two PRs per feature (ADR then implementation), no accepted ADR without Taylor's confirmation, no browser tests until a manual demo is confirmed, one-command full stack.

## License

MIT. Family recipes are not in this repository.

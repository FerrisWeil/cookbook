# Cookbook

> **This branch is a prototype and is never merged to `master`.**
>
> `prototype/TAY-36-frontend` is a clickable kitchen for planning (Linear TAY-36).
> Sample recipes only. No API, no database, no secrets. When an idea is chosen, it
> becomes a normal Linear issue and is built properly on `master`. Prototype-only
> code lives in `apps/web/src/prototype/`.
>
> Run locally: `pnpm prototype` then open http://127.0.0.1:5173
>
> Hosted preview: one Vercel project tracking this branch. See
> [Prototype hosting](#prototype-hosting-this-branch-only).

A self-hosted family recipe app for Taylor and his wife. Used only at home. Never exposed to the public internet.

[Chef](https://github.com/FerrisWeil/nas-mcp) is a separate cloud-hosted chatbot (not this repo). After a meal Taylor liked, Chef saves the recipe plus notes through this repo's MCP server. Taylor then browses favorites on desktop or iPhone when planning meals.

This repository is public (portfolio). Recipes and personal notes live only in the Postgres database on the NAS. Secrets live in env files that are never committed.

## Quick start (laptops and cloud agents)

Copy the example env file, set three database passwords, then start the web app, API, Postgres, and MCP server with seed data:

```bash
cp .env.example .env
# Put a new value in each POSTGRES_SUPERUSER_PASSWORD, POSTGRES_MIGRATOR_PASSWORD,
# and POSTGRES_APP_PASSWORD. Generate each with: openssl rand -base64 24
docker compose up --build
```

Postgres is not published on the host. `docker compose exec db psql -U postgres` reaches it. The API connects as `cookbook_app`. Migrations use `cookbook_migrator`. Neither role is a superuser.

| Service | URL |
| --- | --- |
| Web (recipe list) | http://localhost:8080 |
| API health | http://localhost:3000/health |
| API ready (Postgres + seed) | http://localhost:3000/health/ready |
| MCP health | http://localhost:8787/health |
| MCP (bearer token required) | http://localhost:8787/mcp |

The web home page is the recipe list. An empty library says "No recipes yet."

Local MCP token (not for the NAS): `local-dev-token-not-for-nas`. Local compose sets `MCP_ALLOW_DEV_TOKEN=1` so that token can boot. Local API caller tokens: `local-dev-api-mcp-token-not-for-nas` and `local-dev-api-web-token-not-for-nas`, with `API_ALLOW_DEV_TOKEN=1`. The NAS file sets none of those flags.

```bash
curl -sS http://localhost:8787/health
curl -sS -H "Authorization: Bearer local-dev-token-not-for-nas" http://localhost:8787/health
```

Stop with `docker compose down`. Data lives in the `cookbook_pg` volume.

## NAS (Unraid)

Access is Tailscale-only, with tag-based grants, plus a bearer token on MCP. See [0001](docs/decisions/0001-self-host-on-unraid.md) and [0002](docs/decisions/0002-tailscale-only.md).

The file in the tree is the skeleton. It builds on the NAS and turns Tailscale Serve on. The accepted production file is not in the tree. See [Unraid production](docs/unraid-production.md).

```bash
cp .env.example .env   # set MCP_AUTH_TOKEN, POSTGRES_PASSWORD, the three local POSTGRES_* passwords, TS_WEB_AUTHKEY, TS_MCP_AUTHKEY
docker compose --env-file .env -f deploy/nas/docker-compose.yml up --build -d
```

State is stored under `COOKBOOK_DATA_DIR` (default `/mnt/user/appdata/cookbook`), with `postgres`, `tailscale-web`, and `tailscale-mcp` subdirectories. The web sidecar and the MCP sidecar each need their own Tailscale auth key. In this skeleton, nginx and MCP listen on `127.0.0.1` inside the Tailscale network namespace, and Serve on 443 is the tailnet ingress.

Do not publish host ports on the NAS. Do not enable Tailscale Funnel. Do not set `MCP_ALLOW_DEV_TOKEN` on the NAS.

The Docker / Tailscale / bearer-token pattern follows [nas-mcp](https://github.com/FerrisWeil/nas-mcp).

## Layout

```
apps/web            Kitchen list and recipe screens (Vite + React)
apps/api            HTTP API, migrations, seed
apps/mcp            Cookbook MCP (read, list, save, hello + bearer auth)
packages/shared     Shared TypeScript types
packages/ui         Kitchen tokens, Button, Card
packages/test       `verifies()` helper for requirement IDs in tests
db/migrations/      Numbered SQL. The API applies it on startup.
docs/decisions/     ADRs
deploy/nas/         Unraid skeleton (no host ports)
```

Workspace tooling is pnpm ([0009](docs/decisions/0009-repo-layout.md)). Web is Vite + React. The API uses Fastify as its HTTP adapter. MCP uses the TypeScript MCP SDK. Local Postgres roles are in [security review](docs/security-review.md). Supply-chain pins are [0014](docs/decisions/0014-supply-chain.md). See [docs](docs/README.md).

## Development without Docker

Requires Node 22 and Corepack (pnpm is pinned in `package.json`).

```bash
corepack enable
pnpm install
pnpm check
```

The API accepts `DATABASE_URL` and `MIGRATOR_DATABASE_URL` together, or `POSTGRES_APP_USER`, `POSTGRES_APP_PASSWORD`, `POSTGRES_MIGRATOR_USER`, and `POSTGRES_MIGRATOR_PASSWORD` (passwords are encoded when the URL is built from parts). MCP expects `MCP_AUTH_TOKEN`. Prefer Compose unless you are iterating on one process.

## Working agreements

See [CONTRIBUTING.md](CONTRIBUTING.md) for work types, agent rules, and checks.

## Prototype hosting (this branch only)

The kitchen on this branch can run as a static single-page app with sample data.
Do not merge this branch. Do not add per-PR preview infrastructure.

Local:

```bash
pnpm prototype
```

Opens at http://127.0.0.1:5173 with `VITE_SAMPLE_DATA=1`. No `.env`, API, or
database. Prototype controls at the top switch empty / loading / error, and
theme. `?proto=empty`, `?proto=loading`, and `?proto=error` also work on first
load. No-match: search the name `zzzznope`.

Vercel (one project tracking `prototype/TAY-36-frontend`):

| Setting | Value |
| --- | --- |
| Framework Preset | Other |
| Root Directory | `.` (repository root) |
| Node.js Version | 22 |
| Install Command | `pnpm install` |
| Build Command | `VITE_SAMPLE_DATA=1 pnpm --filter @cookbook/web build` |
| Output Directory | `apps/web/dist` |
| Environment variables | none required beyond the build-command flag |

SPA fallback is `vercel.json` on this branch (`/(.*) → /index.html`). Static
files are served first. The preview contains sample recipes only.

## License

MIT. Family recipes are not in this repository.

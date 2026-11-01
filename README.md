# Cookbook

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
| Web (PWA skeleton) | http://localhost:8080 |
| API health | http://localhost:3000/health |
| API ready (Postgres + seed) | http://localhost:3000/health/ready |
| MCP health | http://localhost:8787/health |
| MCP (bearer token required) | http://localhost:8787/mcp |

The web home page shows Cookbook and `database up`.

Local MCP token (not for the NAS): `local-dev-token-not-for-nas`. Local compose sets `MCP_ALLOW_DEV_TOKEN=1` so that token can boot. The NAS file does not.

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
apps/web            Responsive PWA skeleton (Vite + React)
apps/api            HTTP API, migrations, seed
apps/mcp            Cookbook MCP (hello + bearer auth)
packages/shared     Shared TypeScript types
db/migrations/      Numbered SQL. The API applies it on startup. First file is `app_meta`.
docs/decisions/     ADRs
deploy/nas/         Unraid skeleton (no host ports)
```

Workspace tooling is pnpm ([0009](docs/decisions/0009-repo-layout.md)). Web is Vite + React. The API is a Node HTTP server. MCP uses the TypeScript MCP SDK. Local Postgres roles are in [security review](docs/security-review.md). Supply-chain pins are [0014](docs/decisions/0014-supply-chain.md). See [docs](docs/README.md).

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

## License

MIT. Family recipes are not in this repository.

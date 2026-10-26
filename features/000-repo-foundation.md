# Feature: repo foundation

* Status: in progress
* Related ADRs: [0001](../docs/decisions/0001-self-host-on-unraid.md)–[0007](../docs/decisions/0007-public-repo-secrets.md) and [0009](../docs/decisions/0009-repo-layout.md) accepted; [0008](../docs/decisions/0008-typescript-stack.md), [0010](../docs/decisions/0010-migration-tooling.md), and [0011](../docs/decisions/0011-test-tooling.md) proposed
* Demo: Compose smoke in CI; local `docker compose up --build`

## What it does

Gives the public cookbook repo a layout, working agreements, accepted ADRs, proposed stack ADRs, CI, and a one-command full stack (web, API, Postgres, MCP hello) so later features can be demoed. It does not save or browse recipes.

## Acceptance checks

- [ ] `docker compose up --build` starts web, API, Postgres, and MCP
- [ ] Web home page loads and shows API/database status
- [ ] `GET /health` on API and MCP is unauthenticated and returns ok
- [ ] MCP `/mcp` without a bearer token returns 401
- [ ] MCP `hello` tool returns a structured greeting when authorized
- [ ] Postgres has migrations applied and a seed row in `app_meta`
- [ ] `pnpm check` runs lint, unit tests, build, and secret scanning
- [ ] `pnpm smoke` runs the Compose stack and health checks
- [ ] CI calls `pnpm check` and `pnpm smoke` and does not repeat those steps
- [ ] `.env` cannot be committed; `.env.example` has placeholders only

## How to run it

```bash
docker compose up --build
```

Then:

* Web: http://localhost:8080 — should show Cookbook and `database up`
* API: http://localhost:3000/health and `/health/ready`
* MCP: `curl -sS http://localhost:8787/health` (no token); MCP calls need `Authorization: Bearer local-dev-token-not-for-nas`

NAS (Unraid, no published ports): copy `.env.example` to `.env`, fill real secrets, then `docker compose --env-file .env -f deploy/nas/docker-compose.yml up --build`.

## Tests

- Unit: `apps/api/test`, `apps/mcp/test`, `packages/shared/test`
- Functional (browser): not written (no user feature to confirm yet)

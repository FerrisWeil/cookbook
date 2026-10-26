# 0009. Repo layout and pnpm workspaces

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25, agent chat (foundation PR)

## Context

App, API, MCP, and shared types live in one repo ([0006](0006-one-repo-one-mcp.md)). We need a layout agents can navigate and one package manager for CI, Docker, and local runs.

## Options considered

1. **npm workspaces** — Zero extra toolchain and a `package-lock.json`. Matches nas-mcp. Taylor wants one package manager he will use for every JS command, and he chose pnpm.
2. **pnpm workspaces** — `pnpm-lock.yaml`, strict installs, and `workspace:*` links. One binary for install, lint, test, build, and the scripts CI calls.
3. **Turborepo (or Nx) on top of pnpm** — Task graphs we do not need at this size.

## Decision

Use pnpm exclusively, with pnpm workspaces:

```
apps/web     PWA frontend
apps/api     HTTP API + migrations
apps/mcp     cookbook MCP server
packages/shared
db/migrations, db/seed.sql
deploy/nas   Unraid Compose (no published ports)
```

Root `docker-compose.yml` is the one-command full stack for laptops and cloud agents. `pnpm check` and `pnpm smoke` are the only check entry points; CI calls those and does not restate the steps. How those scripts are composed is a working agreement in [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Consequences

* `pnpm install` at the repo root is the only JS install. The lockfile is `pnpm-lock.yaml`.
* Docker builds use Corepack to activate the `packageManager` version and `pnpm install --frozen-lockfile`.
* Changing package manager later is a new ADR that supersedes this one.
* The Unraid compose file moves to `docker-compose.unraid.yml` at the repo root ([0017](0017-production-compose.md)). `deploy/nas` keeps nginx and Tailscale config. The skeleton compose file stays in `deploy/nas` until that feature lands.

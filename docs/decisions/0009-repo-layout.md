# 0009. Repo layout and monorepo tooling

* Status: **proposed**
* Date: 2026-10-25
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this in chat. The foundation skeleton implements option A.

## Context

App, API, MCP, and shared types live in one repo ([0006](0006-one-repo-one-mcp.md)). We need a layout agents can navigate and a workspace tool that CI and Docker can install.

## Options considered

1. **npm workspaces** (`apps/*`, `packages/*`) — Zero extra toolchain. `package-lock.json` is enough. Matches nas-mcp's npm. Recommended.
2. **pnpm workspaces** — Faster, stricter, but another binary for Unraid, CI, and agents to have on PATH.
3. **Turborepo (or Nx) on top of pnpm/npm** — Task graphs we do not need at this size.

## Decision (proposed)

npm workspaces:

```
apps/web     PWA frontend
apps/api     HTTP API + migrations
apps/mcp     cookbook MCP server
packages/shared
db/migrations, db/seed.sql
deploy/nas   Unraid Compose (no published ports)
```

Root `docker-compose.yml` is the one-command full stack for laptops and cloud agents.

## Consequences (if accepted)

* `npm install` at the repo root is the only JS install.
* Docker builds copy workspace packages from the repo root context.
* Introducing pnpm or Turborepo later is a new ADR.

# Parallel feature agents

Convention for [0012](decisions/0012-parallel-agents.md).

The sequence check, the per-run Compose project, and the feature-folder loaders are not in the tree yet. One agent on a single checkout keeps Compose project `cookbook`, published ports `3000` / `8787` / `8080`, and volume `cookbook_cookbook_pg`. Postgres is not a published port.

## A feature owns a folder

```
features/<slug>/feature.md    required, from docs/templates/feature.md
features/<slug>/server.ts     optional API routes
features/<slug>/mcp.ts        optional MCP tools
features/<slug>/web.tsx       optional UI
features/<slug>/seed.sql      optional seed, applied after db/seed.sql
```

`<slug>` is lowercase kebab-case. The API, web app, and MCP each grow one loader that reads `features/*/`. Presence is registration. Those loaders are not in the tree yet.

Migrations stay in `db/migrations/`, not inside the feature folder. The feature doc names the migration file it added.

Feature code is ordinary TypeScript imported by the loaders. It does not become a pnpm package. A new dependency is added to the app that imports it, and that agent rebases `pnpm-lock.yaml` last.

## Migration numbers

Files stay `db/migrations/NNNN_slug.sql`. `NNNN` is four digits. `0001` through the last file are present exactly once. No timestamps. The API runner applies `readdir` results in sort order and records the filename in `schema_migrations`.

`pnpm check` will fail, once the script exists, when two files share a number, a number is missing, or the prefix is not four digits.

Claim the next number:

1. On the branch you started from, take the highest `NNNN` and add 1.
2. Name the file with that number. Mention it in the pull request body (`Migrations: 0002`).
3. Rebase before merge. If CI reports a duplicate or a gap, renumber to the new highest-plus-one. Leave the old number out of the branch.

There is no `NEXT` file. Taylor consolidates the series before production.

## Two stacks at once

Local `docker-compose.yml` only. The NAS file stays one project, with no host ports.

| Variable | Default | Second run |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | `cookbook` | `cookbook-10` |
| `COOKBOOK_PORT_OFFSET` | `0` | `10`, then `20`, `30`, … |

Offset `10` publishes API `3010`, MCP `8797`, and web `8090`. Container ports stay `3000`, `8787`, and `80`. Postgres has no host port. The wrapper that does this arithmetic is not in the tree yet. `pnpm stack` with no offset stays the same stack as `docker compose up --build`.

## Databases stay apart

Each Compose project has its own Postgres container and its own gitignored env file. The volume key `cookbook_pg` has no global `name:`, so Docker names it `{project}_cookbook_pg`. `docker compose down -v` removes that project's volume only.

## ADR numbers

Files stay `docs/decisions/NNNN-slug.md`, contiguous, same claim steps as migrations (`ADRs: 0012` in the pull request body). A merged ADR keeps its number. Taylor allowed one rewrite on 2026-10-31 that renumbered the set to `0001`–`0018`. Do not renumber again. The next ADR is `0019`.

The status table in `docs/README.md` is gone. Status stays in each file. `features/README.md` still has a table. Removing that table is part of the sequence-check follow-up, which is not this docs rewrite.

## Other shared files

| File | Convention |
| --- | --- |
| `pnpm-lock.yaml` | One lockfile. Agents that add a dependency rebase and regenerate it last. |
| `pnpm-workspace.yaml` | Globs only (`apps/*`, `packages/*`). `allowBuilds` changes only when a new install script is required. |
| Root `package.json` scripts | No per-feature script. New checks join `pnpm check`. |
| `packages/shared` | Cross-app types only. Feature types live in the feature folder. |
| App entry files | One glob loader each, added once. Features do not edit these. The loaders are not in the tree yet. |
| `docker/nginx.conf` | One `/api/` proxy and the SPA fallback. New screens are client routes. |
| `db/seed.sql` | Platform seed only. Feature rows go in `features/<slug>/seed.sql`, applied in slug order. |
| NAS Compose | Not edited per feature. A new container is an ADR. The production file is not in the tree. The skeleton is `deploy/nas/docker-compose.yml`. |
| `.env.example` | Append a key. Leave existing lines in place. |
| `.github/workflows/ci.yml` | Still only `pnpm check` and `pnpm smoke`. |

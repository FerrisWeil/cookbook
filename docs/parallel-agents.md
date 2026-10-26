# Parallel feature agents

Convention for [0012](decisions/0012-parallel-agents.md). Status is **accepted** (2026-10-26, merged means accepted). The commands and checks below are in force as the way to work. The sequence script, per-run Compose project, feature-folder loaders, and removal of the hand-edited index tables are not implemented yet.

One agent on a single checkout keeps Compose project `cookbook`, published ports `3000` / `8787` / `8080`, and volume `cookbook_cookbook_pg`. [0013](decisions/0013-security-review.md) says Postgres is not a published port. The root compose file still publishes `5432` until that follow-up lands.

## 1. A feature owns a folder

A feature is a directory:

```
features/<slug>/feature.md    required, from docs/templates/feature.md
features/<slug>/server.ts     optional API routes
features/<slug>/mcp.ts        optional MCP tools
features/<slug>/web.tsx       optional UI
features/<slug>/seed.sql      optional seed, applied after db/seed.sql
```

`<slug>` is lowercase kebab-case. The API, web app, and MCP each grow one loader that reads `features/*/`. Presence is registration. Nobody edits a list, a barrel, or a route table to add a feature.

Migrations stay in `db/migrations/`, not inside the feature folder. Applied order is global, so one directory stays the sequence. The feature doc names the migration file it added.

Options:

1. **Glob the folder** (accepted). No shared list. A feature with no code is still a valid docs-only folder.
2. **Each feature is a workspace package** that the root `package.json` depends on. Every feature edits the root manifest and the lockfile.
3. **Keep a hand-edited `features/README.md` table** (what the repo does today). Two agents conflict on that file every time.

Feature code is ordinary TypeScript imported by the loaders. It does not become a pnpm package. A new dependency is added to the app that imports it (`apps/api`, `apps/web`, or `apps/mcp`), and the agent rebases `pnpm-lock.yaml` afterward. That app manifest is a remaining hotspot, and it is rare at this size.

## 2. Migration numbers

Files stay `db/migrations/NNNN_slug.sql`. `NNNN` is four digits. `0001` through the last file are present exactly once. No timestamps. The API runner already applies `readdir` results in sort order and records the filename in `schema_migrations`.

`pnpm check` will fail when:

* two files share a number (`0003_recipes.sql` and `0003_notes.sql` do not conflict in git)
* a number is missing (`0001`, `0002`, `0004`)
* the prefix is not four digits

Claim the next number like this:

1. On the branch you started from, take the highest `NNNN` and add 1.
2. Name the file with that number. Mention it in the PR body (`Migrations: 0002`).
3. Rebase before merge. If CI reports a duplicate or a gap, renumber to the new highest-plus-one and update the feature doc. Leave the old number out of the branch.

There is no `NEXT` file. Two agents can claim the same number; CI is the merge-time signal. Taylor consolidates the series before production, which is the point of keeping integers instead of timestamps.

Options for the claim itself:

1. **Highest plus one, CI as the backstop** (accepted). No extra tooling.
2. **A committed counter file.** Every migration PR conflicts on it.
3. **Timestamps.** Ruled out. They avoid clashes and they are the scheme Taylor does not want.

## 3. Two stacks at once

Local `docker-compose.yml` only. The NAS file stays one project, Tailscale-only, with no host ports. Database passwords and which containers share the database network are [0013](decisions/0013-security-review.md), not this proposal.

A second run sets:

| Variable | Default | Second run |
| --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | `cookbook` | `cookbook-10` |
| `COOKBOOK_PORT_OFFSET` | `0` | `10`, then `20`, `30`, … |

Offset `10` publishes API `3010`, MCP `8797`, and web `8090`. Container ports stay `3000`, `8787`, and `80`. Postgres has no host port. Credentials, the database network, and roles are [0013](decisions/0013-security-review.md). The follow-up adds a `pnpm stack` wrapper that does the arithmetic, writes a gitignored env file, and runs Compose. `pnpm stack` with no offset stays the same stack as `docker compose up --build` today. If a default port is already taken, the wrapper exits and tells the agent to set an offset. It does not hunt for a free port.

Options:

1. **Project name plus a port offset, defaults unchanged** (accepted).
2. **Publish no host ports** and use only the Docker network. The browser and `curl` on the host cannot reach the app. The local file publishes ports because that is how laptops and this cloud VM reach the stack.
3. **A port broker** that assigns ports across agents. More machinery than two env vars.

## 4. Databases stay apart

Each Compose project has its own Postgres container and its own gitignored env file. The volume key `cookbook_pg` has no global `name:`, so Docker names it `{project}_cookbook_pg`. Project `cookbook` and project `cookbook-10` do not share data. Migrations in one checkout apply only to the database that checkout's API starts. Who may connect, and over which network, is [0013](decisions/0013-security-review.md).

`docker compose down -v` removes that project's volume only.

Schema-per-branch on one Postgres server was considered. It shares a port and a volume, and the runner would have to aim each file at a schema. A second project is the isolation that already falls out of Compose.

## 5. ADR numbers

ADR files stay `docs/decisions/NNNN-slug.md`, contiguous, same check and the same claim steps as migrations (`ADRs: 0012` in the PR body). Superseded ADRs keep their numbers. Renumber only a branch that has not merged.

Options:

1. **Keep sequential ids and CI** (accepted). Matches migrations and the ids already used in these docs.
2. **Slug-only filenames.** A number clash goes away. So do the short ids (`0004`, `0009`) the other docs link to. Two agents who pick the same slug still collide.
3. **Date prefixes** (`20261025-parallel-agents.md`). Two ADRs in one day share a prefix, and acceptance order is not file order. Timestamps are already ruled out for migrations; using them only for ADRs splits the convention.

Delete the status table in `docs/README.md` in the follow-up that adds the sequence check. Each ADR already has a Status line. Maintaining the table means every ADR PR edits the same file. `features/README.md` loses its table for the same reason. The folders are the index. This acceptance PR leaves both tables in place so the new proposed rows are visible until that follow-up.

## 6. Other shared files

| File | Convention |
| --- | --- |
| `pnpm-lock.yaml` | Stays one lockfile ([0009](decisions/0009-repo-layout.md)). Agents that add no dependency leave it alone. Agents that do, rebase and regenerate it last. |
| `pnpm-workspace.yaml` | Globs only (`apps/*`, `packages/*`). `allowBuilds` changes only when a new install script is required. |
| Root `package.json` scripts | No per-feature script. New checks join `pnpm check`. |
| `packages/shared/src/index.ts` | Cross-app types only. Feature types live in the feature folder. |
| `apps/api/src/index.ts`, `apps/mcp` entry, `apps/web/src/App.tsx` | One glob loader each, added once in the follow-up. Features do not edit these. |
| `docker/nginx.conf` | One `/api/` proxy and the SPA fallback. New screens are client routes. |
| `db/seed.sql` | Platform seed only. Feature rows go in `features/<slug>/seed.sql`, applied in slug order. |
| `deploy/nas/docker-compose.yml` | Not edited per feature. A new container is an ADR. |
| `.env.example` | Append a key. Leave existing lines in place. |
| `.github/workflows/ci.yml` | Still only `pnpm check` and `pnpm smoke`. |

Accepted separately, and unchanged by this convention: the language stack ([0008](decisions/0008-typescript-stack.md)), migration tooling ([0010](decisions/0010-migration-tooling.md)), test tooling ([0011](decisions/0011-test-tooling.md)), and the security review ([0013](decisions/0013-security-review.md)).

# 0012. Parallel feature agents

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-26, agent chat (merged means accepted; foundation PR #1 merged 2026-10-26)

The convention is in force. The follow-up (CI sequence check, per-run Compose project, feature-folder loaders, removing the hand-edited index tables) is not implemented yet.

## Context

More than one agent will implement features at the same time. Today a second agent collides with the first in a few shared places: a hand-edited docs table, a single Compose project with fixed host ports, one Postgres volume named for the whole repo, and sequential files (`db/migrations/0001_app_meta.sql`, `docs/decisions/0001-….md`) whose numbers can clash without a git conflict.

Taylor's constraints: a feature owns a folder and registers by being present; migration numbers stay sequential (no timestamps; he consolidates before production); CI fails on a duplicate or a gap; two full stacks can run at once; one run's migrations stay off another run's database; ADR identity needs the same collision story. Detail and the per-topic options are in [parallel agents](../parallel-agents.md).

## Options considered

1. **Folders plus sequential numbers plus a Compose project per run.** Agents add files under `features/<slug>/` and the next `NNNN_` / `NNNN-` file. A check in `pnpm check` rejects duplicate or gapped numbers. A second local stack sets a project name and a port offset and gets its own database volume. Recommended. Rare number clashes show up in CI; the losing PR renumbers.
2. **Timestamps or branch prefixes on migrations and ADRs.** Agents almost never pick the same name. Taylor has ruled timestamps out for migrations, and he will consolidate numbers before production. Prefixed names also sort in an order the migration runner must not apply.
3. **A claim registry.** A shared `features/index.ts`, a `NEXT` file, or a port broker that every agent edits. That file becomes the conflict. Worse than a CI failure on the occasional duplicate number.

## Decision

Use option 1. Keep one shared migration directory and one shared ADR directory, with a sequence check instead of a lockfile. Give each concurrent local stack its own Compose project, its own web, API, and MCP host ports, and its own Postgres volume. Postgres itself is not published on the host. That access rule is [0013](0013-security-review.md). Leave the NAS Compose file as the single-project, no-published-ports deploy ([0002](0002-tailscale-only.md)).

## Consequences

* Extends the layout in [0009](0009-repo-layout.md): `features/<slug>/` holds the feature doc and any code that feature owns. pnpm stays the only package manager.
* Extends [0004](0004-postgres-migrations.md): numbers are four digits, contiguous from `0001`, with no timestamps. Tooling choice remains [0010](0010-migration-tooling.md).
* Follow-up after confirmation, not before: a sequence script inside `pnpm check`, host-port env vars on the local Compose file, and glob loaders in the API, web, and MCP. No recipe schema, and no change to NAS networking.
* The hand-edited decision table in [docs/README.md](../README.md) and the table in `features/README.md` are removed in that follow-up. Status stays inside each file.

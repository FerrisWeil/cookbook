# 0004. Postgres, migrations from day one, schema deferred

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25, agent chat (foundation PR)

## Context

Recipes, notes, and other family data need a real database that can grow. The final data model is not decided and is deferred until Taylor wants to deploy recipe features. We still need a store that cloud agents, the API, and (later) MCP can share.

## Options considered

1. **SQLite** — Simple, one file. Painful once API and MCP are separate containers on Unraid, and weaker when we want concurrent writes from Chef and the web app.
2. **Postgres** — Available as a well-known Docker image, easy to back up on Unraid, room to grow. Slightly more moving parts than SQLite.
3. **JSON / Markdown files** — Fine for a personal notes vault, poor for query, migrations, and MCP writes.

## Decision

Use Postgres. Start small and grow over time. **Do not freeze a recipe data model in this repository yet.** Use schema migrations from day one so later model work is additive, not a dump-and-restore.

The migration tool is [0010](0010-migration-tooling.md), accepted 2026-10-26: numbered SQL files applied by the API.

## Consequences

* The skeleton ships a tiny `app_meta` table and a seed row so we can prove migrate + seed without inventing recipes.
* Recipe tables, notes, tags, and similar wait for a later ADR + feature PR.
* Backups are Postgres dumps (or Unraid volume copies) of the NAS database. That data never belongs in this public git repo ([0007](0007-public-repo-secrets.md)).

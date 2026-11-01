# 0004. Postgres and ordered migrations

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25

## Problem

Recipes need a database that can grow, without freezing a recipe schema in the foundation.

## Options considered

1. **An embedded database** — one file, and painful once the API and MCP are separate containers.
2. **Postgres** — a normal server, room to grow, straightforward to back up.
3. **Files** — fine for notes, poor for query and for writes from more than one process.

## Decision

Postgres. Not an embedded database. Not files. Schema changes are ordered migrations. The recipe schema is not this decision.

## Consequences

* Backups are of the database, not of git ([0007](0007-public-repo-secrets.md)).
* The migration tool is [0010](0010-migration-tooling.md).
* Who can connect is [0013](0013-security-review.md).

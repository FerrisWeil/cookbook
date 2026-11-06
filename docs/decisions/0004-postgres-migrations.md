# 0004. Postgres and ordered SQL migrations

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25

## Problem

Recipes need a database that can grow, without freezing a recipe schema in the foundation. Schema changes have to be files.

## Options considered

1. **An embedded database** — one file, and painful once the API and MCP are separate containers.
2. **Postgres** — a normal server, room to grow, straightforward to back up.
3. **Files** — fine for notes, poor for query and for writes from more than one process.
4. **SQL files applied by the API** — plain files in git. No ORM until there is a model.
5. **An ORM from day one** — a tool locked in before the model exists.

## Decision

Postgres. Not an embedded database. Not files. The API applies ordered SQL at startup. No ORM until this decision is amended. MCP does not migrate. The recipe schema is not this decision.

## Consequences

* Backups are of the database, not of git ([0007](0007-public-repo-secrets.md)).
* One writer owns schema application.
* Who can connect is [0013](0013-security-review.md).
* Where the files live is in the README.

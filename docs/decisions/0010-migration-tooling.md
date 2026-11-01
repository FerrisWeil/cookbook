# 0010. SQL migrations, no ORM yet

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-26

## Problem

Schema changes have to be files. An ORM before a recipe model would invent a schema.

## Options considered

1. **SQL files applied by the API** — plain files in git. No ORM until there is a model.
2. **An ORM from day one** — a tool locked in before the model exists.
3. **A second ORM** — the same problem, with a heavier runtime.

## Decision

The API applies ordered SQL at startup. No ORM until a new ADR. MCP does not migrate.

## Consequences

* One writer owns schema application.
* Switching tools consumes the same history or supersedes this ADR.
* Where the files live is in the README.

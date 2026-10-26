# 0010. Postgres migration tooling

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-26, agent chat (merged means accepted; foundation PR #1 merged 2026-10-26)

The foundation skeleton implements this choice so migrations exist from day one ([0004](0004-postgres-migrations.md)) without an ORM before the recipe schema exists.

## Context

We will apply schema changes as files, not as "remember to run this SQL." The recipe data model is explicitly deferred. An ORM now would be a schema we pretend is real.

## Options considered

1. **SQL files + a small Node runner in the API** — Plain `.sql` in `db/migrations`, recorded in `schema_migrations`. No ORM until there is a model to map. Easy to read in git. Recommended **until** the recipe schema is designed.
2. **Drizzle Kit from day one** — Excellent TypeScript fit later. Empty Drizzle schema today is ceremony, and it locks a tool before the model exists.
3. **Prisma from day one** — Strong migrations and client. Heavier runtime, same "tool before model" problem.

## Decision

Ship numbered SQL files and apply them from the API process on startup (then seed). Revisit Drizzle vs Prisma in a new ADR when Taylor wants to design the recipe schema.

## Consequences

* Do not add recipe tables in this foundation.
* Switching to Drizzle or Prisma later should consume the same SQL history or supersede this ADR with a conversion plan.
* MCP does not run migrations. One writer (the API) owns schema application.

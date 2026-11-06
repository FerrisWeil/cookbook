# 0012. Parallel agents

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-26

## Problem

Parallel agents collide on a shared list, one Compose project, and sequential numbers.

## Options considered

1. **Folders, contiguous numbers, and an isolated local stack** — presence registers a feature. CI catches a duplicate or a gap. Each local stack has its own database.
2. **Timestamps or branch prefixes** — fewer name clashes. Ruled out for migrations. Prefixed names sort in an order the runner must not apply.
3. **A claim file** — every agent edits the same file. That file becomes the conflict.

## Decision

A feature is a folder. Presence registers it. Migration numbers are contiguous and checked. Concurrent local stacks are isolated. No timestamps. No claim file. Do not add new ADR files.

## Consequences

* A merged ADR number stays. Retired ADRs are deleted and that number is not reused.
* Ports and path templates are in the parallel-agents doc.
* The NAS stack stays the single production project ([0015](0015-production.md)).
* Postgres is not a published port ([0013](0013-security-review.md)).

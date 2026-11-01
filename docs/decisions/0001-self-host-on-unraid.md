# 0001. Self-host on the household NAS

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25

## Problem

The household app has to run somewhere Taylor already operates.

## Options considered

1. **Unraid Compose** — matches the NAS he already runs. One household stack.
2. **Public cloud** — puts family recipes off the NAS and adds a public network surface.
3. **A cluster** — orchestration this household does not have and does not need.

## Decision

Self-host on the household Unraid NAS with Docker Compose. Not a public host. Not a cluster. Local runs use a separate Compose file that may publish ports.

## Consequences

* Production is not the local file. How production is started is [0015](0015-production.md).
* This is a household app, not a multi-tenant service.
* Paths and file names are in the Unraid doc.

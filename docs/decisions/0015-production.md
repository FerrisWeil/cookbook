# 0015. Production on Unraid

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26

## Problem

Production has to run the whole stack on Unraid without compiling on the NAS, without public ports, and without unattended upgrades of the only recipe database.

## Options considered

1. **Compose Manager, pulled images, sidecars, a pinned tag, logical dumps** — one stack, one env file, no compile step on the NAS.
2. **Per-container Unraid templates** — the UI cannot describe a sidecar or a startup order.
3. **Build on the NAS, track a floating tag, or an automatic puller** — no registry lag, and the only copy of the recipes moves on its own.

## Decision

One Compose Manager stack and one env file. Not per-container templates. The NAS pulls images built in CI and does not compile the app. One CPU architecture, the machine the NAS is. Production Compose is separate from dev, publishes no ports, and has no secret defaults. Tailscale runs as sidecars, not inside the app images. Updates are a pinned tag after a dump. No automatic puller. No down migrations. Backups are logical dumps of a running database. The env file is not in the data directory.

## Consequences

* The production Compose file is not in the tree yet. The skeleton still builds on the NAS. Facts are in the Unraid doc.
* Tailnet HTTPS stays deferred ([0002](0002-tailscale-only.md)).
* Database roles stay [0013](0013-security-review.md).
* A new container on the NAS is still an ADR ([0012](0012-parallel-agents.md)).

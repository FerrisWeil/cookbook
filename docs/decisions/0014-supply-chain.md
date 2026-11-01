# 0014. Dependabot and pinned supply chain

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-25

## Problem

Version updates, bot review, and pins are not decided by the security review. A mutable tag is a path onto the NAS.

## Options considered

1. **Dependabot, grouped version updates, immediate security updates** — built into the host. No second party.
2. **A second update bot** — reads this lockfile sooner. A second app and a second config.
3. **Security updates only** — known issues get a pull request when the graph can see them. Everything else drifts.

## Decision

Dependabot, not a second bot. Grouped version updates, immediate security updates, no automerge. Install from the lockfile. Do not flatten the lockfile for a graph parser. Actions and third-party images are pinned. A short release-age wait is accepted.

## Consequences

* Grouping, cooldown, and any ignore list are current state in the supply-chain doc.
* No extra vulnerability product.
* Image signing and API authentication are not decided here.

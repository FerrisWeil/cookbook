# 0013. Security review and database isolation

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-26

## Problem

Every pull request needs a security review Taylor can confirm. The database must not be a superuser on a network the whole stack can reach.

## Options considered

1. **A checklist, plus a locked-down database** — Taylor confirms the review. The database is unpublished. The request role cannot change the schema.
2. **An external scanner** — another account, for one private household server.
3. **A password only** — one superuser on a shared network. A compromised app container can still change the schema.
4. **Publish the database on localhost** — convenient, and it leaves a published port a later edit can widen.

## Decision

Every pull request is checked against the checklist. The pull request records a finding only when there is one. Automated gates are secret scanning and high-severity advisories. No second scanner. The database is not published. The request role cannot change the schema. The migrator is a different role. The image superuser is init-only.

## Consequences

* Moderate advisories are named and do not fail CI.
* Role names, env names, and the checklist are in the security doc.
* Update cadence is [0014](0014-supply-chain.md). Backups are [0015](0015-production.md).

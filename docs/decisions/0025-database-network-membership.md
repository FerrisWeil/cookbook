# 0025. Database network membership

* Status: accepted
* Date: 2026-11-02
* Confirmed: Taylor, 2026-11-02

## Problem

The database is unpublished and the request role cannot change the schema ([0013](0013-security-review.md)). That ADR did not say which processes may share the database network. A password on a shared network is the option it refused.

## Options considered

1. **Only the API on an internal database network** — web and MCP cannot reach Postgres even if they try. The API is the one writer.
2. **The whole stack on one network, unpublished port** — a compromised web or MCP container can still open a database connection.
3. **Publish the database on localhost** — convenient, and a later edit can widen that port. Already refused.
4. **Apply the split on the NAS skeleton in this work** — production Compose is a separate decision, and another agent owns that file.

## Decision

Only the API sits on the database network. Web and MCP do not.

That is how [0013](0013-security-review.md) is applied. The local stack already has this shape. This work proves it. Production isolation, including the same network split and the same roles, lands with the production Compose file ([0015](0015-production.md)). This work does not change the NAS skeleton's database roles or networks.

Recipe HTTP auth stays [0021](0021-mcp-recipe-tools.md). This work does not add an unauthenticated recipe API.

## Consequences

* A compromised web or MCP process cannot open a database connection. It can still call the API if it holds a caller secret.
* The feature pull request proves the local stack. It does not re-implement recipe HTTP auth. It does not edit production Compose.
* Membership, role names, and the checklist stay in the security doc.

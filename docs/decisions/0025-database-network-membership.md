# 0025. Database network membership

* Status: accepted
* Date: 2026-11-02
* Confirmed: Taylor, 2026-11-02

## Problem

The database is unpublished and the request role cannot change the schema ([0013](0013-security-review.md)). That ADR did not say which processes may share the database network.

## Options considered

1. **Only the API on an internal database network** — web and MCP cannot reach Postgres even if they try.
2. **The whole stack on one network, unpublished port** — a compromised web or MCP container can still open a database connection.
3. **Apply the split on the NAS skeleton now** — production Compose is a separate decision ([0015](0015-production.md)).

## Decision

Only the API sits on the database network. Web and MCP do not.

The local stack already has this shape. Production Compose carries the same split. This decision does not change the NAS skeleton's database network.

## Consequences

* A compromised web or MCP process cannot open a database connection.
* Membership stays in the security doc.

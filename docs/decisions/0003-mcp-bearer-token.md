# 0003. MCP requires a bearer secret

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25

## Problem

A tailnet peer that can open a connection could call MCP tools if the server trusted the network alone.

## Options considered

1. **Network trust only** — one grant mistake becomes full MCP access.
2. **Mutual TLS** — strong, and more operational burden than a household app needs.
3. **A shared bearer secret** — a second control in front of the handler. Liveness stays open.

## Decision

MCP requires a shared secret in addition to the network boundary. Liveness is unauthenticated and returns status only.

## Consequences

* Both controls are required for MCP calls.
* The secret is never committed ([0007](0007-public-repo-secrets.md)).
* The check, the header, and the health body are in the security doc.

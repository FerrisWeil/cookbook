# 0002. Private tailnet only

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25

## Problem

Family data and the MCP server must not be reachable from the public internet.

## Options considered

1. **Public HTTPS** — convenient for a cloud caller, and it exposes the family database.
2. **LAN only, no remote identity** — fine for phones at home. A cloud caller cannot reach the MCP server.
3. **A private tailnet, separate identities, least privilege** — family devices and a bot identity. No public ingress.

## Decision

No public exposure. The family app and the MCP server are separate tailnet identities. Grants are least privilege. Bots reach the MCP server only. Funnel is off. Tailnet HTTPS is deferred.

## Consequences

* Clients need the tailnet. The bearer secret in [0003](0003-mcp-bearer-token.md) is still required.
* A later ADR can turn tailnet HTTPS on. Until then the production URL is not a secure context, so the installable app in [0005](0005-v1-scope.md) does not install from that URL.
* Tags, ports, and bind addresses are in the Unraid doc. Sidecars are [0015](0015-production.md).

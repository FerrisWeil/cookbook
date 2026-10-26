# 0002. No public exposure; Tailscale-only with tag-based ACLs

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25, agent chat (foundation PR)

## Context

Cookbook is used only by the family on a private network. Chef is cloud-hosted and must call the MCP server. Nothing in this app should be reachable from the public internet or from an unauthenticated LAN peer.

## Options considered

1. **Public HTTPS** (port forward, Caddy, Funnel) — Convenient for Chef, but exposes a family database to the internet. Rejected.
2. **LAN-only, no remote identity** — Fine for phones at home, but Chef cannot call MCP without a path onto the LAN.
3. **Tailscale with tag-based grants, no host ports** — Family devices and a tagged Chef identity join the tailnet. Unraid does not publish app ports. This is the nas-mcp pattern.

## Decision

Do not expose Cookbook to the public internet. On the NAS, access is only over Tailscale with limited-access, tag-based grants.

* Do not publish host ports in `deploy/nas/docker-compose.yml`.
* The cookbook MCP container is its own tailnet device (see [0006](0006-one-repo-one-mcp.md)).
* The family web app is a separate tailnet device so browsing recipes does not share the MCP node.
* Advertise distinct tags (for example `tag:cookbook-web` and `tag:cookbook-mcp`). ACL grants are least-privilege: family devices to the web node; `tag:bot` (Chef) to the MCP ports only.
* Tailscale Serve (tailnet-only HTTPS) is allowed. Do not enable Funnel.

## Consequences

* Clients must be on the tailnet. Chef needs a Tailscale identity, not a public URL.
* Tailscale ACLs are the network boundary. They are not a substitute for the MCP bearer token ([0003](0003-mcp-bearer-token.md)).
* Root `docker-compose.yml` still publishes ports for local and cloud-agent runs. That file is not the NAS deploy path.
* Deferring Tailscale Serve, and using `tag:cookbook` instead of the example `tag:cookbook-web`, is [0017](0017-tailscale-sidecars.md) (proposed). Until that ADR is accepted, Serve stays allowed and the skeleton tag `tag:cookbook-web` stays as it is. Funnel stays off either way.

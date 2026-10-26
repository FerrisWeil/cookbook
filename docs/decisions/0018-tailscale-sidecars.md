# 0018. Tailscale sidecars; Serve deferred

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

The skeleton still mounts a Serve config and binds web and MCP to loopback. The feature PR changes that in `docker-compose.unraid.yml`.

## Context

[0002](0002-tailscale-only.md) already forbids public exposure and gives web and MCP their own tailnet nodes. It allows Tailscale Serve. The skeleton turns Serve on. Taylor wants HTTPS deferred, tags in the `tag:nas-mcp` style, and bots on `tag:bot`. Detail and the ACL sketch are in [unraid production](../unraid-production.md).

## Options considered

1. **One official Tailscale sidecar per exposed service. Plain HTTP on the tailnet IP. Serve later.** Web hostname `cookbook` tagged `tag:cookbook`. MCP hostname `cookbook-mcp` tagged `tag:cookbook-mcp`. `tag:bot` may open MCP port 8787 only. Family devices may open web port 80. No host ports, no Funnel. Recommended.
2. **Keep Serve on, as the skeleton and as 0002 allow.** Tailnet HTTPS on 443, listeners on 127.0.0.1. Needs MagicDNS and HTTPS certificates before the first boot.
3. **Bake Tailscale into each image, as the nas-mcp Unraid template does.** Drops the sidecar. [0015](0015-unraid-compose-manager.md) is the reason we can keep sidecars.

## Decision

Use option 1. API and Postgres are not tailnet nodes. The web nginx proxies `/api/` to the API on the app network. Listeners bind `0.0.0.0` inside the sidecar network namespace so the tailnet IP answers. That address is not a host port.

This supersedes the Serve allowance in [0002](0002-tailscale-only.md) and replaces that ADR's example tag `tag:cookbook-web` with `tag:cookbook`, matching the hostname the way `tag:nas-mcp` matches its hostname. `tag:cookbook-mcp` is unchanged. Funnel stays off. A later ADR can turn Serve on. Until that later ADR, `http://cookbook/` is not a secure context, so the installable PWA in [0005](0005-v1-scope.md) does not install from the production URL.

## Consequences

* The feature PR removes `TS_SERVE_CONFIG`, sets `TS_EXTRA_ARGS` to `--advertise-tags=tag:cookbook` and `--advertise-tags=tag:cookbook-mcp`, binds web nginx to `0.0.0.0:80` in `deploy/nas/nginx.conf`, and sets MCP `BIND_HOST` to `0.0.0.0`. Loopback was only right while Serve proxied to it. `scripts/smoke.sh` stops requiring `BIND_HOST: 127.0.0.1`. The Serve JSON files stay in the repo and are not mounted.
* Grants do not include port 443.
* The Unraid host can still reach a container by its Docker bridge address. nas-mcp accepts that. Other containers are not joined to this network, and the network has no fixed global name ([0013](0013-security-review.md)).
* Two auth keys, reusable and not ephemeral, one tag each. They live only in the NAS env file.

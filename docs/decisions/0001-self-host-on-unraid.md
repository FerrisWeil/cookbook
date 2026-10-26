# 0001. Self-host on Unraid via Docker Compose

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25, agent chat (foundation PR)

## Context

Cookbook is a family recipe app for Taylor and his wife, run at home. Chef (a separate cloud-hosted chatbot, not code in this repo) saves recipes after a good meal. The household already runs Unraid and Docker. [nas-mcp](https://github.com/FerrisWeil/nas-mcp) showed that Compose on this NAS works.

## Options considered

1. **Unraid Docker Compose** — Compose Manager or `docker compose` on the box. Matches how nas-mcp is deployed. Uses appdata, existing disks, and existing Unraid habits.
2. **Cloud VPS or hosted PaaS** — Would put family recipes off-box, add a public network surface, and fight [0002](0002-tailscale-only.md) and [0007](0007-public-repo-secrets.md).
3. **Kubernetes / Nomad** — Orchestration we do not have and do not need for one household stack.

## Decision

Self-host on Taylor's Unraid NAS via Docker Compose. Persist state under appdata (typically `/mnt/user/appdata/cookbook`).

Local development and cloud agents use the root `docker-compose.yml`, which **does** publish ports so the stack is reachable on a private workspace. The NAS file, `deploy/nas/docker-compose.yml`, publishes **no** host ports.

## Consequences

* Deploy follows Unraid conventions: appdata for state, `TZ` matching the Unraid UI.
* The array must be started before the stack can persist data.
* Cloud agents and laptops run the same images without Tailscale. That local publish-ports path is not how the NAS is reached.
* This is a household app, not a multi-tenant service.

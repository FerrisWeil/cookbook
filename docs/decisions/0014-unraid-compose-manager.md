# 0014. Unraid deploy via Compose Manager

* Status: **proposed**
* Date: 2026-10-26
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this in chat. The NAS file still builds on the box. Do not treat Compose Manager as the required UI until this is accepted.

## Context

[0001](0001-self-host-on-unraid.md) already says the app runs on Taylor's Unraid NAS as Docker Compose, and it leaves the screen he clicks unspecified. [nas-mcp](https://github.com/FerrisWeil/nas-mcp) ships a single-container Unraid XML template because that repo is one process. Cookbook is Postgres, an API, a web app, an MCP server, and two Tailscale sidecars ([0002](0002-tailscale-only.md)). Detail is in [unraid production](../unraid-production.md).

## Options considered

1. **Compose Manager plugin, one compose file, one env file on the NAS.** The plugin and `docker compose` run the same `deploy/nas/docker-compose.yml`. Healthchecks, sidecars, and an internal database network stay in that file. Recommended.
2. **Unraid container XML, one template per container, as nas-mcp does.** The Docker UI cannot describe a sidecar or `depends_on`. nas-mcp's own [0005](https://github.com/FerrisWeil/nas-mcp/blob/main/docs/decisions/0005-ghcr-and-unraid-template.md) says so, and it inlined Tailscale to cope. Six hand-wired containers, or Tailscale baked into every image, is a worse fit here.
3. **Ship both.** Two paths that drift. Worth it for nas-mcp's one container. Not for this stack.

## Decision (proposed)

Use option 1. Taylor starts the stack from Unraid's Compose Manager, pointed at `deploy/nas/docker-compose.yml` and the env file under `COOKBOOK_DATA_DIR`. The same file is what SSH runs. This repo does not grow an `unraid/*.xml` template.

This does not supersede [0001](0001-self-host-on-unraid.md). It settles the UI that ADR left open.

## Consequences (if accepted)

* The feature PR documents the Compose Manager clicks in `docs/unraid-setup.md`. It does not add XML.
* A new container on the NAS is still an ADR ([parallel agents](../parallel-agents.md)).
* nas-mcp stays the reference for GHCR and for `tag:nas-mcp`-style tags, not for the Unraid template.

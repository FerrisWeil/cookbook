# 0014. Unraid deploy via Compose Manager

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat. Same night: one Compose Manager stack, one env file, UI label set in Unraid.

The skeleton is still `deploy/nas/docker-compose.yml` and still builds on the NAS. The feature PR puts the Unraid file at `docker-compose.unraid.yml`.

## Context

[0001](0001-self-host-on-unraid.md) already says the app runs on Taylor's Unraid NAS as Docker Compose, and it leaves the screen he clicks unspecified. [nas-mcp](https://github.com/FerrisWeil/nas-mcp) ships a single-container Unraid XML template because that repo is one process. Cookbook is Postgres, an API, a web app, an MCP server, and two Tailscale sidecars ([0002](0002-tailscale-only.md)). Detail is in [unraid production](../unraid-production.md).

## Options considered

1. **Compose Manager plugin, one compose file, one env file on the NAS.** The plugin and `docker compose` run the same `docker-compose.unraid.yml` at the repo root. Healthchecks, sidecars, and an internal database network stay in that file. Recommended.
2. **Unraid container XML, one template per container, as nas-mcp does.** The Docker UI cannot describe a sidecar or `depends_on`. nas-mcp's own [0005](https://github.com/FerrisWeil/nas-mcp/blob/main/docs/decisions/0005-ghcr-and-unraid-template.md) says so, and it inlined Tailscale to cope. Six hand-wired containers, or Tailscale baked into every image, is a worse fit here.
3. **Ship both.** Two paths that drift. Worth it for nas-mcp's one container. Not for this stack.

## Decision

Use option 1. One Compose Manager stack runs the whole app: Postgres, API, web, MCP, and both Tailscale sidecars. Taylor points that stack at two paths and no others:

* Compose file: `docker-compose.unraid.yml` at the repo root
* Env file: `.env` in that same directory

Every secret for every service is in that one env file. There is no per-service env file and no second production compose file. SSH uses the same pair. The dev file keeps the name `docker-compose.yml`, so a plain `docker compose up` does not start the NAS stack. This repo does not grow an `unraid/*.xml` template, and it does not set the stack's UI label. Taylor edits that label in the Compose Manager UI.

This does not supersede [0001](0001-self-host-on-unraid.md). It settles the UI that ADR left open.

## Consequences

* The feature PR documents the Compose Manager clicks in `docs/unraid-setup.md`: one stack, those two paths, and the UI label left for Taylor to type. It does not add XML or a label in git.
* A new container on the NAS is still an ADR ([parallel agents](../parallel-agents.md)).
* nas-mcp stays the reference for GHCR and for `tag:nas-mcp`-style tags, not for the Unraid template.

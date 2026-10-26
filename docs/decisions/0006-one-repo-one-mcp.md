# 0006. One repo; one MCP container per NAS project

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25, agent chat (foundation PR)

## Context

The NAS already runs MCP servers (nas-mcp). Cookbook needs its own MCP so Chef can read and save recipes without sharing tokens or blast radius with other projects. The app, API, database, and cookbook MCP are one product.

## Options considered

1. **Split repos** (web, API, MCP) — Cleaner independent versioning, worse for a household app and for cloud agents that need one command to run the stack.
2. **One shared MCP container for every NAS project** — One token, one tailnet device, one compromise path for unrelated tools.
3. **One git repo for app + API + DB + cookbook MCP; one MCP container per project, each its own tailnet device and token** — Matches how Taylor wants the NAS laid out.

## Decision

The app, API, DB, and the cookbook MCP live in this one repo. On the NAS, run **one MCP container per project**. Each MCP is its own tailnet device with its own bearer token.

## Consequences

* This repository is the cookbook product, not a generic MCP factory.
* Other NAS MCPs (for example nas-mcp) stay in their own repos and containers.
* Layout and workspace tooling are [0009](0009-repo-layout.md).
* NAS Compose gives the MCP sidecar a distinct hostname and auth key from the web sidecar.

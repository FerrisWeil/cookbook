# 0006. One repo, one MCP per project

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25

## Problem

Cookbook needs its own MCP so a compromise does not share a token with other NAS projects. The app, API, database, and MCP are one product.

## Options considered

1. **Split repos** — independent versioning, and worse for one command that runs the stack.
2. **One shared MCP for every NAS project** — one token and one compromise path.
3. **One repo, and one MCP container per project** — each MCP has its own identity and secret.

## Decision

One repo for the product. One MCP container per NAS project, with its own identity and secret.

## Consequences

* Other NAS MCPs stay in their own repos.
* Layout is [0009](0009-repo-layout.md).
* Hostnames are in the Unraid doc.

# 0005. v1 product shape

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25

## Problem

Taylor browses recipes on a desktop and an iPhone. Chef saves recipes. A native app and a public product are out of scope for a household of two.

## Options considered

1. **MCP only** — Chef can write. Taylor cannot browse on a phone without another client.
2. **A native app** — two codebases and a store, for a family-only app.
3. **A responsive installable web app, plus an API, Postgres, and MCP** — one UI, home-screen install, Chef writes through MCP.

## Decision

v1 is a responsive installable web app, an API, Postgres, and a cookbook MCP. Not a native app. Chef is not in this repo.

## Consequences

* Install is the browser home-screen flow. No app store.
* Offline caching is [0016](0016-kitchen-ui.md).
* Recipe behavior is later features, not this decision.

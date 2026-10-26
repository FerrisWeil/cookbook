# 0005. v1 scope: web PWA, API, Postgres, cookbook MCP

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25, agent chat (foundation PR)

## Context

Taylor browses favorites when planning meals (desktop and iPhone). Chef, after a meal Taylor liked, saves the recipe plus notes via MCP. Native apps, public accounts, and a large content pipeline are out of scope for a household of two.

## Options considered

1. **MCP-only, no UI** — Chef could write recipes, but Taylor could not browse them on a phone without another client.
2. **Native iOS app + API** — Best iPhone feel, two codebases, App Store or sideload friction for a family-only app.
3. **Responsive web (desktop + iPhone), installable as a PWA, plus API + Postgres + MCP** — One UI, home-screen install, Chef writes through MCP.

## Decision

v1 is:

* a responsive web frontend for desktop and iPhone, installable as a PWA from the home screen
* a server plus Postgres
* an MCP server so Chef can read and save recipes

Chef itself is **not** in this repo. Recipe browse/save behavior is **not** in the foundation PR; this ADR only locks the product shape.

## Consequences

* iPhone install uses the browser "Add to Home Screen" flow. No App Store.
* Offline-first caching is not decided here. The skeleton includes a web app manifest so install is possible.
* MCP tools for read/save come in later feature PRs. The foundation MCP only proves hello + auth.

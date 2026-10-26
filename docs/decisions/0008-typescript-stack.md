# 0008. Language and framework stack

* Status: **proposed**
* Date: 2026-10-25
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this in chat. The foundation skeleton implements option A so the stack can boot. A different choice means rewriting those apps, not a silent default.

## Context

v1 needs a web PWA, an HTTP API, and an MCP server, with types shared across them ([0005](0005-v1-scope.md)). Cloud agents and Taylor both have to read and change the same code. nas-mcp is already TypeScript.

## Options considered

1. **TypeScript everywhere, shared types** — Web, API, and MCP in one language. A `packages/shared` workspace exports types both sides import. Matches nas-mcp and Chef-adjacent MCP SDKs. Recommended.
2. **Python API (FastAPI) + TypeScript web + Python or TS MCP** — Strong data/scripting story, two languages, weaker shared types, two Docker runtimes.
3. **Go API + TypeScript web** — Fast single binaries, two languages, more ceremony for a household app, MCP SDK story is thinner than TS.

## Decision (proposed)

Use TypeScript everywhere:

* Web: Vite + React + TypeScript, with a web app manifest for home-screen install
* API: Node.js HTTP server (no extra web framework in the skeleton)
* MCP: `@modelcontextprotocol/server` Streamable HTTP, same family as nas-mcp
* Shared: `@cookbook/shared` for types used by web and API

## Consequences (if accepted)

* One TypeScript toolchain across web, API, and MCP. The package manager is [0009](0009-repo-layout.md).
* React is the UI library for later recipe screens. The skeleton is a single status page, not a design system.
* Switching to Python or Go later is a new ADR that supersedes this one.

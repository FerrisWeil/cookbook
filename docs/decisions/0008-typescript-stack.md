# 0008. TypeScript and React

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-26

## Problem

v1 needs a web app, an HTTP API, and an MCP server, with types shared across them.

## Options considered

1. **TypeScript for the web app, the API, and MCP** — one language, shared types.
2. **A second language for the API** — a stronger scripting story, two toolchains, weaker shared types.
3. **Go for the API** — single binaries, two languages, a thinner MCP story.

## Decision

TypeScript for the web app, the API, and MCP. React for the UI. Types that cross a process boundary live in one shared package. Not a second language.

## Consequences

* A language change is a new ADR.
* Toolchain names are in the README.
* The package manager is [0009](0009-repo-layout.md).

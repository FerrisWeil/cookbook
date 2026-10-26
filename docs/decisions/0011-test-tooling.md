# 0011. Test tooling

* Status: **proposed**
* Date: 2026-10-25
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this in chat. The foundation skeleton implements option A for unit tests. Functional (browser) tests are intentionally not wired yet.

## Context

Working agreement: every feature is tested in code. Unit tests cover functions and classes. Functional tests use a real browser to prove features work and do not regress. **Do not write functional tests until Taylor confirms the feature works end to end** (demo on the PR, or Taylor runs it locally).

## Options considered

1. **`node:test` + `tsx` for unit tests; Playwright later for functional tests** — Zero extra unit-test framework. Matches nas-mcp. Playwright is added in the first feature PR that Taylor has already confirmed by demo. Recommended.
2. **Vitest + Playwright** — Better DX and watch mode, another framework both API and web must agree on.
3. **Jest + Playwright** — Familiar, slower, more config, no benefit at this size.

## Decision (proposed)

Use Node's built-in test runner with `tsx` for unit tests. Add Playwright only after a feature has a confirmed manual demo. CI runs lint, unit tests, and secret scanning. CI does not run browser tests until they exist.

## Consequences (if accepted)

* Foundation CI is green without Playwright.
* The first recipe feature PR is two steps: demo, then (after Taylor confirms) browser tests.
* Choosing Vitest later is a new ADR.

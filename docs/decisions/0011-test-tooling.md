# 0011. Test tooling

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-26, agent chat (merged means accepted; foundation PR #1 merged 2026-10-26)

The foundation skeleton implements this choice for unit tests. Functional (browser) tests stay unwired until Taylor confirms a feature by demo.

## Context

Working agreement: every feature is tested in code. Unit tests cover functions and classes. Functional tests use a real browser to prove features work and do not regress. **Do not write functional tests until Taylor confirms the feature works end to end** (demo on the PR, or Taylor runs it locally).

## Options considered

1. **`node:test` + `tsx` for unit tests; Playwright later for functional tests** — Zero extra unit-test framework. Matches nas-mcp. Playwright is added in the first feature PR that Taylor has already confirmed by demo. Recommended.
2. **Vitest + Playwright** — Better DX and watch mode, another framework both API and web must agree on.
3. **Jest + Playwright** — Familiar, slower, more config, no benefit at this size.

## Decision

Use Node's built-in test runner with `tsx` for unit tests. Add Playwright only after a feature has a confirmed manual demo. CI runs lint, unit tests, and secret scanning. CI does not run browser tests until they exist.

## Consequences

* Foundation CI is green without Playwright.
* The first recipe feature PR is two steps: demo, then (after Taylor confirms) browser tests.
* Choosing Vitest later is a new ADR.

# 0018. How UI work is demoed

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

## Context

Working agreement: demo a feature with screenshots or a recording before writing browser tests, and do not mark the feature confirmed until Taylor says so ([CONTRIBUTING.md](../../CONTRIBUTING.md)). Test tooling is still [0011](0011-test-tooling.md), which is proposed and is not accepted here. UI reviews fail when the only artifact is a desktop crop, or when the capture shows a real recipe in a public PR ([0007](0007-public-repo-secrets.md)).

What to attach is in [UI demos](../design/demo.md).

## Options considered

1. **PR screenshots at desktop width and at an iPhone size, example data only, plus a `/guide` route Taylor can open on his phone. Unit tests allowed. No Playwright until he confirms the feature in chat.** Recommended.
2. **Playwright in the same PR as the first UI, including screenshot diffs.** Proves pixels in CI. He asked not to write functional browser tests until he has confirmed the feature, and a screenshot suite is a browser harness.
3. **Taylor must install the build on an iPhone before any review.** Best device check, blocks cloud agents and makes every small CSS change wait on a phone.

## Decision

Use option 1.

* Every UI feature PR attaches a desktop capture (about 1280×800) and an iPhone-sized capture (390×844). If the change is about color, include both themes. A short recording is added only when motion or a multi-step flow is the thing to judge.
* Captures use example data. Titles are prefixed so they cannot be read as the household's recipes. No tailnet names, tokens, or notes from real meals.
* The feature PR also adds `/guide`, absent from the nav, rendering the same components with example data so Taylor can open it on a phone after deploy. The PR images are still required. He should not have to deploy to review.
* Unit tests for token contrast and theme choice use the runner the skeleton already uses (`node:test`). This does not accept [0011](0011-test-tooling.md). No Testing Library, jsdom, or Playwright dependency is added for the design-system PR.
* Functional browser tests are written only after Taylor confirms in chat that the feature works.

## Consequences

* A UI PR without both captures is not ready for him to confirm.
* Confirming a feature in chat is the gate for Playwright, written up against [0011](0011-test-tooling.md) when that ADR itself is accepted. This ADR does not turn 0011 on.
* `/guide` is a review surface. It is not a cooking screen and it is not linked from Browse.

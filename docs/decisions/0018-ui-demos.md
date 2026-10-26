# 0018. How UI work is demoed

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

## Problem

A UI change is hard to judge from a desktop crop, and a browser test suite that lands in the same pull request arrives before the screen is accepted.

## Options considered

1. **Pull-request screenshots at desktop width and at an iPhone size, example data only, plus a `/guide` route. Unit tests allowed. No Playwright until the feature is confirmed in chat.**
2. **Playwright in the same PR as the first UI, including screenshot diffs.** Proves pixels in CI. Functional browser tests are supposed to wait until the feature is confirmed ([CONTRIBUTING.md](../../CONTRIBUTING.md)).
3. **Require an install on a physical iPhone before any review.** Best device check. Blocks review when the phone is not at hand.

## Decision

Use option 1.

* Every UI feature PR attaches a desktop capture (about 1280×800) and an iPhone-sized capture (390×844). If the change is about color, include both themes. A short recording is added only when motion or a multi-step flow is the thing to judge.
* Captures use example data. Titles are prefixed so they cannot be read as the household's recipes. No tailnet names, tokens, or notes from real meals ([0007](0007-public-repo-secrets.md)).
* The feature PR also adds `/guide`, absent from the cooking screens, rendering the same components with example data. The pull-request images are still required. Review does not wait on a deploy.
* Unit tests for token contrast and theme choice use the runner the skeleton already uses (`node:test`). This does not accept [0011](0011-test-tooling.md). No Testing Library, jsdom, or Playwright dependency is added for the design-system PR.
* Functional browser tests are written only after the feature is confirmed in chat.

What to attach is in [UI demos](../design/demo.md).

## Consequences

* A UI PR without both captures is not ready to confirm.
* Confirming a feature in chat is the gate for Playwright, written up against [0011](0011-test-tooling.md) when that ADR itself is accepted. This ADR does not turn 0011 on.
* `/guide` is a review surface. It is not a cooking screen and it is not linked from the recipe list.

## Amendments

### 2026-10-25

Browser tests still wait until the feature has been demoed and confirmed. This amendment does not add a test framework.

When those tests are written, they drive the UI and check behavior. They cover every state: the list, the recipe, an empty list, and a failed load.

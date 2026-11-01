# 0018. UI demos before browser tests

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26

## Problem

A UI change is hard to judge from one crop. A browser suite in the same pull request arrives before the screen is accepted.

## Options considered

1. **Captures at desktop and phone size, then browser tests after confirmation** — example data only, plus a review route that is not a cooking screen.
2. **Browser tests in the same pull request** — pixels in CI, before the feature is confirmed.
3. **A physical phone before any review** — the real device, and review blocks when the phone is not at hand.

## Decision

UI work is shown at desktop and phone size, example data only, before any browser test. A review route exists and is not a cooking screen. Later browser tests cover the list, the recipe, an empty list, and a failed load.

## Consequences

* A UI pull request without both captures is not ready to confirm.
* The confirmation gate is [CONTRIBUTING.md](../../CONTRIBUTING.md). The runner choice is [0011](0011-test-tooling.md).
* Pixel sizes and the route are in the demo doc.

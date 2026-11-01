# 0011. Node's test runner

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-26

## Problem

Features need unit tests now. Browser tests must not land before Taylor has confirmed the feature.

## Options considered

1. **Node's built-in runner now, a browser runner only after confirmation** — no extra unit-test framework.
2. **A second unit-test framework now** — better watch mode, another framework to share.
3. **A third framework** — familiar, and more config than this repo needs.

## Decision

Unit tests use Node's built-in runner. A browser test runner is not added until a feature is confirmed. That confirmation rule lives in [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Consequences

* Choosing a different unit runner is a new ADR.
* What a UI pull request attaches is [0018](0018-ui-demos.md).

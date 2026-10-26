# 0014. Kitchen UI principles

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

## Problem

A kitchen screen that is small, dense, or online-only is hard to use with messy hands and at arm's length.

## Options considered

1. **Overall kitchen principles: large touch targets, glanceable screens, type readable at arm's length, light and dark, honest offline with no offline library in v1, example data only.**
2. **A dense library UI.** Smaller type and tighter rows. Faster scanning, worse with messy hands and at arm's length.
3. **Offline-first as a v1 principle.** Cache the recipe library now. [0005](0005-v1-scope.md) left caching undecided, and the recipe fields are not chosen.
4. **Seat-specific rules, a fullscreen mode, and live updates.** More specific than this decision. Those wait for a later ADR.

## Decision

Use option 1.

* Touch targets are large. Hover is never the only way to reach an action.
* Screens are glanceable. The important thing is easy to see.
* Type is readable at arm's length.
* Light and dark both exist.
* v1 does not cache the recipe library. ~~A screen that cannot load says so in words. Chrome that is already loaded still paints.~~
* Samples in git are labeled example data. Real recipes stay in Postgres ([0007](0007-public-repo-secrets.md)).

Sizes, contrast, and iPhone layout are [0017](0017-tokens-accessibility-iphone.md). This ADR does not add another set of measurements. Detail is in [kitchen UI principles](../design/principles.md).

## Consequences

* Feature UI that misses a principle is not done, even if the route works.
* ~~A service worker or an offline library is a later ADR.~~
* Fullscreen reading, a Chef panel, and updates that arrive with no reload are not decided here.

## Amendments

### 2026-10-26

v1 does not cache the recipe library and does not add a service worker. A home-screen open that cannot load the document shows the browser's own error page. That is acceptable. After the page has loaded, a later read that fails is said in words on the screen. The app does not paint chrome for a document that never arrived.

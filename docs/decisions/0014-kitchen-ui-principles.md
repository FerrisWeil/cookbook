# 0014. Kitchen UI principles

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

## Context

The app is used in a kitchen and at a desk, on a desktop browser and on iPhone Safari ([0005](0005-v1-scope.md)). It is a household of two, reached only over Tailscale ([0002](0002-tailscale-only.md)). The foundation page is a status card, not a cooking UI. Offline caching was left open in 0005.

Taylor confirmed the overall principles in chat on 2026-10-26 and asked not to pin seat-by-seat behavior, fullscreen reading, or live updates yet. Screen list is [0015](0015-navigation-ia.md). Token numbers are [0017](0017-tokens-accessibility-iphone.md). How components are packaged is [0016](0016-design-system-approach.md). The short write-up is [kitchen UI principles](../design/principles.md).

## Options considered

1. **Overall kitchen principles: large touch targets, glanceable screens, type readable at arm's length, light and dark, honest offline with no offline library in v1, example data only.** Taylor confirmed this level.
2. **A dense library UI.** Smaller type and tighter rows. Faster scanning, worse with messy hands and at arm's length.
3. **Offline-first as a v1 principle.** Cache the recipe library now. 0005 left caching undecided, and the recipe fields are not chosen.
4. **Seat-specific rules, a fullscreen mode, and live updates from Chef.** More specific than Taylor wants in this ADR. Those stay out until a later decision.

## Decision

Use option 1.

* Touch targets are large. Hover is never the only way to reach an action.
* Screens are glanceable. The important thing is easy to see.
* Type is readable at arm's length.
* Light and dark both exist.
* v1 does not cache the recipe library. A screen that cannot load says so in words. Chrome that is already loaded still paints.
* Samples in git are labeled example data. Real recipes stay in Postgres ([0007](0007-public-repo-secrets.md)).

Sizes, contrast, and iPhone layout are [0017](0017-tokens-accessibility-iphone.md), already accepted. This ADR does not add another set of measurements.

## Consequences

* Feature UI that misses a principle is not done, even if the route works.
* A service worker or an offline library is a later ADR.
* Fullscreen reading, a Chef panel, and updates that arrive with no reload are not decided here.

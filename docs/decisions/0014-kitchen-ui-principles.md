# 0014. Kitchen UI principles

* Status: **proposed**
* Date: 2026-10-26
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this in chat. Nothing in this ADR is in force.

## Context

The app is used in a kitchen, on a desktop browser and on iPhone Safari, often at arm's length and sometimes with messy hands ([0005](0005-v1-scope.md)). It is a household of two, reached only over Tailscale ([0002](0002-tailscale-only.md)). The foundation page is a status card, not a cooking UI. Offline caching was explicitly not decided in 0005.

These principles are the bar for later UI work. Screen layout is [0015](0015-navigation-ia.md). How the CSS is built is [0016](0016-design-system-approach.md). Token values are [0017](0017-tokens-accessibility-iphone.md). Detail and what "done" looks like are in [kitchen UI principles](../design/principles.md).

## Options considered

1. **Six principles: large touch targets, one job per screen, arm's-length type, light and dark, honest offline, fake example data.** Recommended. Matches kitchen use without promising an offline library the schema cannot support yet.
2. **A dense library UI.** Smaller type and tighter rows so more recipes fit on a phone. Faster scanning at a desk, worse with messy hands and at arm's length.
3. **Offline-first as a v1 principle.** Cache the recipe library in a service worker now. Taylor will want some offline behavior later, but 0005 left caching undecided and the recipe fields are not chosen. Locking a cache design now would invent a data shape.

## Decision (proposed)

Adopt option 1.

* Primary controls are at least 44×44 CSS pixels, with space between them. Hover is never the only way to reach an action.
* Each screen has one job. The largest text is the recipe name or the thing you are choosing.
* Body text is at least 18px, zoom stays on, and text fields are at least 16px so iOS does not zoom the page when a field is focused.
* Light and dark both exist. The default follows the device, and a control on the page can override it.
* v1 does not cache the recipe library. A screen that cannot load says so in words and stops spinning. Chrome that is already loaded still paints.
* Samples in git are labeled example data. Real recipes stay in Postgres ([0007](0007-public-repo-secrets.md)).

## Consequences (if accepted)

* Feature UI that misses a principle is not done, even if the route works.
* A service worker, "last opened recipe" cache, or offline library is a later ADR. This one only requires an honest failure state.
* Denser layouts for power use would be a new ADR that supersedes this one.

# 0014. Kitchen UI principles

* Status: **proposed**
* Date: 2026-10-26
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this revision in chat. Nothing in this ADR is in force.

## Context

The household uses two seats ([0005](0005-v1-scope.md)). Taylor said in chat on 2026-10-26: the phone is the kitchen device (arm's length, messy hands). The desktop is usually a desk, unless a recipe is fullscreen. A recipe may sit open on a laptop while he talks to Chef and touches nothing, and Chef may edit that recipe so the screen has to change on its own.

The app is Tailscale-only ([0002](0002-tailscale-only.md)). The foundation page is a status card. Offline caching was left open in 0005. Chef's chat is not part of this repo.

These principles are the bar for later UI work. Screen layout is [0015](0015-navigation-ia.md). How the CSS is built is [0016](0016-design-system-approach.md). Token values are [0017](0017-tokens-accessibility-iphone.md). Detail and what "done" looks like are in [kitchen UI principles](../design/principles.md).

## Options considered

1. **Six principles: large touch targets, one job per screen, arm's-length type, light and dark, honest offline, fake example data.** Recommended. Matches kitchen use without promising an offline library the schema cannot support yet.
2. **A dense library UI.** Smaller type and tighter rows so more recipes fit on a phone. Faster scanning at a desk, worse with messy hands and at arm's length.
3. **Offline-first as a v1 principle.** Cache the recipe library in a service worker now. Taylor will want some offline behavior later, but 0005 left caching undecided and the recipe fields are not chosen. Locking a cache design now would invent a data shape.

## Decision (proposed)

Adopt option 1, split by seat, and add a live-recipe rule. This revision is what needs confirmation.

* **Phone, in the kitchen.** Primary controls are at least 44×44 CSS pixels, with space between them. Hover is never the only way to reach an action. No action requires a swipe. Body text is at least 18px. Each screen has one job, and the largest text is the recipe name or the thing you are choosing.
* **Desktop, at a desk.** Same components and the same type size. Targets stay at least 44px so a control written for the phone is the control on the desk. The desk is not a reason to ship a denser phone UI.
* **Fullscreen recipe.** On a wide screen, a recipe can fill the window and hide the rail. That mode is for reading, including while a chat with Chef is the thing being operated. Leaving it is a visible control. Layout is [0015](0015-navigation-ia.md).
* **The open recipe can change by itself.** When the data for the recipe on screen changes, including a save Chef made, the page updates in place. No click, keypress, or reload is required to see it. This ADR does not choose polling, server-sent events, or a websocket, and it does not put Chef's chat inside the cookbook.
* Light and dark both exist. The default follows the device, and a control on the page can override it.
* Zoom stays on. Text fields are at least 16px so iOS does not zoom the page on focus.
* v1 does not cache the recipe library. A screen that cannot load says so in words and stops spinning. Chrome that is already loaded still paints.
* Samples in git are labeled example data. Real recipes stay in Postgres ([0007](0007-public-repo-secrets.md)).

## Consequences (if accepted)

* Feature UI that misses a principle is not done, even if the route works.
* A service worker or an offline library is a later ADR. This one only requires an honest failure state.
* The transport that carries Chef's save to an open page is a later API decision. The UI rule is only that an open recipe is not a snapshot until reload.
* Denser layouts for power use would be a new ADR that supersedes this one.

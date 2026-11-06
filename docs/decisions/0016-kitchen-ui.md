# 0016. Kitchen UI

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26

## Problem

A kitchen screen that is dense, chrome-heavy, or online-only is hard to use at arm's length, and later screens drift without a shared bar.

## Options considered

1. **Kitchen principles, three screens, floating opaque controls, an accessibility bar** — large targets, system fonts, one breakpoint, theme follows the system.
2. **A dense library UI with persistent chrome** — more on screen, worse with messy hands.
3. **Offline-first, extra destinations, or a downloaded font** — a cache before the fields exist, more navigation than v1 needs, or a font request before text.
4. **Recipe as a read-only article** — simpler, and a phone on the counter still sleeps and cannot track a step.
5. **Check-off and wake lock written through the API** — survives a new device, and it is a recipe write the phone is not allowed to make.
6. **Free-text search on the list** — more than v1 needs.
7. **Favorites toggle and tag chips** — a filter, not a search box.

## Decision

Large targets. Hover is never the only way to reach an action. Glanceable. Readable at arm's length. Light and dark. The theme follows the system. v1 does not cache the library. A document that never loads shows the browser error. A later failure is said in words. Example data only in git.

Three screens: a list, one recipe, and settings. Settings is the theme and nothing else. No search, no plan, no fullscreen, no Chef panel, and no live updates.

The list has a favorites toggle and tag filter chips. Free-text search stays out.

The recipe screen is for reading and for cooking. A step can be checked off. That state stays on the device. It is not written through the API. While the recipe is open, the app asks the OS to keep the screen awake.

Controls float. No rail, no header bar, and no bottom bar. Controls are opaque. Text is not read through a control.

The accessibility floor is WCAG 2.2 AA. System fonts. One wide breakpoint. The phone uses the safe area.

## Consequences

* Exact values, routes, and wireframes are in the design docs.
* A service worker is recorded in the web doc, not a new ADR.
* The UI package is [0020](0020-kitchen-design-system.md). How a UI change is shown is [CONTRIBUTING.md](../../CONTRIBUTING.md) and the demo doc.
* Check-off is not a phone write. Favorite and rating writes stay the phone writes.
* Wake Lock is best-effort. A browser that cannot hold the screen still shows the recipe.
* Real recipes stay in Postgres ([0007](0007-public-repo-secrets.md)).

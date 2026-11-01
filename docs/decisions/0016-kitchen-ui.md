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

## Decision

Large targets. Hover is never the only way to reach an action. Glanceable. Readable at arm's length. Light and dark. The theme follows the system. v1 does not cache the library. A document that never loads shows the browser error. A later failure is said in words. Example data only in git.

Three screens: a list, one recipe, and settings. Settings is the theme and nothing else. No search, no plan, no fullscreen, no Chef panel, and no live updates.

Controls float. No rail, no header bar, and no bottom bar. Controls are opaque. Text is not read through a control.

The accessibility floor is WCAG 2.2 AA. System fonts. One wide breakpoint. The phone uses the safe area.

## Consequences

* Exact values, routes, and wireframes are in the design docs.
* A service worker is a later ADR.
* The UI package is [0017](0017-ui-package.md). Demos are [0018](0018-ui-demos.md).
* Real recipes stay in Postgres ([0007](0007-public-repo-secrets.md)).

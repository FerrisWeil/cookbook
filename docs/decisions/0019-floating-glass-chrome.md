# 0019. Floating glass chrome

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25, agent chat

## Problem

The shell feels clunky, and large sidebars and headers compete with the recipe.

## Options considered

1. **Heavy chrome.** A left rail, a tall header band, and a bottom bar. Familiar, and it spends the screen on the frame.
2. **Floating actions and a liquid-glass material.** Primary controls float over the content. Surfaces are translucent, blurred so the content shows through, with a soft highlight. The list and the recipe stay the content.
3. **Dense app chrome.** Thin toolbars and small controls so more fits on screen. That fights the large targets in [0014](0014-kitchen-ui-principles.md).

## Decision

Use option 2. The UI should feel modern rather than heavy.

* Prefer floating action buttons over a large sidebar or a large header. Primary actions float over the content. The list and the recipe remain the content ([0015](0015-navigation-ia.md)).
* The material is liquid glass: translucent surfaces, blur so content shows through, a soft highlight, controls that float. This is our description of the goal. It does not copy another product's marketing, icons, or assets.
* Information stays visible and accessible. Glass must not wash out text. Text keeps the contrast bar in [0017](0017-tokens-accessibility-iphone.md): WCAG 2.2 AA, 4.5:1. Floating controls still meet the 44px target from [0014](0014-kitchen-ui-principles.md). State is not color alone. Zoom stays on. If a scrim or a more opaque surface is required for contrast, that wins over the effect.
* Phone and wide layouts both use this chrome. No large left rail and no tall header band.
* Blur and translucency are an implementation detail of the UI package in [0016](0016-design-system-approach.md). This ADR does not pick a library and it does not add a package.

Sketches are in [chrome](../design/chrome.md) and [information architecture](../design/information-architecture.md).

## Consequences

* Supersedes the heavy shell only: a left rail, a tall header, and a bottom bar, including the bottom-nav and left-rail sentence in [0017](0017-tokens-accessibility-iphone.md). [0015](0015-navigation-ia.md) still stands. v1 is a recipe list and a recipe viewer. Search, Plan, fullscreen, and live updates stay out.
* The `48rem` breakpoint, the palette, the type scale, and the contrast numbers in 0017 stay.
* The feature PR builds this chrome with example data. It does not add a dependency beyond what [0016](0016-design-system-approach.md) already allows inside `@cookbook/ui`.

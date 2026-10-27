# 0024. Tokens, accessibility, and iPhone layout

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

## Problem

The foundation page has no shared measurements for type, color, contrast, or the iPhone safe area, so later screens will drift.

## Options considered

1. **Keep the foundation palette, add a dark theme and semantic tokens, one breakpoint at 48rem, system fonts, WCAG 2.2 AA, safe-area padding.** Familiar colors, no font download, phone layout is the default.
2. **A new brand palette and a webfont.** A network request before text is right, and a license to keep track of in a public repo.
3. **Phone, tablet, and desktop breakpoints, plus a compact density.** Three layouts to maintain for two stated devices (desktop browser and iPhone).

## Decision

Use option 1. Values live in [tokens](../design/tokens.md). In short:

* Semantic colors (`--bg`, `--text`, `--accent`, and the rest of that list) switch with theme. Light keeps the foundation hex values. Dark is warm charcoal, not pure black. Body text and muted text clear 4.5:1 in both themes. Borders that mark a control clear 3:1.
* Serif system stack for recipes (the foundation stack, including Iowan Old Style and Georgia). System sans for nav, buttons, and fields. No downloaded font.
* Body 1.125rem, inputs at least 1rem, titles 1.75rem. Spacing is a 4px scale. Cards use the foundation radius, 0.75rem. Minimum control size is 2.75rem (44px).
* ~~One breakpoint: `48rem`. Below it, bottom nav and one column. At and above it, a left rail, and a recipe may put ingredients beside steps.~~
* Accessibility floor is WCAG 2.2 AA, with 44px primary targets (stricter than the 24px guideline) because of [0021](0021-kitchen-ui-principles.md). Visible focus, zoom allowed, `prefers-reduced-motion` honored, state not shown by color alone.
* iPhone: `viewport-fit=cover`, padding from `env(safe-area-inset-*)`, `min-height: 100dvh`, no `maximum-scale`. Status bar style stays `default`. Theme color meta follows the active theme. The manifest already makes the app installable; this ADR adds no service worker.

## Consequences

* The feature PR applies these tokens and checks the contrast pairs with a unit test. It does not add a font file.
* Changing a hex value later can be a doc edit if the contrast bar still holds. Changing the breakpoint width or dropping AA is a new ADR.
* Install remains Share → Add to Home Screen. Caching is still [0021](0021-kitchen-ui-principles.md), not a worker.
* ~~The bottom nav and left rail in the breakpoint bullet are superseded by [0026](0026-floating-glass-chrome.md). The `48rem` width, the contrast bar, and the other measurements stay.~~

## Amendments

### 2026-10-25

Chrome is [0026](0026-floating-glass-chrome.md). There is no left rail and no bottom nav. The viewer does not name schema fields and has no ingredients column. `48rem` is still the wide breakpoint. It only makes the content wider.

The theme defaults to the system setting. The first paint follows that setting. The selector is not on the list or the recipe. It is on the settings screen in [0022](0022-navigation-ia.md). The contrast bar, the type scale, and the other measurements in this ADR stay.

# 0017. Tokens, accessibility, and iPhone layout

* Status: **proposed**
* Date: 2026-10-26
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this in chat. Nothing in this ADR is in force.

## Context

[0014](0014-kitchen-ui-principles.md) sets the bar (arm's length, both themes, 44px targets). The foundation page already uses paper `#f6f1e9`, ink `#2b241c`, and herb `#3d5a40`, with a web manifest and an apple touch icon. It is light-only, uses `100%` height rather than the dynamic viewport, and the viewport meta does not cover the iPhone safe area.

The numbers, contrast table, and iPhone rules are in [tokens](../design/tokens.md).

## Options considered

1. **Keep the foundation palette, add a dark theme and semantic tokens, one breakpoint at 48rem, system fonts, WCAG 2.2 AA, safe-area padding.** Recommended. Familiar colors, no font download, phone layout is the default.
2. **A new brand palette and a webfont.** More "designed", a network request before text is right, and a license to keep track of in a public repo.
3. **Phone, tablet, and desktop breakpoints, plus a compact density.** Three layouts to maintain for two people and two stated devices (desktop browser and iPhone). iPad was not requested.

## Decision (proposed)

Use option 1. Values live in [tokens](../design/tokens.md). In short:

* Semantic colors (`--bg`, `--text`, `--accent`, and the rest of that list) switch with theme. Light keeps the foundation hex values. Dark is warm charcoal, not pure black. Body text and muted text clear 4.5:1 in both themes. Borders that mark a control clear 3:1.
* Serif system stack for recipes (the foundation stack, including Iowan Old Style and Georgia). System sans for nav, buttons, and fields. No downloaded font.
* Body 1.125rem, inputs at least 1rem, titles 1.75rem. Spacing is a 4px scale. Cards use the foundation radius, 0.75rem. Minimum control size is 2.75rem (44px).
* One breakpoint: `48rem`. Below it, bottom nav and one column. At and above it, a left rail, and a recipe may put ingredients beside steps.
* Accessibility floor is WCAG 2.2 AA, with 44px primary targets (stricter than the 24px guideline) because of [0014](0014-kitchen-ui-principles.md). Visible focus, zoom allowed, `prefers-reduced-motion` honored, state not shown by color alone.
* iPhone: `viewport-fit=cover`, padding from `env(safe-area-inset-*)`, `min-height: 100dvh`, no `maximum-scale`. Status bar style stays `default`. Theme color meta follows the active theme. The manifest already makes the app installable; this ADR adds no service worker.

## Consequences (if accepted)

* The feature PR applies these tokens in `apps/web` and checks the contrast pairs with a unit test. It does not add a font file or a new package.
* Changing a hex value later can be a doc edit if the contrast bar still holds. Changing the breakpoint model or dropping AA is a new ADR.
* Install remains Share → Add to Home Screen. Caching is still [0014](0014-kitchen-ui-principles.md), not a worker.

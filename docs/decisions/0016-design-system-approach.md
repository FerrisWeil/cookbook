# 0016. Design system approach

* Status: **proposed**
* Date: 2026-10-26
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this in chat. Nothing in this ADR is in force. No package is added by this PR.

## Context

The web app is Vite, React, and a single global stylesheet ([0008](0008-typescript-stack.md), still proposed as a stack, already what the skeleton runs). Taylor will not audit every transitive package. A separate security pass owns dependency updates; this decision is about how much UI supply chain we take on.

v1 screens are a list, a search field, and an article ([0015](0015-navigation-ia.md)). They need buttons, links, text, and focus, which HTML already has. Token values, if this approach is accepted, are [0017](0017-tokens-accessibility-iphone.md). The comparison is in [design system](../design/system.md).

## Options considered

1. **Tailwind plus a copied component library (shadcn) on Radix.** Fast to assemble and strong on focus traps. A normal install adds Tailwind, `class-variance-authority`, `clsx`, `tailwind-merge`, an icon package, and one `@radix-ui/react-*` package per widget. Radix Dialog also pulls scroll-lock and aria helpers. The copied components are readable in-repo; the behavior still updates through those packages. More surface than this app's screens need.
2. **CSS modules plus CSS custom properties, no component library.** Recommended. Vite already compiles CSS modules. New runtime dependencies: none. Tokens and components live under `apps/web`. Accessibility comes from semantic HTML (`button`, `a`, `input`, headings), which is enough until a screen needs a dialog or menu.
3. **Tailwind only, or a one-file kit (Pico, Open Props).** Smaller than option 1, still a package Taylor did not write. A classless kit fights a custom shell. Utility classes do not remove the need to specify hit targets and themes.

## Decision (proposed)

Use option 2.

* Design tokens are CSS custom properties in `apps/web`. There is no `packages/design-tokens` until a second app renders UI. API and MCP do not.
* Components are small React functions with a co-located `*.module.css`. One global file holds the reset, tokens, and theme. The foundation stylesheet is replaced in the feature PR, not extended into a junk drawer.
* Do not add Tailwind, Radix, shadcn, an icon font, or a webfont.
* A later screen that needs a focus trap (confirm delete, for example) does not silently install Radix. That dependency is its own decision.

## Consequences (if accepted)

* The feature PR adds tokens, a handful of components, the shell from [0015](0015-navigation-ia.md), and a style-guide route. It does not add a dependency to `apps/web/package.json`.
* Choosing Tailwind or Radix later is a new ADR that supersedes this one.
* If Taylor rejects this and picks option 1 or 3, the token *values* in [0017](0017-tokens-accessibility-iphone.md) can still move across. Only the file format changes.

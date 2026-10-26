# 0016. Design system approach

* Status: **proposed**
* Date: 2026-10-26
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor said this was mostly what he wants, and that he wants a design system package so components stay reusable and DRY. He has not confirmed the revision below. This PR still adds no package.

## Context

The web app is Vite, React, and a single global stylesheet ([0008](0008-typescript-stack.md), still proposed as a stack, already what the skeleton runs). Taylor will not audit every transitive package. A separate security pass owns dependency updates; this decision is about how much UI supply chain we take on.

v1 screens are a list, a search field, and an article ([0015](0015-navigation-ia.md), still proposed). They need buttons, links, text, and focus, which HTML already has. Token values are the accepted [0017](0017-tokens-accessibility-iphone.md). The comparison is in [design system](../design/system.md).

## Options considered

1. **Tailwind plus a copied component library (shadcn) on Radix.** Fast to assemble and strong on focus traps. A normal install adds Tailwind, `class-variance-authority`, `clsx`, `tailwind-merge`, an icon package, and one `@radix-ui/react-*` package per widget. Radix Dialog also pulls scroll-lock and aria helpers. The copied components are readable in-repo; the behavior still updates through those packages. More surface than this app's screens need.
2. **CSS modules plus CSS custom properties, no third-party component library, one workspace package for the components.** Recommended after Taylor's note. Vite already compiles CSS modules. New npm dependencies: none. `@cookbook/ui` holds each component once. `apps/web` imports them. Accessibility comes from semantic HTML (`button`, `a`, `input`, headings), which is enough until a screen needs a dialog or menu.
3. **Tailwind only, or a one-file kit (Pico, Open Props).** Smaller than option 1, still a package Taylor did not write. A classless kit fights a custom shell. Utility classes do not remove the need to specify hit targets and themes.

## Decision (proposed)

Use option 2, with the components in a workspace package.

* `@cookbook/ui` is the design-system package. Each component is one React function and one CSS module. The shell, the screens, and `/guide` import that function. They do not restyle a copy.
* Tokens are the CSS variables accepted in [0017](0017-tokens-accessibility-iphone.md). They live in `@cookbook/ui` and the app imports that file, so the values are not pasted into `apps/web`. 0017's sentence that the feature PR adds no new package is superseded only for this workspace package, and only if this ADR is accepted. The hex values do not change.
* React is a peer dependency of `@cookbook/ui`, the same React `apps/web` already has. No second copy.
* Do not add Tailwind, Radix, shadcn, an icon font, or a webfont. "Design system package" here means our package, not a downloaded kit. If Taylor meant shadcn or Radix, that is option 1 and it is not this decision.
* A later screen that needs a focus trap does not silently install Radix. That dependency is its own decision.
* API and MCP do not import `@cookbook/ui`.

## Consequences (if accepted)

* Extends the layout in [0009](0009-repo-layout.md) with `packages/ui`. The workspace glob already includes `packages/*`.
* The feature PR adds the package, the shell from [0015](0015-navigation-ia.md), and `/guide`. `apps/web` depends on `workspace:*`. No new third-party UI dependency.
* Choosing Tailwind or Radix later is a new ADR that supersedes this one.

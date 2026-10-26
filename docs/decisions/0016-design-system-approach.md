# 0016. Design system approach

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

## Context

Screens should share components instead of copying them. Taylor said in chat on 2026-10-26 that a well-tested third-party UI library, Tailwind included, is fine, and that the library is an implementation detail of the UI package so it can change later. He asked to use whatever makes the best UI. He will not audit every transitive package; a separate security pass owns dependency updates.

Token values are the accepted [0017](0017-tokens-accessibility-iphone.md). The comparison is in [design system](../design/system.md). This ADR does not add a package. The feature PR does.

## Options considered

1. **Lock Tailwind, shadcn, or Radix as the product decision.** A specific kit is then hard to leave. Taylor did not choose a kit.
2. **Ban third-party UI libraries and hand-write every component.** Small supply chain. Taylor said a well-tested library is welcome.
3. **One workspace UI package. Screens import it. A well-tested library may be used inside the package and is not a product decision.** Taylor confirmed this.

## Decision

Use option 3.

* `@cookbook/ui` (`packages/ui`) is the design-system package. Components live there once. `apps/web` imports them. The style guide from [0018](0018-ui-demos.md) imports the same components.
* Tailwind, or another major, well-tested UI library, may be used inside that package. The choice is an implementation detail. Swapping the library later does not need a new product ADR.
* This decision does not require Tailwind, shadcn, or Radix, and it does not forbid them.
* API and MCP do not import `@cookbook/ui`.
* Token values stay the ones in [0017](0017-tokens-accessibility-iphone.md). Which file in the package holds the CSS is an implementation detail.

## Consequences

* Extends the layout in [0009](0009-repo-layout.md) with `packages/ui`. The workspace glob already includes `packages/*`.
* The feature PR adds the package and the list and viewer from [0015](0015-navigation-ia.md). It picks a library for the quality of the UI.
* Prefer a widely used library. Do not add a package per widget just in case. That is caution, not a ban.
* 0017's colors, type, breakpoint, and iPhone rules are unchanged.

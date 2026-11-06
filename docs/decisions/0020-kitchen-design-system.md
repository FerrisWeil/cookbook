# 0020. Kitchen design system

* Status: accepted
* Date: 2026-11-02
* Confirmed: Taylor, 2026-11-02

## Problem

Shared controls get copied into each screen. A second design file, or a CSS framework, would freeze look-and-feel in the wrong place.

## Options considered

1. **Lock a component library as the product decision** — a specific kit is then hard to leave.
2. **Ban third-party UI libraries** — a small supply chain, and a well-tested library is off limits.
3. **One shared package, semantic CSS variables, Radix, local review on the guide route** — screens import it; a token file can drop in later; accessible behavior is borrowed; the designer runs each UI pull request locally.
4. **Tailwind or shadcn as the system** — faster first screens, and look-and-feel is then a utility class or a kit, not a token file.
5. **Figma as the source of truth** — a second artifact to keep in sync with the household app.
6. **A CI screenshot job or a per-pull-request preview** — review waits on automation instead of the running app.

## Decision

One shared UI package. Screens import it. The API and MCP do not. The primitives inside that package are a product decision. Tokens are semantic CSS custom properties. Radix primitives supply accessible behavior. Not Tailwind. Not shadcn.

Review is the guide route in the running app. The designer runs each UI pull request locally. The guide uses the real UI-package components and shows every state in light and dark, with theme and reduced-motion toggles. Not a CI screenshot job. Not a per-pull-request preview. Not a Figma file.

Kitchen product shape, including list filters and cooking, is [0016](0016-kitchen-ui.md). How the web app renders and proxies the API is [0023](0023-kitchen-web-implementation.md).

## Consequences

* Swapping Radix later is recorded in the design-system doc, not a new ADR.
* Look-and-feel that still sits in the pending list waits for a later design pass.
* Values, routes, and pending items are in the design docs.

# Design system

Detail for [0023](../decisions/0023-design-system-approach.md). Status is **accepted** (Taylor, 2026-10-26, agent chat).

Components live in one workspace package, `@cookbook/ui`. Screens import that package. A well-tested UI library may be used inside the package. Which library is an implementation detail of the feature PR, chosen for the quality of the UI. Replacing it later does not need a new product ADR.

This page does not pick Tailwind, shadcn, Radix, or hand-written CSS. Any of those can sit inside the package. The product decision is the package boundary, not the tool.

## What the package is for

[0022](../decisions/0022-navigation-ia.md) is a list and a recipe viewer. The package owns the pieces those screens share: the page shell, a recipe card, the article, buttons, and the load and error message. The style guide at `/guide` ([0025](../decisions/0025-ui-demos.md)) renders the same pieces with example data.

Token values are [0024](../decisions/0024-tokens-accessibility-iphone.md). The package applies them. It does not invent a second palette.

API and MCP do not depend on `@cookbook/ui`.

## Supply chain

Prefer a library that is widely used and already maintained. Do not add a package for each widget just in case. That caution is not a ban. A major library such as Tailwind is allowed when it is the right tool. Blur and translucency for [chrome](chrome.md) stay inside this package.

React stays the React `apps/web` already has. The UI package does not install a second copy.

## What is not decided here

The feature PR chooses the library and writes the components. A later swap of that library edits the package. It does not reopen this ADR.

# Design system

Detail for [0017](../decisions/0017-ui-package.md).

`@cookbook/ui` (`packages/ui`) is not in the tree. When it lands, screens import that package. A well-tested UI library may be used inside it. Which library is an implementation detail. Replacing it later does not need a new ADR.

This page does not pick Tailwind, shadcn, Radix, or hand-written CSS. Any of those can sit inside the package.

## What the package is for

The pieces the screens share: the page shell, a recipe card, the article, buttons, and the load and error message. `/guide` ([0018](../decisions/0018-ui-demos.md)) renders the same pieces with example data.

Token values are [tokens](tokens.md). The package applies them. It does not invent a second palette.

The API and MCP do not depend on `@cookbook/ui`.

## Supply chain

Prefer a library that is widely used and already maintained. Do not add a package for each widget just in case. Blur and translucency for [chrome](chrome.md) stay inside this package.

React stays the React `apps/web` already has. The UI package does not install a second copy.

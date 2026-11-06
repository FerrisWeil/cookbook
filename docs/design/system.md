# Design system

Detail for [0017](../decisions/0017-ui-package.md) and [0020](../decisions/0020-kitchen-design-system.md).

`@cookbook/ui` (`packages/ui`) is not in the tree. Screens import that package. The API and MCP do not.

## Tokens

Semantic CSS custom properties. The color set and motion tokens are [tokens](tokens.md). Buttons are [buttons](buttons.md). The foundation `--paper`, `--ink`, and `--herb` names are not kept. One set. Spacing and radius tokens are pending.

The package applies the tokens. It does not invent a second palette.

## Primitives

Radix primitives supply accessible behavior (name, role, keyboard). Styling is plain CSS on those primitives, using the custom properties.

Not Tailwind. Not shadcn. A later swap of Radix is a new decision; 0020 amended [0017](../decisions/0017-ui-package.md) on that point.

React stays the React `apps/web` already has. The UI package does not install a second copy.

## What the package is for

The pieces the screens share: the page shell, a recipe card, the article (ingredients and steps), buttons, filter chips, a step check-off, and the load and error message. `/guide` ([demo](demo.md)) renders the same pieces with example data.

Theme control placement, icons, and the pending tokens above wait for a later design pass. List cards are [information architecture](information-architecture.md). The package still exports structure those can drop into: semantic token names, a document theme hint, and Radix-backed controls.

## Supply chain

Prefer a library that is widely used and already maintained. Do not add a package for each widget just in case. Radix is the allowed primitive kit. Blur and translucency for [chrome](chrome.md) stay inside this package.

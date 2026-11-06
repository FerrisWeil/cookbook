# Design system

Detail for [0020](../decisions/0020-kitchen-design-system.md).

`@cookbook/ui` (`packages/ui`) holds semantic tokens, Button, Card, and the read/error message. Screens import that package. The API and MCP do not. This slice uses native `button` and `a`; Radix remains the allowed kit when a primitive is needed.

## Tokens

Semantic CSS custom properties. The color set and motion tokens are [tokens](tokens.md). Buttons are [buttons](buttons.md). The foundation `--paper`, `--ink`, and `--herb` names are not kept. One set. Spacing and radius tokens are pending.

The package applies the tokens. It does not invent a second palette.

## Primitives

Radix primitives supply accessible behavior (name, role, keyboard) when a control needs them. Styling is plain CSS using the custom properties.

Not Tailwind. Not shadcn. A later swap of Radix is recorded here, not a new ADR.

React stays the React `apps/web` already has. The UI package does not install a second copy.

## What the package is for

The pieces the screens share: the page shell, a recipe card, the article (ingredients and steps), buttons, filter chips, a step check-off, and the load and error message. This slice ships the shell, card, article, buttons, and load/error copy. `/guide` ([demo](demo.md)) is not built.

Theme control placement, icons, and the pending tokens above wait for a later design pass. List cards are [information architecture](information-architecture.md). Title-only cards omit favorite, rating, and tags until the list API returns them.

## Supply chain

Prefer a library that is widely used and already maintained. Do not add a package for each widget just in case. Radix is the allowed primitive kit. Blur and translucency for [chrome](chrome.md) stay inside this package.

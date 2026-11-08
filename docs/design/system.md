# Design system

Detail for [0020](../decisions/0020-kitchen-design-system.md).

`@cookbook/ui` (`packages/ui`) holds semantic tokens, Button, Card, and the read/error message. Screens import that package. The API and MCP do not. This slice uses native `button` and `a`; Radix remains the allowed kit when a primitive is needed.

## Tokens

Semantic CSS custom properties. The color set, type, motion, spacing, and radius tokens are [tokens](tokens.md). Buttons are [buttons](buttons.md). The foundation `--paper`, `--ink`, and `--herb` names are not kept. One set.

The package applies the tokens. It does not invent a second palette.

## Primitives

Radix primitives supply accessible behavior (name, role, keyboard) when a control needs them. Styling is plain CSS using the custom properties.

Not Tailwind. Not shadcn. A later swap of Radix is recorded here, not a new ADR.

React stays the React `apps/web` already has. The UI package does not install a second copy.

## What the package is for

The pieces the screens share: the page shell, a recipe card, the article (ingredients and steps), buttons, filter chips, a step check-off, and the load and error message. This slice ships the shell, card, article, buttons, and load/error copy. `/guide` ([demo](demo.md)) is not built.

Theme control placement and home-screen icons wait for a later design pass. List cards are [information architecture](information-architecture.md). Cards show title and facts. Favorite, rating, and tags wait until the list API returns those fields.

## Supply chain

Prefer a library that is widely used and already maintained. Do not add a package for each widget just in case. Radix is the allowed primitive kit. Blur and translucency for [chrome](chrome.md) stay inside this package.

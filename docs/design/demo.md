# UI demos

Detail for [0020](../decisions/0020-kitchen-design-system.md).

The designer reviews each UI pull request by running the app locally. Not a CI screenshot job. Not a per-pull-request preview. Not a Figma file. Desktop and phone captures still attach to the pull request.

Browser tests wait until Taylor confirms the feature in chat ([CONTRIBUTING.md](../../CONTRIBUTING.md)). Unit tests use Node's built-in runner.

## What a UI pull request attaches

1. Desktop, about 1280×800, showing the screen a person actually lands on.
2. iPhone size, 390×844. The safe-area padding should be visible if the shell uses it.
3. Both themes, when the change touches color. Otherwise one theme is enough, and the pull request says which.
4. A short screen recording only when the review is about motion or a sequence of taps.

Captures are taken from the local running app. They are images on the pull request. There is no screenshot package and no screenshot CI job. The first UI pull request did not include Playwright.

## Example data

Every visible recipe title starts with `Example:`. Do not photograph a real phone that is logged into the household app. Do not include tailnet hostnames, auth keys, or meal notes.

## Review route

`/guide` is a hand-built route in `apps/web`. It uses the real `@cookbook/ui` components.

- Not linked from the list, the recipe, or settings.
- Shows every state on example data, in light and dark: colors, type scale, buttons, cards (favorite on and off, rated and unrated, extra tags), article, filter chips, a step check-off, load and error messages.
- Theme and reduced-motion toggles live on the route.

## Tests

Allowed in the UI feature pull request:

- `node:test` for the contrast pairs in [tokens](tokens.md), the motion token values, and for the theme choice (`system` when storage is empty, the stored value when it is `light` or `dark`, `system` when storage throws).
- `node:test` that a browser-facing payload has no token, once the proxy exists. Detail is [web.md](../web.md).
- The web package grows a `test` script, and the root `pnpm test` runs it.

Spacing and radius tokens exist. Tests for those values, and for icon artwork, are not required in this slice.

Not allowed until the feature has been demoed and confirmed in chat:

- Playwright
- any other real-browser test
- a screenshot-diff suite

When those browser tests exist, they drive the UI and check behavior. Search list behavior uses Playwright after Taylor confirmed it. Smoke installs Chromium and runs `pnpm test:search`. Outbox and cooking still use the Chrome CDP scripts when a system Chrome is present.

Also not part of the first UI pull request: Testing Library, jsdom, or a React test renderer. Adding a DOM test library is a dependency.

Taylor confirms in the agent chat. After that, functional tests can be written against the accepted behavior.

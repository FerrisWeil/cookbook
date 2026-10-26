# UI demos

Detail for [0025](../decisions/0025-ui-demos.md). Status is **accepted** (Taylor, 2026-10-26, agent chat).

Browser tests wait until Taylor confirms the feature in chat ([CONTRIBUTING.md](../../CONTRIBUTING.md)). [0011](../decisions/0011-test-tooling.md) is a separate proposal and is not turned on by this doc.

## What a UI pull request attaches

1. Desktop, about 1280×800, showing the screen a person actually lands on.
2. iPhone size, 390×844, the logical CSS pixels of a modern iPhone portrait. The safe-area padding should be visible if the shell uses it (content is not under the home indicator).
3. Both themes, when the change touches color. Otherwise one theme is enough, and the PR says which.
4. A short screen recording only when the review is about motion or a sequence of taps. A static screen does not need a video.

Captures are taken from the running web app (Vite or the Compose stack). They are images on the PR, not a new screenshot package and not Playwright.

## Example data

Every visible recipe title starts with `Example:`. Do not photograph a real phone that is logged into the household app. Do not include tailnet hostnames, auth keys, or meal notes. This is the same rule as [0007](../decisions/0007-public-repo-secrets.md).

## Style guide

If [0023](../decisions/0023-design-system-approach.md) is accepted, the feature PR adds `/guide`.

* Not linked from the list, the recipe, or settings.
* Renders the components on example data: colors in both themes, type scale, button, card, article, load and error messages.
* Taylor can open `https://<tailnet-web>/guide` on his iPhone after a deploy. That visit is in addition to the PR images, not a replacement. Review has to be possible before he deploys.

## Tests in the design-system feature PR

Allowed:

* `node:test` for the contrast pairs in [tokens](tokens.md) and for the theme choice (`system` when storage is empty, the stored value when it is `light` or `dark`, `system` when storage throws).
* The web package grows a `test` script, and the root `pnpm test` runs it, so `pnpm check` covers it.

Not allowed in the first UI feature PR, and not allowed until the feature has been demoed and confirmed in chat:

* Playwright
* any other real-browser test
* a screenshot-diff suite

When those browser tests exist, they drive the UI and check behavior. They cover the list, the recipe, an empty list, and a failed load. This doc does not add a framework.

Also not part of that PR: Testing Library, jsdom, or a React test renderer. Components are shown on `/guide` and in the PR images. Adding a DOM test library is a dependency, and [0023](../decisions/0023-design-system-approach.md) is the decision that would have to allow it.

## Confirming

Taylor confirms in the agent chat, not by emoji on the PR alone. After that, functional tests can be proposed against the accepted behavior. Until then the ADR and the feature stay unconfirmed, and the feature PR's test section says browser tests are not written yet.

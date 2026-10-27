# Kitchen UI principles

Detail for [0021](../decisions/0021-kitchen-ui-principles.md). Status is **accepted** (Taylor, 2026-10-26, agent chat).

The app is used while cooking and while planning, on a desktop browser and on iPhone Safari ([0005](../decisions/0005-v1-scope.md)). These are the overall rules. Measurements live in [tokens](tokens.md).

## Large touch targets

Primary actions are easy to hit. Hover is never the only way to reach an action.

## Glanceable

A screen is easy to scan. The important thing stands out.

## Readable at arm's length

Body text can be read with the phone propped up or held away. Zoom stays available.

## Light and dark

Both themes exist. The first paint follows the system setting. The selector is on the settings screen, not on the list or the recipe.

## Honest offline

v1 does not cache the recipe library and does not add a service worker.

A home-screen open that cannot load the document shows the browser's own error page. That is acceptable. The app does not paint chrome for a document that never arrived.

After the page has loaded, a later read that fails is said in words. The screen does not sit on a spinner with no text. Controls that shipped with the loaded page still render.

## Example data in git

This repo is public ([0007](../decisions/0007-public-repo-secrets.md)). Docs, wireframes, the style guide, tests, and PR captures use invented recipes whose titles start with "Example:". Real titles and notes stay in Postgres on the NAS.

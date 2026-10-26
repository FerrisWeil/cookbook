# Kitchen UI principles

Detail for [0014](../decisions/0014-kitchen-ui-principles.md). Status is **accepted** (Taylor, 2026-10-26, agent chat).

The app is used while cooking and while planning, on a desktop browser and on iPhone Safari ([0005](../decisions/0005-v1-scope.md)). These are the overall rules. Measurements live in [tokens](tokens.md).

## Large touch targets

Primary actions are easy to hit. Hover is never the only way to reach an action.

## Glanceable

A screen is easy to scan. The important thing stands out.

## Readable at arm's length

Body text can be read with the phone propped up or held away. Zoom stays available.

## Light and dark

Both themes exist. The first paint follows the device, and a control on the page can override it for this browser.

## Honest offline

v1 does not ship an offline recipe library. That cache was left open in [0005](../decisions/0005-v1-scope.md) and stays open.

If a fetch fails, the screen says so in words. The shell does not sit on a spinner with no text. Controls that shipped with the page still render when the API is down.

## Example data in git

This repo is public ([0007](../decisions/0007-public-repo-secrets.md)). Docs, wireframes, the style guide, tests, and PR captures use invented recipes whose titles start with "Example:". Real titles and notes stay in Postgres on the NAS.

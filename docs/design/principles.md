# Kitchen UI principles

Detail for [0014](../decisions/0014-kitchen-ui-principles.md). Status is **proposed**.

The app is used while cooking and while planning. The reader is standing, the phone may be propped up, and a finger may be damp. Desktop is the planning seat. iPhone Safari, including a home-screen install, is the kitchen seat ([0005](../decisions/0005-v1-scope.md)).

## 1. Touch first

Every primary action is a `button` or a link with a box of at least 44×44 CSS pixels and at least 8px of space to the next target. Pressed and focused states are visible without a pointer. No action is available only on hover, and no action requires a swipe.

## 2. One job per screen

Favorites is a list to choose from. Search is a query and matches. A recipe is one recipe to read. The largest text on the screen is the thing you need: the recipe name, or the screen title when you are choosing. Source, tags, and notes stay smaller and lower. Do not combine planning, editing, and reading on the first version of a screen.

## 3. Readable at arm's length

Body copy is at least 1.125rem (18px at the default root) with line-height of at least 1.45. The line length on a wide screen stays near 65 characters. The viewport meta does not set `maximum-scale` and does not disable zoom. Text inputs and textareas are at least 1rem so iPhone Safari does not zoom the whole page on focus.

## 4. Light and dark

Both themes meet the contrast bar in [tokens](tokens.md). The first paint follows `prefers-color-scheme`. A control labeled with the current choice (Auto, Light, or Dark) overrides it for this browser and stores that choice on the device. Two people do not share a theme setting across phones. There is no account for this.

## 5. Honest offline

Tailscale-only means "cannot load" is normal: the phone is off the tailnet, or the NAS is off ([0002](../decisions/0002-tailscale-only.md)). v1 does not ship a service worker and does not claim the recipe list works offline. That cache was left open in 0005 and stays open.

What v1 does claim:

* If a fetch fails, the screen says it failed, in words, and the control to retry is a normal button.
* The shell does not sit on a spinner with no text.
* Header, nav, and theme still render when the API is down, because they shipped with the page.

A cache of the last opened recipe would be a new ADR after the schema exists.

## 6. Example data in git

This repo is public ([0007](../decisions/0007-public-repo-secrets.md)). Docs, wireframes, the style guide, tests, and PR captures use invented recipes whose titles start with "Example:". Real titles, notes, and photos stay in Postgres on the NAS.

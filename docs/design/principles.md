# Kitchen UI principles

Detail for [0014](../decisions/0014-kitchen-ui-principles.md). Status is **proposed**. Revised 2026-10-26 after Taylor's note. Not confirmed.

The phone is the kitchen seat: standing, arm's length, a finger may be damp. The desktop is the desk seat: planning and reading, and sometimes a recipe left fullscreen while Chef is the conversation. iPhone Safari, including a home-screen install, is the kitchen seat ([0005](../decisions/0005-v1-scope.md)).

## 1. Phone, in the kitchen

Every primary action is a `button` or a link with a box of at least 44×44 CSS pixels and at least 8px of space to the next target. Pressed and focused states are visible without a pointer. No action is available only on hover, and no action requires a swipe.

Each phone screen has one job. Favorites is a list to choose from. Search is a query and matches. A recipe is one recipe to read. The largest text is the recipe name, or the screen title when you are choosing.

Body copy is at least 1.125rem (18px at the default root) with line-height of at least 1.45. The viewport meta does not set `maximum-scale` and does not disable zoom. Text inputs and textareas are at least 1rem so iPhone Safari does not zoom the whole page on focus.

## 2. Desktop, at a desk

The same components and the same type size. A control is not restyled smaller because a mouse can hit it. The line length on a wide screen stays near 65 characters. Fullscreen reading, below, uses this type.

## 3. Fullscreen recipe

On a wide screen the recipe can hide the rail and fill the window. That is the mode for reading while Chef is open beside the cookbook and the recipe is not being clicked. Exit is a labeled control, at least 44px, visible without hover. The phone recipe does not get a separate fullscreen mode; it is already one column.

## 4. The open recipe updates by itself

If the data for the recipe on screen changes, the page shows the change. That includes a save Chef made while the laptop was untouched. The reader does not reload and does not press a refresh control.

This doc does not choose how the change arrives. Polling, server-sent events, and a websocket are API decisions. Chef's chat window is not a pane in this app ([0005](../decisions/0005-v1-scope.md)). The feature PR, if 0014 and 0015 are accepted, shows the rule with example data: one example recipe changes to a second example state on its own.

## 5. Light and dark

Both themes meet the contrast bar in [tokens](tokens.md), which [0017](../decisions/0017-tokens-accessibility-iphone.md) accepted. The first paint follows `prefers-color-scheme`. A control labeled with the current choice (Auto, Light, or Dark) overrides it for this browser and stores that choice on the device. Two people do not share a theme setting across phones. There is no account for this.

## 6. Honest offline

Tailscale-only means "cannot load" is normal: the phone is off the tailnet, or the NAS is off ([0002](../decisions/0002-tailscale-only.md)). v1 does not ship a service worker and does not claim the recipe list works offline. That cache was left open in 0005 and stays open.

What v1 does claim:

* If a fetch fails, the screen says it failed, in words, and the control to retry is a normal button.
* The shell does not sit on a spinner with no text.
* Header, nav, and theme still render when the API is down, because they shipped with the page.

A cache of the last opened recipe would be a new ADR after the schema exists.

## 7. Example data in git

This repo is public ([0007](../decisions/0007-public-repo-secrets.md)). Docs, wireframes, the style guide, tests, and PR captures use invented recipes whose titles start with "Example:". Real titles, notes, and photos stay in Postgres on the NAS.

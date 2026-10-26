# 0022. Navigation and information architecture

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

Shell chrome is [0026](0026-floating-glass-chrome.md). ~~The screens below are unchanged.~~

## Problem

The first version needs a place to find a recipe and a place to read it, without extra destinations.

## Options considered

1. **Two screens: a list of recipes, and one recipe opened from that list.**
2. **Browse, Search, and a Plan slot.** More navigation than the first version needs.
3. **Search as its own destination, a fullscreen mode, or a Chef panel.** Later work. Not this decision.

## Decision

~~Use option 1.~~

* `/` is the list. Each card shows an example title and `Placeholder meta · fields undecided`. The card opens the recipe.
* `/recipes/:id` is one recipe to read. The id is an opaque string. The page shows the title, the same placeholder meta line, and the recipe body as placeholder text. It does not name schema fields.
* ~~Phone and desktop are the same two screens. Desktop is the wider layout from [0024](0024-tokens-accessibility-iphone.md). There is no second nav destination.~~
* Back returns to the list.
* If the list cannot load, the list screen says so. The foundation status card is not the home screen.

The style-guide URL from [0025](0025-ui-demos.md) is a review page. It is not a screen in this information architecture.

Wireframes are in [information architecture](../design/information-architecture.md).

## Consequences

* ~~The feature PR builds the list and the viewer with example data. It does not add Search, Plan, fullscreen, a live-update channel, or a Chef panel.~~
* Those later screens, and any real field list, wait for their own decisions. The schema is not chosen here.
* Client routes only. No new nginx locations.
* How the list and the viewer are framed is [0026](0026-floating-glass-chrome.md), not a left rail, a tall header, or a bottom bar.

## Amendments

### 2026-10-25

v1 screens are the recipe list, the recipe viewer, and settings. Settings holds the theme selector and nothing else. The list and the recipe do not. The first paint follows the system setting.

~~The feature PR builds those three screens with example data.~~ It does not add Search, Plan, fullscreen, a live-update channel, or a Chef panel. Phone and desktop are the same screens. Desktop is the wider layout from [0024](0024-tokens-accessibility-iphone.md).

### 2026-10-26

The feature PR adds the example recipes as files in the repo. It does not add them in this docs PR. Titles start with `Example:`. Ids are explicit. The body is placeholder text and does not name schema fields. That same data can show the list, one recipe, an empty list, and a failed load, for demos. The failed load is an in-app state after the page has loaded. A document that never arrives is [0021](0021-kitchen-ui-principles.md). A real recipe schema and API are later. They are not this PR and not the first UI PR.

Settings stays the theme selector only, for now. More UI design comes later. The default remains the system setting. No other settings are added.

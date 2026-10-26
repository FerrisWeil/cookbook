# 0015. Navigation and information architecture

* Status: accepted
* Date: 2026-10-26
* Confirmed: Taylor, 2026-10-26, agent chat

## Context

Taylor said in chat on 2026-10-26 to stop overthinking information architecture and to start with the basics: a recipe list, and opening one recipe to read it. Search, weekly planning, fullscreen reading, live updates, and a Chef panel are later. They are not part of this decision.

The recipe schema is not decided, so the viewer does not depend on a final field list. nginx already falls back unknown paths to the SPA (`docker/nginx.conf`); this ADR does not change that file.

Wireframes are in [information architecture](../design/information-architecture.md). They use example titles and the line `Placeholder meta · fields undecided`.

## Options considered

1. **Two screens: a list of recipes, and one recipe opened from that list.** Taylor confirmed this.
2. **Browse, Search, and a Plan slot.** More navigation than the first version needs.
3. **Search as its own destination, a fullscreen mode, or a Chef panel.** Later work. Not this decision.

## Decision

Use option 1.

* `/` is the list. Each card shows an example title and `Placeholder meta · fields undecided`. The card opens the recipe.
* `/recipes/:id` is one recipe to read. The id is an opaque string. The page shows the title, the same placeholder meta line, and the recipe body as placeholder text. It does not name schema fields.
* Phone and desktop are the same two screens. Desktop is the wider layout from [0017](0017-tokens-accessibility-iphone.md). There is no second nav destination.
* Back returns to the list.
* If the list cannot load, the list screen says so. The foundation status card is not the home screen.

The style-guide URL from [0018](0018-ui-demos.md) is a review page. It is not a screen in this information architecture.

## Consequences

* The feature PR builds the list and the viewer with example data. It does not add Search, Plan, fullscreen, a live-update channel, or a Chef panel.
* Those later screens, and any real field list, wait for their own decisions. The schema is not chosen here.
* Client routes only. No new nginx locations.

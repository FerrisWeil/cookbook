# 0015. Navigation and information architecture

* Status: **proposed**
* Date: 2026-10-26
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this in chat. Nothing in this ADR is in force. Wireframes show example recipes, not household data.

## Context

v1 needs a way to browse favorites, search, and open one recipe. Weekly meal planning comes later ([0005](0005-v1-scope.md)). The recipe schema is not decided, so screens must not depend on a final field list. nginx already falls back unknown paths to the SPA (`docker/nginx.conf`); this ADR does not change that file.

Wireframes and the route list are in [information architecture](../design/information-architecture.md).

## Options considered

1. **Browse and Search in the nav. A recipe opens on top of either. Plan is drawn as a later screen and is not a v1 route.** Recommended. The shell can gain one nav item later without a redesign, and v1 has no dead tab.
2. **A Plan tab now, labeled later.** The household sees where planning will live. The tab does nothing, which is a poor target to hit with messy hands.
3. **Search as a field on Browse, not its own screen.** One less destination. Search is easier to miss, and a query has no URL to return to.

## Decision (proposed)

Use option 1.

* Phone: a top bar and a bottom nav (Browse, Search), padded for the iPhone safe areas. Wide screens (the breakpoint in [0017](0017-tokens-accessibility-iphone.md)): the same two items in a left rail.
* Routes: `/` favorites, `/search` search, `/recipes/:id` one recipe. The id is an opaque string. The page shows a title and placeholder blocks. Ingredients, steps, and notes in the sketches are layout regions, not a claim that the schema has those columns.
* The recipe screen keeps Back and the nav. Both are large. Leaving a recipe does not depend on a swipe.
* Plan has a wireframe and no route. It is not in the nav until a later feature is accepted.
* The foundation status card leaves the home screen. If the list cannot load, Browse says that the API is unreachable. Database health is not a cooking task. The foundation feature's home-page status check is then history; this ADR does not edit that feature doc.

## Consequences (if accepted)

* The feature PR builds this shell with example cards. It does not add Plan, and it does not call a recipe API that does not exist yet.
* Weekly planning, filters, and any field that is not "title plus placeholder blocks" wait for the schema.
* Client routes only. No new nginx locations.

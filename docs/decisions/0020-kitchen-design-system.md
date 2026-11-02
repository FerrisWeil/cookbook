# 0020. Kitchen design system

* Status: accepted
* Date: 2026-11-02
* Confirmed: Taylor, 2026-11-02

## Problem

The shared UI package and the kitchen screens still have open design calls: how tokens and primitives are built, how a recipe is cooked from the phone, and how the list is narrowed. A second design file, or a CSS framework, would freeze look-and-feel in the wrong place.

## Options considered

1. **Code-first package: semantic CSS variables, Radix, review on the guide route** — a token file can drop in later; accessible behavior is borrowed; review stays in the running app.
2. **Tailwind or shadcn as the system** — faster first screens, and look-and-feel is then a utility class or a kit, not a token file.
3. **Figma as the source of truth** — a second artifact to keep in sync with the household app.
4. **Recipe as a read-only article** — simpler, and a phone on the counter still sleeps and cannot track a step.
5. **Check-off and wake lock written through the API** — survives a new device, and it is a recipe write the phone is not allowed to make.
6. **Free-text search on the list** — [0016](0016-kitchen-ui.md) already refused it.
7. **Favorites toggle and tag chips only** — a filter, not a search box.

## Decision

One shared UI package, as [0017](0017-ui-package.md). This amends 0017: the primitives inside that package are now a product decision. Tokens are semantic CSS custom properties. The color set is the tokens doc. Radix primitives supply accessible behavior. Not Tailwind. Not shadcn. Review is the guide route plus desktop and phone captures ([0018](0018-ui-demos.md)). Not a Figma file.

The recipe screen is for reading and for cooking. Ingredients and steps sit side by side on the wide layout and stack on the phone. A step can be checked off. That state stays on the device. It is not written through the API. While the recipe is open, the app asks the OS to keep the screen awake.

The list has a favorites toggle and tag filter chips. This amends [0016](0016-kitchen-ui.md): those filters are allowed. Free-text search is still out. A meal plan, fullscreen, a Chef panel, and live updates stay out.

Not decided here: list card fields, where the theme control sits on settings, spacing and radius and motion tokens, icons, and home-screen icons.

## Consequences

* Look-and-feel that still sits in the pending list waits for a later design pass. The package shape is ready for a token file.
* Check-off is not a phone write. Favorite and rating writes stay the phone writes.
* Wake Lock is best-effort. A browser that cannot hold the screen still shows the recipe.
* The recipe data model ([0019](0019-v1-recipe-data-model.md)) has tags as one list. The documented household API list item is id and title. The read field list has no tags. Tag chips cannot work until the API exposes tags on the list. That gap is not closed here.
* Values, routes, and pending items are in the design docs.
* How the web app renders, proxies the API, and applies a theme is a separate decision.

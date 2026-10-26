# Information architecture

Detail for [0015](../decisions/0015-navigation-ia.md). Status is **accepted** (Taylor, 2026-10-26, agent chat).

v1 is two screens: a list of recipes, and one recipe opened to read. Search, weekly planning, fullscreen, live updates, and a Chef panel are later. They are not drawn here.

Wireframes use invented example recipes. They are not the schema and not household data.

## Routes

| Route | v1 | What it is |
| --- | --- | --- |
| `/` | yes | The list. A card opens the recipe. |
| `/recipes/:id` | yes | One recipe. `:id` is opaque. |

`/guide` is the style guide from [0018](../decisions/0018-ui-demos.md). It is not part of this information architecture.

## Screens

### List

Title: Recipes. Cards show the example title and one muted line: `Placeholder meta · fields undecided`. The whole card is the link. Empty: "No recipes yet." Failure: "Could not load recipes." and a way to try again. The foundation stack-status card is not this screen.

Phone and desktop are the same list. Desktop is wider. There is no second destination in the nav.

![Phone wireframe of the recipe list](wireframes/browse-phone.svg)

![Wide wireframe of the recipe list](wireframes/browse-desktop.svg)

### Recipe

One `h1`, the example title. Then `Placeholder meta · fields undecided`. Then placeholder body text. Those lines are not a schema. Back returns to the list.

![Phone wireframe of one example recipe](wireframes/recipe-phone.svg)

![Wide wireframe of one example recipe](wireframes/recipe-desktop.svg)

## Example cards

| Title | Placeholder meta |
| --- | --- |
| Example: Tomato lentils | Placeholder meta · fields undecided |
| Example: Weeknight oats | Placeholder meta · fields undecided |
| Example: Citrus chicken | Placeholder meta · fields undecided |

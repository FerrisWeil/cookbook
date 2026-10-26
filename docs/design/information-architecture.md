# Information architecture

Detail for [0015](../decisions/0015-navigation-ia.md). Status is **accepted** (Taylor, 2026-10-26, agent chat).

v1 is two screens: a list of recipes, and one recipe opened to read. Search, weekly planning, fullscreen, live updates, and a Chef panel are later. They are not drawn here.

Chrome is [0019](../decisions/0019-floating-glass-chrome.md): floating actions, translucent panels, no left rail, no tall header, no bottom bar. See [chrome](chrome.md).

Wireframes use invented example recipes. They are not the schema and not household data.

## Routes

| Route | v1 | What it is |
| --- | --- | --- |
| `/` | yes | The list. A card opens the recipe. |
| `/recipes/:id` | yes | One recipe. `:id` is opaque. |

`/guide` is the style guide from [0018](../decisions/0018-ui-demos.md). It is not part of this information architecture.

## Screens

### List

The title "Recipes" is the first line of the content, not a header band. Cards show the example title and one muted line: `Placeholder meta · fields undecided`. The whole card is the link. Cards are translucent panels. Empty: "No recipes yet." Failure: "Could not load recipes." and a way to try again.

Theme floats over the list. It is at least 44px. Phone and desktop are the same list. Desktop is wider.

![Phone wireframe of the recipe list, floating theme control, glass cards](wireframes/browse-phone.svg)

![Wide wireframe of the recipe list, floating theme control, no rail](wireframes/browse-desktop.svg)

### Recipe

One `h1`, the example title, in the content. Then `Placeholder meta · fields undecided`. Then placeholder body text. Those lines are not a schema. Back is a floating control and returns to the list. It is not a header bar.

![Phone wireframe of one example recipe with a floating Back control](wireframes/recipe-phone.svg)

![Wide wireframe of one example recipe with a floating Back control](wireframes/recipe-desktop.svg)

## Example cards

| Title | Placeholder meta |
| --- | --- |
| Example: Tomato lentils | Placeholder meta · fields undecided |
| Example: Weeknight oats | Placeholder meta · fields undecided |
| Example: Citrus chicken | Placeholder meta · fields undecided |

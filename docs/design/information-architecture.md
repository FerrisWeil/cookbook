# Information architecture

Screens for [0016](../decisions/0016-kitchen-ui.md) and [0020](../decisions/0020-kitchen-design-system.md). Not in the tree.

Three screens: a list of recipes, one recipe opened to read and cook, and settings. Chrome is [chrome](chrome.md).

Wireframes use invented example recipes. They are not household data. They do not yet show the two-column recipe or the list filters.

## Routes

| Route | What it is |
| --- | --- |
| `/` | The list. A card opens the recipe. |
| `/recipes/:id` | One recipe. `:id` is explicit in the example data. |
| `/settings` | Theme only. |

`/guide` is the review route from [0018](../decisions/0018-ui-demos.md). It is not part of this information architecture.

## Screens

### List

The title "Recipes" is the first line of the content. A favorites toggle narrows the list to favorites. Tag filter chips narrow it to recipes that have the chosen tags. Both can be on at once. No chip chosen means every tag. Free-text search is not offered.

Card fields besides the title are pending. Empty library: "No recipes yet." No rows after a filter: "No recipes match." Failure, after the page has loaded: "Could not load recipes." and a way to try again. The last line stays clear of the safe area. There is no theme control on this screen.

![Phone wireframe of the recipe list](wireframes/browse-phone.svg)

![Wide wireframe of the recipe list](wireframes/browse-desktop.svg)

### Recipe

Reading and cooking help. One `h1`, the example title. Ingredients and steps sit side by side from the wide breakpoint up, and stack on the phone. Each ingredient is one written line. Steps stay in saved order. Each step can be checked off. That check-off stays on this browser for that recipe. It is not written through the API.

While this screen is open, the app asks the OS to keep the display awake. If the browser cannot, the recipe still shows.

Favorite and rating are the phone writes. They are offered on this screen. Back returns to the list. It uses an opaque fill and does not cover the title, the ingredient lines, or the steps. The last line stays clear of Back and of the safe area.

Nutrition, when present, is shown. List card fields are pending; this screen still shows the title, ingredient lines, steps, nutrition when present, favorite, and rating.

![Phone wireframe of one example recipe](wireframes/recipe-phone.svg)

![Wide wireframe of one example recipe](wireframes/recipe-desktop.svg)

### Settings

Title: Settings. The only choice is Theme. The default is the system setting. Placement of that control is pending.

![Phone wireframe of settings, theme only](wireframes/settings-phone.svg)

## Example cards

Titles start with `Example:`. Ids are explicit. The body is placeholder text and does not name schema fields. The same data can show the list, one recipe, an empty list, a filtered-empty list, and a failed load. That failed load is after the page has loaded. A document that never arrives is the browser error page ([0016](../decisions/0016-kitchen-ui.md)).

| Id | Title | Placeholder meta |
| --- | --- | --- |
| `example-tomato-lentils` | Example: Tomato lentils | Placeholder meta · fields undecided |
| `example-weeknight-oats` | Example: Weeknight oats | Placeholder meta · fields undecided |
| `example-citrus-chicken` | Example: Citrus chicken | Placeholder meta · fields undecided |

## Tags

The data model treats tags as one list ([0019](../decisions/0019-v1-recipe-data-model.md)). The documented API list item is id and title. The read field list has no tags. Tag chips need tags on the list payload. That is an API gap, not a screen invention.

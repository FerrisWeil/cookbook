# Information architecture

Detail for [0015](../decisions/0015-navigation-ia.md).

v1 is three screens: a list of recipes, one recipe opened to read, and settings. Search, weekly planning, fullscreen, live updates, and a Chef panel are later. They are not drawn here.

The feature PR adds example recipes in the repo. This docs PR does not. Titles start with `Example:`. Ids are explicit. Body text is a placeholder and does not name schema fields. The same data can show the list, one recipe, an empty list, and a failed load. That failed load is after the page has loaded. A real schema and API are later, and they are not the first UI PR.

Chrome is [0019](../decisions/0019-floating-glass-chrome.md). See [chrome](chrome.md).

Wireframes use invented example recipes. They are not household data.

## Routes

| Route | v1 | What it is |
| --- | --- | --- |
| `/` | yes | The list. A card opens the recipe. |
| `/recipes/:id` | yes | One recipe. `:id` is explicit in the example data. |
| `/settings` | yes | Theme only, for now. |

`/guide` is the style guide from [0018](../decisions/0018-ui-demos.md). It is not part of this information architecture.

## Screens

### List

The title "Recipes" is the first line of the content. Cards show the example title and one muted line: `Placeholder meta · fields undecided`. The whole card is the link. Each card is one fill. Empty: "No recipes yet." Failure, after the page has loaded: "Could not load recipes." and a way to try again. The last line stays clear of the safe area. There is no theme control on this screen.

![Phone wireframe of the recipe list](wireframes/browse-phone.svg)

![Wide wireframe of the recipe list](wireframes/browse-desktop.svg)

### Recipe

One `h1`, the example title. Then `Placeholder meta · fields undecided`. Then placeholder body text. Those lines are not a schema. Back returns to the list. It uses an opaque fill and does not cover the title or the body. The last line stays clear of Back and of the safe area.

![Phone wireframe of one example recipe](wireframes/recipe-phone.svg)

![Wide wireframe of one example recipe](wireframes/recipe-desktop.svg)

### Settings

Title: Settings. The only choice, for now, is Theme. The default is the system setting. More UI design comes later. This screen does not decide whether the control is a menu button or a control at the top of the screen.

![Phone wireframe of settings, theme only](wireframes/settings-phone.svg)

## Example cards

These strings are what the feature PR's committed examples use.

| Id | Title | Placeholder meta |
| --- | --- | --- |
| `example-tomato-lentils` | Example: Tomato lentils | Placeholder meta · fields undecided |
| `example-weeknight-oats` | Example: Weeknight oats | Placeholder meta · fields undecided |
| `example-citrus-chicken` | Example: Citrus chicken | Placeholder meta · fields undecided |

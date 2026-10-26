# Information architecture

Detail for [0015](../decisions/0015-navigation-ia.md). The amendment of 2026-10-25 is the current decision.

v1 is three screens: a list of recipes, one recipe opened to read, and settings. Search, weekly planning, fullscreen, live updates, and a Chef panel are later. They are not drawn here.

Chrome is [0019](../decisions/0019-floating-glass-chrome.md). See [chrome](chrome.md).

Wireframes use invented example recipes. They are not the schema and not household data.

## Routes

| Route | v1 | What it is |
| --- | --- | --- |
| `/` | yes | The list. A card opens the recipe. |
| `/recipes/:id` | yes | One recipe. `:id` is opaque. |
| `/settings` | yes | Theme only. |

`/guide` is the style guide from [0018](../decisions/0018-ui-demos.md). It is not part of this information architecture.

## Screens

### List

The title "Recipes" is the first line of the content. Cards show the example title and one muted line: `Placeholder meta · fields undecided`. The whole card is the link. Each card is one fill. Empty: "No recipes yet." Failure: "Could not load recipes." and a way to try again. The last line stays clear of the safe area. There is no theme control on this screen.

![Phone wireframe of the recipe list](wireframes/browse-phone.svg)

![Wide wireframe of the recipe list](wireframes/browse-desktop.svg)

### Recipe

One `h1`, the example title. Then `Placeholder meta · fields undecided`. Then placeholder body text. Those lines are not a schema. Back returns to the list. It uses an opaque fill and does not cover the title or the body. The last line stays clear of Back and of the safe area.

![Phone wireframe of one example recipe](wireframes/recipe-phone.svg)

![Wide wireframe of one example recipe](wireframes/recipe-desktop.svg)

### Settings

Title: Settings. One choice: Theme. The first paint follows the system. This screen does not decide whether the control is a menu button or a control at the top of the screen.

![Phone wireframe of settings, theme only](wireframes/settings-phone.svg)

## Example cards

| Title | Placeholder meta |
| --- | --- |
| Example: Tomato lentils | Placeholder meta · fields undecided |
| Example: Weeknight oats | Placeholder meta · fields undecided |
| Example: Citrus chicken | Placeholder meta · fields undecided |

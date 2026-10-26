# Information architecture

Detail for [0015](../decisions/0015-navigation-ia.md). Status is **proposed**.

Wireframes are sketches of layout and priority. Every recipe on them is invented. They are not the schema and not household data. Placeholder lines are labeled so a later field list can replace them without moving the shell.

## Routes

| Route | Nav | v1 | What it is |
| --- | --- | --- | --- |
| `/` | Browse | yes | Favorites. Large cards. Opening a card goes to the recipe. |
| `/search` | Search | yes | One text field. Results use the same card as Browse. |
| `/recipes/:id` | — | yes | One recipe. `:id` is opaque. Reached from Browse or Search. |
| `/guide` | — | yes, if [0018](../decisions/0018-ui-demos.md) is accepted | Style guide. URL only. |
| Plan | — | no | Wireframe only. No path until a planning feature is accepted. |

Search in v1 filters the example list in the page. It does not assume an API query language. When a real list exists, the same screen can send the query to the API. The field matches the title until the schema says which other fields exist.

## Shell

Phone (under `48rem`, see [tokens](tokens.md)):

* Top bar: screen title, and a theme button reading `Theme: Auto`, `Theme: Light`, or `Theme: Dark`.
* Bottom nav: Browse, Search. The current one is selected with more than color (weight plus an underline).
* Safe areas above the top bar and below the nav.

Wide (`48rem` and up):

* Left rail with the same two items and the theme control.
* No bottom nav.
* One main column.

A skip link is the first focusable control: "Skip to content".

The recipe screen shows a Back link of at least 44px and leaves the nav in place. Back returns to the list you came from when that list is Browse or Search; otherwise it returns to `/`.

## Screens

### Browse

Title: Favorites. Cards show the example title and one muted line: `Placeholder meta · fields undecided`. The whole card is the link. Empty: "No favorites yet. Chef saves a recipe here after a meal you liked." Failure: "Could not load recipes." and a Retry button. The foundation stack-status card is not on this screen.

![Phone wireframe of Favorites, light theme, two example cards, bottom nav](wireframes/browse-phone.svg)

![Wide wireframe of Favorites with a left rail](wireframes/browse-desktop.svg)

### Search

The field is labeled Search, large, and is not icon-only. An empty field shows a hint: "Type to filter titles." No matches: "No titles match “{query}”." plus the field still focused. Results are cards. The wireframe shows the typed-query state.

![Phone wireframe of Search with one example match](wireframes/search-phone.svg)

### Recipe

One `h1`, the example title. Then a muted line that reads `Placeholder meta · fields undecided`. The sketch also shows Ingredients, Steps, and Notes as layout regions so the article has a shape. Those labels are not a schema proposal. If the accepted schema is a single body, the article is one block under the title. On a phone the regions stack. On a wide screen, a secondary region may sit beside the main one. Nothing on this screen edits.

![Phone wireframe of one example recipe in the dark theme](wireframes/recipe-phone.svg)

![Wide wireframe of a recipe with ingredients beside steps](wireframes/recipe-desktop.svg)

### Plan (not v1)

Recorded so the rail and the bottom nav are drawn as a short list that can grow by one item. The sketch is not a route. Do not ship a disabled Plan tab.

![Phone wireframe marked as a later Plan screen, not in v1](wireframes/plan-phone.svg)

## Example cards used in the sketches

These strings are the stand-ins for the feature PR as well, so the docs and the app match.

| Title | Placeholder meta |
| --- | --- |
| Example: Tomato lentils | Placeholder meta · fields undecided |
| Example: Weeknight oats | Placeholder meta · fields undecided |
| Example: Citrus chicken | Placeholder meta · fields undecided |

Steps and ingredient lines in the recipe sketch are the words "Example ingredient" and "Example step", numbered. They are not a cookable recipe.

# Kitchen UI

Category F3. Status: Proposed.

Drawn from the accepted kitchen UI decision. Taylor answered the open questions in chat. Each statement stays Proposed until he accepts it.

## F3.1 Household

Status: Proposed.

Taylor and his wife can open the app on a desktop browser and on an iPhone.

## F3.2 Install

Status: Proposed.

The app is a responsive web app and installs to the home screen from a secure context.

### F3.2.1 No offline cache

Status: Proposed.

v1 does not cache the library and does not serve it offline.

### F3.2.2 Failed load

Status: Proposed.

A document that never loads shows the browser error. After a load, a failed read is said in words.

### F3.2.3 Tailnet address

Status: Proposed.

Install is not required from the production tailnet address.

## F3.3 Screens

Status: Proposed.

v1 has three screens: the recipe list, one recipe, and settings.

### F3.3.1 Settings

Status: Proposed.

Settings changes the theme and nothing else.

### F3.3.2 Later screens

Status: Proposed.

v1 has no search, meal plan, fullscreen reading, Chef panel, or live updates.

### F3.3.3 List

Status: Proposed.

The list shows each recipe's title and favorite.

### F3.3.4 Recipe

Status: Proposed.

The recipe screen shows the title, the ingredient lines, the steps in order, and nutrition when a row exists.

### F3.3.5 Rating

Status: Proposed.

A rating shows on the recipe when it is set.

### F3.3.6 Parsed fields

Status: Proposed.

Amount, unit, and name are not shown.

### F3.3.7 Not favorites-only

Status: Proposed.

The list includes recipes that are not favorites.

## F3.4 Controls

Status: Proposed.

Controls float and use an opaque fill.

### F3.4.1 No persistent chrome

Status: Proposed.

There is no rail, header bar, or bottom bar.

### F3.4.2 Text stays readable

Status: Proposed.

Recipe text is not read through a control.

## F3.5 Accessibility

Status: Proposed.

The three screens meet WCAG 2.2 AA.

### F3.5.1 Targets

Status: Proposed.

A primary action target is at least 44 by 44 CSS pixels. Hover is never the only way to reach an action.

### F3.5.2 Zoom and transparency

Status: Proposed.

Zoom is not disabled. When the system asks for less transparency, a control stays opaque.

## F3.6 Theme

Status: Proposed.

Light and dark both exist. The first paint follows the system. The choice is on settings.

## F3.7 Phone actor

Status: Proposed.

A write from the phone asks which actor is writing. It does not pick one.

### F3.7.1 What the phone writes

Status: Proposed.

From the phone, a write may set the favorite and the rating. It does not change the title, the ingredient lines, the steps, the servings, or the nutrition.

### F3.7.2 Choices

Status: Proposed.

The phone offers only actors that already exist.

# Chrome

Detail for [0016](../decisions/0016-kitchen-ui.md) and [0020](../decisions/0020-kitchen-design-system.md).

The list, the recipe, and settings are the content. There is no left rail, no tall header band, and no bottom bar. The app does not cache the library and does not serve it offline. Free-text search, a meal plan, fullscreen reading, a Chef panel, and live updates stay out. A favorites toggle and tag filter chips are allowed on the list ([0020](../decisions/0020-kitchen-design-system.md)).

## Controls

A floating control uses an opaque fill from a contrast-tested pair in [tokens](tokens.md). Recipe text is not read through a button. Backdrop blur does not cover the only copy of a line. When the system asks for less transparency, that fill still hides the surface behind it.

A control is at least 44px on each side. Its name is text, not color alone. Zoom stays on.

On a small screen the control sits where the text stays readable: a menu button, the top of the screen, or a zone that has no text. Placement of the theme control on settings is pending. The list and the recipe do not carry the theme selector.

The last line of content stays clear of any control and of the safe area. On the recipe screen, no control overlaps the title, ingredient lines, or steps.

## Cards

A card has one fill, `--bg-elevated`. It is not a second translucent layer. Which fields a card shows, besides the title, is pending.

## Theme

The first paint follows the system setting. The selector is on the settings screen only.

How a surface is painted belongs to the UI package ([0020](../decisions/0020-kitchen-design-system.md)).

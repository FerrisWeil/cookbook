# Chrome

Detail for [0016](../decisions/0016-kitchen-ui.md).

The list, the recipe, and settings are the content. There is no left rail, no tall header band, and no bottom bar. v1 does not cache the library and does not serve it offline. Search, a meal plan, fullscreen reading, a Chef panel, and live updates stay out ([0016](../decisions/0016-kitchen-ui.md)).

## Controls

A floating control uses an opaque fill from a contrast-tested pair in [tokens](tokens.md). Recipe text is not read through a button. Backdrop blur does not cover the only copy of a line. When the system asks for less transparency, that fill still hides the surface behind it.

A control is at least 44px on each side. Its name is text, not color alone. Zoom stays on.

On a small screen the control sits where the text stays readable: a menu button, the top of the screen, or a zone that has no text. Which of those the settings screen uses is not decided. The list and the recipe do not carry the theme selector.

The last line of content stays clear of any control and of the safe area.

## Cards

A card has one fill, `--bg-elevated`. It is not a second translucent layer.

## Theme

The first paint follows the system setting. The selector is on the settings screen only.

How a surface is painted belongs to the UI package ([0017](../decisions/0017-ui-package.md)). This doc does not pick a library.

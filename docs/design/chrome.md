# Chrome

Detail for [0019](../decisions/0019-floating-glass-chrome.md). Status is **accepted** (Taylor, 2026-10-25, agent chat).

The list and the recipe are the content. Controls float over them. There is no left rail, no tall header band, and no bottom bar.

## Material

Surfaces used for controls are translucent. The content behind them blurs through. A soft light edge separates the control from the page. The sketches use opacity because a wireframe cannot blur. Text does not sit on a wash that fails the contrast bar in [tokens](tokens.md). Where the effect would drop body text under 4.5:1, the surface becomes more opaque. That choice wins.

Floating controls are at least 44px on each side ([0014](../decisions/0014-kitchen-ui-principles.md)). A control's name is text, not color alone. Zoom stays on.

Phone and wide layouts use the same chrome. Wide only gives the content more room. The `48rem` breakpoint from [0017](../decisions/0017-tokens-accessibility-iphone.md) still changes width. It does not add a rail.

## What floats

On the list, theme floats. It is not a header.

On the recipe, Back floats and returns to the list. The title is the first line of the recipe, not a bar.

How blur is implemented belongs to `@cookbook/ui` ([0016](../decisions/0016-design-system-approach.md)). This doc does not pick a library.

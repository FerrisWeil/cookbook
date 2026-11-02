# Buttons

Detail for [0020](../decisions/0020-kitchen-design-system.md). Hit size and the focus ring are [tokens](tokens.md). Motion is the duration and easing tokens.

The UI package is not in the tree.

## Variants

| Kind | Fill |
| --- | --- |
| Primary | Herb (`--accent` with `--accent-contrast` text) |
| Tonal | `--bg-elevated` |
| Quiet | No fill |
| Destructive | `--danger` / `--danger-bg` |
| Floating icon button | Opaque fill from a contrast-tested pair |
| Favorite toggle | Quiet until on |
| Rating toggle | Quiet until on |
| Tag filter chips | Pill-shaped. Tonal when off, herb when on |

## Size

Default height 48px. Minimum 44px (`--hit`). The hit area may extend past the visual. Buttons use 8px radius. Chips are pill-shaped.

## Labels

Sentence case. The floating Back button shows an icon and a label. Settings may be icon-only with an accessible name.

## Press, focus, loading

Press feedback on `pointerdown`: scale 0.97 plus a darker fill. Drop the scale under `prefers-reduced-motion`. Show a `focus-visible` ring. A loading button keeps its label width. `touch-action: manipulation`.

## Favorite and rating

The control updates on tap, then writes. On failure it rolls back and shows a worded error.

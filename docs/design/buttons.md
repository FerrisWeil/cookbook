# Buttons

Detail for [0020](../decisions/0020-kitchen-design-system.md). Hit size and the focus ring are [tokens](tokens.md). Motion is the duration and easing tokens.

Button lives in `@cookbook/ui`. Favorite, rating, and filter chips are not in this slice. The Back control is the label only; icon artwork is pending.

## Variants

| Kind | Fill |
| --- | --- |
| Primary | Ocean (`--accent` with `--accent-contrast` text) |
| Tonal | `--bg-elevated` |
| Quiet | No fill |
| Destructive | `--danger` / `--danger-bg` |
| Floating icon button | Opaque fill from a contrast-tested pair |
| Favorite toggle | Quiet until on |
| Rating toggle | Quiet until on |
| Tag filter chips | Pill-shaped. Tonal when off, ocean when on |

## Size

Default height 48px. Minimum 44px (`--hit`). The hit area may extend past the visual. Buttons use `--radius-control` (0.75rem). Chips are pill-shaped. The recipe Back control is Primary.

## Labels

Sentence case. The floating Back button shows an icon and a label. Settings may be icon-only with an accessible name.

## Press, focus, loading

Press feedback on `pointerdown`: scale 0.97 plus a darker fill. Under `prefers-reduced-motion`, drop the scale and keep the darker fill. Press uses `--duration-fast` and `--ease-out`. Show a `focus-visible` ring. A loading button keeps its label width. `touch-action: manipulation`.

## Favorite and rating

Optimistic: updates on tap, then writes; on failure rolls back and shows a worded error, e.g. "Could not save favorite."

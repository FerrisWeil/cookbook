# Tokens, accessibility, breakpoints, iPhone

Values for [0016](../decisions/0016-kitchen-ui.md). The UI package is not in the tree. A unit test locks these pairs when that package lands.

Contrast ratios below are WCAG 2.x relative luminance, computed for these hex pairs, not measured off a screenshot.

The file format inside the UI package follows [0017](../decisions/0017-ui-package.md). The hex values can move with that format.

## Color

Light values are the foundation page: paper, ink, herb, and the existing warn pair. Dark is a warm charcoal so a phone on the counter at night is not a pure-black glare.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#f6f1e9` | `#1c1915` | Page |
| `--bg-elevated` | `#efe6d6` | `#2a2520` | Cards, one fill |
| `--text` | `#2b241c` | `#f3ecdf` | Body and titles |
| `--text-muted` | `#5c5348` | `#c4b8a5` | Meta that still meets 4.5:1 |
| `--accent` | `#3d5a40` | `#c5d4c0` | Links, focus |
| `--accent-contrast` | `#f6f1e9` | `#1c1915` | Text on an accent fill |
| `--danger` | `#8a3b2a` | `#f0c2b6` | Error text |
| `--danger-bg` | `#f3ddd6` | `#3a2924` | Error surface |
| `--border` | `#7d7264` | `#8a7d6b` | Control boundaries |
| `--focus` | `#3d5a40` | `#c5d4c0` | Focus ring |

| Pair | Ratio | Bar |
| --- | --- | --- |
| `--text` on `--bg`, light | 13.61 | 4.5:1 |
| `--text-muted` on `--bg`, light | 6.70 | 4.5:1 |
| `--text-muted` on `--bg-elevated`, light | 6.09 | 4.5:1 |
| `--accent` on `--bg`, light | 6.83 | 4.5:1 |
| `--accent` on `--bg-elevated`, light | 6.20 | 4.5:1 |
| `--accent-contrast` on `--accent`, light | 6.83 | 4.5:1 |
| `--danger` on `--danger-bg`, light | 5.89 | 4.5:1 |
| `--danger` on `--bg`, light | 6.82 | 4.5:1 |
| `--border` on `--bg`, light | 4.18 | 3:1 |
| `--border` on `--bg-elevated`, light | 3.80 | 3:1 |
| `--text` on `--bg`, dark | 14.90 | 4.5:1 |
| `--text` on `--bg-elevated`, dark | 12.92 | 4.5:1 |
| `--text-muted` on `--bg`, dark | 8.96 | 4.5:1 |
| `--text-muted` on `--bg-elevated`, dark | 7.77 | 4.5:1 |
| `--accent` on `--bg`, dark | 11.30 | 4.5:1 |
| `--accent-contrast` on `--accent`, dark | 11.30 | 4.5:1 |
| `--danger` on `--bg`, dark | 10.92 | 4.5:1 |
| `--danger` on `--danger-bg`, dark | 8.60 | 4.5:1 |
| `--border` on `--bg`, dark | 4.36 | 3:1 |
| `--border` on `--bg-elevated`, dark | 3.78 | 3:1 |

`color-scheme` is set to `light` or `dark` with the theme so native form controls match. The foundation `--paper`, `--ink`, and `--herb` names are not kept alongside the semantic names. One set.

## Type

No webfont files and no Google Fonts request.

```css
--font-serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
--font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
```

Recipes use the serif stack (the foundation choice; Iowan Old Style is on iOS). Controls and inputs use the sans stack so a control is not mistaken for a sentence.

| Token | Size | Line height | Use |
| --- | --- | --- | --- |
| `--text-title` | 1.75rem | 1.2 | Screen title and recipe name. 2.25rem from 48rem up |
| `--text-body` | 1.125rem | 1.5 | Body text |
| `--text-ui` | 1rem | 1.3 | Buttons and inputs. Never smaller on an input |
| `--text-meta` | 0.875rem | 1.4 | Secondary meta only. Still 4.5:1 |

Root font size stays the browser default so iOS text settings and pinch zoom can enlarge the page. Do not set `font-size` on `html` to a pixel value.

## Spacing, radius, targets

| Token | Value |
| --- | --- |
| `--space-1` | 0.25rem |
| `--space-2` | 0.5rem |
| `--space-3` | 0.75rem |
| `--space-4` | 1rem |
| `--space-5` | 1.5rem |
| `--space-6` | 2rem |
| `--space-7` | 3rem |
| `--space-8` | 4rem |
| `--radius-card` | 0.75rem |
| `--radius-control` | 0.5rem |
| `--hit` | 2.75rem |
| `--read` | 65ch |

Page padding is `--space-4` on a phone and `--space-5` from the wide breakpoint up. The end of the page adds at least `--space-7` plus the safe-area inset, so the last line stays clear of any control and of the home indicator. Gap between two targets is at least `--space-2`.

## Accessibility baseline

Floor is WCAG 2.2 level AA on the screens this design system ships.

* Text contrast 4.5:1. Non-text boundaries that show a control's edge, 3:1, using `--border`.
* Primary targets 44×44 CSS pixels, above the 24×24 AA minimum, per the kitchen principles.
* Focus: 2px solid `--focus`, offset by 2px. Never remove the outline without that replacement.
* Keyboard: every control, card, and field is reachable on desktop. Order follows the DOM.
* Name and role come from the element. The theme control's accessible name includes the current choice. It is on the settings screen.
* `prefers-reduced-transparency: reduce` uses the same opaque control fill. Floating controls do not switch to a translucent fill.
* Headings stay in order on each screen. One `h1`.
* `prefers-reduced-motion: reduce` disables transitions. Nothing moves by default except a focus ring. No information depends on animation.
* State is a word as well as a color. "Could not load" is text, not a red card alone.
* `lang="en"` stays on `html`.

## Breakpoints

The default CSS is the phone. There is one min-width query.

| Name | Query | Layout |
| --- | --- | --- |
| phone | default | One column. Floating actions ([0016](../decisions/0016-kitchen-ui.md)), not a bottom bar. |
| wide | `min-width: 48rem` | Same chrome, wider content. Content column caps near `65ch` on the list. |

No tablet layout and no compact density. A desktop browser window narrower than 48rem gets the phone layout, which is the right fallback.

## iPhone and install

The manifest, apple touch icon, and `apple-mobile-web-app-capable` already exist. This decision adds the page rules a home-screen install needs. It does not add a service worker.

* Viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover`. Do not add `maximum-scale=1` or `user-scalable=no`.
* Shell padding includes `env(safe-area-inset-top)`, `right`, `bottom`, and `left`. Floating controls sit inside that padding, above the home indicator. There is no bottom bar ([0016](../decisions/0016-kitchen-ui.md)).
* The shell uses `min-height: 100dvh`, not `100vh`, so Safari's toolbars do not cover the page.
* `apple-mobile-web-app-status-bar-style` is `default`. The OS keeps status-bar contrast. Safe-area padding is still applied so a later style change does not slide the title under the clock.
* `theme-color` is updated to `--bg` of the active theme (light `#f6f1e9`, dark `#1c1915`). The manifest `background_color` and `theme_color` stay the light pair for the install splash. iOS does not reliably read a dark `theme_color` from the manifest.
* Inputs are 1rem or larger (principle 3).
* `-webkit-tap-highlight-color` may be transparent only when the control has its own pressed background.
* Install path stays Safari Share → Add to Home Screen. No prompt library and no App Store.

## Theme storage

`localStorage` key `cookbook-theme` is `light`, `dark`, or `system`. Missing or unreadable storage means `system`. The first paint follows the system setting. The selector is on the settings screen, not on the list or the recipe. Changing it writes the key. This is per browser, not per person, and it is not synced to Postgres.

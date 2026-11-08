# Tokens, accessibility, breakpoints, iPhone

Values for [0016](../decisions/0016-kitchen-ui.md) and [0020](../decisions/0020-kitchen-design-system.md). Tokens live in `@cookbook/ui`. A unit test checks the WCAG 2.2 AA floors for those pairs.

Contrast ratios below are WCAG 2.x relative luminance, computed for these hex pairs, not measured off a screenshot.

Tokens are semantic CSS custom properties. The hex values can move with the file format inside the UI package.

## Color

Light is Coastal blue: cool mist page, powder-blue cards, ocean-blue controls, navy type. Dark is a complementary cool navy so a phone on the counter at night is not a pure-black glare. The selected mockup is feel, not a pixel spec.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#f5f9fc` | `#0b1a2c` | Page |
| `--bg-elevated` | `#d7e6f5` | `#16324c` | Cards, one fill |
| `--text` | `#0b2b51` | `#e8f3fc` | Body and titles |
| `--text-muted` | `#3a5a78` | `#b7cde3` | Meta that still meets 4.5:1 |
| `--accent` | `#134175` | `#8bbde8` | Links, focus, primary fill |
| `--accent-contrast` | `#f5f9fc` | `#0b1a2c` | Text on an accent fill |
| `--danger` | `#8b2e3a` | `#f0b8c0` | Error text |
| `--danger-bg` | `#f3d6dc` | `#3a2730` | Error surface |
| `--border` | `#5a7390` | `#7a93ad` | Control boundaries |
| `--focus` | `#134175` | `#8bbde8` | Focus ring |

| Pair | Ratio | Bar |
| --- | --- | --- |
| `--text` on `--bg`, light | 13.42 | 4.5:1 |
| `--text-muted` on `--bg`, light | 6.81 | 4.5:1 |
| `--text-muted` on `--bg-elevated`, light | 5.67 | 4.5:1 |
| `--accent` on `--bg`, light | 9.72 | 4.5:1 |
| `--accent` on `--bg-elevated`, light | 8.10 | 4.5:1 |
| `--accent-contrast` on `--accent`, light | 9.72 | 4.5:1 |
| `--danger` on `--danger-bg`, light | 6.06 | 4.5:1 |
| `--danger` on `--bg`, light | 7.78 | 4.5:1 |
| `--border` on `--bg`, light | 4.62 | 3:1 |
| `--border` on `--bg-elevated`, light | 3.85 | 3:1 |
| `--text` on `--bg`, dark | 15.57 | 4.5:1 |
| `--text` on `--bg-elevated`, dark | 11.70 | 4.5:1 |
| `--text-muted` on `--bg`, dark | 10.73 | 4.5:1 |
| `--text-muted` on `--bg-elevated`, dark | 8.06 | 4.5:1 |
| `--accent` on `--bg`, dark | 8.80 | 4.5:1 |
| `--accent-contrast` on `--accent`, dark | 8.80 | 4.5:1 |
| `--danger` on `--bg`, dark | 10.28 | 4.5:1 |
| `--danger` on `--danger-bg`, dark | 8.15 | 4.5:1 |
| `--border` on `--bg`, dark | 5.51 | 3:1 |
| `--border` on `--bg-elevated`, dark | 4.14 | 3:1 |

`color-scheme` is set to `light` or `dark` with the theme so native form controls match. The foundation `--paper`, `--ink`, and `--herb` names are not kept alongside the semantic names. One set.

## Type

No webfont files and no Google Fonts request.

```css
--font-serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
--font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
```

Live screens use the sans stack throughout. `--font-serif` stays defined and unused on those screens.

| Token | Size | Line height | Use |
| --- | --- | --- | --- |
| `--text-title` | 1.75rem | 1.2 | Screen title and recipe name. 2.25rem from 48rem up |
| `--text-body` | 1.125rem | 1.5 | Body text |
| `--text-ui` | 1rem | 1.3 | Buttons and inputs. Never smaller on an input |
| `--text-meta` | 0.875rem | 1.4 | Secondary meta only. Still 4.5:1 |

Root font size stays the browser default so iOS text settings and pinch zoom can enlarge the page. Do not set `font-size` on `html` to a pixel value.

## Targets and measure

| Token | Value |
| --- | --- |
| `--hit` | 2.75rem |
| `--read` | 65ch |

Primary targets stay 44×44 CSS pixels (`--hit` at the default root size). Recipe text caps near `--read` from the wide breakpoint up. The list is a card grid from that breakpoint.

| Token | Value | Use |
| --- | --- | --- |
| `--space-page-x` | `1.25rem` | Shell left and right, plus the safe-area inset |
| `--space-page-top` | `2.5rem` | Shell top, plus the safe-area inset |
| `--space-page-bottom` | `4rem` | Shell bottom, plus the safe-area inset |
| `--space-stack` | `1.25rem` | Title to list |
| `--radius-control` | `0.75rem` | Buttons and messages |
| `--radius-card` | `1rem` | Cards |

Button radius is also in [buttons](buttons.md).

The end of the page stays clear of any control and of the home indicator: padding plus the safe-area inset.

## Accessibility baseline

Floor is WCAG 2.2 level AA on the screens this design system ships.

* Text contrast 4.5:1. Non-text boundaries that show a control's edge, 3:1, using `--border`.
* Primary targets 44×44 CSS pixels, above the 24×24 AA minimum, per the kitchen principles.
* Focus: 2px solid `--focus`, offset by 2px. Never remove the outline without that replacement.
* Keyboard: every control, card, and field is reachable on desktop. Order follows the DOM.
* Name and role come from the element. The theme control's accessible name includes the current choice. It is on the settings screen.
* `prefers-reduced-transparency: reduce` uses the same opaque control fill. Floating controls do not switch to a translucent fill.
* Headings stay in order on each screen. One `h1`.
* `prefers-reduced-motion: reduce` keeps only short opacity fades at `--duration-fast`. No transform, scale or slide. No information depends on animation.
* State is a word as well as a color. "Could not load" is text, not a red card alone.
* `lang="en"` stays on `html`.

## Breakpoints

The default CSS is the phone. There is one min-width query.

| Name | Query | Layout |
| --- | --- | --- |
| phone | default | One column. Floating actions ([0016](../decisions/0016-kitchen-ui.md)), not a bottom bar. |
| wide | `min-width: 48rem` | Same chrome, wider content. The list is a card grid. Recipe measure caps near `65ch`. On the recipe, ingredients and steps sit side by side. |

No tablet layout and no compact density. A desktop browser window narrower than 48rem gets the phone layout, which is the right fallback.

## iPhone and install

The page rules a home-screen install needs. No service worker. Icon artwork and home-screen icons are pending.

* Viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover`. Do not add `maximum-scale=1` or `user-scalable=no`.
* Shell padding includes `env(safe-area-inset-top)`, `right`, `bottom`, and `left`. Floating controls sit inside that padding, above the home indicator. There is no bottom bar ([0016](../decisions/0016-kitchen-ui.md)).
* The shell uses `min-height: 100dvh`, not `100vh`, so Safari's toolbars do not cover the page.
* `apple-mobile-web-app-status-bar-style` is `default`. The OS keeps status-bar contrast. Safe-area padding is still applied so a later style change does not slide the title under the clock.
* `theme-color` is updated to `--bg` of the active theme (light `#f5f9fc`, dark `#0b1a2c`). The manifest `background_color` and `theme_color` stay the light pair for the install splash. iOS does not reliably read a dark `theme_color` from the manifest.
* Inputs are 1rem or larger.
* `-webkit-tap-highlight-color` may be transparent only when the control has its own pressed background.
* Install path stays Safari Share → Add to Home Screen. No prompt library and no App Store.

## Motion

Tokens live in `@cookbook/ui`. Components use them and never a raw duration.

| Token | Value | Use |
| --- | --- | --- |
| `--duration-fast` | 100ms | Press |
| `--duration-base` | 200ms | Default |
| `--duration-slow` | 320ms | Theme and larger layout |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | Enter, press |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Theme, layout |

Page changes use the View Transitions API where supported; elsewhere the page swaps without animation. Under reduced motion the transition is a short opacity fade.

## Theme

The first paint follows the system setting unless a stored choice exists. The selector is on the settings screen, not on the list or the recipe. The choice is per browser, not per person, and it is not synced to Postgres. Storage, the first-paint script, and the document hint are in [web.md](../web.md). First paint uses the resolved theme before any transition runs; theme transitions apply only to a change made in settings.

## Pending

Not decided.

- Theme control placement on settings
- Home-screen icons


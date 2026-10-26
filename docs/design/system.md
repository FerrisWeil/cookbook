# Design system

Detail for [0016](../decisions/0016-design-system-approach.md). Status is **proposed**.

The web package today depends on React, React DOM, and `@cookbook/shared`. Dev dependencies are Vite, the React plugin, and TypeScript. The proposal adds no packages.

## What v1 screens actually need

From [information architecture](information-architecture.md), if that ADR is accepted:

* a top bar and either a bottom nav or a left rail
* a theme control
* a text field
* a list of recipe cards
* an article (title, a placeholder meta line, and layout regions that can hold whatever blocks the schema eventually has)
* an error message with a retry button
* a style-guide page that shows those pieces

No modal, menu, toast, or drag-and-drop is in that set. Native elements cover it: `header`, `nav`, `main`, `a`, `button`, `input`, `ul`, `article`, headings.

## Option 1 — Tailwind and shadcn/Radix

shadcn copies component source into the repo (good: you can read the button) and leaves Radix as the runtime for anything that is not a plain button. A typical set for "we might need it" is:

* `tailwindcss` and `@tailwindcss/vite`
* `class-variance-authority`, `clsx`, `tailwind-merge`
* `@radix-ui/react-slot`, and then dialog, dropdown, popover, or tabs as soon as a component imports them
* an icon package such as `lucide-react`

Radix Dialog's tree includes scroll locking and aria hiding. Those are reasonable libraries. They are also a stream of releases Taylor will not read, on top of the security pass that already tracks dependency updates. For a list and an article, the accessibility win does not show up yet. The focus trap matters when the first dialog exists, and that install can be its own decision.

## Option 2 — CSS modules and tokens (proposed)

* `apps/web/src/styles/tokens.css` — custom properties for both themes, the type scale, spacing, radius, and the hit size. One file, global.
* `apps/web/src/styles/base.css` — reset, body background, focus ring, reduced motion.
* `apps/web/src/components/*.tsx` with `*.module.css` beside each component. Vite compiles CSS modules with no extra plugin.
* Class names in the modules are local, so two components can both have a `title` without colliding. Tokens stay global on purpose, so a theme flip restyles every component.

No `packages/design-tokens`. The API and MCP do not render pixels. A package would be a workspace, a build step, and a lockfile change for a single consumer. If a second UI appears, moving the CSS file is a small follow-up, not a new product decision.

Components to build in the feature PR, only if this ADR and [0015](../decisions/0015-navigation-ia.md) are accepted:

| Component | Job |
| --- | --- |
| `AppShell` | Skip link, top bar, nav, theme control, `main` |
| `ThemeControl` | Auto / Light / Dark, stored in `localStorage` under `cookbook-theme` |
| `Button` | Primary and quiet variants, 44px minimum |
| `TextField` | Label, 16px text, search uses this |
| `RecipeCard` | Title and a placeholder meta line, whole card is one link |
| `RecipeArticle` | Example article layout |
| `LoadMessage` | Loading text, empty text, or failure plus retry |

The style guide at `/guide` renders each of these with example data. It is specified in [demo](demo.md).

## Option 3 — Tailwind alone, or a kit

Tailwind without Radix is one toolchain, not a component library. Hit targets and themes are still our job, and the class strings are harder to scan than a short stylesheet in a repo this size.

Pico or Water style raw HTML. We would override the shell, the 44px targets, and both themes until little of the kit remained.

Open Props is a token file we could vendor or depend on. Vendoring a third-party token set means maintaining someone else's names. Our list is short enough to write by hand; the values are in [tokens](tokens.md).

## What this refuses

* Icon fonts and icon packages. A control that needs a picture also gets a text label (principle 2 and the accessibility floor).
* A webfont. System stacks only, so the first paint on a phone does not wait on a font file and so offline chrome has nothing to fetch.
* Runtime CSS-in-JS. Another package, no accessibility benefit.

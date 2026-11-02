# 0023. Kitchen web implementation

* Status: accepted
* Date: 2026-11-02
* Confirmed: Taylor, 2026-11-02

## Problem

The kitchen app has to run in a desktop or phone browser, load recipes without showing a secret, apply a theme, be installable, and prove layout and access — while look-and-feel still belongs to the design system.

## Options considered

1. **Client-rendered React, existing reverse proxy attaches the web secret** — one language ([0008](0008-typescript-stack.md)), no extra container, the browser never holds a token ([0021](0021-mcp-recipe-tools.md)).
2. **A server-rendered framework** — first HTML from the server, a new rendering stack, and the token still must not reach the browser.
3. **A Node proxy beside the static server** — a second process in the web image for work the reverse proxy already does.
4. **The browser calls the API with a token** — forbidden by [0021](0021-mcp-recipe-tools.md).
5. **Theme as a CSS-framework dark mode, or media query only** — couples to a kit, or cannot honor the settings choice.
6. **Document hint plus color-scheme, tokens from the design system** — first paint can follow the system; semantic CSS variables key off the hint ([0020](0020-kitchen-design-system.md)).
7. **A service worker for install** — offline cache, which [0016](0016-kitchen-ui.md) deferred.
8. **Manifest and Apple home-screen tags, no service worker** — installable, still online.
9. **A browser test runner, a CI screenshot job, or a per-pull-request preview** — pixels or a hosted copy before the screens are accepted ([0018](0018-ui-demos.md), [0020](0020-kitchen-design-system.md)).
10. **Node tests for theme, contrast, and proxy; local guide-route review; browser tests after confirmation** — matches 0020.

## Decision

The kitchen UI is a client-rendered React app. The web image serves the documents. Screens import the shared UI package ([0020](0020-kitchen-design-system.md)). Not a server-rendered framework.

The process that serves the app holds the web caller secret and attaches it when it proxies recipe requests. The browser talks only to the app origin and never receives a token. The proxy offers list, read, and a write that sets favorite and rating. It does not offer a full recipe save from the browser. Step check-off stays on the device and is not proxied.

Theme is light, dark, or system. Missing or unreadable storage means system. The first paint follows that choice. The document exposes the resolved light or dark state and color-scheme so the design system's CSS variables can apply. Palette, type, and pending tokens are [0020](0020-kitchen-design-system.md). The selector stays on settings.

Install is the browser home-screen flow and a manifest. No service worker. Icon artwork is still open.

Tests use Node's runner ([0011](0011-test-tooling.md)). The feature pull request tests theme resolution, the contrast pairs that are already in the tokens doc, and that a browser response has no token. The designer reviews each UI pull request by running the app locally. The guide route uses the real UI-package components and shows every state in light and dark, with theme and reduced-motion toggles. Not a CI screenshot job. Not a per-pull-request preview. A browser test runner waits until the screens are confirmed. Spacing, radius, and icons have no tests until those tokens exist.

## Consequences

* A design-system token file can land in the UI package without a rendering change.
* A leaked web caller secret can use the proxied recipe routes until it is revoked. It is not the MCP secret. Tightening the proxy to favorite and rating writes limits what a browser session can change.
* The documented API save is a full save. The kitchen UI needs a favorite-and-rating write that leaves the rest of the recipe unchanged. List items are documented as id and title; the list also needs favorite and tags. Those gaps sit with the API work. This decision does not add recipe routes.
* Install splash colors follow the light pair until icon artwork is chosen.
* Header injection and theme storage are in the web doc. Secrets stay in the environment ([0007](0007-public-repo-secrets.md)).

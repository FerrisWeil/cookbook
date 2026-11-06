# 0023. Kitchen web implementation

* Status: accepted
* Date: 2026-11-02
* Confirmed: Taylor, 2026-11-02

## Problem

The kitchen app has to run in a desktop or phone browser, load recipes without showing a secret, apply a theme, and be installable — while look-and-feel still belongs to the design system.

## Options considered

1. **Client-rendered React, existing reverse proxy attaches the web secret** — one language ([0008](0008-typescript-stack.md)), no extra container, the browser never holds a token ([0021](0021-mcp-recipe-tools.md)).
2. **A server-rendered framework** — first HTML from the server, a new rendering stack, and the token still must not reach the browser.
3. **A Node proxy beside the static server** — a second process in the web image for work the reverse proxy already does.
4. **The browser calls the API with a token** — forbidden by [0021](0021-mcp-recipe-tools.md).
5. **A service worker for install** — offline cache, which [0016](0016-kitchen-ui.md) deferred.
6. **Manifest and Apple home-screen tags, no service worker** — installable, still online.

## Decision

The kitchen UI is a client-rendered React app. The web image serves the documents. Screens import the shared UI package ([0020](0020-kitchen-design-system.md)). Not a server-rendered framework.

The process that serves the app holds the web caller secret and attaches it when it proxies recipe requests. The browser talks only to the app origin and never receives a token. The proxy offers list, read, and a write that sets favorite and rating. It does not offer a full recipe save from the browser. Step check-off stays on the device and is not proxied ([0016](0016-kitchen-ui.md)).

Theme is light, dark, or system. Missing or unreadable storage means system. The first paint follows that choice. The document exposes the resolved light or dark state so the design system's CSS variables can apply. The selector stays on settings.

Install is the browser home-screen flow and a manifest. No service worker.

## Consequences

* A leaked web caller secret can use the proxied recipe routes until it is revoked. It is not the MCP secret. Tightening the proxy to favorite and rating writes limits what a browser session can change.
* Header injection and theme storage are in the web doc. Secrets stay in the environment ([0007](0007-public-repo-secrets.md)).
* How UI work is shown is [CONTRIBUTING.md](../../CONTRIBUTING.md) and the demo doc.

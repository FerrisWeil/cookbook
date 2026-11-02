# Web

Current state for [0023](decisions/0023-kitchen-web-implementation.md). Design is [0020](decisions/0020-kitchen-design-system.md). Recipe HTTP is [api.md](api.md). Token comparison is [security-review.md](security-review.md).

The kitchen screens and the UI package are not in the tree. The web image still serves the foundation page.

## Rendering

Client-rendered React. The web image serves static files. The reverse proxy's `/` location already falls back to `index.html`, so new screens are client routes.

Screens import `@cookbook/ui`. That package holds Radix primitives and semantic CSS variables ([system](design/system.md)). The API and MCP do not import it. `/guide` is a hand-built route that uses those real components. It shows every state in light and dark, with theme and reduced-motion toggles.

| Route | Screen |
| --- | --- |
| `/` | Recipe list |
| `/recipes/:id` | One recipe |
| `/settings` | Theme |
| `/guide` | Design review. Not linked from the three screens. |

## Proxy

The kitchen web proxy is not in the tree.

The web process holds `API_AUTH_TOKEN_WEB`. The reverse proxy attaches `Authorization: Bearer` when it forwards recipe requests to the API. The token is not in the JavaScript bundle, not in a cookie, and not in a browser response body.

The browser calls same-origin `/api/…` only. It does not call the API origin.

| Browser request | Forwarded | Notes |
| --- | --- | --- |
| `GET /api/health`, `GET /api/health/ready` | yes | Unauthenticated. |
| `GET /api/recipes` | yes | List. |
| `GET /api/recipes/:id` | yes | Read. |
| Favorite and rating write | yes | Path is not in the tree. The documented API save is a full `PUT /recipes`. |
| Full recipe save | no | The proxy must not forward it from the browser. |
| Step check-off | no | Device only. Not an API call. |

Local development uses the same rule: the dev server attaches the web token on recipe proxy requests and never exposes it to client code.

A missing or short web token refuses to boot, same bar as the other caller token. Placeholders are refused. Local compose may use a non-secret web token that is not valid on the NAS.

## What the list and recipe need

The documented list item is `id` and `title`. The kitchen list also needs `favorite` (the toggle) and `tags` (the chips). The documented read field list has no `tags`. Those fields are an API gap. Filters apply to the loaded list until the API offers a filtered list.

The documented save replaces the recipe. A phone write may set favorite and rating only, and records the actor as `system`. That write is not in the tree.

## Theme

Storage key `cookbook-theme`: `light`, `dark`, or `system`. Missing, junk, or a throwing store means `system`.

An inline script in the document runs before paint. It reads the key, then `prefers-color-scheme` when the choice is `system`. It sets `data-theme` to `light` or `dark` and `color-scheme` to match. Semantic variables in `@cookbook/ui` key off that hint. Settings writes the key and updates the document. Not synced.

## Install

The manifest and Apple home-screen tags already exist. No service worker. Viewport, safe area, and `theme-color` are [tokens](design/tokens.md). Icon artwork is pending.

## Tests

The designer reviews each UI pull request by running the app locally. [demo](design/demo.md) is that bar. No CI screenshot job and no per-pull-request preview. In addition, when the proxy lands:

- The web token is not present in a document or a client bundle.
- A proxied recipe request leaves the server with the web `Authorization` header.
- A full save from the browser is not forwarded.

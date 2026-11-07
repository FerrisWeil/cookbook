# Web

Current state for [0023](decisions/0023-kitchen-web-implementation.md). Design is [0020](decisions/0020-kitchen-design-system.md). Recipe HTTP is [api.md](api.md). Token comparison is [security-review.md](security-review.md).

`/` is the recipe list. `/recipes/:id` is one recipe. Settings and `/guide` are not in this slice. `@cookbook/ui` holds the tokens, Button, Card, and read/error copy used by those screens. Controls are native elements styled with the semantic variables. Radix is still the allowed primitive kit; this slice does not install it.

List cards are title only. The list API returns `id` and `title`. The kitchen does not fetch each card's detail.

## Rendering

Client-rendered React. The web image serves static files. `/` falls back to `index.html`.

The recipe screen requests `fields=title,ingredients,steps`. Default read omits ingredients. Empty ingredient or step lists omit that section. Back pops when the recipe was opened from the list, and replaces the current entry with `/` when the recipe was opened directly.

List and recipe screens subscribe to `GET /api/recipes/events`, then refetch the current list and any open recipe. A refetch does not return the screen to loading. Connection health and pending/failed save counts sit under the title, distinct from "All saved". Screens use `useRecipeList` / `useRecipe`; they do not call `fetch`, `EventSource`, or storage.

Pending field writes live in a per-device outbox (IndexedDB when present). Queue order, overlay, and retry are independent of React and HTTP. Last-save-wins is server application order, not a client clock. Arrays are whole fields. This checkpoint does not send `PATCH /recipes/:id/facts` (facts object or `null`). The outbox stays queued until that route is integrated.

| Route | Screen |
| --- | --- |
| `/` | Recipe list |
| `/recipes/:id` | One recipe |
| `/settings` | Not built |
| `/guide` | Not built |

## Proxy

Nginx (Compose and the NAS skeleton) and the Vite dev server attach `Authorization: Bearer` for `GET`/`HEAD` `/api/recipes`, `/api/recipes/:id`, and `GET` `/api/recipes/events`. Other methods on those paths return 405. Health stays unauthenticated. The proxy target is the API origin from config, not a URL the browser supplies.

The web token is not in the JavaScript bundle, not in a cookie, and not in a browser response body. Incoming `Authorization` from the browser is stripped. Vite refuses to start the dev server if the token is missing, short, or a placeholder. Nginx substitutes `API_AUTH_TOKEN_WEB` at container start.

| Browser request | Forwarded | Notes |
| --- | --- | --- |
| `GET /api/health`, `GET /api/health/ready` | yes | Unauthenticated. |
| `GET /api/recipes` | yes | List. |
| `GET /api/recipes/:id` | yes | Read. |
| `GET /api/recipes/events` | yes | SSE. Nginx buffering off, 1h read timeout. Vite proxy timeout 0. |
| Favorite and rating write | no | Path is not in the tree. |
| Facts PATCH | no | Owned by the facts branch. Not forwarded here. |
| Full recipe save | no | `PUT /api/recipes` is 405. |
| Step check-off | no | Device only. Not an API call. |

## What the list and recipe need

The documented list item is `id` and `title`. Favorite, tags, and rating on cards wait on the list payload. The documented read field list has no `tags`.

## Theme

Storage key `cookbook-theme`: `light`, `dark`, or `system`. Missing, junk, or a throwing store means `system`.

An inline script in the document runs before paint. Semantic variables also follow `prefers-color-scheme` until a stored `light` or `dark` sets `data-theme`. Settings is not built, so a stored choice is only honored if it already exists.

## Install

The manifest and Apple home-screen tags already exist. No service worker. Viewport includes `viewport-fit=cover`. `theme-color` follows `--bg`. Icon artwork is pending.

## Tests

The designer reviews each UI pull request by running the app locally. [demo](design/demo.md) is that bar. No CI screenshot job and no per-pull-request preview. Proxy checks:

- The web token is not present in a document or a client bundle.
- A proxied recipe request leaves the server with the web `Authorization` header.
- A full save from the browser is not forwarded.

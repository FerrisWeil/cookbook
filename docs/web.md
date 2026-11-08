# Web

Current state for [0023](decisions/0023-kitchen-web-implementation.md). Design is [0020](decisions/0020-kitchen-design-system.md). Recipe HTTP is [api.md](api.md). Token comparison is [security-review.md](security-review.md).

`/` is the recipe list. `/recipes/:id` is one recipe. Settings and `/guide` are not in this slice. `@cookbook/ui` holds the tokens, Button, Card, and read/error copy used by those screens. Controls are native elements styled with the semantic variables. Radix is still the allowed primitive kit; this slice does not install it.

List cards show the title and the four facts slots from the list payload (`id`, `title`, `facts`). The kitchen does not fetch each card's detail.

## Rendering

Client-rendered React. The web image serves static files. `/` falls back to `index.html`.

The recipe screen requests `fields=title,ingredients,steps,facts`. Default read omits ingredients and facts. Empty ingredient or step lists omit that section. Facts always show four slots. Back pops when the recipe was opened from the list, and replaces the current entry with `/` when the recipe was opened directly.

The recipe screen has a small **Edit recipe facts** form. It is not a full editor. Submit sends only the fields the user changed. The list and recipe show those fields immediately from the device queue; the server ack confirms them. A transient failure retries. A permanent rejection keeps the submitted values visible and does not retry. Unsaved form drafts stay separate from that queue and from a refetch. The form talks to `useRecipe`; the hook talks to the session. Components do not issue the PATCH themselves.

Cooking progress is `useCookingSession`. While a session is active for the open recipe, the screen shows that session's snapshot and its displayed and completed steps. Previous and next only change the displayed step. Mark done and undo only change completion. Start and finish need a connection and are not queued. The confirmed session is stored on the device apart from the pending step queue, so a reload while disconnected still shows that session and its queued steps. A step write that fails briefly is retried while the event stream stays up. Finish clears the session only when the server confirms it has ended. A slower refresh does not replace a newer session. Step changes replay in order when the connection returns. A rejection after finish stays on screen and is not retried. The list links to the active session so another device can resume it. Components do not call the session routes themselves.

List and recipe screens subscribe to `GET /api/recipes/events`, then refetch the current list and any open recipe. A refetch does not return the screen to loading. Connection health and pending/failed save counts sit under the title, distinct from "All saved". Screens use `useRecipeList` / `useRecipe`; they do not call `fetch`, `EventSource`, or storage.

Pending field writes live in a per-device outbox (IndexedDB when present). Queue order, overlay, and retry are independent of React and HTTP. Last-save-wins is server application order, not a client clock. Arrays are whole fields.

| Route | Screen |
| --- | --- |
| `/` | Recipe list |
| `/recipes/:id` | One recipe |
| `/settings` | Not built |
| `/guide` | Not built |

## Proxy

Nginx (Compose and the NAS skeleton) and the Vite dev server attach `Authorization: Bearer` for `GET`/`HEAD` `/api/recipes`, `/api/recipes/:id`, `GET` `/api/recipes/events`, `PATCH` `/api/recipes/:id/facts`, `GET` `/api/sessions/active`, and same-origin JSON `POST` cooking-session routes. The facts PATCH and session writes must be same-origin (`Origin` matches `Host`) with `Content-Type: application/json`. Other methods on those paths return 405. A cross-origin facts PATCH or session write is 403. Health stays unauthenticated. The proxy target is the API origin from config, not a URL the browser supplies. Incoming `Authorization` from the browser is stripped.

The web token is not in the JavaScript bundle, not in a cookie, and not in a browser response body. Incoming `Authorization` from the browser is stripped. Vite refuses to start the dev server if the token is missing, short, or a placeholder. Nginx substitutes `API_AUTH_TOKEN_WEB` at container start.

| Browser request | Forwarded | Notes |
| --- | --- | --- |
| `GET /api/health`, `GET /api/health/ready` | yes | Unauthenticated. |
| `GET /api/recipes` | yes | List, including facts. |
| `GET /api/recipes/:id` | yes | Read. |
| `GET /api/recipes/events` | yes | SSE. Nginx buffering off, 1h read timeout. Vite proxy timeout 0. |
| `PATCH /api/recipes/:id/facts` | yes | Facts only. Same-origin JSON. |
| Favorite and rating write | no | Path is not in the tree. |
| Full recipe save | no | `PUT /api/recipes` is 405. |
| `GET /api/sessions/active` | yes | Resume the active cooking session. |
| `POST /api/sessions` and the session step routes | yes | Start, finish, display, complete, undo. Same-origin JSON. |
| Device-local step check-off | no | Not an API call. An active cooking session is the progress the screen shows. |

## What the list and recipe need

The documented list item is `id`, `title`, and `facts`. Favorite, tags, and rating on cards wait on those fields in the list payload. The documented read field list has no `tags`.

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
- A facts PATCH from the same origin is forwarded; a cross-origin or non-PATCH facts call is not.
- A same-origin cooking-session call is forwarded; a cross-origin session write is not.
- When Chrome is present, smoke runs `scripts/browser-outbox.mjs`: an offline facts save survives reload in IndexedDB, two tabs keep both pending edits, auto-retry PATCH keeps omitted Chef fields, a 400 is not retried, and a live update keeps scroll and an unsaved draft. It also runs `scripts/browser-cooking.mjs`: two pages share one live session, and an offline reload keeps the session snapshot and replays the queued step. GitHub runners skip both.

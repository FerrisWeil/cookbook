# API

Contract for [0021](decisions/0021-mcp-recipe-tools.md). Tables and domain rules are in [recipes.md](recipes.md). Token comparison, headers, and the health body are in [security-review.md](security-review.md). MCP tools are in [mcp.md](mcp.md).

Fastify is the HTTP adapter. `listen` / `close` is the process boundary. Handlers depend on `ApiDeps` (`getReady`, `RecipeStore`, caller tokens). Fastify request, reply, and plugin types stay in that adapter. Domain validation stays in the recipe parsers; this layer does not add JSON Schema. A later transport should reuse those seams.

Env names: `API_AUTH_TOKEN_MCP` and `API_AUTH_TOKEN_WEB`. Local compose may boot with `local-dev-api-mcp-token-not-for-nas` and `local-dev-api-web-token-not-for-nas` when `API_ALLOW_DEV_TOKEN=1`. The NAS file does not set that flag.

## Liveness

`GET /health` and `GET /health/ready` stay unauthenticated. Health is status only. Ready reports database and seed, not recipes.

## Recipe routes

These require a bearer. Missing or wrong token: the caller is told the call is not allowed.

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/recipes` | List visible recipes. |
| `GET` | `/recipes/:id` | Read one visible recipe. Query `fields` for the same projection as MCP `read`. |
| `GET` | `/recipes/events` | Authenticated SSE. Heartbeats, then `committed` invalidation events `{ recipeId, op }` after a store save or hide. Clients refetch. Not a recipe snapshot stream. |
| `PUT` | `/recipes` | Save. Body matches MCP `save`. |

Notifications are emitted from the recipe store seam after a successful commit, not only from the browser HTTP handler. The hub is in-process: one API replica. A restart drops the stream; clients reconnect and refetch. Direct SQL does not notify.

`keepAliveTimeout` stays 5s. An open SSE socket sets its own timeout to 0. Nginx `proxy_buffering off` and a 1h read timeout apply only to `/api/recipes/events`.

Mutation ids are stored in `recipe_mutation_acks`. `applyWithAck` records the id and payload fingerprint in the same transaction as the effect. Same id and fingerprint is a duplicate ack. Same id and a different fingerprint is rejected. The facts PATCH on `cursor/recipe-facts-t248u-5a7f` does not yet send a mutation id or call this helper.

## Callers

Two secrets, both from the environment, never committed, never printed.

| Caller | Who holds it | Who presents it |
| --- | --- | --- |
| MCP | The MCP process | MCP, when it calls the recipe routes |
| Web | The web app's server | That server, when it proxies the browser |

The API accepts either caller token on recipe routes. It is the process that holds both. MCP holds only the MCP caller token. The web server holds only the web token. The MCP caller token is not the Chef-facing MCP secret. The browser never receives a token. The two caller tokens differ from each other and from the Chef-facing MCP secret.

Local compose already publishes the API. On the NAS the API is not a tailnet node; the web proxy and the Docker network reach it.

How the web server attaches the web token, and which browser calls it forwards, is [web.md](web.md).

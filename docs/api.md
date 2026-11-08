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
| `GET` | `/recipes` | List visible recipes as `id`, `title`, and `facts`. |
| `GET` | `/recipes/:id` | Read one visible recipe. Query `fields` for the same projection as MCP `read`. `facts` is a valid field. |
| `GET` | `/recipes/events` | Authenticated SSE. Heartbeats, then `committed` invalidation events `{ recipeId, op }` after a store save or hide. Clients refetch. Not a recipe snapshot stream. |
| `PUT` | `/recipes` | Save. Body matches MCP `save`. Omit `facts` to leave stored facts. |
| `PATCH` | `/recipes/:id/facts` | Apply only the submitted facts fields. Omitted fields stay. Does not change title, ingredients, steps, servings, nutrition, favorite, rating, or actor. |

Facts PATCH body:

```json
{
  "mutationId": "3b8c1e2a-7f4d-4c2a-9a11-0f6d2c8e91aa",
  "fields": {
    "primaryProtein": "seitan"
  }
}
```

`mutationId` is required. `fields` is a partial facts object, or `null` to clear all four slots. Omitted keys are unchanged. `null` on one key clears that slot. `mealTypes` is replaced as a whole array. Unknown keys are refused.

Clear one field:

```json
{ "mutationId": "…", "fields": { "primaryProtein": null } }
```

Clear all four:

```json
{ "mutationId": "…", "fields": null }
```

Success is `{ "facts": { … }, "mutation": { "id": "<mutationId>" } }`. The same id and payload returns that success without writing again. The same id and a different payload is `409 payload_mismatch`. Missing `mutationId` or invalid fields is `400`. Validation is in [recipes.md](recipes.md). The kitchen browser uses this PATCH through the web proxy. MCP `save` still sends a full optional `facts` object or `facts: null`; it does not use this PATCH.

Notifications are emitted from the recipe store seam after a successful commit, not only from the browser HTTP handler. Extra store methods pass through the wrapper; `updateFacts` notifies after it commits. Duplicate acks still return the current recipe and notify. The hub is in-process: one API replica. A restart drops the stream; clients reconnect and refetch. Direct SQL does not notify. Keepalive is not the stream timeout.

`keepAliveTimeout` stays 5s. An open SSE socket sets its own timeout to 0. Nginx `proxy_buffering off` and a 1h read timeout apply only to `/api/recipes/events`.

Mutation ids are stored in `recipe_mutation_acks`. `applyWithAck` must run on a client already inside the effect's transaction. It locks the ack row, applies the effect, then inserts the id and payload fingerprint. Same id and fingerprint is a duplicate ack. Same id and a different fingerprint is rejected. The facts PATCH sends `mutationId` and records the ack in the same transaction as the facts write.

## Callers

Two secrets, both from the environment, never committed, never printed.

| Caller | Who holds it | Who presents it |
| --- | --- | --- |
| MCP | The MCP process | MCP, when it calls the recipe routes |
| Web | The web app's server | That server, when it proxies the browser |

The API accepts either caller token on recipe routes. It is the process that holds both. MCP holds only the MCP caller token. The web server holds only the web token. The MCP caller token is not the Chef-facing MCP secret. The browser never receives a token. The two caller tokens differ from each other and from the Chef-facing MCP secret.

Local compose already publishes the API. On the NAS the API is not a tailnet node; the web proxy and the Docker network reach it.

How the web server attaches the web token, and which browser calls it forwards, is [web.md](web.md).

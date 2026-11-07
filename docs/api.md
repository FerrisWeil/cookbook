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
| `PUT` | `/recipes` | Save. Body matches MCP `save`. Omit `facts` to leave stored facts. |
| `PATCH` | `/recipes/:id/facts` | Replace only facts. Body is a facts object or `null` to clear. Does not change title, ingredients, steps, servings, nutrition, favorite, rating, or actor. |

Facts body:

```json
{
  "primaryProtein": "chicken",
  "totalMinutes": 30,
  "effort": "low",
  "mealTypes": ["dinner"]
}
```

or `null` to unset all four. Success for the facts route is `{ "facts": { … } }`. Validation is in [recipes.md](recipes.md). The kitchen browser uses this PATCH through the web proxy; MCP uses `save`. There is not a second write shape.

## Callers

Two secrets, both from the environment, never committed, never printed.

| Caller | Who holds it | Who presents it |
| --- | --- | --- |
| MCP | The MCP process | MCP, when it calls the recipe routes |
| Web | The web app's server | That server, when it proxies the browser |

The API accepts either caller token on recipe routes. It is the process that holds both. MCP holds only the MCP caller token. The web server holds only the web token. The MCP caller token is not the Chef-facing MCP secret. The browser never receives a token. The two caller tokens differ from each other and from the Chef-facing MCP secret.

Local compose already publishes the API. On the NAS the API is not a tailnet node; the web proxy and the Docker network reach it.

How the web server attaches the web token, and which browser calls it forwards, is [web.md](web.md).

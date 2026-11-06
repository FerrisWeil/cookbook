# API

Contract for [0021](decisions/0021-mcp-recipe-tools.md). Tables and domain rules are in [recipes.md](recipes.md). Token comparison, headers, and the health body are in [security-review.md](security-review.md). MCP tools are in [mcp.md](mcp.md).

Env names: `API_AUTH_TOKEN_MCP` and `API_AUTH_TOKEN_WEB`. Local compose may boot with `local-dev-api-mcp-token-not-for-nas` and `local-dev-api-web-token-not-for-nas` when `API_ALLOW_DEV_TOKEN=1`. The NAS file does not set that flag.

## Liveness

`GET /health` and `GET /health/ready` stay unauthenticated. Health is status only. Ready reports database and seed, not recipes.

## Recipe routes

These require a bearer. Missing or wrong token: the caller is told the call is not allowed.

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/recipes` | List visible recipes. |
| `GET` | `/recipes/:id` | Read one visible recipe. Query `fields` for the same projection as MCP `read`. |
| `PUT` | `/recipes` | Save. Body matches MCP `save`. |

## Callers

Two secrets, both from the environment, never committed, never printed.

| Caller | Who holds it | Who presents it |
| --- | --- | --- |
| MCP | The MCP process | MCP, when it calls the recipe routes |
| Web | The web app's server | That server, when it proxies the browser |

The API accepts either caller token on recipe routes. It is the process that holds both. MCP holds only the MCP caller token. The web server holds only the web token. The MCP caller token is not the Chef-facing MCP secret. The browser never receives a token. The two caller tokens differ from each other and from the Chef-facing MCP secret.

Local compose already publishes the API. On the NAS the API is not a tailnet node; the web proxy and the Docker network reach it.

How the web server attaches the web token, and which browser calls it forwards, is [web.md](web.md).

# MCP

Contract for [0003](decisions/0003-mcp-bearer-token.md) and [0021](decisions/0021-mcp-recipe-tools.md). The recipe tools and `/recipes` routes are not in the tree. Auth that is already running (the token check, the header, and the health body) is in [security-review.md](security-review.md).

## Reach

MCP calls the household API. It has no database connection. Local and production keep MCP off the database network.

## Tools

| Name | Role |
| --- | --- |
| `read` | One visible recipe. |
| `list` | Visible recipes. |
| `save` | Create or update. |
| `hello` | Foundation ping. Not a recipe tool. |

Journal, tag, and search are not registered. Calling one of those names is told that operation is not available.

A tool failure is a sentence on the tool result, not an HTTP status.

### `read`

Id is required. Without it, the agent is told an ID is required.

A missing or hidden recipe is told the recipe was not found. Same sentence for both.

Without a field list, the result is title, steps in saved order, servings, and nutrition when present.

With a field list, the result is only those fields. An unknown field is told which field is invalid.

Valid fields: `id`, `title`, `ingredients`, `steps`, `servings`, `nutrition`, `favorite`, `rating`, `actor`.

### `list`

Each item is `id` and `title`. Hidden recipes are omitted.

### `save`

Required: a non-empty title, steps (at least one, stored in that order), servings greater than zero, and an actor. The actor is a name, not a login. There is no default.

Optional: nutrition (one per-serving row, source `estimated`, `entered`, or `copied`), favorite, rating (empty or a whole number from one to five), ingredient lines (written line required; amount, unit, and name optional).

Given an id, save uses that id. A visible recipe is updated. A hidden id is not found and is not revived. Without an id, save creates a recipe.

Save replaces title, steps, servings, favorite, rating, and ingredients. Actor is recorded on create and does not change. An omitted favorite is off. Nutrition omitted is left as stored; a nutrition object replaces the row; empty nutrition clears it.

## Household API

These routes hold the writes. They do not require the MCP bearer.

| Method | Path | Role |
| --- | --- | --- |
| `GET` | `/recipes` | List visible recipes. |
| `GET` | `/recipes/:id` | Read one visible recipe. Query `fields` for the same projection as `read`. |
| `PUT` | `/recipes` | Save. Body matches `save`. |

Local compose already publishes the API. On the NAS the API is not a tailnet node; the web proxy and the Docker network reach it.

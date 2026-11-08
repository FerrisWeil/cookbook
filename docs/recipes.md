# Recipes

Current state for the accepted recipe model. Tool shapes stay in [mcp.md](mcp.md). HTTP routes stay in [api.md](api.md).

The API applies `0002_recipes.sql`, `0003_recipe_facts.sql`, and `0004_recipe_mutation_acks.sql` at startup. Tables: `actors`, `recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_nutrition`, `recipe_mutation_acks`. Git ships `taylor`, `chef`, and `system`. Another cook is a row on the NAS.

A recipe id is an opaque string. The written ingredient line is stored as written; amount, unit, and name may be empty. Favorite is one household flag. Rating is empty or 1–5. Nutrition is at most one per-serving row labeled estimated, entered, or copied. The divisor is the recipe's servings.

Optional facts are four explicit slots the caller supplies. The app does not infer them from the title or ingredients. Existing recipes stay unset until a save or a facts update sets them.

| Field | Stored as | Rules |
| --- | --- | --- |
| `primaryProtein` | text or empty | Arbitrary text, trimmed. Empty is unset. The words `no protein` are also unset. Max 80 characters. Recommended names (not enforced): chicken, beef, pork, turkey, fish, shellfish, eggs, tofu/tempeh, beans/lentils, dairy. |
| `totalMinutes` | integer or empty | Finite nonnegative whole minutes, 0 through 10080 (seven days). Includes preparation and waiting, not hands-on-only time. |
| `effort` | `low`, `medium`, `high`, or empty | Exact lowercase names. |
| `mealTypes` | list | Subset of `breakfast`, `lunch`, `dinner`, `snack`, `dessert`. Stored in that order. Empty is unset. Duplicates and unknown names are refused. |

JSON object `facts` holds those four keys. Omit `facts` on save to leave stored values. Send `facts: null` or a facts object with empty slots to clear all four. A facts-only update (`updateFacts` / `PATCH …/facts`) takes `{ mutationId, fields }`. `fields` is a partial object: only listed keys change, omitted keys stay, a listed key of `null` (or empty `mealTypes`) clears that slot, and `fields: null` clears all four. `mealTypes` is one field. The write and the mutation ack commit together. Replaying the same id and payload is a no-op. A different payload for that id is refused.

Delete sets `hidden_at` and `hidden_by`. The row stays. Save does not revive a hidden id.

The API uses `createPgRecipeStore` from `apps/api/src/recipes/`. Domain functions live in the API (`save`, `read`, `list`, `hide`, `updateFacts`). Recipe HTTP is in [api.md](api.md). MCP tools call that HTTP and are in [mcp.md](mcp.md). Columns were added in `0003_recipe_facts.sql`.

# Recipes

Current state for the accepted recipe model. Tool shapes stay in [mcp.md](mcp.md). HTTP routes stay in [api.md](api.md).

The API applies `0002_recipes.sql` at startup. Tables: `actors`, `recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_nutrition`. Git ships `taylor`, `chef`, and `system`. Another cook is a row on the NAS.

A recipe id is an opaque string. The written ingredient line is stored as written; amount, unit, and name may be empty. Favorite is one household flag. Rating is empty or 1–5. Nutrition is at most one per-serving row labeled estimated, entered, or copied. The divisor is the recipe's servings.

Delete sets `hidden_at` and `hidden_by`. The row stays. Save does not revive a hidden id.

HTTP and MCP import `createPgRecipeStore` from `apps/api/src/recipes/`. Domain functions live in the API (`save`, `read`, `list`, `hide`). Recipe HTTP is in [api.md](api.md). MCP tools are in [mcp.md](mcp.md).

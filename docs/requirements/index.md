# Requirements

Generated from the YAML topic files. Do not edit. `pnpm requirements:index` rewrites this file.

1.1 Agents can retrieve the details of one recipe.
1.1.1 Given a recipe ID, the agent receives that recipe.
1.1.2 Without a recipe ID, the agent is told an ID is required.
1.1.3 Given an ID that matches no recipe, the agent is told the recipe was not found.
1.1.4 Given the ID of a deleted recipe, the agent is told the recipe was not found.
1.1.5 Given any combination of fields, the agent receives only those fields.
1.1.6 Given a field that doesn't exist, the agent is told which field is invalid.
1.1.7 Without fields, the agent receives the title, steps in saved order, servings, and nutrition when present.
1.2 Agents can list recipes.
1.2.1 Given a deleted recipe, the list does not include it.
1.3 Agents can save a recipe.
1.3.1 Given a nutrition row, the saved recipe records that one row.
1.3.2 Given an actor, the saved recipe records that actor.
1.3.3 Without an actor, the agent is told an actor is required.
1.3.4 Given a non-empty title, the saved recipe records that title.
1.3.5 Without a non-empty title, the agent is told a title is required.
1.3.6 Given steps, the saved recipe records them in that order.
1.3.7 Without steps, the agent is told steps are required.
1.3.8 Given servings, the saved recipe records those servings.
1.3.9 Without servings, the agent is told servings are required.
1.3.10 Given a favorite, the saved recipe records that favorite.
1.3.11 Given a rating, the saved recipe records that rating.
1.4 Recipe calls require the shared secret.
1.4.1 Without the shared secret, the agent is told the call is not allowed.
1.4.2 Given a liveness check, the agent is not asked for the shared secret.
1.4.3 Given a liveness check, the agent is told whether the server is up.
1.4.4 Given a liveness check, the agent is not given recipe data.
1.5 v1 limits recipe operations to read, list, and save.
1.5.1 Given a journal request, the agent is told that operation is not available.
1.5.2 Given a tag request, the agent is told that operation is not available.
1.5.3 Given a search request, the agent is told that operation is not available.

import type { CookingSnapshot } from "@cookbook/shared";

import type { Recipe } from "../recipes/types.js";

export function snapshotFromRecipe(recipe: Recipe): CookingSnapshot {
  return {
    title: recipe.title,
    servings: recipe.servings,
    ingredients: recipe.ingredients.map((item) => item.line),
    steps: [...recipe.steps],
  };
}

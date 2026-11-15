import {
  compileListCriteria,
  emptyRecipeFacts,
  matchRecipe,
  mergeProteinChoices,
  type ListCriteria,
  type MatchableRecipe,
  type QueryNode,
  type RecipeFacts,
  type RecipeListItem,
} from "@cookbook/shared";

import type { FieldPatch } from "../sync/types";
import type { RecipeSnapshot } from "../sync/session";
import type { PrototypeRecipe } from "./types";

export function toMatchable(recipe: PrototypeRecipe): MatchableRecipe {
  return {
    title: recipe.title,
    ingredients: recipe.ingredients.map((ingredient) => ({
      line: ingredient.line,
      amount: ingredient.amount,
      unit: ingredient.unit,
      name: ingredient.name,
    })),
    facts: recipe.facts,
  };
}

export function toListItem(recipe: PrototypeRecipe): RecipeListItem {
  return {
    id: recipe.id,
    title: recipe.title,
    facts: recipe.facts,
  };
}

export function toSnapshot(recipe: PrototypeRecipe): RecipeSnapshot {
  return {
    title: recipe.title,
    ingredients: recipe.ingredients.map((ingredient) => ingredient.line),
    steps: recipe.steps.map((step) => step.text),
    facts: recipe.facts,
  };
}

export function filterSampleRecipes(
  recipes: readonly PrototypeRecipe[],
  query: QueryNode | null,
): PrototypeRecipe[] {
  return recipes.filter((recipe) => matchRecipe(toMatchable(recipe), query));
}

export function filterSampleRecipesByCriteria(
  recipes: readonly PrototypeRecipe[],
  criteria: ListCriteria,
): PrototypeRecipe[] {
  return filterSampleRecipes(recipes, compileListCriteria(criteria));
}

export function proteinChoicesFrom(recipes: readonly PrototypeRecipe[]): string[] {
  return mergeProteinChoices(
    recipes.map((recipe) => recipe.facts.primaryProtein ?? ""),
  );
}

export function applyFactsPatch(
  facts: RecipeFacts,
  fields: FieldPatch,
): RecipeFacts {
  const next = { ...facts, mealTypes: [...facts.mealTypes] };
  if ("primaryProtein" in fields) {
    const value = fields.primaryProtein;
    next.primaryProtein = typeof value === "string" ? value : null;
  }
  if ("totalMinutes" in fields) {
    const value = fields.totalMinutes;
    next.totalMinutes = typeof value === "number" ? value : null;
  }
  if ("effort" in fields) {
    const value = fields.effort;
    next.effort =
      value === "low" || value === "medium" || value === "high" ? value : null;
  }
  if ("mealTypes" in fields) {
    const value = fields.mealTypes;
    next.mealTypes = Array.isArray(value)
      ? value.filter(
          (item): item is RecipeFacts["mealTypes"][number] =>
            item === "breakfast" ||
            item === "lunch" ||
            item === "dinner" ||
            item === "snack" ||
            item === "dessert",
        )
      : [];
  }
  return next;
}

export function cloneRecipe(recipe: PrototypeRecipe): PrototypeRecipe {
  return {
    ...recipe,
    facts: {
      ...recipe.facts,
      mealTypes: [...recipe.facts.mealTypes],
    },
    ingredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
    steps: recipe.steps.map((step) => ({
      ...step,
      ingredients: step.ingredients.map((item) => ({ ...item })),
    })),
  };
}

export { emptyRecipeFacts };

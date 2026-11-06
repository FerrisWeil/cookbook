export type LiveStatus = {
  status: "ok";
};

export type ReadyStatus = {
  status: "ok" | "degraded";
  database: "up" | "down";
  seed: boolean;
};

export type HelloResult = {
  name: string;
  message: string;
};

export function isStackReady(ready: ReadyStatus): boolean {
  return ready.status === "ok" && ready.database === "up" && ready.seed;
}

export {
  DEFAULT_READ_FIELDS,
  MESSAGES,
  NUTRITION_SOURCES,
  RECIPE_FIELDS,
  invalidFieldMessage,
  isRecipeField,
  type Ingredient,
  type Nutrition,
  type NutritionSource,
  type Recipe,
  type RecipeField,
  type RecipeListItem,
} from "./recipe.js";

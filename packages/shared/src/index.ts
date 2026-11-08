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

export type { CookingSession, CookingSessionStatus, CookingSnapshot } from "./cooking.js";

export function isStackReady(ready: ReadyStatus): boolean {
  return ready.status === "ok" && ready.database === "up" && ready.seed;
}

export {
  DEFAULT_READ_FIELDS,
  FACTS_SCHEMA_DESCRIPTION,
  MAX_PRIMARY_PROTEIN_LENGTH,
  MAX_TOTAL_MINUTES,
  MESSAGES,
  NUTRITION_SOURCES,
  RECIPE_EFFORTS,
  RECIPE_FIELDS,
  RECIPE_MEAL_TYPES,
  RECOMMENDED_PROTEINS,
  emptyRecipeFacts,
  isUnsetPrimaryProtein,
  invalidFieldMessage,
  isRecipeEffort,
  isRecipeField,
  isRecipeMealType,
  type Ingredient,
  type Nutrition,
  type NutritionSource,
  type Recipe,
  type RecipeEffort,
  type RecipeFacts,
  type RecipeFactsUpdate,
  type RecipeField,
  type RecipeListItem,
  type RecipeMealType,
} from "./recipe.js";

export {
  QUERY_LIMITS,
  QUERY_SCHEMA_DESCRIPTION,
  compileListCriteria,
  containsPhrase,
  criteriaIsEmpty,
  emptyListCriteria,
  encodeListQueryParam,
  ingredientNameText,
  isQueryGroup,
  listCriteriaFromSearch,
  listSearchFromCriteria,
  matchRecipe,
  mergeProteinChoices,
  normalizeMatchText,
  normalizePhrase,
  omitBlankPhrases,
  parseListQuery,
  type ListCriteria,
  type MatchableRecipe,
  type QueryGroup,
  type QueryLeaf,
  type QueryNode,
  type QueryParseResult,
} from "./query.js";

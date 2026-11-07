export const RECIPE_FIELDS = [
  "id",
  "title",
  "ingredients",
  "steps",
  "servings",
  "nutrition",
  "favorite",
  "rating",
  "actor",
  "facts",
] as const;

export type RecipeField = (typeof RECIPE_FIELDS)[number];

export const DEFAULT_READ_FIELDS: RecipeField[] = [
  "title",
  "steps",
  "servings",
  "nutrition",
];

export const NUTRITION_SOURCES = ["estimated", "entered", "copied"] as const;
export type NutritionSource = (typeof NUTRITION_SOURCES)[number];

export const RECIPE_EFFORTS = ["low", "medium", "high"] as const;
export type RecipeEffort = (typeof RECIPE_EFFORTS)[number];

export const RECIPE_MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
] as const;
export type RecipeMealType = (typeof RECIPE_MEAL_TYPES)[number];

export const RECOMMENDED_PROTEINS = [
  "chicken",
  "beef",
  "pork",
  "turkey",
  "fish",
  "shellfish",
  "eggs",
  "tofu/tempeh",
  "beans/lentils",
  "dairy",
] as const;

export const MAX_PRIMARY_PROTEIN_LENGTH = 80;
export const MAX_TOTAL_MINUTES = 10_080;

export type Ingredient = {
  line: string;
  amount: number | null;
  unit: string;
  name: string;
};

export type Nutrition = {
  source: NutritionSource;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
};

export type RecipeFacts = {
  primaryProtein: string | null;
  totalMinutes: number | null;
  effort: RecipeEffort | null;
  mealTypes: RecipeMealType[];
};

export type RecipeFactsUpdate = RecipeFacts | null;

export type Recipe = {
  id: string;
  title: string;
  ingredients: Ingredient[];
  steps: string[];
  servings: number;
  nutrition: Nutrition | null;
  favorite: boolean;
  rating: number | null;
  actor: string;
  facts: RecipeFacts;
};

export type RecipeListItem = {
  id: string;
  title: string;
  facts: RecipeFacts;
};

export const MESSAGES = {
  idRequired: "An ID is required.",
  notFound: "The recipe was not found.",
  actorRequired: "An actor is required.",
  titleRequired: "A title is required.",
  stepsRequired: "Steps are required.",
  servingsRequired: "Servings must be greater than zero.",
  notAvailable: "That operation is not available.",
  unauthorized: "The call is not allowed.",
  apiUnavailable: "The cookbook API is unavailable.",
  invalidFacts:
    "Facts must be primary protein, total minutes, effort, and meal types.",
  invalidProtein: "Primary protein must be text or empty.",
  invalidDuration:
    "Total time must be whole minutes from 0 through 10080, including prep and waiting.",
  invalidEffort: "Effort must be low, medium, or high.",
  invalidMealTypes:
    "Meal types must be breakfast, lunch, dinner, snack, or dessert.",
} as const;

export const FACTS_SCHEMA_DESCRIPTION =
  "Optional explicit facts supplied by the caller. primaryProtein is arbitrary text, not a closed list (recommended names: chicken, beef, pork, turkey, fish, shellfish, eggs, tofu/tempeh, beans/lentils, dairy). totalMinutes is finite nonnegative whole minutes including preparation and waiting, 0 through 10080. effort is low, medium, or high. mealTypes is a subset of breakfast, lunch, dinner, snack, dessert. Omit facts to leave stored values unchanged. Send null to clear all four. Do not infer or classify facts.";

export function emptyRecipeFacts(): RecipeFacts {
  return {
    primaryProtein: null,
    totalMinutes: null,
    effort: null,
    mealTypes: [],
  };
}

export function isUnsetPrimaryProtein(value: string | null | undefined): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  const trimmed = value.trim();
  return trimmed === "" || trimmed.toLowerCase() === "no protein";
}

export function invalidFieldMessage(field: string): string {
  return `Field "${field}" is invalid.`;
}

export function isRecipeField(value: string): value is RecipeField {
  return (RECIPE_FIELDS as readonly string[]).includes(value);
}

export function isRecipeEffort(value: string): value is RecipeEffort {
  return (RECIPE_EFFORTS as readonly string[]).includes(value);
}

export function isRecipeMealType(value: string): value is RecipeMealType {
  return (RECIPE_MEAL_TYPES as readonly string[]).includes(value);
}

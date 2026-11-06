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
};

export type RecipeListItem = {
  id: string;
  title: string;
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
} as const;

export function invalidFieldMessage(field: string): string {
  return `Field "${field}" is invalid.`;
}

export function isRecipeField(value: string): value is RecipeField {
  return (RECIPE_FIELDS as readonly string[]).includes(value);
}

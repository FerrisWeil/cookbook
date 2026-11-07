import {
  MAX_PRIMARY_PROTEIN_LENGTH,
  MAX_TOTAL_MINUTES,
  MESSAGES,
  RECIPE_MEAL_TYPES,
  emptyRecipeFacts,
  isRecipeEffort,
  isRecipeMealType,
  isUnsetPrimaryProtein,
  type RecipeFacts,
  type RecipeMealType,
} from "@cookbook/shared";

import { RecipeError } from "./errors.js";
import {
  NUTRITION_SOURCES,
  type HideRecipeInput,
  type Ingredient,
  type IngredientInput,
  type Nutrition,
  type NutritionInput,
  type NutritionSource,
  type SaveRecipeInput,
} from "./types.js";

export type ParsedSave = {
  id: string | undefined;
  actor: string;
  title: string;
  servings: number;
  favorite: boolean | undefined;
  rating: number | null | undefined;
  ingredients: Ingredient[] | undefined;
  steps: string[] | undefined;
  nutrition: Nutrition | null | undefined;
  facts: RecipeFacts | null | undefined;
};

export type ParsedHide = {
  id: string;
  actor: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown, code: string, message: string): string {
  if (typeof value !== "string") {
    throw new RecipeError(code, message);
  }
  return value;
}

function presentText(value: unknown, code: string, message: string): string {
  const text = asText(value, code, message);
  if (text.trim() === "") {
    throw new RecipeError(code, message);
  }
  return text;
}

function emptyText(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value !== "string") {
    throw new RecipeError("invalid_ingredient", "Amount, unit, and name may be empty.");
  }
  return value;
}

function optionalFinite(
  value: unknown,
  code: string,
  message: string,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RecipeError(code, message);
  }
  return value;
}

export function parseSave(input: SaveRecipeInput): ParsedSave {
  const actor = presentText(
    input.actor,
    "actor_required",
    "An actor is required.",
  );
  const title = presentText(
    input.title,
    "title_required",
    "A title is required.",
  );
  if (
    typeof input.servings !== "number" ||
    !Number.isFinite(input.servings) ||
    !(input.servings > 0)
  ) {
    throw new RecipeError(
      "servings_required",
      "Servings must be greater than zero.",
    );
  }

  let id: string | undefined;
  if (input.id !== undefined && input.id !== null && input.id !== "") {
    id = presentText(input.id, "invalid_id", "A recipe id is opaque.");
  }

  let favorite: boolean | undefined;
  if (input.favorite === undefined) {
    favorite = undefined;
  } else if (typeof input.favorite !== "boolean") {
    throw new RecipeError("invalid_favorite", "A recipe has one favorite.");
  } else {
    favorite = input.favorite;
  }

  let rating: number | null | undefined;
  if (input.rating === undefined) {
    rating = undefined;
  } else if (input.rating === null || input.rating === "") {
    rating = null;
  } else if (
    typeof input.rating !== "number" ||
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5
  ) {
    throw new RecipeError(
      "invalid_rating",
      "A rating is empty or a whole number from 1 to 5.",
    );
  } else {
    rating = input.rating;
  }

  const ingredients = parseIngredients(input.ingredients);
  const steps = parseSteps(input.steps);
  const nutrition = parseNutritionField(input.nutrition);
  const facts = parseFactsField(input.facts);

  return {
    id,
    actor,
    title,
    servings: input.servings,
    favorite,
    rating,
    ingredients,
    steps,
    nutrition,
    facts,
  };
}

export function parseHide(input: HideRecipeInput): ParsedHide {
  const id = presentText(input.id, "invalid_id", "A recipe id is required.");
  const actor = presentText(
    input.actor,
    "actor_required",
    "An actor is required.",
  );
  return { id, actor };
}

export function parseFactsField(value: unknown): RecipeFacts | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return parseFacts(value);
}

export function parseFacts(value: unknown): RecipeFacts {
  if (!isObject(value)) {
    throw new RecipeError("invalid_facts", MESSAGES.invalidFacts);
  }
  const allowed = new Set([
    "primaryProtein",
    "totalMinutes",
    "effort",
    "mealTypes",
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new RecipeError("invalid_facts", MESSAGES.invalidFacts);
    }
  }
  return {
    primaryProtein: parsePrimaryProtein(value.primaryProtein),
    totalMinutes: parseTotalMinutes(value.totalMinutes),
    effort: parseEffort(value.effort),
    mealTypes: parseMealTypes(value.mealTypes),
  };
}

export function factsOrEmpty(facts: RecipeFacts | null | undefined): RecipeFacts {
  if (facts === undefined || facts === null) {
    return emptyRecipeFacts();
  }
  return {
    primaryProtein: facts.primaryProtein,
    totalMinutes: facts.totalMinutes,
    effort: facts.effort,
    mealTypes: [...facts.mealTypes],
  };
}

function parsePrimaryProtein(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new RecipeError("invalid_protein", MESSAGES.invalidProtein);
  }
  if (isUnsetPrimaryProtein(value)) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_PRIMARY_PROTEIN_LENGTH) {
    throw new RecipeError("invalid_protein", MESSAGES.invalidProtein);
  }
  return trimmed;
}

function parseTotalMinutes(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_TOTAL_MINUTES
  ) {
    throw new RecipeError("invalid_duration", MESSAGES.invalidDuration);
  }
  return value;
}

function parseEffort(value: unknown): RecipeFacts["effort"] {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || !isRecipeEffort(value)) {
    throw new RecipeError("invalid_effort", MESSAGES.invalidEffort);
  }
  return value;
}

function parseMealTypes(value: unknown): RecipeMealType[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new RecipeError("invalid_meal_types", MESSAGES.invalidMealTypes);
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !isRecipeMealType(item) || seen.has(item)) {
      throw new RecipeError("invalid_meal_types", MESSAGES.invalidMealTypes);
    }
    seen.add(item);
  }
  return RECIPE_MEAL_TYPES.filter((item) => seen.has(item));
}

function parseIngredients(value: unknown): Ingredient[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new RecipeError(
      "invalid_ingredients",
      "The written ingredient line is required.",
    );
  }
  return value.map((item) => parseIngredient(item));
}

function parseIngredient(value: unknown): Ingredient {
  if (!isObject(value)) {
    throw new RecipeError(
      "ingredient_line_required",
      "The written ingredient line is required.",
    );
  }
  const row = value as IngredientInput;
  const line = presentText(
    row.line,
    "ingredient_line_required",
    "The written ingredient line is required.",
  );
  const amount = optionalFinite(
    row.amount,
    "invalid_ingredient",
    "Amount, unit, and name may be empty.",
  );
  return {
    line,
    amount,
    unit: emptyText(row.unit),
    name: emptyText(row.name),
  };
}

function parseSteps(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new RecipeError("invalid_steps", "A step is stored as plain text.");
  }
  return value.map((item) => {
    if (typeof item !== "string") {
      throw new RecipeError("invalid_steps", "A step is stored as plain text.");
    }
    return item;
  });
}

function parseNutritionField(
  value: unknown,
): Nutrition | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return parseNutrition(value);
}

function parseNutrition(value: unknown): Nutrition {
  if (!isObject(value)) {
    throw new RecipeError(
      "invalid_nutrition",
      "Nutrition source must be estimated, entered, or copied.",
    );
  }
  const row = value as NutritionInput;
  const source = asText(
    row.source,
    "invalid_nutrition",
    "Nutrition source must be estimated, entered, or copied.",
  );
  if (!isNutritionSource(source)) {
    throw new RecipeError(
      "invalid_nutrition",
      "Nutrition source must be estimated, entered, or copied.",
    );
  }
  const message = "The numbers are per serving.";
  return {
    source,
    calories: optionalFinite(row.calories, "invalid_nutrition", message),
    protein: optionalFinite(row.protein, "invalid_nutrition", message),
    fat: optionalFinite(row.fat, "invalid_nutrition", message),
    carbs: optionalFinite(row.carbs, "invalid_nutrition", message),
  };
}

function isNutritionSource(value: string): value is NutritionSource {
  return (NUTRITION_SOURCES as readonly string[]).includes(value);
}

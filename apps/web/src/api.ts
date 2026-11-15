import {
  emptyRecipeFacts,
  encodeListQueryParam,
  isUnsetPrimaryProtein,
  mergeProteinChoices,
  type QueryNode,
  type RecipeFacts,
  type RecipeListItem,
} from "@cookbook/shared";

export const LIST_ERROR = "Could not load recipes.";
export const RECIPE_ERROR = "Could not load this recipe.";
export const RECIPE_MISSING = "The recipe was not found.";
export const FACTS_SAVE_ERROR = "Could not save recipe facts.";

export const RECIPE_READ_FIELDS = "title,ingredients,steps,facts";

export type RecipeView = {
  title: string;
  ingredients: string[];
  steps: string[];
  facts: RecipeFacts;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function parseRecipeFacts(value: unknown): RecipeFacts {
  const record = asRecord(value);
  if (!record) {
    return emptyRecipeFacts();
  }
  const protein = record["primaryProtein"];
  const minutes = record["totalMinutes"];
  const effort = record["effort"];
  const meals = record["mealTypes"];
  return {
    primaryProtein:
      typeof protein === "string" && !isUnsetPrimaryProtein(protein)
        ? protein.trim()
        : null,
    totalMinutes:
      typeof minutes === "number" && Number.isFinite(minutes) ? minutes : null,
    effort:
      effort === "low" || effort === "medium" || effort === "high" ? effort : null,
    mealTypes: Array.isArray(meals)
      ? meals.filter(
          (item): item is RecipeFacts["mealTypes"][number] =>
            item === "breakfast" ||
            item === "lunch" ||
            item === "dinner" ||
            item === "snack" ||
            item === "dessert",
        )
      : [],
  };
}

export function parseRecipeList(body: unknown): RecipeListItem[] {
  const record = asRecord(body);
  const recipes = record?.["recipes"];
  if (!Array.isArray(recipes)) {
    throw new Error(LIST_ERROR);
  }
  const items: RecipeListItem[] = [];
  for (const entry of recipes) {
    const item = asRecord(entry);
    const id = item?.["id"];
    const title = item?.["title"];
    if (
      !item ||
      typeof id !== "string" ||
      id.trim() === "" ||
      typeof title !== "string"
    ) {
      throw new Error(LIST_ERROR);
    }
    items.push({
      id,
      title,
      facts: parseRecipeFacts(item["facts"]),
    });
  }
  return items;
}

export function parseRecipeView(body: unknown): RecipeView {
  const record = asRecord(body);
  const recipe = asRecord(record?.["recipe"]);
  if (!recipe) {
    throw new Error(RECIPE_ERROR);
  }
  const title = recipe["title"];
  if (typeof title !== "string" || title.trim() === "") {
    throw new Error(RECIPE_ERROR);
  }
  return {
    title,
    ingredients: ingredientLines(recipe["ingredients"]),
    steps: stepLines(recipe["steps"]),
    facts: parseRecipeFacts(recipe["facts"]),
  };
}

function ingredientLines(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(RECIPE_ERROR);
  }
  const lines: string[] = [];
  for (const entry of value) {
    const item = asRecord(entry);
    const line = item?.["line"];
    if (typeof line === "string" && line.trim() !== "") {
      lines.push(line);
    }
  }
  return lines;
}

function stepLines(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(RECIPE_ERROR);
  }
  const steps: string[] = [];
  for (const step of value) {
    if (typeof step === "string" && step.trim() !== "") {
      steps.push(step);
    }
  }
  return steps;
}

export function recipeReadUrl(id: string): string {
  const params = new URLSearchParams({ fields: RECIPE_READ_FIELDS });
  return `/api/recipes/${encodeURIComponent(id)}?${params.toString()}`;
}

export function recipeFactsUrl(id: string): string {
  return `/api/recipes/${encodeURIComponent(id)}/facts`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export type RecipeListPayload = {
  recipes: RecipeListItem[];
  proteinChoices: string[];
};

export function parseRecipeListPayload(body: unknown): RecipeListPayload {
  const recipes = parseRecipeList(body);
  const record =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const raw = record?.["proteinChoices"];
  const proteinChoices = Array.isArray(raw)
    ? mergeProteinChoices(raw.filter((item): item is string => typeof item === "string"))
    : mergeProteinChoices([]);
  return { recipes, proteinChoices };
}

export function recipeListUrl(query?: QueryNode | null): string {
  const encoded = encodeListQueryParam(query ?? null);
  if (!encoded) {
    return "/api/recipes";
  }
  const params = new URLSearchParams({ query: encoded });
  return `/api/recipes?${params.toString()}`;
}

export async function fetchRecipeList(
  query?: QueryNode | null,
  signal?: AbortSignal,
): Promise<RecipeListPayload> {
  try {
    const response = await fetch(recipeListUrl(query), { signal });
    if (!response.ok) {
      throw new Error(LIST_ERROR);
    }
    return parseRecipeListPayload(await response.json());
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new Error(LIST_ERROR);
  }
}

export async function fetchRecipeView(
  id: string,
  signal?: AbortSignal,
): Promise<RecipeView> {
  try {
    const response = await fetch(recipeReadUrl(id), { signal });
    if (response.status === 404) {
      throw new Error(RECIPE_MISSING);
    }
    if (!response.ok) {
      throw new Error(RECIPE_ERROR);
    }
    return parseRecipeView(await response.json());
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof Error && error.message === RECIPE_MISSING) {
      throw error;
    }
    throw new Error(RECIPE_ERROR);
  }
}


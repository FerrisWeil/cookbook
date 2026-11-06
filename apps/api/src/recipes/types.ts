export const SHIPPED_ACTORS = ["chef", "system", "taylor"] as const;

export type ShippedActor = (typeof SHIPPED_ACTORS)[number];

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
  servings: number;
  favorite: boolean;
  rating: number | null;
  actor: string;
  ingredients: Ingredient[];
  steps: string[];
  nutrition: Nutrition | null;
};

export type RecipeListItem = {
  id: string;
  title: string;
};

export type IngredientInput = {
  line?: unknown;
  amount?: unknown;
  unit?: unknown;
  name?: unknown;
};

export type NutritionInput = {
  source?: unknown;
  calories?: unknown;
  protein?: unknown;
  fat?: unknown;
  carbs?: unknown;
};

export type SaveRecipeInput = {
  id?: unknown;
  actor?: unknown;
  title?: unknown;
  servings?: unknown;
  favorite?: unknown;
  rating?: unknown;
  ingredients?: unknown;
  steps?: unknown;
  nutrition?: unknown;
};

export type HideRecipeInput = {
  id?: unknown;
  actor?: unknown;
};

export type RecipeStore = {
  save(input: SaveRecipeInput): Promise<Recipe>;
  read(id: string): Promise<Recipe>;
  list(): Promise<RecipeListItem[]>;
  hide(input: HideRecipeInput): Promise<void>;
};

export type StoredRecipe = Recipe & {
  hiddenAt: Date | null;
  hiddenBy: string | null;
};

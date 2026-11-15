import type {
  Ingredient,
  RecipeEffort,
  RecipeFacts,
  RecipeMealType,
} from "@cookbook/shared";

export type PrototypeIngredient = Ingredient & { id: string };

export type PrototypeStepIngredient = {
  ingredientId: string;
  amount: string;
};

export type PrototypeStep = {
  text: string;
  durationSeconds?: number;
  timerLabel?: string;
  ingredients: PrototypeStepIngredient[];
};

export type PrototypeRecipe = {
  id: string;
  title: string;
  servings: number;
  ingredients: PrototypeIngredient[];
  steps: PrototypeStep[];
  facts: RecipeFacts;
};

export type PrototypeLibraryState = "ok" | "empty" | "loading" | "error";

export type PrototypeTimer = {
  id: string;
  stepIndex: number;
  label: string;
  durationMs: number;
  startedAt: number;
};

export type PrototypeCookingState = {
  sessionId: string;
  recipeId: string;
  completedSteps: number[];
  checkedIngredientIds: string[];
  timers: PrototypeTimer[];
  openedTimerId: string | null;
};

export type { RecipeEffort, RecipeFacts, RecipeMealType };

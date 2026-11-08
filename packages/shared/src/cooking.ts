export type CookingSnapshot = {
  title: string;
  servings: number;
  ingredients: string[];
  steps: string[];
};

export type CookingSessionStatus = "active" | "finished";

export type CookingSession = {
  id: string;
  recipeId: string;
  status: CookingSessionStatus;
  snapshot: CookingSnapshot;
  displayedStep: number;
  completedSteps: number[];
};

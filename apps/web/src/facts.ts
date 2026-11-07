import {
  RECIPE_MEAL_TYPES,
  RECOMMENDED_PROTEINS,
  type RecipeEffort,
  type RecipeFacts,
  type RecipeMealType,
} from "@cookbook/shared";

export const MISSING_PROTEIN = "No primary protein specified";
export const MISSING_TIME = "No total time specified";
export const MISSING_EFFORT = "No effort specified";
export const MISSING_MEALS = "No meal types specified";
export const FACTS_DASH = "—";

export type ProteinIconKind =
  | (typeof RECOMMENDED_PROTEINS)[number]
  | "generic";

export function proteinIconKind(name: string | null): ProteinIconKind {
  if (!name) {
    return "generic";
  }
  const key = name.trim().toLowerCase();
  if (key === "tofu" || key === "tempeh" || key === "tofu/tempeh") {
    return "tofu/tempeh";
  }
  if (key === "beans" || key === "lentils" || key === "beans/lentils") {
    return "beans/lentils";
  }
  if ((RECOMMENDED_PROTEINS as readonly string[]).includes(key)) {
    return key as (typeof RECOMMENDED_PROTEINS)[number];
  }
  return "generic";
}

export function formatTotalMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = `${hours} hr`;
  if (rest === 0) {
    return hourLabel;
  }
  return `${hourLabel} ${rest} min`;
}

export function formatEffort(effort: RecipeEffort): string {
  if (effort === "low") {
    return "Low";
  }
  if (effort === "medium") {
    return "Medium";
  }
  return "High";
}

export function formatMealTypes(meals: readonly RecipeMealType[]): string {
  return RECIPE_MEAL_TYPES.filter((item) => meals.includes(item))
    .map(formatMealType)
    .join(" · ");
}

export function formatMealType(meal: RecipeMealType): string {
  return meal.slice(0, 1).toUpperCase() + meal.slice(1);
}

export function proteinExplanation(name: string | null): string {
  return name ? `Primary protein: ${name}` : MISSING_PROTEIN;
}

export function timeExplanation(minutes: number | null): string {
  if (minutes === null) {
    return MISSING_TIME;
  }
  return `Total time including prep and waiting: ${formatTotalMinutes(minutes)}`;
}

export function effortExplanation(effort: RecipeEffort | null): string {
  return effort ? `Effort: ${formatEffort(effort)}` : MISSING_EFFORT;
}

export function mealsExplanation(meals: readonly RecipeMealType[]): string {
  if (meals.length === 0) {
    return MISSING_MEALS;
  }
  return `Meal types: ${formatMealTypes(meals)}`;
}

export function factsAccessibleSummary(facts: RecipeFacts): string {
  return [
    proteinExplanation(facts.primaryProtein),
    timeExplanation(facts.totalMinutes),
    effortExplanation(facts.effort),
    mealsExplanation(facts.mealTypes),
  ].join(". ");
}

export function draftFromFacts(facts: RecipeFacts): FactsDraft {
  return {
    primaryProtein: facts.primaryProtein ?? "",
    totalMinutes:
      facts.totalMinutes === null ? "" : String(facts.totalMinutes),
    effort: facts.effort ?? "",
    mealTypes: [...facts.mealTypes],
  };
}

export type FactsDraft = {
  primaryProtein: string;
  totalMinutes: string;
  effort: RecipeEffort | "";
  mealTypes: RecipeMealType[];
};

export function factsFromDraft(draft: FactsDraft): RecipeFacts {
  const minutes = draft.totalMinutes.trim();
  return {
    primaryProtein: draft.primaryProtein.trim() === "" ? null : draft.primaryProtein.trim(),
    totalMinutes: minutes === "" ? null : Number(minutes),
    effort: draft.effort === "" ? null : draft.effort,
    mealTypes: RECIPE_MEAL_TYPES.filter((item) => draft.mealTypes.includes(item)),
  };
}

import type { PrototypeCookingState, PrototypeRecipe, PrototypeTimer } from "./types";

export const COOKING_STORAGE_KEY = "cookbook-prototype-cooking-v1";

export function emptyCookingState(
  recipeId: string,
  sessionId: string,
): PrototypeCookingState {
  return {
    sessionId,
    recipeId,
    completedSteps: [],
    checkedIngredientIds: [],
    timers: [],
    openedTimerId: null,
  };
}

export function activeStepIndex(
  completedSteps: readonly number[],
  stepCount: number,
): number | null {
  const done = new Set(completedSteps);
  for (let index = 0; index < stepCount; index += 1) {
    if (!done.has(index)) {
      return index;
    }
  }
  return null;
}

export function stepStatus(
  index: number,
  completedSteps: readonly number[],
  stepCount: number,
): "completed" | "current" | "upcoming" {
  if (completedSteps.includes(index)) {
    return "completed";
  }
  if (activeStepIndex(completedSteps, stepCount) === index) {
    return "current";
  }
  return "upcoming";
}

export function remainingMs(timer: PrototypeTimer, now: number): number {
  return Math.max(0, timer.durationMs - (now - timer.startedAt));
}

export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function toggleStep(
  state: PrototypeCookingState,
  index: number,
  stepCount: number,
): PrototypeCookingState {
  if (!Number.isInteger(index) || index < 0 || index >= stepCount) {
    return state;
  }
  const completed = new Set(state.completedSteps);
  if (completed.has(index)) {
    completed.delete(index);
  } else {
    completed.add(index);
  }
  return {
    ...state,
    completedSteps: [...completed].sort((left, right) => left - right),
  };
}

export function toggleIngredient(
  state: PrototypeCookingState,
  ingredientId: string,
): PrototypeCookingState {
  const checked = new Set(state.checkedIngredientIds);
  if (checked.has(ingredientId)) {
    checked.delete(ingredientId);
  } else {
    checked.add(ingredientId);
  }
  return {
    ...state,
    checkedIngredientIds: [...checked],
  };
}

export function startTimer(
  state: PrototypeCookingState,
  recipe: PrototypeRecipe,
  stepIndex: number,
  now: number,
  id: string,
): PrototypeCookingState {
  const step = recipe.steps[stepIndex];
  if (!step || step.durationSeconds === undefined || step.durationSeconds <= 0) {
    return state;
  }
  if (state.timers.some((timer) => timer.stepIndex === stepIndex)) {
    return state;
  }
  const timer: PrototypeTimer = {
    id,
    stepIndex,
    label: step.timerLabel ?? `Step ${stepIndex + 1}`,
    durationMs: step.durationSeconds * 1000,
    startedAt: now,
  };
  return {
    ...state,
    timers: [...state.timers, timer],
  };
}

export function openTimer(
  state: PrototypeCookingState,
  timerId: string | null,
): PrototypeCookingState {
  if (timerId !== null && !state.timers.some((timer) => timer.id === timerId)) {
    return state;
  }
  return { ...state, openedTimerId: timerId };
}

export function parseCookingState(value: unknown): PrototypeCookingState | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const completed = record["completedSteps"];
  const checked = record["checkedIngredientIds"];
  const timers = record["timers"];
  if (
    typeof record["sessionId"] !== "string" ||
    typeof record["recipeId"] !== "string" ||
    !Array.isArray(completed) ||
    !Array.isArray(checked) ||
    !Array.isArray(timers) ||
    completed.some((item) => typeof item !== "number") ||
    checked.some((item) => typeof item !== "string")
  ) {
    return null;
  }
  const parsedTimers: PrototypeTimer[] = [];
  for (const entry of timers) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return null;
    }
    const timer = entry as Record<string, unknown>;
    if (
      typeof timer["id"] !== "string" ||
      typeof timer["stepIndex"] !== "number" ||
      typeof timer["label"] !== "string" ||
      typeof timer["durationMs"] !== "number" ||
      typeof timer["startedAt"] !== "number"
    ) {
      return null;
    }
    parsedTimers.push({
      id: timer["id"],
      stepIndex: timer["stepIndex"],
      label: timer["label"],
      durationMs: timer["durationMs"],
      startedAt: timer["startedAt"],
    });
  }
  const opened = record["openedTimerId"];
  return {
    sessionId: record["sessionId"],
    recipeId: record["recipeId"],
    completedSteps: completed.filter((item): item is number => typeof item === "number"),
    checkedIngredientIds: checked.filter((item): item is string => typeof item === "string"),
    timers: parsedTimers,
    openedTimerId: typeof opened === "string" ? opened : null,
  };
}

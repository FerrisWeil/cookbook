import { MESSAGES, type CookingSession } from "@cookbook/shared";

import type { CookingClient } from "../cooking/client";
import type { PrototypeRecipe, PrototypeStep, PrototypeStepTimer } from "./sampleData";

const COOKING_STORAGE_KEY = "cookbook-prototype-cooking-v1";

export type PrototypeTimer = {
  id: string;
  stepIndex: number;
  label: string;
  durationSeconds: number;
  remainingSeconds: number;
  status: "running" | "paused" | "finished";
  endAtMs: number | null;
};

export type PrototypeCookingExtras = {
  sessionId: string;
  recipeId: string;
  recipeTitle: string;
  steps: PrototypeStep[];
  fullIngredients: string[];
  checkedIngredients: number[];
  checkedStepIngredients: string[];
  timers: PrototypeTimer[];
  fullscreenTimerId: string | null;
};

type PersistedCooking = {
  session: CookingSession;
  extras: PrototypeCookingExtras;
};

export type PrototypeCookingClient = CookingClient & {
  getExtras(): PrototypeCookingExtras | null;
  toggleStepCompleted(stepIndex: number): void;
  toggleIngredient(index: number): void;
  clearIngredients(): void;
  toggleStepIngredient(stepIndex: number, ingredientIndex: number): void;
  startTimer(stepIndex: number, timer: PrototypeStepTimer): void;
  pauseTimer(timerId: string): void;
  resumeTimer(timerId: string): void;
  resetTimer(timerId: string): void;
  addTimerSeconds(timerId: string, deltaSeconds: number): void;
  dismissTimer(timerId: string): void;
  openTimerFullscreen(timerId: string): void;
  closeTimerFullscreen(): void;
  runningTimerCount(): number;
};

export function formatTimerSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function readStorage(): PersistedCooking | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(COOKING_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedCooking;
    if (!parsed?.session || parsed.session.status !== "active" || !parsed.extras) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(value: PersistedCooking | null): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!value) {
      window.localStorage.removeItem(COOKING_STORAGE_KEY);
    } else {
      window.localStorage.setItem(COOKING_STORAGE_KEY, JSON.stringify(value));
    }
  } catch {
    // Ignore storage quota / privacy restrictions; state remains in memory.
  }
}

export function createPrototypeCookingClient(options: {
  findRecipe: (id: string) => PrototypeRecipe | undefined;
  now?: () => number;
  persist?: boolean;
}): PrototypeCookingClient {
  const now = options.now ?? (() => Date.now());
  const persist = options.persist ?? true;
  const listeners = new Set<() => void>();
  let state: PersistedCooking | null = persist ? readStorage() : null;
  let errorMessage: string | null = null;
  let tickHandle: ReturnType<typeof setInterval> | undefined;

  function syncTimersToNow(): boolean {
    if (!state) {
      return false;
    }
    let changed = false;
    const currentMs = now();
    const nextTimers = state.extras.timers.map((timer) => {
      if (timer.status !== "running" || timer.endAtMs === null) {
        return timer;
      }
      const nextRemaining = Math.max(0, Math.ceil((timer.endAtMs - currentMs) / 1000));
      if (nextRemaining === 0) {
        changed = true;
        return {
          ...timer,
          remainingSeconds: 0,
          status: "finished" as const,
          endAtMs: null,
        };
      }
      if (nextRemaining !== timer.remainingSeconds) {
        changed = true;
        return {
          ...timer,
          remainingSeconds: nextRemaining,
        };
      }
      return timer;
    });
    if (changed) {
      state = {
        ...state,
        extras: {
          ...state.extras,
          timers: nextTimers,
        },
      };
      if (persist) {
        writeStorage(state);
      }
    }
    return changed;
  }

  function ensureTicker(): void {
    const hasRunning =
      state?.extras.timers.some((timer) => timer.status === "running") ?? false;
    if (hasRunning && tickHandle === undefined) {
      tickHandle = setInterval(() => {
        if (syncTimersToNow()) {
          emit();
        }
        const stillRunning =
          state?.extras.timers.some((timer) => timer.status === "running") ?? false;
        if (!stillRunning && tickHandle !== undefined) {
          clearInterval(tickHandle);
          tickHandle = undefined;
        }
      }, 250);
    } else if (!hasRunning && tickHandle !== undefined) {
      clearInterval(tickHandle);
      tickHandle = undefined;
    }
  }

  function commit(next: PersistedCooking | null): void {
    state = next;
    if (persist) {
      writeStorage(state);
    }
    ensureTicker();
    emit();
  }

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  if (state) {
    syncTimersToNow();
  }

  return {
    async open() {
      if (persist && !state) {
        state = readStorage();
      }
      syncTimersToNow();
      ensureTicker();
      emit();
    },

    close() {
      if (tickHandle !== undefined) {
        clearInterval(tickHandle);
        tickHandle = undefined;
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    view() {
      return state?.session ?? null;
    },

    error() {
      return errorMessage;
    },

    setConnected() {
      // Browser-only prototype is always available locally.
    },

    async begin(recipeId) {
      const recipe = options.findRecipe(recipeId);
      if (!recipe) {
        errorMessage = MESSAGES.notFound;
        emit();
        return;
      }
      if (state?.session.status === "active" && state.session.recipeId === recipeId) {
        errorMessage = null;
        emit();
        return;
      }
      const sessionId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `proto-session-${now()}`;
      const fullIngredients = recipe.ingredients.map((item) => item.line);
      const stepTexts = recipe.steps.map((step) => step.text);
      errorMessage = null;
      commit({
        session: {
          id: sessionId,
          recipeId: recipe.id,
          status: "active",
          snapshot: {
            title: recipe.title,
            servings: recipe.servings,
            ingredients: fullIngredients,
            steps: stepTexts,
          },
          displayedStep: 0,
          completedSteps: [],
        },
        extras: {
          sessionId,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          steps: recipe.steps,
          fullIngredients,
          checkedIngredients: [],
          checkedStepIngredients: [],
          timers: [],
          fullscreenTimerId: null,
        },
      });
    },

    async end() {
      errorMessage = null;
      commit(null);
    },

    async show(step) {
      if (!state) {
        errorMessage = MESSAGES.sessionMissing;
        emit();
        return;
      }
      if (
        !Number.isInteger(step) ||
        step < 0 ||
        step >= state.session.snapshot.steps.length
      ) {
        errorMessage = MESSAGES.sessionStep;
        emit();
        return;
      }
      if (state.session.displayedStep === step) {
        return;
      }
      errorMessage = null;
      commit({
        ...state,
        session: {
          ...state.session,
          displayedStep: step,
        },
      });
    },

    async completeDisplayed() {
      if (!state) {
        return;
      }
      const step = state.session.displayedStep;
      if (state.session.completedSteps.includes(step)) {
        return;
      }
      commit({
        ...state,
        session: {
          ...state.session,
          completedSteps: [...state.session.completedSteps, step].sort((a, b) => a - b),
        },
      });
    },

    async undoDisplayed() {
      if (!state) {
        return;
      }
      const step = state.session.displayedStep;
      commit({
        ...state,
        session: {
          ...state.session,
          completedSteps: state.session.completedSteps.filter((item) => item !== step),
        },
      });
    },

    getExtras() {
      return state?.extras ?? null;
    },

    toggleStepCompleted(stepIndex) {
      if (!state) {
        return;
      }
      const exists = state.session.completedSteps.includes(stepIndex);
      const completedSteps = exists
        ? state.session.completedSteps.filter((item) => item !== stepIndex)
        : [...state.session.completedSteps, stepIndex].sort((a, b) => a - b);
      commit({
        ...state,
        session: {
          ...state.session,
          completedSteps,
        },
      });
    },

    toggleIngredient(index) {
      if (!state) {
        return;
      }
      const checked = state.extras.checkedIngredients;
      const next = checked.includes(index)
        ? checked.filter((item) => item !== index)
        : [...checked, index].sort((a, b) => a - b);
      commit({
        ...state,
        extras: {
          ...state.extras,
          checkedIngredients: next,
        },
      });
    },

    clearIngredients() {
      if (!state) {
        return;
      }
      commit({
        ...state,
        extras: {
          ...state.extras,
          checkedIngredients: [],
          checkedStepIngredients: [],
        },
      });
    },

    toggleStepIngredient(stepIndex, ingredientIndex) {
      if (!state) {
        return;
      }
      const key = `${stepIndex}:${ingredientIndex}`;
      const checked = state.extras.checkedStepIngredients;
      const next = checked.includes(key)
        ? checked.filter((item) => item !== key)
        : [...checked, key];
      commit({
        ...state,
        extras: {
          ...state.extras,
          checkedStepIngredients: next,
        },
      });
    },

    startTimer(stepIndex, timerDef) {
      if (!state) {
        return;
      }
      const currentMs = now();
      const instanceId = `${timerDef.id}-${currentMs}-${Math.random().toString(36).slice(2, 6)}`;
      const timer: PrototypeTimer = {
        id: instanceId,
        stepIndex,
        label: timerDef.label,
        durationSeconds: timerDef.durationSeconds,
        remainingSeconds: timerDef.durationSeconds,
        status: "running",
        endAtMs: currentMs + timerDef.durationSeconds * 1000,
      };
      commit({
        ...state,
        extras: {
          ...state.extras,
          timers: [...state.extras.timers, timer],
        },
      });
    },

    pauseTimer(timerId) {
      if (!state) {
        return;
      }
      syncTimersToNow();
      const timers = state.extras.timers.map((timer) => {
        if (timer.id !== timerId || timer.status !== "running") {
          return timer;
        }
        return {
          ...timer,
          status: "paused" as const,
          endAtMs: null,
        };
      });
      commit({
        ...state,
        extras: { ...state.extras, timers },
      });
    },

    resumeTimer(timerId) {
      if (!state) {
        return;
      }
      const currentMs = now();
      const timers = state.extras.timers.map((timer) => {
        if (
          timer.id !== timerId ||
          timer.status !== "paused" ||
          timer.remainingSeconds <= 0
        ) {
          return timer;
        }
        return {
          ...timer,
          status: "running" as const,
          endAtMs: currentMs + timer.remainingSeconds * 1000,
        };
      });
      commit({
        ...state,
        extras: { ...state.extras, timers },
      });
    },

    resetTimer(timerId) {
      if (!state) {
        return;
      }
      const timers = state.extras.timers.map((timer) => {
        if (timer.id !== timerId) {
          return timer;
        }
        return {
          ...timer,
          remainingSeconds: timer.durationSeconds,
          status: "paused" as const,
          endAtMs: null,
        };
      });
      commit({
        ...state,
        extras: { ...state.extras, timers },
      });
    },

    addTimerSeconds(timerId, deltaSeconds) {
      if (!state) {
        return;
      }
      syncTimersToNow();
      const currentMs = now();
      const timers = state.extras.timers.map((timer) => {
        if (timer.id !== timerId) {
          return timer;
        }
        const nextRemaining = Math.max(0, timer.remainingSeconds + deltaSeconds);
        if (nextRemaining === 0) {
          return {
            ...timer,
            remainingSeconds: 0,
            status: "finished" as const,
            endAtMs: null,
          };
        }
        if (timer.status === "running" || (timer.status === "finished" && deltaSeconds > 0)) {
          return {
            ...timer,
            remainingSeconds: nextRemaining,
            status: "running" as const,
            endAtMs: currentMs + nextRemaining * 1000,
          };
        }
        return {
          ...timer,
          remainingSeconds: nextRemaining,
        };
      });
      commit({
        ...state,
        extras: { ...state.extras, timers },
      });
    },

    dismissTimer(timerId) {
      if (!state) {
        return;
      }
      const timers = state.extras.timers.filter((timer) => timer.id !== timerId);
      const fullscreenTimerId =
        state.extras.fullscreenTimerId === timerId
          ? (timers[0]?.id ?? null)
          : state.extras.fullscreenTimerId;
      commit({
        ...state,
        extras: {
          ...state.extras,
          timers,
          fullscreenTimerId: timers.length === 0 ? null : fullscreenTimerId,
        },
      });
    },

    openTimerFullscreen(timerId) {
      if (!state) {
        return;
      }
      commit({
        ...state,
        extras: {
          ...state.extras,
          fullscreenTimerId: timerId,
        },
      });
    },

    closeTimerFullscreen() {
      if (!state) {
        return;
      }
      commit({
        ...state,
        extras: {
          ...state.extras,
          fullscreenTimerId: null,
        },
      });
    },

    runningTimerCount() {
      if (!state) {
        return 0;
      }
      return state.extras.timers.filter((timer) => timer.status === "running").length;
    },
  };
}

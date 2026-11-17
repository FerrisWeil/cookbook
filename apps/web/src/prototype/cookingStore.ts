import { MESSAGES, type CookingSession } from "@cookbook/shared";

import type { CookingClient } from "../cooking/client";
import type { PrototypeRecipe, PrototypeStep, PrototypeStepTimer } from "./sampleData";

const COOKING_STORAGE_KEY = "cookbook-prototype-cooking-v1";
const STANDALONE_TIMERS_STORAGE_KEY = "cookbook-prototype-timers-v1";

export type PrototypeTimer = {
  id: string;
  stepIndex: number | null;
  recipeId?: string;
  recipeTitle?: string;
  label: string;
  durationSeconds: number;
  remainingSeconds: number;
  overtimeSeconds?: number;
  status: "running" | "paused" | "finished";
  endAtMs: number | null;
  finishedAtMs?: number | null;
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

type PersistedStandaloneTimers = {
  timers: PrototypeTimer[];
  fullscreenTimerId: string | null;
};

export type PrototypeCookingClient = CookingClient & {
  getExtras(): PrototypeCookingExtras | null;
  getTimers(): PrototypeTimer[];
  getFullscreenTimerId(): string | null;
  toggleStepCompleted(stepIndex: number): void;
  toggleIngredient(index: number): void;
  clearIngredients(): void;
  toggleStepIngredient(stepIndex: number, ingredientIndex: number): void;
  startTimer(stepIndex: number, timer: PrototypeStepTimer): void;
  startAdhocTimer(durationSeconds: number, label?: string): void;
  pauseTimer(timerId: string): void;
  resumeTimer(timerId: string): void;
  resetTimer(timerId: string): void;
  restartTimer(timerId: string): void;
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

export function formatTimerClockValue(timer: PrototypeTimer): string {
  if (timer.status === "finished") {
    return `+${formatTimerSeconds(timer.overtimeSeconds ?? 0)}`;
  }
  return formatTimerSeconds(timer.remainingSeconds);
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

function readStandaloneStorage(): PersistedStandaloneTimers {
  if (typeof window === "undefined") {
    return { timers: [], fullscreenTimerId: null };
  }
  try {
    const raw = window.localStorage.getItem(STANDALONE_TIMERS_STORAGE_KEY);
    if (!raw) {
      return { timers: [], fullscreenTimerId: null };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedStandaloneTimers>;
    return {
      timers: Array.isArray(parsed.timers) ? parsed.timers : [],
      fullscreenTimerId:
        typeof parsed.fullscreenTimerId === "string"
          ? parsed.fullscreenTimerId
          : null,
    };
  } catch {
    return { timers: [], fullscreenTimerId: null };
  }
}

function writeStandaloneStorage(value: PersistedStandaloneTimers): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (value.timers.length === 0 && value.fullscreenTimerId === null) {
      window.localStorage.removeItem(STANDALONE_TIMERS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        STANDALONE_TIMERS_STORAGE_KEY,
        JSON.stringify(value),
      );
    }
  } catch {
    // Ignore storage failures.
  }
}

function alignedEndAtMs(currentMs: number, seconds: number): number {
  return Math.ceil(currentMs / 1000) * 1000 + seconds * 1000;
}

function syncTimerList(
  timers: PrototypeTimer[],
  currentMs: number,
): { timers: PrototypeTimer[]; changed: boolean } {
  let changed = false;
  const nextTimers = timers.map((timer) => {
    if (timer.status === "running" && timer.endAtMs !== null) {
      const diffMs = timer.endAtMs - currentMs;
      if (diffMs <= 0) {
        const finishedAtMs = timer.endAtMs;
        const overtimeSeconds = Math.max(
          0,
          Math.floor((currentMs - finishedAtMs) / 1000),
        );
        changed = true;
        return {
          ...timer,
          remainingSeconds: 0,
          overtimeSeconds,
          status: "finished" as const,
          endAtMs: null,
          finishedAtMs,
        };
      }
      const nextRemaining = Math.max(0, Math.floor(diffMs / 1000));
      if (nextRemaining !== timer.remainingSeconds) {
        changed = true;
        return {
          ...timer,
          remainingSeconds: nextRemaining,
        };
      }
      return timer;
    }
    if (timer.status === "finished" && timer.finishedAtMs != null) {
      const nextOvertime = Math.max(
        0,
        Math.floor((currentMs - timer.finishedAtMs) / 1000),
      );
      if (nextOvertime !== (timer.overtimeSeconds ?? 0)) {
        changed = true;
        return {
          ...timer,
          overtimeSeconds: nextOvertime,
        };
      }
    }
    return timer;
  });
  return { timers: nextTimers, changed };
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
  let standalone: PersistedStandaloneTimers = persist
    ? readStandaloneStorage()
    : { timers: [], fullscreenTimerId: null };
  let errorMessage: string | null = null;
  let tickHandle: ReturnType<typeof setInterval> | undefined;

  function activeTimers(): PrototypeTimer[] {
    return state ? state.extras.timers : standalone.timers;
  }

  function syncTimersToNow(): boolean {
    const currentMs = now();
    if (state) {
      const res = syncTimerList(state.extras.timers, currentMs);
      if (res.changed) {
        state = {
          ...state,
          extras: { ...state.extras, timers: res.timers },
        };
        if (persist) {
          writeStorage(state);
        }
      }
      return res.changed;
    }
    const res = syncTimerList(standalone.timers, currentMs);
    if (res.changed) {
      standalone = { ...standalone, timers: res.timers };
      if (persist) {
        writeStandaloneStorage(standalone);
      }
    }
    return res.changed;
  }

  function needsTicker(timers: PrototypeTimer[]): boolean {
    return timers.some(
      (timer) => timer.status === "running" || timer.status === "finished",
    );
  }

  function ensureTicker(): void {
    const active = needsTicker(activeTimers());
    if (active && tickHandle === undefined) {
      tickHandle = setInterval(() => {
        if (syncTimersToNow()) {
          emit();
        }
        if (!needsTicker(activeTimers()) && tickHandle !== undefined) {
          clearInterval(tickHandle);
          tickHandle = undefined;
        }
      }, 100);
    } else if (!active && tickHandle !== undefined) {
      clearInterval(tickHandle);
      tickHandle = undefined;
    }
  }

  function commitSession(next: PersistedCooking | null): void {
    state = next;
    if (persist) {
      writeStorage(state);
    }
    ensureTicker();
    emit();
  }

  function commitTimers(
    timers: PrototypeTimer[],
    fullscreenTimerId?: string | null,
  ): void {
    if (state) {
      state = {
        ...state,
        extras: {
          ...state.extras,
          timers,
          fullscreenTimerId:
            fullscreenTimerId !== undefined
              ? fullscreenTimerId
              : state.extras.fullscreenTimerId,
        },
      };
      if (persist) {
        writeStorage(state);
      }
    } else {
      standalone = {
        timers,
        fullscreenTimerId:
          fullscreenTimerId !== undefined
            ? fullscreenTimerId
            : standalone.fullscreenTimerId,
      };
      if (persist) {
        writeStandaloneStorage(standalone);
      }
    }
    ensureTicker();
    emit();
  }

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  syncTimersToNow();

  return {
    async open() {
      if (persist && !state) {
        state = readStorage();
      }
      if (persist && !state && standalone.timers.length === 0) {
        standalone = readStandaloneStorage();
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
      const carriedTimers = standalone.timers;
      const carriedFullscreen = standalone.fullscreenTimerId;
      standalone = { timers: [], fullscreenTimerId: null };
      if (persist) {
        writeStandaloneStorage(standalone);
      }
      errorMessage = null;
      commitSession({
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
          timers: carriedTimers,
          fullscreenTimerId: carriedFullscreen,
        },
      });
    },

    async end() {
      errorMessage = null;
      const preservedAdhoc =
        state?.extras.timers.filter((timer) => timer.stepIndex === null) ?? [];
      const preservedFullscreen =
        state &&
        state.extras.fullscreenTimerId &&
        preservedAdhoc.some((t) => t.id === state!.extras.fullscreenTimerId)
          ? state.extras.fullscreenTimerId
          : null;
      standalone = {
        timers: preservedAdhoc,
        fullscreenTimerId: preservedFullscreen,
      };
      if (persist) {
        writeStandaloneStorage(standalone);
      }
      commitSession(null);
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
      commitSession({
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
      commitSession({
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
      commitSession({
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

    getTimers() {
      return activeTimers();
    },

    getFullscreenTimerId() {
      return state ? state.extras.fullscreenTimerId : standalone.fullscreenTimerId;
    },

    toggleStepCompleted(stepIndex) {
      if (!state) {
        return;
      }
      const exists = state.session.completedSteps.includes(stepIndex);
      const completedSteps = exists
        ? state.session.completedSteps.filter((item) => item !== stepIndex)
        : [...state.session.completedSteps, stepIndex].sort((a, b) => a - b);
      commitSession({
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
      commitSession({
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
      commitSession({
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
      commitSession({
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
        recipeId: state.session.recipeId,
        recipeTitle: state.session.snapshot.title,
        label: timerDef.label,
        durationSeconds: timerDef.durationSeconds,
        remainingSeconds: timerDef.durationSeconds,
        overtimeSeconds: 0,
        status: "running",
        endAtMs: alignedEndAtMs(currentMs, timerDef.durationSeconds),
        finishedAtMs: null,
      };
      commitTimers([...activeTimers(), timer]);
    },

    startAdhocTimer(durationSeconds, label) {
      const safeDuration = Math.max(10, Math.min(24 * 3600, Math.round(durationSeconds)));
      const currentMs = now();
      const adhocCount =
        activeTimers().filter((item) => item.stepIndex === null).length + 1;
      const cleanLabel =
        label && label.trim() !== "" ? label.trim() : `Kitchen timer ${adhocCount}`;
      const instanceId = `adhoc-${currentMs}-${Math.random().toString(36).slice(2, 6)}`;
      const timer: PrototypeTimer = {
        id: instanceId,
        stepIndex: null,
        label: cleanLabel,
        durationSeconds: safeDuration,
        remainingSeconds: safeDuration,
        overtimeSeconds: 0,
        status: "running",
        endAtMs: alignedEndAtMs(currentMs, safeDuration),
        finishedAtMs: null,
      };
      commitTimers([...activeTimers(), timer]);
    },

    pauseTimer(timerId) {
      syncTimersToNow();
      const timers = activeTimers().map((timer) => {
        if (timer.id !== timerId || timer.status !== "running") {
          return timer;
        }
        return {
          ...timer,
          status: "paused" as const,
          endAtMs: null,
        };
      });
      commitTimers(timers);
    },

    resumeTimer(timerId) {
      const currentMs = now();
      const timers = activeTimers().map((timer) => {
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
          endAtMs: alignedEndAtMs(currentMs, timer.remainingSeconds),
          finishedAtMs: null,
        };
      });
      commitTimers(timers);
    },

    resetTimer(timerId) {
      const timers = activeTimers().map((timer) => {
        if (timer.id !== timerId) {
          return timer;
        }
        return {
          ...timer,
          remainingSeconds: timer.durationSeconds,
          overtimeSeconds: 0,
          status: "paused" as const,
          endAtMs: null,
          finishedAtMs: null,
        };
      });
      commitTimers(timers);
    },

    restartTimer(timerId) {
      const currentMs = now();
      const timers = activeTimers().map((timer) => {
        if (timer.id !== timerId) {
          return timer;
        }
        return {
          ...timer,
          remainingSeconds: timer.durationSeconds,
          overtimeSeconds: 0,
          status: "running" as const,
          endAtMs: alignedEndAtMs(currentMs, timer.durationSeconds),
          finishedAtMs: null,
        };
      });
      commitTimers(timers);
    },

    addTimerSeconds(timerId, deltaSeconds) {
      syncTimersToNow();
      const currentMs = now();
      const timers = activeTimers().map((timer) => {
        if (timer.id !== timerId) {
          return timer;
        }
        if (timer.status === "finished" && deltaSeconds <= 0) {
          return timer;
        }
        const nextRemaining = Math.max(0, timer.remainingSeconds + deltaSeconds);
        if (nextRemaining === 0) {
          return {
            ...timer,
            remainingSeconds: 0,
            overtimeSeconds: 0,
            status: "finished" as const,
            endAtMs: null,
            finishedAtMs: Math.floor(currentMs / 1000) * 1000,
          };
        }
        if (
          timer.status === "running" ||
          (timer.status === "finished" && deltaSeconds > 0)
        ) {
          return {
            ...timer,
            remainingSeconds: nextRemaining,
            overtimeSeconds: 0,
            status: "running" as const,
            endAtMs: alignedEndAtMs(currentMs, nextRemaining),
            finishedAtMs: null,
          };
        }
        return {
          ...timer,
          remainingSeconds: nextRemaining,
          overtimeSeconds: 0,
          finishedAtMs: null,
        };
      });
      commitTimers(timers);
    },

    dismissTimer(timerId) {
      const timers = activeTimers().filter((timer) => timer.id !== timerId);
      const currentFullscreen = state
        ? state.extras.fullscreenTimerId
        : standalone.fullscreenTimerId;
      const fullscreenTimerId =
        currentFullscreen === timerId ? (timers[0]?.id ?? null) : currentFullscreen;
      commitTimers(timers, timers.length === 0 ? null : fullscreenTimerId);
    },

    openTimerFullscreen(timerId) {
      commitTimers(activeTimers(), timerId);
    },

    closeTimerFullscreen() {
      commitTimers(activeTimers(), null);
    },

    runningTimerCount() {
      return activeTimers().filter((timer) => timer.status === "running").length;
    },
  };
}

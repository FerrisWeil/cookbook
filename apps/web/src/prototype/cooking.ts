import { MESSAGES, type CookingSession } from "@cookbook/shared";

import type { CookingClient } from "../cooking/client";
import { SAMPLE_RECIPES } from "./sample-recipes";
import {
  COOKING_STORAGE_KEY,
  emptyCookingState,
  openTimer,
  parseCookingState,
  startTimer,
  toggleIngredient,
  toggleStep,
} from "./cooking-state";
import type { PrototypeCookingState, PrototypeRecipe } from "./types";

export type MemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type PrototypeCookingStore = {
  subscribe(listener: () => void): () => void;
  state(): PrototypeCookingState | null;
  recipe(): PrototypeRecipe | null;
  begin(recipeId: string): void;
  end(): void;
  toggleStep(index: number): void;
  toggleIngredient(ingredientId: string): void;
  startTimer(stepIndex: number): void;
  openTimer(timerId: string | null): void;
};

export type PrototypeCookingClient = CookingClient & {
  prototypeStore: PrototypeCookingStore;
};

export function memoryWebStorage(): MemoryStorage {
  const data = new Map<string, string>();
  return {
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

export function createPrototypeCooking(options: {
  now?: () => number;
  id?: () => string;
  storage?: MemoryStorage | null;
} = {}): PrototypeCookingClient {
  const now = options.now ?? (() => Date.now());
  const nextId = options.id ?? defaultId;
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const listeners = new Set<() => void>();
  let current = loadState(storage);
  let commandError: string | null = null;

  function emit(): void {
    persist(storage, current);
    for (const listener of listeners) {
      listener();
    }
  }

  function recipeFor(id: string): PrototypeRecipe | undefined {
    return SAMPLE_RECIPES.find((item) => item.id === id);
  }

  function snapshot(recipe: PrototypeRecipe): CookingSession["snapshot"] {
    return {
      title: recipe.title,
      servings: recipe.servings,
      ingredients: recipe.ingredients.map((ingredient) => ingredient.line),
      steps: recipe.steps.map((step) => step.text),
    };
  }

  function asSession(): CookingSession | null {
    if (!current) {
      return null;
    }
    const recipe = recipeFor(current.recipeId);
    if (!recipe) {
      return null;
    }
    return {
      id: current.sessionId,
      recipeId: current.recipeId,
      status: "active",
      snapshot: snapshot(recipe),
      displayedStep: 0,
      completedSteps: [...current.completedSteps],
    };
  }

  const prototypeStore: PrototypeCookingStore = {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    state() {
      return current;
    },
    recipe() {
      return current ? recipeFor(current.recipeId) ?? null : null;
    },
    begin(recipeId) {
      const recipe = recipeFor(recipeId);
      if (!recipe) {
        commandError = MESSAGES.notFound;
        emit();
        return;
      }
      if (current?.recipeId === recipeId) {
        commandError = null;
        emit();
        return;
      }
      current = emptyCookingState(recipeId, nextId());
      commandError = null;
      emit();
    },
    end() {
      current = null;
      commandError = null;
      emit();
    },
    toggleStep(index) {
      if (!current) {
        return;
      }
      const recipe = recipeFor(current.recipeId);
      if (!recipe) {
        return;
      }
      current = toggleStep(current, index, recipe.steps.length);
      emit();
    },
    toggleIngredient(ingredientId) {
      if (!current) {
        return;
      }
      current = toggleIngredient(current, ingredientId);
      emit();
    },
    startTimer(stepIndex) {
      if (!current) {
        return;
      }
      const recipe = recipeFor(current.recipeId);
      if (!recipe) {
        return;
      }
      current = startTimer(current, recipe, stepIndex, now(), nextId());
      emit();
    },
    openTimer(timerId) {
      if (!current) {
        return;
      }
      current = openTimer(current, timerId);
      emit();
    },
  };

  const client: PrototypeCookingClient = {
    prototypeStore,
    async open() {
      emit();
    },
    close() {},
    subscribe(listener) {
      return prototypeStore.subscribe(listener);
    },
    view() {
      return asSession();
    },
    error() {
      return commandError;
    },
    setConnected() {},
    async begin(recipeId) {
      prototypeStore.begin(recipeId);
    },
    async end() {
      prototypeStore.end();
    },
    async show() {},
    async completeDisplayed() {
      if (!current) {
        return;
      }
      const recipe = recipeFor(current.recipeId);
      const index = current.completedSteps.length;
      if (!recipe || index >= recipe.steps.length) {
        return;
      }
      prototypeStore.toggleStep(index);
    },
    async undoDisplayed() {
      if (!current || current.completedSteps.length === 0) {
        return;
      }
      const last = current.completedSteps[current.completedSteps.length - 1];
      if (last === undefined) {
        return;
      }
      prototypeStore.toggleStep(last);
    },
  };

  return client;
}

function defaultId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `proto-${Date.now()}`;
}

function browserStorage(): MemoryStorage | null {
  try {
    if (typeof sessionStorage === "undefined") {
      return null;
    }
    return sessionStorage;
  } catch {
    return null;
  }
}

function loadState(storage: MemoryStorage | null): PrototypeCookingState | null {
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(COOKING_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return parseCookingState(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function persist(
  storage: MemoryStorage | null,
  state: PrototypeCookingState | null,
): void {
  if (!storage) {
    return;
  }
  try {
    if (!state) {
      storage.removeItem(COOKING_STORAGE_KEY);
      return;
    }
    storage.setItem(COOKING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Prototype persistence is best-effort.
  }
}

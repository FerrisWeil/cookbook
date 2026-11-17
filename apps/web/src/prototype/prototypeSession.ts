import {
  compileListCriteria,
  listCriteriaFromSearch,
  matchRecipe,
  mergeProteinChoices,
  type RecipeFacts,
  type RecipeListItem,
} from "@cookbook/shared";

import { LIST_ERROR, RECIPE_ERROR, RECIPE_MISSING } from "../api";
import { memoryLock, memoryStorage } from "../sync/ports";
import {
  createKitchenSession,
  type KitchenSession,
  type ListView,
  type RecipeView,
  type StreamHandlers,
} from "../sync/session";
import { resolvePantryIngredientAsset } from "./pantryCatalog";
import { SAMPLE_RECIPES, type PrototypeRecipe } from "./sampleData";

export type PrototypeViewMode = "normal" | "empty" | "loading" | "error";

export type PrototypeController = {
  session: KitchenSession;
  getMode(): PrototypeViewMode;
  setMode(mode: PrototypeViewMode): void;
  subscribe(listener: () => void): () => void;
  findRecipe(id: string): PrototypeRecipe | undefined;
  resetFacts(): Promise<void>;
};

function cloneRecipes(): PrototypeRecipe[] {
  return structuredClone(SAMPLE_RECIPES);
}

export function initialPrototypeModeFromSearch(search: string): PrototypeViewMode {
  const params = new URLSearchParams(search);
  const raw = params.get("state") ?? params.get("protoState");
  if (raw === "empty" || raw === "loading" || raw === "error") {
    return raw;
  }
  return "normal";
}

export function createPrototypeController(
  initialSearch = "",
): PrototypeController {
  let recipes = cloneRecipes();
  let mode: PrototypeViewMode = initialPrototypeModeFromSearch(initialSearch);
  const modeListeners = new Set<() => void>();
  let streamHandlers: StreamHandlers | null = null;

  function emitMode(): void {
    for (const listener of modeListeners) {
      listener();
    }
  }

  function findRecipe(id: string): PrototypeRecipe | undefined {
    return recipes.find((item) => item.id === id);
  }

  const inner = createKitchenSession(
    {
      storage: memoryStorage(),
      lock: memoryLock(),
      network: {
        async send(mutation) {
          const target = findRecipe(mutation.recipeId);
          if (!target) {
            return {
              ok: false,
              kind: "permanent",
              message: RECIPE_MISSING,
            };
          }
          const nextFacts: RecipeFacts = { ...target.facts };
          if ("primaryProtein" in mutation.fields) {
            const val = mutation.fields["primaryProtein"];
            nextFacts.primaryProtein = typeof val === "string" ? val : null;
          }
          if ("totalMinutes" in mutation.fields) {
            const val = mutation.fields["totalMinutes"];
            nextFacts.totalMinutes = typeof val === "number" ? val : null;
          }
          if ("effort" in mutation.fields) {
            const val = mutation.fields["effort"];
            nextFacts.effort =
              val === "low" || val === "medium" || val === "high" ? val : null;
          }
          if ("mealTypes" in mutation.fields) {
            const val = mutation.fields["mealTypes"];
            if (Array.isArray(val)) {
              nextFacts.mealTypes = val.filter(
                (item): item is RecipeFacts["mealTypes"][number] =>
                  item === "breakfast" ||
                  item === "lunch" ||
                  item === "dinner" ||
                  item === "snack" ||
                  item === "dessert",
              );
            }
          }
          target.facts = nextFacts;
          streamHandlers?.onEvent({ recipeId: target.id, op: "saved" });
          return { ok: true, kind: "applied" };
        },
      },
      stream: {
        connect(handlers, signal) {
          streamHandlers = handlers;
          queueMicrotask(() => {
            if (!signal.aborted) {
              handlers.onOpen();
            }
          });
          signal.addEventListener(
            "abort",
            () => {
              if (streamHandlers === handlers) {
                streamHandlers = null;
              }
            },
            { once: true },
          );
        },
      },
      recipes: {
        async list(query) {
          const allProteins = recipes
            .map((item) => item.facts.primaryProtein)
            .filter((item): item is string => typeof item === "string");
          const matched: RecipeListItem[] = recipes
            .filter((item) => matchRecipe(item, query ?? null))
            .map((item) => ({
              id: item.id,
              title: item.title,
              shortTitle: item.shortTitle,
              imageUrl: item.imageUrl ?? null,
              facts: { ...item.facts, mealTypes: [...item.facts.mealTypes] },
            }));
          return {
            recipes: matched,
            proteinChoices: mergeProteinChoices(allProteins),
          };
        },
        async read(id) {
          const item = findRecipe(id);
          if (!item) {
            throw new Error(RECIPE_MISSING);
          }
          return {
            title: item.title,
            ingredients: item.ingredients.map((entry) => entry.line),
            steps: item.steps.map((step) => step.text),
            facts: { ...item.facts, mealTypes: [...item.facts.mealTypes] },
          };
        },
      },
      now: () => Date.now(),
      id: () =>
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `proto-${Date.now()}`,
    },
    {
      initialListQuery: compileListCriteria(listCriteriaFromSearch(initialSearch)),
    },
  );

  function setMode(next: PrototypeViewMode): void {
    if (mode === next) {
      return;
    }
    mode = next;
    emitMode();
    if (next === "normal") {
      void inner.refetch();
    }
  }

  const session: KitchenSession = {
    ...inner,
    subscribe(listener) {
      const unsubInner = inner.subscribe(listener);
      modeListeners.add(listener);
      return () => {
        unsubInner();
        modeListeners.delete(listener);
      };
    },
    list(): ListView {
      if (mode === "loading") {
        return { kind: "loading" };
      }
      if (mode === "error") {
        return { kind: "error", message: LIST_ERROR };
      }
      if (mode === "empty") {
        return { kind: "ready", recipes: [], updating: false };
      }
      return inner.list();
    },
    recipe(id: string): RecipeView {
      if (mode === "loading") {
        return { kind: "loading" };
      }
      if (mode === "error") {
        return { kind: "error", message: RECIPE_ERROR };
      }
      const res = inner.recipe(id);
      if (res.kind === "ready") {
        const sample = findRecipe(id);
        const ingredientImages =
          sample?.id === "three-hour-beef-barley-stew"
            ? sample.ingredients.map(
                (entry) => resolvePantryIngredientAsset(entry.line)?.imageUrl ?? null,
              )
            : undefined;
        return {
          ...res,
          recipe: {
            ...res.recipe,
            imageUrl: sample?.imageUrl ?? null,
            ingredientImages,
          },
        };
      }
      return res;
    },
    async refetch() {
      if (mode === "error") {
        mode = "normal";
        emitMode();
      }
      return inner.refetch();
    },
    async openRecipe(id: string) {
      if (mode === "error") {
        mode = "normal";
        emitMode();
      }
      return inner.openRecipe(id);
    },
  };

  return {
    session,
    getMode: () => mode,
    setMode,
    subscribe(listener) {
      modeListeners.add(listener);
      return () => {
        modeListeners.delete(listener);
      };
    },
    findRecipe,
    async resetFacts() {
      await inner.idle();
      recipes = cloneRecipes();
      if (mode !== "normal") {
        mode = "normal";
      }
      emitMode();
      await inner.refetch();
    },
  };
}

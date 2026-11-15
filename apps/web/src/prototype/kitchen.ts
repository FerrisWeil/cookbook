import {
  mergeProteinChoices,
  type QueryNode,
  type RecipeListItem,
} from "@cookbook/shared";

import { LIST_ERROR, RECIPE_ERROR, RECIPE_MISSING } from "../api";
import { formatSyncLabel, type KitchenSession } from "../sync/session";
import type { FieldPatch } from "../sync/types";
import {
  applyFactsPatch,
  cloneRecipe,
  filterSampleRecipes,
  proteinChoicesFrom,
  toListItem,
  toSnapshot,
} from "./data";
import { protoStateFromSearch } from "./mode";
import { SAMPLE_RECIPES } from "./sample-recipes";
import type { PrototypeLibraryState, PrototypeRecipe } from "./types";

export type PrototypeKitchen = KitchenSession & {
  libraryState(): PrototypeLibraryState;
  setLibraryState(state: PrototypeLibraryState): void;
  fullRecipe(id: string): PrototypeRecipe | undefined;
};

export function createPrototypeKitchen(
  options: { search?: string } = {},
): PrototypeKitchen {
  const recipes = SAMPLE_RECIPES.map(cloneRecipe);
  const listeners = new Set<() => void>();
  const snapshots = new Map<string, string>();
  let listQuery: QueryNode | null = null;
  let libraryState: PrototypeLibraryState =
    protoStateFromSearch(options.search ?? currentSearch()) ?? "ok";

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function visible(): PrototypeRecipe[] {
    if (libraryState === "empty") {
      return [];
    }
    return filterSampleRecipes(recipes, listQuery);
  }

  function listItems(): RecipeListItem[] {
    return visible().map(toListItem);
  }

  const kitchen: PrototypeKitchen = {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    list() {
      if (libraryState === "loading") {
        return { kind: "loading" };
      }
      if (libraryState === "error") {
        return { kind: "error", message: LIST_ERROR };
      }
      return { kind: "ready", recipes: listItems(), updating: false };
    },
    recipe(id) {
      if (libraryState === "loading") {
        return { kind: "loading" };
      }
      if (libraryState === "error") {
        return { kind: "error", message: RECIPE_ERROR };
      }
      const recipe = recipes.find((item) => item.id === id);
      if (!recipe) {
        return { kind: "missing" };
      }
      snapshots.set(id, id);
      return { kind: "ready", recipe: toSnapshot(recipe) };
    },
    syncStatus() {
      const status = {
        connection: "online" as const,
        pending: 0,
        failed: 0,
        allSaved: true,
        label: "",
      };
      status.label =
        libraryState === "ok"
          ? "Sample data · in memory"
          : formatSyncLabel(status);
      return status;
    },
    listQuery() {
      return listQuery;
    },
    proteinChoices() {
      if (libraryState === "empty") {
        return mergeProteinChoices([]);
      }
      return proteinChoicesFrom(recipes);
    },
    setListQuery(query) {
      listQuery = query;
      emit();
      return Promise.resolve(true);
    },
    async start() {
      emit();
    },
    stop() {},
    refetch() {
      const recovered = libraryState === "error";
      if (recovered) {
        libraryState = "ok";
      }
      emit();
      return Promise.resolve(libraryState === "ok" || libraryState === "empty");
    },
    openRecipe(id) {
      snapshots.set(id, id);
      emit();
      return Promise.resolve();
    },
    setDraft() {},
    async saveFields(recipeId: string, fields: FieldPatch) {
      const recipe = recipes.find((item) => item.id === recipeId);
      if (!recipe) {
        throw new Error(RECIPE_MISSING);
      }
      recipe.facts = applyFactsPatch(recipe.facts, fields);
      emit();
    },
    async drain() {},
    idle() {
      return Promise.resolve();
    },
    libraryState() {
      return libraryState;
    },
    setLibraryState(next) {
      libraryState = next;
      emit();
    },
    fullRecipe(id) {
      return recipes.find((item) => item.id === id);
    },
  };
  return kitchen;
}

function currentSearch(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.search;
}

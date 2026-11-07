import type { RecipeStore } from "./recipes/index.js";

export type RecipeCommit = {
  recipeId: string;
  op: "saved" | "hidden";
};

export type CommitListener = (commit: RecipeCommit) => void;

export type CommitHub = {
  subscribe(listener: CommitListener): () => void;
  notify(commit: RecipeCommit): void;
};

export function createCommitHub(): CommitHub {
  const listeners = new Set<CommitListener>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify(commit) {
      for (const listener of listeners) {
        try {
          listener(commit);
        } catch {
          // Subscribers must not fail the write that already committed.
        }
      }
    },
  };
}

export function notifyingRecipeStore(
  store: RecipeStore,
  hub: CommitHub,
): RecipeStore {
  return {
    ...store,
    async save(input) {
      const recipe = await store.save(input);
      hub.notify({ recipeId: recipe.id, op: "saved" });
      return recipe;
    },
    async hide(input) {
      await store.hide(input);
      const recipeId =
        typeof input.id === "string" ? input.id : String(input.id ?? "");
      hub.notify({ recipeId, op: "hidden" });
    },
  };
}

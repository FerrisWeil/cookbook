import type { RecipeStore } from "./recipes/index.js";
import type { SessionStore } from "./sessions/index.js";
import type { CookingSession } from "@cookbook/shared";

export type RecipeCommit = {
  recipeId: string;
  op: "saved" | "hidden";
};

export type SessionCommit = {
  sessionId: string;
  op: "started" | "updated" | "finished";
};

export type CommitListener = (commit: RecipeCommit) => void;
export type SessionListener = (commit: SessionCommit) => void;

export type CommitHub = {
  subscribe(listener: CommitListener): () => void;
  subscribeSession(listener: SessionListener): () => void;
  notify(commit: RecipeCommit): void;
  notifySession(commit: SessionCommit): void;
};

export function createCommitHub(): CommitHub {
  const listeners = new Set<CommitListener>();
  const sessionListeners = new Set<SessionListener>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeSession(listener) {
      sessionListeners.add(listener);
      return () => {
        sessionListeners.delete(listener);
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
    notifySession(commit) {
      for (const listener of sessionListeners) {
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
    async updateFacts(id, facts) {
      const recipe = await store.updateFacts(id, facts);
      hub.notify({ recipeId: recipe.id, op: "saved" });
      return recipe;
    },
  };
}

export function notifyingSessionStore(
  store: SessionStore,
  hub: CommitHub,
): SessionStore {
  const notify = async (
    session: CookingSession,
    op: SessionCommit["op"],
  ): Promise<CookingSession> => {
    hub.notifySession({ sessionId: session.id, op });
    return session;
  };
  return {
    resume: () => store.resume(),
    async start(input) {
      return notify(await store.start(input), "started");
    },
    async finish(input) {
      return notify(await store.finish(input), "finished");
    },
    async complete(input) {
      return notify(await store.complete(input), "updated");
    },
    async undo(input) {
      return notify(await store.undo(input), "updated");
    },
    async display(input) {
      return notify(await store.display(input), "updated");
    },
  };
}

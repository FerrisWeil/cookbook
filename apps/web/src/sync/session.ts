import { type RecipeFacts, type RecipeListItem } from "@cookbook/shared";

import { overlayList, overlayRecord } from "./overlay";
import { Outbox } from "./outbox";
import type { LockPort, NetworkPort, StoragePort } from "./ports";
import type { FieldPatch, JsonValue, Mutation } from "./types";

export type RecipeSnapshot = {
  title: string;
  ingredients: string[];
  steps: string[];
  facts: RecipeFacts;
};

export type RecipeReader = {
  list(): Promise<RecipeListItem[]>;
  read(id: string): Promise<RecipeSnapshot>;
};

export type StreamEvent = {
  recipeId: string;
  op: "saved" | "hidden";
};

export type StreamHandlers = {
  onOpen(): void;
  onConnecting?(): void;
  onEvent(event: StreamEvent): void;
  onError(): void;
};

export type StreamPort = {
  connect(handlers: StreamHandlers, signal: AbortSignal): void;
};

export type KitchenPorts = {
  storage: StoragePort;
  lock: LockPort;
  network: NetworkPort;
  stream: StreamPort;
  recipes: RecipeReader;
  now: () => number;
  id: () => string;
};

export type ListView =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; recipes: RecipeListItem[] };

export type RecipeView =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "missing" }
  | { kind: "ready"; recipe: RecipeSnapshot };

export type ConnectionState = "offline" | "connecting" | "online";

export type SyncStatus = {
  connection: ConnectionState;
  pending: number;
  failed: number;
  allSaved: boolean;
  label: string;
};

function asRecord(snapshot: RecipeSnapshot): Record<string, JsonValue> {
  return {
    title: snapshot.title,
    ingredients: snapshot.ingredients,
    steps: snapshot.steps,
    primaryProtein: snapshot.facts.primaryProtein,
    totalMinutes: snapshot.facts.totalMinutes,
    effort: snapshot.facts.effort,
    mealTypes: [...snapshot.facts.mealTypes],
  };
}

function factsFromRecord(record: Record<string, JsonValue>): RecipeFacts {
  const meals = record["mealTypes"];
  const effort = record["effort"];
  const protein = record["primaryProtein"];
  const minutes = record["totalMinutes"];
  return {
    primaryProtein: typeof protein === "string" ? protein : null,
    totalMinutes: typeof minutes === "number" ? minutes : null,
    effort:
      effort === "low" || effort === "medium" || effort === "high" ? effort : null,
    mealTypes: Array.isArray(meals)
      ? meals.filter(
          (item): item is RecipeFacts["mealTypes"][number] =>
            item === "breakfast" ||
            item === "lunch" ||
            item === "dinner" ||
            item === "snack" ||
            item === "dessert",
        )
      : [],
  };
}

function asRecipe(record: Record<string, JsonValue>): RecipeSnapshot {
  return {
    title: String(record["title"] ?? ""),
    ingredients: Array.isArray(record["ingredients"])
      ? record["ingredients"].map((item) => String(item))
      : [],
    steps: Array.isArray(record["steps"])
      ? record["steps"].map((item) => String(item))
      : [],
    facts: factsFromRecord(record),
  };
}

export function formatSyncLabel(status: {
  connection: ConnectionState;
  pending: number;
  failed: number;
}): string {
  const connection =
    status.connection === "online"
      ? "Online"
      : status.connection === "connecting"
        ? "Reconnecting"
        : "Offline";
  const saves =
    status.failed > 0
      ? `${status.failed} need attention`
      : status.pending > 0
        ? `${status.pending} pending`
        : "All saved";
  return `${connection} · ${saves}`;
}

export function createKitchenSession(ports: KitchenPorts) {
  const outbox = new Outbox({
    storage: ports.storage,
    network: ports.network,
    lock: ports.lock,
    now: ports.now,
  });
  const drafts = new Map<string, FieldPatch>();
  const snapshots = new Map<string, RecipeSnapshot>();
  const recipeErrors = new Map<string, RecipeView>();
  const listeners = new Set<() => void>();
  let listSnapshot: RecipeListItem[] | undefined;
  let listError: string | undefined;
  let listLoading = true;
  let connection: ConnectionState = "connecting";
  let started = false;
  let stopStream: (() => void) | undefined;
  let inflight: Promise<void> = Promise.resolve();
  let fetchGeneration = 0;
  const recipeReads = new Map<string, number>();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function pending(): Mutation[] {
    return outbox.snapshot().map((item) => item.mutation);
  }

  function list(): ListView {
    if (listSnapshot) {
      return { kind: "ready", recipes: overlayList(listSnapshot, pending()) };
    }
    if (listError) {
      return { kind: "error", message: listError };
    }
    if (listLoading) {
      return { kind: "loading" };
    }
    return { kind: "ready", recipes: [] };
  }

  function recipe(id: string): RecipeView {
    const error = recipeErrors.get(id);
    const snapshot = snapshots.get(id);
    if (snapshot) {
      const draft = drafts.get(id) ?? null;
      const forRecipe = pending().filter((item) => item.recipeId === id);
      return {
        kind: "ready",
        recipe: asRecipe(overlayRecord(asRecord(snapshot), forRecipe, draft)),
      };
    }
    if (error) {
      return error;
    }
    return { kind: "loading" };
  }

  function syncStatus(): SyncStatus {
    const counts = outbox.status();
    const allSaved = counts.pending === 0 && counts.failed === 0;
    const status = {
      connection,
      pending: counts.pending,
      failed: counts.failed,
      allSaved,
      label: "",
    };
    status.label = formatSyncLabel(status);
    return status;
  }

  function beginRecipeRead(id: string): number {
    const seq = (recipeReads.get(id) ?? 0) + 1;
    recipeReads.set(id, seq);
    return seq;
  }

  function commitRecipe(id: string, seq: number, next: RecipeSnapshot): boolean {
    if (recipeReads.get(id) !== seq) {
      return false;
    }
    snapshots.set(id, next);
    recipeErrors.delete(id);
    return true;
  }

  async function refetch(): Promise<void> {
    const generation = (fetchGeneration += 1);
    const openIds = [
      ...new Set([
        ...snapshots.keys(),
        ...recipeErrors.keys(),
        ...recipeReads.keys(),
      ]),
    ];
    try {
      const recipes = await ports.recipes.list();
      if (generation !== fetchGeneration) {
        return;
      }
      listSnapshot = recipes;
      listError = undefined;
      listLoading = false;
    } catch (error) {
      if (generation !== fetchGeneration) {
        return;
      }
      if (!listSnapshot) {
        listError = error instanceof Error ? error.message : "Could not load recipes.";
        listLoading = false;
      }
    }
    await Promise.all(
      openIds.map(async (id) => {
        const seq = beginRecipeRead(id);
        try {
          const next = await ports.recipes.read(id);
          if (generation !== fetchGeneration) {
            return;
          }
          commitRecipe(id, seq, next);
        } catch (error) {
          if (generation !== fetchGeneration) {
            return;
          }
          const message =
            error instanceof Error ? error.message : "Could not load this recipe.";
          if (recipeReads.get(id) !== seq) {
            return;
          }
          if (message === "The recipe was not found.") {
            snapshots.delete(id);
            recipeErrors.set(id, { kind: "missing" });
            return;
          }
          if (!snapshots.has(id)) {
            recipeErrors.set(id, { kind: "error", message });
          }
        }
      }),
    );
    emit();
  }

  async function openRecipe(id: string): Promise<void> {
    const seq = beginRecipeRead(id);
    try {
      const next = await ports.recipes.read(id);
      if (!commitRecipe(id, seq, next)) {
        return;
      }
    } catch (error) {
      if (recipeReads.get(id) !== seq) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Could not load this recipe.";
      if (message === "The recipe was not found.") {
        snapshots.delete(id);
        recipeErrors.set(id, { kind: "missing" });
      } else if (!snapshots.has(id)) {
        recipeErrors.set(id, { kind: "error", message });
      }
    }
    emit();
  }

  function track<T>(work: Promise<T>): Promise<T> {
    const settled = work.then(
      () => undefined,
      () => undefined,
    );
    inflight = Promise.all([inflight, settled]).then(() => undefined);
    return work;
  }

  function clearRetry(): void {
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
  }

  function armRetry(): void {
    clearRetry();
    const wake = outbox.nextRetryAt();
    if (wake === undefined) {
      return;
    }
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void track(drain());
    }, Math.max(0, wake - ports.now()));
  }

  async function drain(): Promise<void> {
    await outbox.drain();
    armRetry();
    emit();
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    list,
    recipe,
    syncStatus,
    async start(): Promise<void> {
      if (started) {
        return refetch();
      }
      started = true;
      const controller = new AbortController();
      stopStream = () => controller.abort();
      ports.stream.connect(
        {
          onOpen() {
            connection = "online";
            emit();
            void track(refetch());
            void track(drain());
          },
          onConnecting() {
            connection = "connecting";
            emit();
          },
          onEvent() {
            void track(refetch());
          },
          onError() {
            connection = "offline";
            emit();
          },
        },
        controller.signal,
      );
      await track(refetch());
      await track(drain());
    },
    stop() {
      clearRetry();
      stopStream?.();
      stopStream = undefined;
      started = false;
      connection = "offline";
    },
    refetch() {
      return track(refetch());
    },
    openRecipe(id: string) {
      return track(openRecipe(id));
    },
    setDraft(recipeId: string, fields: FieldPatch): void {
      const current = drafts.get(recipeId) ?? {};
      drafts.set(recipeId, { ...current, ...fields });
      emit();
    },
    async saveFields(recipeId: string, fields: FieldPatch): Promise<void> {
      const current = drafts.get(recipeId);
      if (current) {
        const next: { [key: string]: JsonValue } = { ...current };
        for (const key of Object.keys(fields)) {
          delete next[key];
        }
        if (Object.keys(next).length === 0) {
          drafts.delete(recipeId);
        } else {
          drafts.set(recipeId, next);
        }
      }
      await outbox.enqueue({
        id: ports.id(),
        recipeId,
        fields,
      });
      emit();
      void track(drain());
    },
    drain,
    idle() {
      return inflight;
    },
  };
}

export type KitchenSession = ReturnType<typeof createKitchenSession>;

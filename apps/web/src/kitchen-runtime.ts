import { fetchRecipeList, fetchRecipeView } from "./api";
import {
  eventSourceStream,
  indexedDbStorage,
  unavailableMutationNetwork,
  webLock,
} from "./sync/adapters";
import { memoryLock, memoryStorage } from "./sync/ports";
import { createKitchenSession, type KitchenSession } from "./sync/session";

export function createBrowserSession(): KitchenSession {
  const storage =
    typeof indexedDB === "undefined"
      ? memoryStorage()
      : indexedDbStorage(indexedDB);
  return createKitchenSession({
    storage,
    lock: typeof navigator === "undefined" ? memoryLock() : webLock(),
    network: unavailableMutationNetwork(),
    stream: eventSourceStream("/api/recipes/events"),
    recipes: {
      list: () => fetchRecipeList(),
      read: (id) => fetchRecipeView(id),
    },
    now: () => Date.now(),
    id: () => crypto.randomUUID(),
  });
}

export function createDetachedSession(): KitchenSession {
  return createKitchenSession({
    storage: memoryStorage(),
    lock: memoryLock(),
    network: unavailableMutationNetwork(),
    stream: { connect() {} },
    recipes: {
      async list() {
        return [];
      },
      async read() {
        throw new Error("The recipe was not found.");
      },
    },
    now: () => 0,
    id: () => "detached",
  });
}

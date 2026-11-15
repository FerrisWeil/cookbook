import { compileListCriteria, listCriteriaFromSearch } from "@cookbook/shared";

import { fetchRecipeList, fetchRecipeView } from "./api";
import {
  eventSourceStream,
  factsPatchNetwork,
  indexedDbStorage,
  webLock,
} from "./sync/adapters";
import { memoryLock, memoryStorage } from "./sync/ports";
import { createKitchenSession, type KitchenSession } from "./sync/session";

export function createBrowserSession(): KitchenSession {
  const storage =
    typeof indexedDB === "undefined"
      ? memoryStorage()
      : indexedDbStorage(indexedDB);
  const search =
    typeof window === "undefined" ? "" : window.location.search;
  return createKitchenSession(
    {
      storage,
      lock: typeof navigator === "undefined" ? memoryLock() : webLock(),
      network: factsPatchNetwork(),
      stream: eventSourceStream("/api/recipes/events"),
      recipes: {
        list: (query) => fetchRecipeList(query),
        read: (id) => fetchRecipeView(id),
      },
      now: () => Date.now(),
      id: () => crypto.randomUUID(),
    },
    {
      initialListQuery: compileListCriteria(listCriteriaFromSearch(search)),
    },
  );
}

export function createDetachedSession(): KitchenSession {
  return createKitchenSession({
    storage: memoryStorage(),
    lock: memoryLock(),
    network: {
      async send() {
        return {
          ok: false,
          kind: "unavailable" as const,
          message: "This screen is not connected.",
        };
      },
    },
    stream: { connect() {} },
    recipes: {
      async list() {
        return { recipes: [], proteinChoices: [] };
      },
      async read() {
        throw new Error("The recipe was not found.");
      },
    },
    now: () => 0,
    id: () => "detached",
  });
}

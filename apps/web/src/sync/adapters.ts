import type { QueueItem } from "./types";
import { memoryLock, type LockPort, type NetworkPort, type SendResult, type StoragePort } from "./ports";
import type { StreamHandlers, StreamPort } from "./session";

const OUTBOX_DB = "cookbook-outbox";
const OUTBOX_STORE = "items";
const OUTBOX_KEY = "queue";
const OUTBOX_VERSION = 1;
const LOCK_NAME = "cookbook-outbox";

function storedItems(items: QueueItem[]): QueueItem[] {
  return items.map((item) => ({
    mutation: {
      id: item.mutation.id,
      recipeId: item.mutation.recipeId,
      fields: item.mutation.fields,
    },
    status: item.status,
    attempts: item.attempts,
    nextAttemptAt: item.nextAttemptAt,
    failure: item.failure,
  }));
}

export function unavailableMutationNetwork(
  message = "Facts PATCH is not on this branch",
): NetworkPort {
  return {
    async send() {
      return { ok: false, kind: "unavailable", message };
    },
  };
}

export function classifyHttpSend(status: number, message: string): SendResult {
  if (status === 200 || status === 204) {
    return { ok: true, kind: "applied" };
  }
  if (status === 409) {
    return { ok: false, kind: "payload-mismatch", message };
  }
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status === 422
  ) {
    return { ok: false, kind: "permanent", message };
  }
  return { ok: false, kind: "transient", message };
}

export function factsPatchNetwork(): NetworkPort {
  return {
    async send(mutation) {
      const facts = mutation.fields["facts"] ?? null;
      try {
        const response = await fetch(
          `/api/recipes/${encodeURIComponent(mutation.recipeId)}/facts`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(facts),
          },
        );
        const text = await response.text();
        let message = `Save failed (${response.status})`;
        try {
          const body = JSON.parse(text) as { message?: unknown };
          if (typeof body.message === "string" && body.message.trim() !== "") {
            message = body.message;
          }
        } catch {
          // Status-only bodies stay status-only.
        }
        if (response.ok) {
          return { ok: true, kind: "applied" };
        }
        return classifyHttpSend(response.status, message);
      } catch {
        return {
          ok: false,
          kind: "transient",
          message: "Could not reach the kitchen.",
        };
      }
    },
  };
}

export function eventSourceStream(url = "/api/recipes/events"): StreamPort {
  return {
    connect(handlers: StreamHandlers, signal: AbortSignal) {
      if (typeof EventSource === "undefined") {
        handlers.onError();
        return;
      }
      const source = new EventSource(url);
      const onOpen = () => handlers.onOpen();
      const onError = () => {
        if (source.readyState === EventSource.CLOSED) {
          handlers.onError();
          return;
        }
        handlers.onConnecting?.();
      };
      const onCommitted = (event: Event) => {
        const message = event as MessageEvent<string>;
        try {
          const data = JSON.parse(message.data) as {
            recipeId?: unknown;
            op?: unknown;
          };
          if (typeof data.recipeId !== "string" || data.recipeId === "") {
            handlers.onEvent({ recipeId: "", op: "saved" });
            return;
          }
          handlers.onEvent({
            recipeId: data.recipeId,
            op: data.op === "hidden" ? "hidden" : "saved",
          });
        } catch {
          handlers.onEvent({ recipeId: "", op: "saved" });
        }
      };
      source.addEventListener("open", onOpen);
      source.addEventListener("error", onError);
      source.addEventListener("committed", onCommitted);
      const abort = () => {
        source.removeEventListener("open", onOpen);
        source.removeEventListener("error", onError);
        source.removeEventListener("committed", onCommitted);
        source.close();
      };
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
    },
  };
}

export function webLock(name = LOCK_NAME): LockPort {
  const locks = globalThis.navigator?.locks;
  if (!locks) {
    return memoryLock();
  }
  return {
    withLock(fn) {
      return locks.request(name, () => fn());
    },
  };
}

function openOutboxDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(OUTBOX_DB, OUTBOX_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open outbox storage"));
  });
}

export function indexedDbStorage(factory: IDBFactory): StoragePort {
  let opened: Promise<IDBDatabase> | undefined;
  const db = () => {
    opened ??= openOutboxDb(factory);
    return opened;
  };
  return {
    async load() {
      const database = await db();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(OUTBOX_STORE, "readonly");
        const request = tx.objectStore(OUTBOX_STORE).get(OUTBOX_KEY);
        request.onsuccess = () => {
          resolve(Array.isArray(request.result) ? request.result : []);
        };
        request.onerror = () =>
          reject(request.error ?? new Error("Could not read outbox storage"));
      });
    },
    async save(items) {
      const database = await db();
      const payload = storedItems(items);
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(OUTBOX_STORE, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(tx.error ?? new Error("Could not write outbox storage"));
        tx.objectStore(OUTBOX_STORE).put(payload, OUTBOX_KEY);
      });
    },
  };
}

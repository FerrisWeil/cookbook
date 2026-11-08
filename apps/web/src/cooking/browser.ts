import { MESSAGES, type CookingSession, type CookingSnapshot } from "@cookbook/shared";

import { classifyHttpSend, indexedDbStorage, indexedDbValue, webLock } from "../sync/adapters";
import { memoryLock, memoryStorage } from "../sync/ports";
import type { Mutation } from "../sync/types";
import {
  createCookingClient,
  memorySessionCache,
  type CookingClient,
  type CookingNetwork,
  type CookingStream,
  type CookingWrite,
  type SessionCache,
} from "./client";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asSnapshot(value: unknown): CookingSnapshot | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const title = record["title"];
  const servings = record["servings"];
  const ingredients = record["ingredients"];
  const steps = record["steps"];
  if (
    typeof title !== "string" ||
    typeof servings !== "number" ||
    !Array.isArray(ingredients) ||
    !Array.isArray(steps) ||
    ingredients.some((line) => typeof line !== "string") ||
    steps.some((step) => typeof step !== "string")
  ) {
    return null;
  }
  return {
    title,
    servings,
    ingredients,
    steps,
  };
}

export function parseCookingSession(value: unknown): CookingSession | null {
  const record = asRecord(value);
  const snapshot = asSnapshot(record?.["snapshot"]);
  const completed = record?.["completedSteps"];
  if (
    !record ||
    !snapshot ||
    typeof record["id"] !== "string" ||
    typeof record["recipeId"] !== "string" ||
    (record["status"] !== "active" && record["status"] !== "finished") ||
    typeof record["displayedStep"] !== "number" ||
    !Array.isArray(completed) ||
    completed.some((step) => typeof step !== "number")
  ) {
    return null;
  }
  return {
    id: record["id"],
    recipeId: record["recipeId"],
    status: record["status"],
    snapshot,
    displayedStep: record["displayedStep"],
    completedSteps: completed.filter((step): step is number => typeof step === "number"),
  };
}

async function readBody(response: Response): Promise<{ message: string; session?: CookingSession }> {
  let message = "";
  let session: CookingSession | undefined;
  try {
    const body = (await response.json()) as unknown;
    const record = asRecord(body);
    if (typeof record?.["message"] === "string") {
      message = record["message"];
    }
    const parsed = parseCookingSession(record?.["session"]);
    if (parsed) {
      session = parsed;
    }
  } catch {
    // Status-only bodies stay status-only.
  }
  return { message, session };
}

function browserCookingNetwork(): CookingNetwork {
  return {
    async resume() {
      try {
        const response = await fetch("/api/sessions/active");
        if (response.status === 404) {
          return { ok: true, session: null };
        }
        const body = await readBody(response);
        if (!response.ok || !body.session) {
          return { ok: false, message: body.message || MESSAGES.apiUnavailable };
        }
        return { ok: true, session: body.session };
      } catch {
        return { ok: false, message: MESSAGES.apiUnavailable };
      }
    },

    begin(input) {
      return postSession("/api/sessions", input);
    },

    end(input) {
      return postSession(`/api/sessions/${encodeURIComponent(input.sessionId)}/finish`, {
        mutationId: input.mutationId,
      });
    },

    async send(mutation: Mutation) {
      const target = sessionMutationTarget(mutation);
      if (!target) {
        return { ok: false, kind: "permanent", message: MESSAGES.sessionStep };
      }
      try {
        const response = await fetch(target.path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(target.body),
        });
        const body = await readBody(response);
        if (response.ok) {
          return { ok: true, kind: "applied" };
        }
        const message = body.message || `Save failed (${response.status})`;
        return classifyHttpSend(response.status, message);
      } catch {
        return { ok: false, kind: "transient", message: "Could not reach the kitchen." };
      }
    },
  };
}

async function postSession(path: string, payload: unknown): Promise<CookingWrite> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await readBody(response);
    if (response.ok && body.session) {
      return { ok: true, session: body.session };
    }
    return {
      ok: false,
      message: body.message || MESSAGES.apiUnavailable,
      session: body.session,
    };
  } catch {
    return { ok: false, message: MESSAGES.apiUnavailable };
  }
}

function sessionMutationTarget(mutation: Mutation): { path: string; body: unknown } | null {
  const root = `/api/sessions/${encodeURIComponent(mutation.recipeId)}`;
  const displayed = mutation.fields["displayedStep"];
  if (typeof displayed === "number") {
    return { path: `${root}/display`, body: { mutationId: mutation.id, step: displayed } };
  }
  for (const [key, value] of Object.entries(mutation.fields)) {
    if (!key.startsWith("completed:") || typeof value !== "boolean") {
      continue;
    }
    const step = Number(key.slice("completed:".length));
    if (!Number.isInteger(step) || step < 0) {
      return null;
    }
    const action = value ? "complete" : "undo";
    return {
      path: `${root}/steps/${step}/${action}`,
      body: { mutationId: mutation.id },
    };
  }
  return null;
}

function browserCookingStream(): CookingStream {
  return {
    connect(handlers, signal) {
      if (typeof EventSource === "undefined") {
        handlers.onOffline();
        return;
      }
      const source = new EventSource("/api/recipes/events");
      const onOpen = () => handlers.onOpen();
      const onOffline = () => handlers.onOffline();
      const onSession = () => handlers.onSession();
      source.addEventListener("open", onOpen);
      source.addEventListener("error", onOffline);
      source.addEventListener("session", onSession);
      const abort = () => {
        source.removeEventListener("open", onOpen);
        source.removeEventListener("error", onOffline);
        source.removeEventListener("session", onSession);
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

function browserSessionCache(): SessionCache {
  if (typeof indexedDB === "undefined") {
    return memorySessionCache();
  }
  const store = indexedDbValue(indexedDB, "cooking-session");
  return {
    async load() {
      const parsed = parseCookingSession(await store.load());
      return parsed?.status === "active" ? parsed : null;
    },
    async save(session) {
      await store.save(session);
    },
  };
}

export function createBrowserCooking(): CookingClient {
  const storage =
    typeof indexedDB === "undefined"
      ? memoryStorage()
      : indexedDbStorage(indexedDB, "cooking-queue");
  return createCookingClient({
    storage,
    sessions: browserSessionCache(),
    lock: typeof navigator === "undefined" ? memoryLock() : webLock("cookbook-cooking-outbox"),
    network: browserCookingNetwork(),
    stream: browserCookingStream(),
    now: () => Date.now(),
    id: () => crypto.randomUUID(),
  });
}

export function createDetachedCooking(): CookingClient {
  return createCookingClient({
    storage: memoryStorage(),
    sessions: memorySessionCache(),
    lock: memoryLock(),
    network: {
      async resume() {
        return { ok: true, session: null };
      },
      async begin() {
        return { ok: false, message: MESSAGES.sessionOfflineStart };
      },
      async end() {
        return { ok: false, message: MESSAGES.sessionOfflineFinish };
      },
      async send() {
        return {
          ok: false,
          kind: "unavailable",
          message: "This screen is not connected.",
        };
      },
    },
    stream: { connect() {} },
    now: () => 0,
    id: () => "detached",
  });
}

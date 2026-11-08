import { MESSAGES, type CookingSession } from "@cookbook/shared";

import { Outbox } from "../sync/outbox";
import type { LockPort, StoragePort } from "../sync/ports";
import type { Mutation, QueueItem } from "../sync/types";

export type CookingWrite =
  | { ok: true; session: CookingSession }
  | { ok: false; message: string; session?: CookingSession };

export type CookingNetwork = {
  resume(): Promise<{ ok: true; session: CookingSession | null } | { ok: false; message: string }>;
  begin(input: { mutationId: string; recipeId: string }): Promise<CookingWrite>;
  end(input: { mutationId: string; sessionId: string }): Promise<CookingWrite>;
  send(mutation: Mutation): Promise<
    | { ok: true; kind: "applied" | "duplicate" }
    | { ok: false; kind: "transient" | "permanent" | "payload-mismatch" | "unavailable"; message: string }
  >;
};

export type CookingStream = {
  connect(
    handlers: {
      onOpen(): void;
      onSession(): void;
      onOffline(): void;
    },
    signal: AbortSignal,
  ): void;
};

export type SessionCache = {
  load(): Promise<CookingSession | null>;
  save(session: CookingSession | null): Promise<void>;
};

export function memorySessionCache(initial: CookingSession | null = null): SessionCache {
  let current = initial ? structuredClone(initial) : null;
  return {
    async load() {
      return current ? structuredClone(current) : null;
    },
    async save(next) {
      current = next && next.status === "active" ? structuredClone(next) : null;
    },
  };
}

export type CookingPorts = {
  storage: StoragePort;
  sessions: SessionCache;
  lock: LockPort;
  network: CookingNetwork;
  stream: CookingStream;
  now: () => number;
  id: () => string;
  schedule?: (delayMs: number, run: () => void) => () => void;
};

export type CookingClient = {
  open(): Promise<void>;
  close(): void;
  subscribe(listener: () => void): () => void;
  view(): CookingSession | null;
  error(): string | null;
  setConnected(online: boolean): void;
  begin(recipeId: string): Promise<void>;
  end(): Promise<void>;
  show(step: number): Promise<void>;
  completeDisplayed(): Promise<void>;
  undoDisplayed(): Promise<void>;
};

export function overlaySession(
  session: CookingSession,
  items: readonly QueueItem[],
): CookingSession {
  let displayedStep = session.displayedStep;
  const completed = new Set(session.completedSteps);
  for (const item of items) {
    if (item.status === "failed" || item.mutation.recipeId !== session.id) {
      continue;
    }
    const displayed = item.mutation.fields["displayedStep"];
    if (typeof displayed === "number") {
      displayedStep = displayed;
    }
    for (const [key, value] of Object.entries(item.mutation.fields)) {
      if (!key.startsWith("completed:")) {
        continue;
      }
      const step = Number(key.slice("completed:".length));
      if (!Number.isInteger(step)) {
        continue;
      }
      if (value === true) {
        completed.add(step);
      } else {
        completed.delete(step);
      }
    }
  }
  return {
    ...session,
    snapshot: {
      ...session.snapshot,
      ingredients: [...session.snapshot.ingredients],
      steps: [...session.snapshot.steps],
    },
    displayedStep,
    completedSteps: [...completed].sort((left, right) => left - right),
  };
}

export function createCookingClient(ports: CookingPorts): CookingClient {
  const outbox = new Outbox({
    storage: ports.storage,
    network: {
      async send(mutation) {
        const result = await ports.network.send(mutation);
        if (result.ok) {
          await refresh({ quiet: true });
        }
        return result;
      },
    },
    lock: ports.lock,
    now: ports.now,
  });
  const listeners = new Set<() => void>();
  let session: CookingSession | null = null;
  let commandError: string | null = null;
  let online = true;
  let ending = false;
  let opened = false;
  let abort: AbortController | undefined;
  let beginFlight: { recipeId: string; promise: Promise<void> } | null = null;
  let refreshGeneration = 0;
  let finishedId: string | null = null;
  let cancelRetry: (() => void) | undefined;
  const schedule =
    ports.schedule ??
    ((delayMs, run) => {
      const timer = setTimeout(run, delayMs);
      return () => clearTimeout(timer);
    });

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function view(): CookingSession | null {
    if (!session || session.status !== "active") {
      return null;
    }
    return overlaySession(session, outbox.snapshot());
  }

  function error(): string | null {
    const failed = outbox.snapshot().find((item) => item.status === "failed");
    return commandError ?? failed?.failure?.message ?? null;
  }

  function bumpRefresh(): void {
    refreshGeneration += 1;
  }

  function clearRetry(): void {
    cancelRetry?.();
    cancelRetry = undefined;
  }

  function armRetry(): void {
    clearRetry();
    if (!online) {
      return;
    }
    const wake = outbox.nextRetryAt();
    if (wake === undefined) {
      return;
    }
    cancelRetry = schedule(Math.max(0, wake - ports.now()), () => {
      cancelRetry = undefined;
      if (!online) {
        return;
      }
      void outbox.drain().then(() => {
        armRetry();
        emit();
      });
    });
  }

  async function remember(next: CookingSession | null): Promise<void> {
    session = next && next.status === "active" ? next : null;
    await ports.sessions.save(session);
  }

  async function hydrate(): Promise<void> {
    const cached = await ports.sessions.load();
    if (cached?.status === "active") {
      session = cached;
    }
    await outbox.hydrate();
  }

  async function refresh(options: { quiet: boolean }): Promise<void> {
    const generation = (refreshGeneration += 1);
    const result = await ports.network.resume();
    if (generation !== refreshGeneration) {
      return;
    }
    if (!result.ok) {
      if (!options.quiet) {
        commandError = result.message;
      }
      emit();
      return;
    }
    if (result.session?.status === "active") {
      if (finishedId && result.session.id === finishedId) {
        emit();
        return;
      }
      finishedId = null;
      await remember(result.session);
      emit();
      return;
    }
    if (session && !ending) {
      commandError = MESSAGES.sessionEnded;
    }
    await remember(null);
    emit();
  }

  async function syncOnline(): Promise<void> {
    if (!online) {
      emit();
      return;
    }
    await outbox.drain();
    armRetry();
    emit();
  }

  async function enqueue(mutation: Mutation): Promise<void> {
    await outbox.enqueue(mutation);
    emit();
    await syncOnline();
  }

  const client: CookingClient = {
    async open() {
      if (!opened) {
        opened = true;
        abort = new AbortController();
        ports.stream.connect(
          {
            onOpen() {
              online = true;
              void refresh({ quiet: true }).then(() => syncOnline());
            },
            onSession() {
              void refresh({ quiet: true });
            },
            onOffline() {
              online = false;
              clearRetry();
              emit();
            },
          },
          abort.signal,
        );
      }
      await hydrate();
      emit();
      await refresh({ quiet: true });
      await syncOnline();
    },

    close() {
      clearRetry();
      abort?.abort();
      abort = undefined;
      opened = false;
    },

    subscribe(listener) {
      listeners.add(listener);
      const stopOutbox = outbox.subscribe(() => emit());
      return () => {
        listeners.delete(listener);
        stopOutbox();
      };
    },

    view,
    error,

    setConnected(next) {
      online = next;
      if (!next) {
        clearRetry();
        emit();
        return;
      }
      void syncOnline();
    },

    async begin(recipeId) {
      if (session?.status === "active" && session.recipeId === recipeId) {
        commandError = null;
        emit();
        return;
      }
      if (beginFlight?.recipeId === recipeId) {
        return beginFlight.promise;
      }
      const promise = beginOnce(recipeId);
      beginFlight = { recipeId, promise };
      try {
        await promise;
      } finally {
        if (beginFlight?.promise === promise) {
          beginFlight = null;
        }
      }
    },

    async end() {
      if (!online) {
        commandError = MESSAGES.sessionOfflineFinish;
        emit();
        return;
      }
      if (!session || session.status !== "active") {
        commandError = MESSAGES.sessionMissing;
        emit();
        return;
      }
      const finishingId = session.id;
      ending = true;
      bumpRefresh();
      const result = await ports.network.end({
        mutationId: ports.id(),
        sessionId: finishingId,
      });
      bumpRefresh();
      ending = false;
      if (!result.ok) {
        commandError = result.message;
        if (result.session?.status === "finished") {
          finishedId = result.session.id;
          await remember(null);
        }
        emit();
        return;
      }
      if (result.session.status === "active") {
        finishedId = null;
        await remember(result.session);
      } else {
        finishedId = finishingId;
        await remember(null);
      }
      commandError = null;
      emit();
    },

    async show(step) {
      const current = view();
      if (!current) {
        commandError = MESSAGES.sessionMissing;
        emit();
        return;
      }
      if (step === current.displayedStep) {
        return;
      }
      if (!Number.isInteger(step) || step < 0 || step >= current.snapshot.steps.length) {
        commandError = MESSAGES.sessionStep;
        emit();
        return;
      }
      commandError = null;
      await enqueue({
        id: ports.id(),
        recipeId: current.id,
        fields: { displayedStep: step },
      });
    },

    completeDisplayed() {
      return changeDisplayed(true);
    },

    undoDisplayed() {
      return changeDisplayed(false);
    },
  };

  async function beginOnce(recipeId: string): Promise<void> {
    if (!online) {
      commandError = MESSAGES.sessionOfflineStart;
      emit();
      return;
    }
    bumpRefresh();
    const result = await ports.network.begin({
      mutationId: ports.id(),
      recipeId,
    });
    bumpRefresh();
    if (!result.ok) {
      commandError = result.message;
      if (result.session?.status === "active") {
        finishedId = null;
        await remember(result.session);
      }
      emit();
      return;
    }
    if (result.session.status === "active") {
      finishedId = null;
      await remember(result.session);
      commandError = null;
    } else {
      finishedId = result.session.id;
      await remember(null);
      commandError = MESSAGES.sessionEnded;
    }
    emit();
  }

  async function changeDisplayed(complete: boolean): Promise<void> {
    const current = view();
    if (!current) {
      commandError = MESSAGES.sessionMissing;
      emit();
      return;
    }
    commandError = null;
    await enqueue({
      id: ports.id(),
      recipeId: current.id,
      fields: { [`completed:${current.displayedStep}`]: complete },
    });
  }

  return client;
}

import type { Mutation, OutboxCounts, QueueItem } from "./types";

export type SendResult =
  | { ok: true; kind: "applied" | "duplicate" }
  | {
      ok: false;
      kind: "transient" | "permanent" | "payload-mismatch" | "unavailable";
      message: string;
    };

export type StoragePort = {
  load(): Promise<QueueItem[]>;
  save(items: QueueItem[]): Promise<void>;
};

export type NetworkPort = {
  send(mutation: Mutation): Promise<SendResult>;
};

export type LockPort = {
  withLock<T>(fn: () => Promise<T>): Promise<T>;
};

export type OutboxPorts = {
  storage: StoragePort;
  network: NetworkPort;
  lock: LockPort;
  now: () => number;
};

export function memoryStorage(initial: QueueItem[] = []): StoragePort {
  let items = initial.map((item) => ({ ...item }));
  return {
    async load() {
      return items.map((item) => ({ ...item }));
    },
    async save(next) {
      items = next.map((item) => ({ ...item }));
    },
  };
}

export function memoryLock(): LockPort {
  let chain: Promise<unknown> = Promise.resolve();
  return {
    withLock(fn) {
      const run = chain.then(fn, fn);
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}

export type { OutboxCounts };

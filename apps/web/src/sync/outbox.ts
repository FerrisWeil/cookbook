import {
  acknowledge,
  enqueue,
  markFailed,
  markInflight,
  nextSendable,
  prune,
  scheduleRetry,
} from "./queue";
import { backoffMs, classifySendResult } from "./retry";
import type { LockPort, NetworkPort, OutboxPorts, StoragePort } from "./ports";
import type { Mutation, OutboxCounts, QueueItem } from "./types";

export class Outbox {
  private readonly storage: StoragePort;
  private readonly network: NetworkPort;
  private readonly lock: LockPort;
  private readonly now: () => number;
  private items: QueueItem[] = [];
  private loaded = false;
  private readonly listeners = new Set<() => void>();

  constructor(ports: OutboxPorts) {
    this.storage = ports.storage;
    this.network = ports.network;
    this.lock = ports.lock;
    this.now = ports.now;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  status(): OutboxCounts {
    let pending = 0;
    let failed = 0;
    for (const item of this.items) {
      if (item.status === "failed") {
        failed += 1;
      } else {
        pending += 1;
      }
    }
    return { pending, failed };
  }

  snapshot(): QueueItem[] {
    return this.items.map((item) => ({ ...item }));
  }

  async enqueue(mutation: Mutation): Promise<void> {
    await this.lock.withLock(async () => {
      await this.ensureLoaded();
      this.items = enqueue(this.items, mutation);
      await this.persist();
    });
    this.emit();
  }

  async drain(): Promise<void> {
    await this.lock.withLock(async () => {
      await this.ensureLoaded();
      for (;;) {
        this.items = prune(this.items);
        const next = nextSendable(this.items, this.now());
        if (!next) {
          await this.persist();
          return;
        }
        this.items = markInflight(this.items, next.mutation.id);
        await this.persist();
        const result = await this.network.send(next.mutation);
        const classified = classifySendResult(result);
        if (classified === "success") {
          this.items = acknowledge(this.items, next.mutation.id);
          continue;
        }
        if (classified === "wait") {
          this.items = scheduleRetry(
            this.items,
            next.mutation.id,
            this.now() + backoffMs(next.attempts),
          );
          await this.persist();
          return;
        }
        if (classified === "transient") {
          this.items = scheduleRetry(
            this.items,
            next.mutation.id,
            this.now() + backoffMs(next.attempts),
          );
          await this.persist();
          return;
        }
        this.items = markFailed(this.items, next.mutation.id, {
          kind: "permanent",
          message: result.ok ? "rejected" : result.message,
        });
        await this.persist();
      }
    });
    this.emit();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.items = prune(await this.storage.load());
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await this.storage.save(this.items);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

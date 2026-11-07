import type { Mutation, QueueFailure, QueueItem } from "./types";

export type { QueueItem };

function fieldKeys(mutation: Mutation): string[] {
  return Object.keys(mutation.fields);
}

export function supersededIds(items: readonly QueueItem[]): Set<string> {
  const drop = new Set<string>();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || item.status === "inflight") {
      continue;
    }
    const keys = fieldKeys(item.mutation);
    if (keys.length === 0) {
      drop.add(item.mutation.id);
      continue;
    }
    const later = items.slice(index + 1);
    const covered = keys.every((key) =>
      later.some((candidate) => key in candidate.mutation.fields),
    );
    if (covered) {
      drop.add(item.mutation.id);
    }
  }
  return drop;
}

export function prune(items: readonly QueueItem[]): QueueItem[] {
  const drop = supersededIds(items);
  return items.filter((item) => !drop.has(item.mutation.id));
}

export function enqueue(
  items: readonly QueueItem[],
  mutation: Mutation,
): QueueItem[] {
  return prune([
    ...items,
    { mutation, status: "queued", attempts: 0 },
  ]);
}

export function acknowledge(
  items: readonly QueueItem[],
  mutationId: string,
): QueueItem[] {
  const drop = supersededIds(items);
  return items.filter(
    (item) => item.mutation.id !== mutationId && !drop.has(item.mutation.id),
  );
}

export function markInflight(
  items: readonly QueueItem[],
  mutationId: string,
): QueueItem[] {
  return items.map((item) =>
    item.mutation.id === mutationId
      ? { ...item, status: "inflight", failure: undefined }
      : item,
  );
}

export function markFailed(
  items: readonly QueueItem[],
  mutationId: string,
  failure: QueueFailure,
): QueueItem[] {
  return items.map((item) =>
    item.mutation.id === mutationId
      ? { ...item, status: "failed", failure }
      : item,
  );
}

export function scheduleRetry(
  items: readonly QueueItem[],
  mutationId: string,
  nextAttemptAt: number,
): QueueItem[] {
  return items.map((item) => {
    if (item.mutation.id !== mutationId) {
      return item;
    }
    return {
      mutation: item.mutation,
      status: "queued" as const,
      attempts: item.attempts + 1,
      nextAttemptAt,
      failure: { kind: "transient" as const, message: item.failure?.message ?? "" },
    };
  });
}

export function nextSendable(
  items: readonly QueueItem[],
  now: number,
): QueueItem | undefined {
  const drop = supersededIds(items);
  return items.find((item) => {
    if (drop.has(item.mutation.id)) {
      return false;
    }
    if (item.status === "failed") {
      return false;
    }
    if (item.status === "inflight") {
      return true;
    }
    if (item.status !== "queued") {
      return false;
    }
    return (item.nextAttemptAt ?? 0) <= now;
  });
}

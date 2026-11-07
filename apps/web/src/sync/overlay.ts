import type { FieldPatch, JsonValue, Mutation } from "./types";

function cloneJson<T extends JsonValue>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneJson(item)) as T;
  }
  const copy: { [key: string]: JsonValue } = {};
  for (const [key, item] of Object.entries(value)) {
    copy[key] = cloneJson(item);
  }
  return copy as T;
}

function applyPatch<T extends Record<string, JsonValue>>(
  base: T,
  fields: FieldPatch,
): T {
  const next: { [key: string]: JsonValue } = { ...base };
  for (const [key, value] of Object.entries(fields)) {
    next[key] = cloneJson(value);
  }
  return next as T;
}

export function overlayRecord<T extends Record<string, JsonValue>>(
  snapshot: T,
  pending: readonly Mutation[],
  draft: FieldPatch | null,
): T {
  let next = applyPatch(snapshot, {});
  for (const mutation of pending) {
    next = applyPatch(next, mutation.fields);
  }
  if (draft) {
    next = applyPatch(next, draft);
  }
  return next;
}

export function overlayRecipe<T extends Record<string, JsonValue>>(
  snapshot: T,
  pending: readonly Mutation[],
  draft: FieldPatch | null,
): T {
  return overlayRecord(snapshot, pending, draft);
}

export function overlayList<T extends { id: string; title: string }>(
  items: readonly T[],
  pending: readonly Mutation[],
): T[] {
  return items.map((item) => {
    const forRow = pending.filter((mutation) => mutation.recipeId === item.id);
    if (forRow.length === 0) {
      return item;
    }
    const overlaid = overlayRecord(
      { title: item.title },
      forRow,
      null,
    );
    return { ...item, title: overlaid.title };
  });
}

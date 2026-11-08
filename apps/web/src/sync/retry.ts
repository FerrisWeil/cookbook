import type { SendResult } from "./ports";
import type { FailureKind } from "./types";

const MAX_BACKOFF_MS = 30_000;

export function backoffMs(attempts: number): number {
  const step = Math.max(0, attempts);
  return Math.min(1000 * 2 ** step, MAX_BACKOFF_MS);
}

export function classifySendResult(result: SendResult): FailureKind | "success" | "wait" {
  if (result.ok) {
    return "success";
  }
  if (result.kind === "unavailable") {
    return "wait";
  }
  if (result.kind === "transient") {
    return "transient";
  }
  return "permanent";
}

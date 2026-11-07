export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

export type FieldPatch = { readonly [key: string]: JsonValue };

export type Mutation = {
  readonly id: string;
  readonly recipeId: string;
  readonly fields: FieldPatch;
};

export type FailureKind = "transient" | "permanent";

export type QueueFailure = {
  readonly kind: FailureKind;
  readonly message: string;
};

export type QueueStatus = "queued" | "inflight" | "failed";

export type QueueItem = {
  readonly mutation: Mutation;
  readonly status: QueueStatus;
  readonly attempts: number;
  readonly nextAttemptAt?: number;
  readonly failure?: QueueFailure;
};

export type OutboxCounts = {
  readonly pending: number;
  readonly failed: number;
};

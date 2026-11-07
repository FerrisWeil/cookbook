import type { SqlClient } from "./migrate.js";

export type MutationAckInput = {
  mutationId: string;
  payloadFingerprint: string;
  recipeId: string;
};

export type MutationAckResult =
  | { kind: "applied" }
  | { kind: "duplicate" };

export class MutationAckError extends Error {
  readonly code = "payload_mismatch" as const;

  constructor() {
    super("That mutation id was already used with a different payload.");
    this.name = "MutationAckError";
  }
}

/**
 * Caller must pass a client already inside the effect's transaction.
 * `apply` must use that same client so the write and ack commit or roll back
 * together. `SELECT ... FOR UPDATE` serializes concurrent acks for one id.
 */
export async function applyWithAck(
  client: SqlClient,
  input: MutationAckInput,
  apply: () => Promise<void>,
): Promise<MutationAckResult> {
  const existing = await client.query(
    `SELECT payload_fingerprint
     FROM recipe_mutation_acks
     WHERE mutation_id = $1
     FOR UPDATE`,
    [input.mutationId],
  );
  const row = existing.rows[0] as { payload_fingerprint?: unknown } | undefined;
  if (row) {
    if (row.payload_fingerprint === input.payloadFingerprint) {
      return { kind: "duplicate" };
    }
    throw new MutationAckError();
  }
  await apply();
  await client.query(
    `INSERT INTO recipe_mutation_acks (
       mutation_id, payload_fingerprint, recipe_id
     ) VALUES ($1, $2, $3)`,
    [input.mutationId, input.payloadFingerprint, input.recipeId],
  );
  return { kind: "applied" };
}

export function canonicalFingerprint(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalFingerprint).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalFingerprint(record[key])}`)
    .join(",")}}`;
}

import { randomUUID } from "node:crypto";

import { MESSAGES, type CookingSession, type CookingSnapshot } from "@cookbook/shared";

import type { ReleasableClient, SqlClient } from "../migrate.js";
import {
  activeSession,
  applyCommand,
  classifyStart,
  cloneSession,
  parseMutationId,
  parseRecipeId,
  parseSessionId,
  parseSnapshot,
  parseStep,
  type SessionAck,
  type SessionState,
} from "./domain.js";
import { SessionError } from "./error.js";
import type {
  FinishSessionInput,
  SessionStore,
  StartSessionInput,
  StepSessionInput,
} from "./types.js";

const LOCK_KEY = "cookbook-cooking-session";

const SESSION_COLUMNS = `
  id, recipe_id, status, title, servings, ingredients, steps,
  displayed_step, completed_steps
`;

async function transaction<T>(
  checkout: () => Promise<ReleasableClient>,
  fn: (client: SqlClient) => Promise<T>,
): Promise<T> {
  const client = await checkout();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original failure is the one callers need.
    }
    throw error;
  } finally {
    client.release();
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") {
    throw new Error(`cooking session ${label} is unreadable`);
  }
  return value;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("cooking session snapshot is unreadable");
  }
  return [...value];
}

function asServings(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error("cooking session snapshot is unreadable");
  }
  return number;
}

function asSteps(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new Error("cooking session progress is unreadable");
  }
  return value.map((item) => {
    const number = typeof item === "number" ? item : Number(item);
    if (!Number.isInteger(number)) {
      throw new Error("cooking session progress is unreadable");
    }
    return number;
  });
}

function rowToSession(row: Record<string, unknown>): CookingSession {
  const status = row["status"];
  if (status !== "active" && status !== "finished") {
    throw new Error("cooking session status is unreadable");
  }
  const snapshot: CookingSnapshot = {
    title: asString(row["title"], "title"),
    servings: asServings(row["servings"]),
    ingredients: asStringList(row["ingredients"]),
    steps: asStringList(row["steps"]),
  };
  const displayed = row["displayed_step"];
  if (typeof displayed !== "number" || !Number.isInteger(displayed) || displayed < 0) {
    throw new Error("cooking session progress is unreadable");
  }
  return {
    id: asString(row["id"], "id"),
    recipeId: asString(row["recipe_id"], "recipe"),
    status,
    snapshot,
    displayedStep: displayed,
    completedSteps: asSteps(row["completed_steps"]),
  };
}

async function loadState(client: SqlClient): Promise<SessionState> {
  const sessions = await client.query(
    `SELECT ${SESSION_COLUMNS} FROM cooking_sessions ORDER BY id`,
  );
  const acks = await client.query(
    `SELECT mutation_id, payload_fingerprint, session_id
     FROM session_mutation_acks`,
  );
  return {
    sessions: sessions.rows.map((row) => rowToSession(row)),
    acks: acks.rows.map((row) => ({
      mutationId: asString(row["mutation_id"], "ack"),
      fingerprint: asString(row["payload_fingerprint"], "ack"),
      sessionId: asString(row["session_id"], "ack"),
    })),
  };
}

async function insertSession(client: SqlClient, session: CookingSession): Promise<void> {
  await client.query(
    `INSERT INTO cooking_sessions (
       id, recipe_id, status, title, servings, ingredients, steps,
       displayed_step, completed_steps
     ) VALUES (
       $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9
     )`,
    [
      session.id,
      session.recipeId,
      session.status,
      session.snapshot.title,
      session.snapshot.servings,
      JSON.stringify(session.snapshot.ingredients),
      JSON.stringify(session.snapshot.steps),
      session.displayedStep,
      session.completedSteps,
    ],
  );
}

async function updateSession(client: SqlClient, session: CookingSession): Promise<void> {
  await client.query(
    `UPDATE cooking_sessions
     SET status = $2,
         displayed_step = $3,
         completed_steps = $4
     WHERE id = $1`,
    [session.id, session.status, session.displayedStep, session.completedSteps],
  );
}

async function insertAck(client: SqlClient, ack: SessionAck): Promise<void> {
  await client.query(
    `INSERT INTO session_mutation_acks (
       mutation_id, payload_fingerprint, session_id
     ) VALUES ($1, $2, $3)`,
    [ack.mutationId, ack.fingerprint, ack.sessionId],
  );
}

async function persist(
  client: SqlClient,
  before: SessionState,
  after: SessionState,
): Promise<void> {
  const previous = new Map(before.sessions.map((session) => [session.id, session]));
  for (const session of after.sessions) {
    const prior = previous.get(session.id);
    if (!prior) {
      await insertSession(client, session);
      continue;
    }
    if (
      prior.status !== session.status ||
      prior.displayedStep !== session.displayedStep ||
      prior.completedSteps.join(",") !== session.completedSteps.join(",")
    ) {
      await updateSession(client, session);
    }
  }
  const known = new Set(before.acks.map((ack) => ack.mutationId));
  for (const ack of after.acks) {
    if (!known.has(ack.mutationId)) {
      await insertAck(client, ack);
    }
  }
}

export function createPgSessionStore(
  checkout: () => Promise<ReleasableClient>,
): SessionStore {
  async function locked<T>(fn: (client: SqlClient, state: SessionState) => Promise<T>): Promise<T> {
    try {
      return await transaction(checkout, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
          LOCK_KEY,
        ]);
        const state = await loadState(client);
        return fn(client, state);
      });
    } catch (error) {
      if (error instanceof SessionError) {
        throw error;
      }
      if (isUniqueViolation(error)) {
        throw new SessionError("active", MESSAGES.sessionActive);
      }
      throw error;
    }
  }

  return {
    async resume() {
      const client = await checkout();
      try {
        const result = await client.query(
          `SELECT ${SESSION_COLUMNS} FROM cooking_sessions WHERE status = 'active'`,
        );
        const row = result.rows[0];
        return row ? rowToSession(row) : null;
      } finally {
        client.release();
      }
    },

    async start(input: StartSessionInput) {
      const mutationId = parseMutationId(input.mutationId);
      const recipeId = parseRecipeId(input.recipeId);
      return locked(async (client, state) => {
        const plan = classifyStart(state, mutationId, recipeId);
        if (plan.kind === "session") {
          return plan.session;
        }
        const snapshot = parseSnapshot(await input.loadSnapshot());
        const result = applyCommand(state, {
          op: "start",
          mutationId,
          recipeId,
          snapshot,
          sessionId: randomUUID(),
        });
        await persist(client, state, result.state);
        return result.session;
      });
    },

    finish(input: FinishSessionInput) {
      return writeStep(input, "finish");
    },

    complete(input: StepSessionInput) {
      return writeStep(input, "complete");
    },

    undo(input: StepSessionInput) {
      return writeStep(input, "undo");
    },

    display(input: StepSessionInput) {
      return writeStep(input, "display");
    },
  };

  function writeStep(
    input: FinishSessionInput | StepSessionInput,
    op: "finish" | "complete" | "undo" | "display",
  ): Promise<CookingSession> {
    const mutationId = parseMutationId(input.mutationId);
    const sessionId = parseSessionId(input.sessionId);
    const step = op === "finish" ? 0 : parseStep("step" in input ? input.step : undefined);
    return locked(async (client, state) => {
      const result = applyCommand(
        state,
        op === "finish"
          ? { op, mutationId, sessionId }
          : { op, mutationId, sessionId, step },
      );
      await persist(client, state, result.state);
      return cloneSession(result.session);
    });
  }
}

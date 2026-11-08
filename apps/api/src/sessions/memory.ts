import { randomUUID } from "node:crypto";

import type { CookingSession } from "@cookbook/shared";

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
  type SessionState,
} from "./domain.js";
import type {
  FinishSessionInput,
  SessionStore,
  StartSessionInput,
  StepSessionInput,
} from "./types.js";

export class MemorySessionStore implements SessionStore {
  private state: SessionState = { sessions: [], acks: [] };
  private queue: Promise<unknown> = Promise.resolve();

  resume(): Promise<CookingSession | null> {
    return this.run(async () => {
      const active = activeSession(this.state);
      return active ? cloneSession(active) : null;
    });
  }

  start(input: StartSessionInput): Promise<CookingSession> {
    const mutationId = parseMutationId(input.mutationId);
    const recipeId = parseRecipeId(input.recipeId);
    return this.run(async () => {
      const plan = classifyStart(this.state, mutationId, recipeId);
      if (plan.kind === "session") {
        return plan.session;
      }
      const snapshot = parseSnapshot(await input.loadSnapshot());
      const result = applyCommand(this.state, {
        op: "start",
        mutationId,
        recipeId,
        snapshot,
        sessionId: randomUUID(),
      });
      this.state = result.state;
      return result.session;
    });
  }

  finish(input: FinishSessionInput): Promise<CookingSession> {
    return this.stepCommand(input, "finish");
  }

  complete(input: StepSessionInput): Promise<CookingSession> {
    return this.stepCommand(input, "complete");
  }

  undo(input: StepSessionInput): Promise<CookingSession> {
    return this.stepCommand(input, "undo");
  }

  display(input: StepSessionInput): Promise<CookingSession> {
    return this.stepCommand(input, "display");
  }

  private stepCommand(
    input: FinishSessionInput | StepSessionInput,
    op: "finish" | "complete" | "undo" | "display",
  ): Promise<CookingSession> {
    const mutationId = parseMutationId(input.mutationId);
    const sessionId = parseSessionId(input.sessionId);
    const step = op === "finish" ? 0 : parseStep("step" in input ? input.step : undefined);
    return this.run(async () => {
      const result = applyCommand(
        this.state,
        op === "finish"
          ? { op, mutationId, sessionId }
          : { op, mutationId, sessionId, step },
      );
      this.state = result.state;
      return result.session;
    });
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export function createMemorySessionStore(): SessionStore {
  return new MemorySessionStore();
}

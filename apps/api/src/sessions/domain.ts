import { MESSAGES, type CookingSession, type CookingSnapshot } from "@cookbook/shared";

import { canonicalFingerprint } from "../mutations.js";
import { SessionError } from "./error.js";

export type SessionAck = {
  mutationId: string;
  fingerprint: string;
  sessionId: string;
};

export type SessionState = {
  sessions: CookingSession[];
  acks: SessionAck[];
};

export type SessionCommand =
  | {
      op: "start";
      mutationId: string;
      recipeId: string;
      snapshot: CookingSnapshot;
      sessionId: string;
    }
  | { op: "finish"; mutationId: string; sessionId: string }
  | { op: "complete"; mutationId: string; sessionId: string; step: number }
  | { op: "undo"; mutationId: string; sessionId: string; step: number }
  | { op: "display"; mutationId: string; sessionId: string; step: number };

export type ApplyResult = {
  state: SessionState;
  session: CookingSession;
};

export function parseMutationId(value: unknown): string {
  if (typeof value !== "string") {
    throw new SessionError("invalid", MESSAGES.sessionMutation);
  }
  const id = value.trim();
  if (id === "" || id.length > 256) {
    throw new SessionError("invalid", MESSAGES.sessionMutation);
  }
  return id;
}

export function parseRecipeId(value: unknown): string {
  return parseId(value, MESSAGES.sessionRecipe);
}

export function parseSessionId(value: unknown): string {
  return parseId(value, MESSAGES.sessionId);
}

function parseId(value: unknown, message: string): string {
  if (typeof value !== "string") {
    throw new SessionError("invalid", message);
  }
  const id = value.trim();
  if (id === "" || id.length > 256) {
    throw new SessionError("invalid", message);
  }
  return id;
}

export function parseStep(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new SessionError("invalid", MESSAGES.sessionStep);
  }
  return value;
}

export function parseSnapshot(value: CookingSnapshot): CookingSnapshot {
  const title = value.title.trim();
  if (title === "") {
    throw new SessionError("invalid", MESSAGES.titleRequired);
  }
  if (!Number.isFinite(value.servings) || value.servings <= 0) {
    throw new SessionError("invalid", MESSAGES.servingsRequired);
  }
  if (
    !Array.isArray(value.steps) ||
    value.steps.length === 0 ||
    value.steps.some((step) => typeof step !== "string" || step.trim() === "")
  ) {
    throw new SessionError("invalid", MESSAGES.stepsRequired);
  }
  if (
    !Array.isArray(value.ingredients) ||
    value.ingredients.some((line) => typeof line !== "string")
  ) {
    throw new SessionError("invalid", MESSAGES.sessionRecipe);
  }
  return {
    title,
    servings: value.servings,
    ingredients: [...value.ingredients],
    steps: [...value.steps],
  };
}

export function commandFingerprint(command: SessionCommand): string {
  if (command.op === "start") {
    return canonicalFingerprint({ op: "start", recipeId: command.recipeId });
  }
  if (command.op === "finish") {
    return canonicalFingerprint({ op: "finish", sessionId: command.sessionId });
  }
  return canonicalFingerprint({
    op: command.op,
    sessionId: command.sessionId,
    step: command.step,
  });
}

export function activeSession(state: SessionState): CookingSession | null {
  return state.sessions.find((session) => session.status === "active") ?? null;
}

export function classifyStart(
  state: SessionState,
  mutationId: string,
  recipeId: string,
): { kind: "create" } | { kind: "session"; session: CookingSession } {
  const fingerprint = canonicalFingerprint({ op: "start", recipeId });
  const ack = state.acks.find((item) => item.mutationId === mutationId);
  if (ack) {
    if (ack.fingerprint !== fingerprint) {
      throw new SessionError("mismatch", MESSAGES.sessionPayload);
    }
    const session = state.sessions.find((item) => item.id === ack.sessionId);
    if (!session || session.status !== "active") {
      throw new SessionError(
        "ended",
        MESSAGES.sessionEnded,
        session ? cloneSession(session) : undefined,
      );
    }
    return { kind: "session", session: cloneSession(session) };
  }
  const active = activeSession(state);
  if (active) {
    throw new SessionError("active", MESSAGES.sessionActive, cloneSession(active));
  }
  return { kind: "create" };
}

export function applyCommand(
  state: SessionState,
  command: SessionCommand,
): ApplyResult {
  const fingerprint = commandFingerprint(command);
  const ack = state.acks.find((item) => item.mutationId === command.mutationId);
  if (ack) {
    if (ack.fingerprint !== fingerprint) {
      throw new SessionError("mismatch", MESSAGES.sessionPayload);
    }
    const session = state.sessions.find((item) => item.id === ack.sessionId);
    if (!session) {
      throw new SessionError("ended", MESSAGES.sessionEnded);
    }
    if (command.op === "start" && session.status !== "active") {
      throw new SessionError("ended", MESSAGES.sessionEnded, cloneSession(session));
    }
    return { state, session: cloneSession(session) };
  }

  if (command.op === "start") {
    const active = activeSession(state);
    if (active) {
      throw new SessionError("active", MESSAGES.sessionActive, cloneSession(active));
    }
    const snapshot = parseSnapshot(command.snapshot);
    const session: CookingSession = {
      id: command.sessionId,
      recipeId: command.recipeId,
      status: "active",
      snapshot,
      displayedStep: 0,
      completedSteps: [],
    };
    return {
      state: append(state, session, command.mutationId, fingerprint),
      session: cloneSession(session),
    };
  }

  const current = state.sessions.find((item) => item.id === command.sessionId);
  if (!current) {
    throw new SessionError("not_found", MESSAGES.sessionNotFound);
  }
  if (current.status !== "active") {
    throw new SessionError("ended", MESSAGES.sessionEnded, cloneSession(current));
  }

  const next = cloneSession(current);
  if (command.op === "finish") {
    next.status = "finished";
  } else {
    assertStep(next, command.step);
    if (command.op === "display") {
      next.displayedStep = command.step;
    } else if (command.op === "complete") {
      next.completedSteps = sortedUnique([...next.completedSteps, command.step]);
    } else {
      next.completedSteps = next.completedSteps.filter((step) => step !== command.step);
    }
  }

  return {
    state: replace(state, next, command.mutationId, fingerprint),
    session: cloneSession(next),
  };
}

function assertStep(session: CookingSession, step: number): void {
  if (!Number.isInteger(step) || step < 0 || step >= session.snapshot.steps.length) {
    throw new SessionError("invalid", MESSAGES.sessionStep);
  }
}

function sortedUnique(steps: number[]): number[] {
  return [...new Set(steps)].sort((left, right) => left - right);
}

function append(
  state: SessionState,
  session: CookingSession,
  mutationId: string,
  fingerprint: string,
): SessionState {
  return {
    sessions: [...state.sessions.map(cloneSession), cloneSession(session)],
    acks: [
      ...state.acks.map((ack) => ({ ...ack })),
      { mutationId, fingerprint, sessionId: session.id },
    ],
  };
}

function replace(
  state: SessionState,
  session: CookingSession,
  mutationId: string,
  fingerprint: string,
): SessionState {
  return {
    sessions: state.sessions.map((item) =>
      item.id === session.id ? cloneSession(session) : cloneSession(item),
    ),
    acks: [
      ...state.acks.map((ack) => ({ ...ack })),
      { mutationId, fingerprint, sessionId: session.id },
    ],
  };
}

export function cloneSession(session: CookingSession): CookingSession {
  return {
    id: session.id,
    recipeId: session.recipeId,
    status: session.status,
    snapshot: {
      title: session.snapshot.title,
      servings: session.snapshot.servings,
      ingredients: [...session.snapshot.ingredients],
      steps: [...session.snapshot.steps],
    },
    displayedStep: session.displayedStep,
    completedSteps: [...session.completedSteps],
  };
}

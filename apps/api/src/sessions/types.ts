import type { CookingSession, CookingSnapshot } from "@cookbook/shared";

export type StartSessionInput = {
  mutationId: unknown;
  recipeId: unknown;
  loadSnapshot: () => Promise<CookingSnapshot>;
};

export type FinishSessionInput = {
  mutationId: unknown;
  sessionId: unknown;
};

export type StepSessionInput = {
  mutationId: unknown;
  sessionId: unknown;
  step: unknown;
};

export type SessionStore = {
  resume(): Promise<CookingSession | null>;
  start(input: StartSessionInput): Promise<CookingSession>;
  finish(input: FinishSessionInput): Promise<CookingSession>;
  complete(input: StepSessionInput): Promise<CookingSession>;
  undo(input: StepSessionInput): Promise<CookingSession>;
  display(input: StepSessionInput): Promise<CookingSession>;
};

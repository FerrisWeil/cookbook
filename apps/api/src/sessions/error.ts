import type { CookingSession } from "@cookbook/shared";

export type SessionErrorCode =
  | "not_found"
  | "invalid"
  | "active"
  | "ended"
  | "mismatch";

export class SessionError extends Error {
  readonly code: SessionErrorCode;
  readonly session?: CookingSession;

  constructor(
    code: SessionErrorCode,
    message: string,
    session?: CookingSession,
  ) {
    super(message);
    this.name = "SessionError";
    this.code = code;
    this.session = session;
  }
}

export function isSessionError(error: unknown): error is SessionError {
  return error instanceof SessionError;
}

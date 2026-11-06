export class RecipeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RecipeError";
    this.code = code;
  }
}

export function isRecipeError(error: unknown): error is RecipeError {
  return error instanceof RecipeError;
}

const MIN_TOKEN_LENGTH = 16;
const PLACEHOLDER_TOKENS = new Set([
  "replace-with-a-long-random-token",
  "replace-me",
]);
const DEV_TOKEN = "local-dev-api-web-token-not-for-nas";

export type WebTokenEnv = {
  API_AUTH_TOKEN_WEB?: string;
  API_ALLOW_DEV_TOKEN?: string;
};

export function loadWebToken(env: WebTokenEnv = process.env): string {
  const value = env.API_AUTH_TOKEN_WEB?.trim();
  if (!value) {
    throw new Error(
      "API_AUTH_TOKEN_WEB is required. Generate one with: openssl rand -hex 32",
    );
  }
  if (PLACEHOLDER_TOKENS.has(value)) {
    throw new Error(
      "API_AUTH_TOKEN_WEB is a public placeholder. Generate one with: openssl rand -hex 32",
    );
  }
  if (value === DEV_TOKEN && env.API_ALLOW_DEV_TOKEN?.trim() !== "1") {
    throw new Error(
      "API_AUTH_TOKEN_WEB is a local dev token. Set API_ALLOW_DEV_TOKEN=1 only for local compose, never on the NAS",
    );
  }
  if (value.length < MIN_TOKEN_LENGTH) {
    throw new Error(
      `API_AUTH_TOKEN_WEB must be at least ${MIN_TOKEN_LENGTH} characters`,
    );
  }
  return value;
}

function pathOnly(urlPath: string): string {
  return urlPath.split("?")[0] ?? "";
}

export function incomingRecipeApiPath(urlPath: string): boolean {
  const path = pathOnly(urlPath);
  return path === "/api/recipes" || path.startsWith("/api/recipes/");
}

export function upstreamRecipePath(urlPath: string): boolean {
  const path = pathOnly(urlPath);
  return path === "/recipes" || path.startsWith("/recipes/");
}

export function shouldAttachWebToken(urlPath: string): boolean {
  return incomingRecipeApiPath(urlPath) || upstreamRecipePath(urlPath);
}

export function isRecipeReadMethod(method: string): boolean {
  const verb = method.toUpperCase();
  return verb === "GET" || verb === "HEAD";
}

export function recipeAuthorization(token: string): string {
  return `Bearer ${token}`;
}

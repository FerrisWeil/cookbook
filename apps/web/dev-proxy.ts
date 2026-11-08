const MIN_TOKEN_LENGTH = 16;
const PLACEHOLDER_TOKENS = new Set([
  "replace-with-a-long-random-token",
  "replace-me",
]);
const DEV_TOKEN = "local-dev-api-web-token-not-for-nas";
const RECIPE_FACTS_PATH = /^\/(?:api\/)?recipes\/[^/]+\/facts$/;

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

export function isRecipeFactsPath(urlPath: string): boolean {
  return RECIPE_FACTS_PATH.test(pathOnly(urlPath));
}

export function shouldAttachWebToken(urlPath: string): boolean {
  return incomingRecipeApiPath(urlPath) || upstreamRecipePath(urlPath);
}

export function isRecipeReadMethod(method: string): boolean {
  const verb = method.toUpperCase();
  return verb === "GET" || verb === "HEAD";
}

export function isRecipeFactsMethod(method: string): boolean {
  return method.toUpperCase() === "PATCH";
}

export function recipeAuthorization(token: string): string {
  return `Bearer ${token}`;
}

export function isJsonContentType(value: string | string[] | undefined): boolean {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) {
    return false;
  }
  const media = header.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return media === "application/json";
}

export function originMatchesHost(
  origin: string | string[] | undefined,
  host: string | string[] | undefined,
): boolean {
  const originValue = Array.isArray(origin) ? origin[0] : origin;
  const hostValue = Array.isArray(host) ? host[0] : host;
  if (!originValue || !hostValue || originValue === "null") {
    return false;
  }
  try {
    const url = new URL(originValue);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    return url.host === hostValue;
  } catch {
    return false;
  }
}

export function isSameOriginFactsRequest(headers: {
  origin?: string | string[];
  host?: string | string[];
  "sec-fetch-site"?: string | string[];
}): boolean {
  const site = Array.isArray(headers["sec-fetch-site"])
    ? headers["sec-fetch-site"][0]
    : headers["sec-fetch-site"];
  if (site === "cross-site" || site === "none") {
    return false;
  }
  return originMatchesHost(headers.origin, headers.host);
}

export function recipeProxyDecision(
  method: string,
  urlPath: string,
  headers: {
    origin?: string | string[];
    host?: string | string[];
    "content-type"?: string | string[];
    "sec-fetch-site"?: string | string[];
  },
):
  | { allow: true; attachToken: boolean }
  | { allow: false; status: number; error: string; allowHeader?: string } {
  if (isRecipeFactsPath(urlPath)) {
    if (!isRecipeFactsMethod(method)) {
      return {
        allow: false,
        status: 405,
        error: "method_not_allowed",
        allowHeader: "PATCH",
      };
    }
    if (!isJsonContentType(headers["content-type"])) {
      return { allow: false, status: 415, error: "unsupported_media_type" };
    }
    if (!isSameOriginFactsRequest(headers)) {
      return { allow: false, status: 403, error: "forbidden" };
    }
    return { allow: true, attachToken: true };
  }
  if (incomingRecipeApiPath(urlPath) || upstreamRecipePath(urlPath)) {
    if (!isRecipeReadMethod(method)) {
      return {
        allow: false,
        status: 405,
        error: "method_not_allowed",
        allowHeader: "GET, HEAD",
      };
    }
    return { allow: true, attachToken: true };
  }
  return { allow: false, status: 404, error: "not_found" };
}

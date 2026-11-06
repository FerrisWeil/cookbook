import { MESSAGES, type Recipe, type RecipeListItem } from "@cookbook/shared";

export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type CookbookApi = {
  read(id: string, fields?: string[]): Promise<ApiResult<Partial<Recipe>>>;
  list(): Promise<ApiResult<RecipeListItem[]>>;
  save(input: Record<string, unknown>): Promise<ApiResult<Recipe>>;
};

const REQUEST_TIMEOUT_MS = 10_000;

function messageFrom(body: unknown, fallback: string): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string" &&
    body.message.trim() !== ""
  ) {
    return body.message;
  }
  return fallback;
}

async function requestJson(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { status: 0, body: null };
  }
  try {
    return { status: response.status, body: await response.json() };
  } catch {
    return { status: response.status, body: null };
  }
}

function failure(status: number, body: unknown): ApiResult<never> {
  if (status === 400 || status === 404) {
    return {
      ok: false,
      message: messageFrom(
        body,
        status === 404 ? MESSAGES.notFound : MESSAGES.apiUnavailable,
      ),
    };
  }
  return { ok: false, message: MESSAGES.apiUnavailable };
}

export function createHttpCookbookApi(
  baseUrl: string,
  token: string,
): CookbookApi {
  const root = baseUrl.replace(/\/+$/, "");
  const headers = {
    accept: "application/json",
    authorization: `Bearer ${token}`,
  };

  return {
    async read(id, fields) {
      const url = new URL(`${root}/recipes/${encodeURIComponent(id)}`);
      if (fields && fields.length > 0) {
        url.searchParams.set("fields", fields.join(","));
      }
      const { status, body } = await requestJson(url.toString(), { headers });
      if (status !== 200) {
        return failure(status, body);
      }
      if (
        body === null ||
        typeof body !== "object" ||
        !("recipe" in body) ||
        body.recipe === null ||
        typeof body.recipe !== "object"
      ) {
        return { ok: false, message: MESSAGES.apiUnavailable };
      }
      return { ok: true, value: body.recipe as Partial<Recipe> };
    },

    async list() {
      const { status, body } = await requestJson(`${root}/recipes`, { headers });
      if (status !== 200) {
        return failure(status, body);
      }
      if (
        body === null ||
        typeof body !== "object" ||
        !("recipes" in body) ||
        !Array.isArray(body.recipes)
      ) {
        return { ok: false, message: MESSAGES.apiUnavailable };
      }
      return { ok: true, value: body.recipes as RecipeListItem[] };
    },

    async save(input) {
      const { status, body } = await requestJson(`${root}/recipes`, {
        method: "PUT",
        headers: {
          ...headers,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });
      if (status !== 200) {
        return failure(status, body);
      }
      if (
        body === null ||
        typeof body !== "object" ||
        !("recipe" in body) ||
        body.recipe === null ||
        typeof body.recipe !== "object"
      ) {
        return { ok: false, message: MESSAGES.apiUnavailable };
      }
      return { ok: true, value: body.recipe as Recipe };
    },
  };
}

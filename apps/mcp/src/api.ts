import {
  MESSAGES,
  type CookingSession,
  type QueryNode,
  type Recipe,
  type RecipeListItem,
} from "@cookbook/shared";

export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type ListResult = {
  recipes: RecipeListItem[];
  proteinChoices: string[];
};

export type CookbookApi = {
  read(id: string, fields?: string[]): Promise<ApiResult<Partial<Recipe>>>;
  list(query?: QueryNode | null): Promise<ApiResult<ListResult>>;
  save(input: Record<string, unknown>): Promise<ApiResult<Recipe>>;
  sessionResume(): Promise<ApiResult<CookingSession | null>>;
  sessionStart(input: {
    mutationId: string;
    recipeId: string;
  }): Promise<ApiResult<CookingSession>>;
  sessionFinish(input: {
    mutationId: string;
    sessionId: string;
  }): Promise<ApiResult<CookingSession>>;
  sessionShow(input: {
    mutationId: string;
    sessionId: string;
    step: number;
  }): Promise<ApiResult<CookingSession>>;
  sessionComplete(input: {
    mutationId: string;
    sessionId: string;
    step: number;
  }): Promise<ApiResult<CookingSession>>;
  sessionUndo(input: {
    mutationId: string;
    sessionId: string;
    step: number;
  }): Promise<ApiResult<CookingSession>>;
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
  if (status === 400 || status === 404 || status === 409) {
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

    async list(query) {
      const url = new URL(`${root}/recipes`);
      if (query) {
        url.searchParams.set("query", JSON.stringify(query));
      }
      const { status, body } = await requestJson(url.toString(), { headers });
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
      const record = body as {
        recipes: RecipeListItem[];
        proteinChoices?: unknown;
      };
      const proteinChoices = Array.isArray(record.proteinChoices)
        ? record.proteinChoices.filter((item): item is string => typeof item === "string")
        : [];
      return {
        ok: true,
        value: { recipes: record.recipes, proteinChoices },
      };
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

    sessionResume() {
      return readSession("/sessions/active");
    },

    sessionStart(input) {
      return writeSession("/sessions", input);
    },

    sessionFinish(input) {
      return writeSession(`/sessions/${encodeURIComponent(input.sessionId)}/finish`, {
        mutationId: input.mutationId,
      });
    },

    sessionShow(input) {
      return writeSession(`/sessions/${encodeURIComponent(input.sessionId)}/display`, {
        mutationId: input.mutationId,
        step: input.step,
      });
    },

    sessionComplete(input) {
      return writeSession(
        `/sessions/${encodeURIComponent(input.sessionId)}/steps/${input.step}/complete`,
        { mutationId: input.mutationId },
      );
    },

    sessionUndo(input) {
      return writeSession(
        `/sessions/${encodeURIComponent(input.sessionId)}/steps/${input.step}/undo`,
        { mutationId: input.mutationId },
      );
    },
  };

  async function readSession(path: string): Promise<ApiResult<CookingSession | null>> {
    const { status, body } = await requestJson(`${root}${path}`, { headers });
    if (status === 404) {
      return { ok: false, message: messageFrom(body, MESSAGES.sessionMissing) };
    }
    if (status !== 200) {
      return failure(status, body);
    }
    const session = sessionFrom(body);
    if (!session) {
      return { ok: false, message: MESSAGES.apiUnavailable };
    }
    return { ok: true, value: session };
  }

  async function writeSession(
    path: string,
    payload: unknown,
  ): Promise<ApiResult<CookingSession>> {
    const { status, body } = await requestJson(`${root}${path}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (status !== 200) {
      return failure(status, body);
    }
    const session = sessionFrom(body);
    if (!session) {
      return { ok: false, message: MESSAGES.apiUnavailable };
    }
    return { ok: true, value: session };
  }
}

function sessionFrom(body: unknown): CookingSession | null {
  if (body === null || typeof body !== "object" || !("session" in body)) {
    return null;
  }
  const session = body.session;
  if (session === null || typeof session !== "object") {
    return null;
  }
  const record = session as Record<string, unknown>;
  const snapshot = record["snapshot"];
  if (snapshot === null || typeof snapshot !== "object") {
    return null;
  }
  const snap = snapshot as Record<string, unknown>;
  if (
    typeof record["id"] !== "string" ||
    typeof record["recipeId"] !== "string" ||
    (record["status"] !== "active" && record["status"] !== "finished") ||
    typeof snap["title"] !== "string" ||
    typeof snap["servings"] !== "number" ||
    !Array.isArray(snap["ingredients"]) ||
    !Array.isArray(snap["steps"]) ||
    typeof record["displayedStep"] !== "number" ||
    !Array.isArray(record["completedSteps"])
  ) {
    return null;
  }
  return record as CookingSession;
}

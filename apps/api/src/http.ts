import Fastify, {
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import { MESSAGES, type ReadyStatus } from "@cookbook/shared";

import { requestHasValidBearer } from "./auth.js";
import { createCommitHub, type CommitHub } from "./commits.js";
import { parseFieldList, projectRecipe } from "./recipe-fields.js";
import { isRecipeError, type RecipeStore } from "./recipes/index.js";

export type ApiDeps = {
  getReady: () => Promise<ReadyStatus>;
  recipes: RecipeStore;
  callerTokens: readonly string[];
  commits?: CommitHub;
  sseHeartbeatMs?: number;
};

export type ApiListener = {
  url: string;
  close(): Promise<void>;
};

// Fastify requires a numeric limit; the previous Node reader was unbounded.
const BODY_LIMIT = Number.MAX_SAFE_INTEGER;
// Opaque recipe ids are unbounded; Fastify's default param cap is 100.
const MAX_PARAM_LENGTH = 32 * 1024;
const INVALID_JSON = Symbol("invalid-json");

function sendJson(
  reply: FastifyReply,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): FastifyReply {
  for (const [name, value] of Object.entries(extraHeaders)) {
    reply.header(name, value);
  }
  return reply
    .code(status)
    .header("content-type", "application/json; charset=utf-8")
    .header("cache-control", "no-store")
    .send(body);
}

function requestUrl(request: FastifyRequest): URL {
  try {
    return new URL(request.raw.url ?? "/", "http://127.0.0.1");
  } catch {
    return new URL("http://127.0.0.1/");
  }
}

function unauthorized(reply: FastifyReply): FastifyReply {
  return sendJson(
    reply,
    401,
    { error: "unauthorized" },
    { "www-authenticate": 'Bearer realm="cookbook-api"' },
  );
}

function recipeIdFromPath(raw: string): string | null {
  try {
    const id = decodeURIComponent(raw);
    return id.trim() === "" ? null : id;
  } catch {
    return null;
  }
}

function stepsError(body: Record<string, unknown>): string | undefined {
  const steps = body.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    return MESSAGES.stepsRequired;
  }
  for (const step of steps) {
    if (typeof step !== "string" || step.trim() === "") {
      return MESSAGES.stepsRequired;
    }
  }
  return undefined;
}

function sendStoreError(reply: FastifyReply, error: unknown): FastifyReply {
  if (isRecipeError(error)) {
    const notFound = error.code === "not_found";
    return sendJson(reply, notFound ? 404 : 400, {
      error: notFound ? "not_found" : "invalid",
      message: error.message,
    });
  }
  return sendJson(reply, 503, { error: "unavailable" });
}

function parseJsonBody(raw: string | Buffer): unknown {
  const text = typeof raw === "string" ? raw : raw.toString("utf8");
  if (text.trim() === "") {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return INVALID_JSON;
  }
}

function isHealthGet(method: string, pathname: string): boolean {
  return method === "GET" && (pathname === "/health" || pathname === "/health/ready");
}

const DEFAULT_SSE_HEARTBEAT_MS = 15_000;

function openRecipeEventStream(
  request: FastifyRequest,
  reply: FastifyReply,
  hub: CommitHub,
  heartbeatMs: number,
): void {
  reply.hijack();
  request.raw.socket?.setTimeout(0);
  const raw = reply.raw;
  raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  raw.write("retry: 3000\n\n");
  raw.write(": keepalive\n\n");

  let closed = false;
  const httpServer = request.server.server;
  const cleanup = () => {
    if (closed) {
      return;
    }
    closed = true;
    clearInterval(timer);
    unsubscribe();
    request.raw.off("close", cleanup);
    httpServer.off("close", cleanup);
    if (!raw.writableEnded && !raw.destroyed) {
      raw.end();
    }
  };
  const write = (chunk: string) => {
    if (closed || raw.destroyed || raw.writableEnded) {
      cleanup();
      return;
    }
    if (!raw.write(chunk)) {
      cleanup();
    }
  };
  const unsubscribe = hub.subscribe((commit) => {
    write(`event: committed\ndata: ${JSON.stringify(commit)}\n\n`);
  });
  const timer = setInterval(() => {
    write(": keepalive\n\n");
  }, heartbeatMs);
  request.raw.on("close", cleanup);
  httpServer.on("close", cleanup);
}

function hasUsableContentType(value: string | string[] | undefined): boolean {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) {
    return false;
  }
  const media = header.split(";", 1)[0] ?? "";
  const slash = media.indexOf("/");
  return slash > 0 && slash < media.length - 1;
}

function createApp(deps: ApiDeps) {
  const commits = deps.commits ?? createCommitHub();
  const sseHeartbeatMs = deps.sseHeartbeatMs ?? DEFAULT_SSE_HEARTBEAT_MS;
  const app = Fastify({
    logger: false,
    exposeHeadRoutes: false,
    bodyLimit: BODY_LIMIT,
    requestTimeout: 300_000,
    keepAliveTimeout: 5_000,
    return503OnClosing: false,
    forceCloseConnections: "idle",
    routerOptions: {
      maxParamLength: MAX_PARAM_LENGTH,
      ignoreTrailingSlash: false,
      ignoreDuplicateSlashes: false,
      caseSensitive: true,
    },
    frameworkErrors(error, request, reply) {
      const pathname = requestUrl(request).pathname;
      if (
        !isHealthGet(request.method, pathname) &&
        !requestHasValidBearer(request.raw, deps.callerTokens)
      ) {
        unauthorized(reply);
        return;
      }
      if (
        error.code === "FST_ERR_BAD_URL" ||
        error.code === "FST_ERR_MAX_PARAM_LENGTH"
      ) {
        const one = /^\/recipes\/([^/]+)$/.exec(pathname);
        if (one) {
          sendJson(reply, 404, {
            error: "not_found",
            message: MESSAGES.notFound,
          });
          return;
        }
        sendJson(reply, 404, { error: "not_found" });
        return;
      }
      sendJson(reply, 503, { error: "unavailable" });
    },
  });

  app.removeAllContentTypeParsers();
  app.addContentTypeParser(
    "*",
    { parseAs: "string", bodyLimit: BODY_LIMIT },
    (_request, body, done) => {
      done(null, parseJsonBody(body));
    },
  );

  app.addHook("onRequest", async (request, reply) => {
    if (!hasUsableContentType(request.headers["content-type"])) {
      delete request.headers["content-type"];
    }
    const pathname = requestUrl(request).pathname;
    if (isHealthGet(request.method, pathname)) {
      return;
    }
    if (!requestHasValidBearer(request.raw, deps.callerTokens)) {
      return unauthorized(reply);
    }
  });

  app.get("/health", async (_request, reply) => {
    return sendJson(reply, 200, { status: "ok" });
  });

  app.get("/health/ready", async (_request, reply) => {
    try {
      const body = await deps.getReady();
      return sendJson(reply, body.status === "ok" ? 200 : 503, body);
    } catch {
      return sendJson(reply, 503, {
        status: "degraded",
        database: "down",
        seed: false,
      });
    }
  });

  app.get("/recipes/events", async (request, reply) => {
    openRecipeEventStream(request, reply, commits, sseHeartbeatMs);
  });

  app.get("/recipes", async (_request, reply) => {
    try {
      const recipes = await deps.recipes.list();
      return sendJson(reply, 200, { recipes });
    } catch (error) {
      return sendStoreError(reply, error);
    }
  });

  app.get("/recipes/:id", async (request, reply) => {
    const pathname = requestUrl(request).pathname;
    const one = /^\/recipes\/([^/]+)$/.exec(pathname);
    if (!one) {
      return sendJson(reply, 404, { error: "not_found" });
    }
    const id = recipeIdFromPath(one[1] ?? "");
    if (!id) {
      return sendJson(reply, 404, {
        error: "not_found",
        message: MESSAGES.notFound,
      });
    }
    try {
      const recipe = await deps.recipes.read(id);
      const url = requestUrl(request);
      const fields = parseFieldList(
        url.searchParams.has("fields")
          ? url.searchParams.getAll("fields")
          : undefined,
      );
      const projected = projectRecipe(recipe, fields);
      if (!projected.ok) {
        return sendJson(reply, 400, {
          error: "invalid",
          message: projected.message,
        });
      }
      return sendJson(reply, 200, { recipe: projected.value });
    } catch (error) {
      return sendStoreError(reply, error);
    }
  });

  app.put("/recipes", async (request, reply) => {
    try {
      const parsed = request.body;
      if (parsed === INVALID_JSON) {
        return sendJson(reply, 400, {
          error: "invalid",
          message: MESSAGES.titleRequired,
        });
      }
      const body: unknown = parsed === undefined ? {} : parsed;
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return sendJson(reply, 400, {
          error: "invalid",
          message: MESSAGES.titleRequired,
        });
      }
      const record = body as Record<string, unknown>;
      const steps = stepsError(record);
      if (steps) {
        return sendJson(reply, 400, { error: "invalid", message: steps });
      }
      const saved = await deps.recipes.save(record);
      return sendJson(reply, 200, { recipe: saved });
    } catch (error) {
      return sendStoreError(reply, error);
    }
  });

  app.setNotFoundHandler((_request, reply) => {
    return sendJson(reply, 404, { error: "not_found" });
  });

  app.setErrorHandler((_error, _request, reply) => {
    return sendJson(reply, 503, { error: "unavailable" });
  });

  return app;
}

function listenerUrl(
  address: string | { address: string; port: number } | null,
): string {
  if (!address || typeof address === "string") {
    throw new Error("failed to determine listen address");
  }
  const host =
    address.address === "::" || address.address === "0.0.0.0"
      ? "127.0.0.1"
      : address.address.includes(":")
        ? `[${address.address}]`
        : address.address;
  return `http://${host}:${address.port}`;
}

export async function listen(
  bindHost: string,
  port: number,
  deps: ApiDeps,
): Promise<ApiListener> {
  const app = createApp(deps);
  await app.listen({ host: bindHost, port });
  return {
    url: listenerUrl(app.server.address()),
    close: () => app.close(),
  };
}

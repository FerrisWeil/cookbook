import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import { MESSAGES, type ReadyStatus } from "@cookbook/shared";

import { requestHasValidBearer } from "./auth.js";
import { parseFieldList, projectRecipe } from "./recipe-fields.js";
import { isRecipeError, type RecipeStore } from "./recipes/index.js";

export type ApiDeps = {
  getReady: () => Promise<ReadyStatus>;
  recipes: RecipeStore;
  callerTokens: readonly string[];
};

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(payload);
}

function requestUrl(req: IncomingMessage): URL {
  try {
    return new URL(req.url ?? "/", "http://127.0.0.1");
  } catch {
    return new URL("http://127.0.0.1/");
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function unauthorized(res: ServerResponse): void {
  sendJson(
    res,
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

function sendStoreError(res: ServerResponse, error: unknown): void {
  if (isRecipeError(error)) {
    const notFound = error.code === "not_found";
    sendJson(res, notFound ? 404 : 400, {
      error: notFound ? "not_found" : "invalid",
      message: error.message,
    });
    return;
  }
  sendJson(res, 503, { error: "unavailable" });
}

export function createRequestListener(
  deps: ApiDeps,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const url = requestUrl(req);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "GET" && path === "/health/ready") {
      void deps
        .getReady()
        .then((body) => {
          sendJson(res, body.status === "ok" ? 200 : 503, body);
        })
        .catch(() => {
          sendJson(res, 503, {
            status: "degraded",
            database: "down",
            seed: false,
          });
        });
      return;
    }

    if (!requestHasValidBearer(req, deps.callerTokens)) {
      unauthorized(res);
      return;
    }

    if (req.method === "GET" && path === "/recipes") {
      void deps.recipes
        .list()
        .then((recipes) => {
          sendJson(res, 200, { recipes });
        })
        .catch((error) => {
          sendStoreError(res, error);
        });
      return;
    }

    const one = /^\/recipes\/([^/]+)$/.exec(path);
    if (req.method === "GET" && one) {
      const id = recipeIdFromPath(one[1] ?? "");
      if (!id) {
        sendJson(res, 404, { error: "not_found", message: MESSAGES.notFound });
        return;
      }
      void deps.recipes
        .read(id)
        .then((recipe) => {
          const fields = parseFieldList(
            url.searchParams.has("fields")
              ? url.searchParams.getAll("fields")
              : undefined,
          );
          const projected = projectRecipe(recipe, fields);
          if (!projected.ok) {
            sendJson(res, 400, { error: "invalid", message: projected.message });
            return;
          }
          sendJson(res, 200, { recipe: projected.value });
        })
        .catch((error) => {
          sendStoreError(res, error);
        });
      return;
    }

    if (req.method === "PUT" && path === "/recipes") {
      void readBody(req)
        .then((raw) => {
          let body: unknown = {};
          if (raw.trim() !== "") {
            try {
              body = JSON.parse(raw) as unknown;
            } catch {
              sendJson(res, 400, { error: "invalid", message: MESSAGES.titleRequired });
              return;
            }
          }
          if (body === null || typeof body !== "object" || Array.isArray(body)) {
            sendJson(res, 400, { error: "invalid", message: MESSAGES.titleRequired });
            return;
          }
          const record = body as Record<string, unknown>;
          const steps = stepsError(record);
          if (steps) {
            sendJson(res, 400, { error: "invalid", message: steps });
            return;
          }
          return deps.recipes.save(record).then((saved) => {
            sendJson(res, 200, { recipe: saved });
          });
        })
        .catch((error) => {
          sendStoreError(res, error);
        });
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

export function createHttpServer(deps: ApiDeps): Server {
  return createServer(createRequestListener(deps));
}

export async function listen(
  bindHost: string,
  port: number,
  deps: ApiDeps,
): Promise<{ server: Server; url: string }> {
  const server = createHttpServer(deps);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, bindHost, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to determine listen address");
  }

  const host =
    address.address === "::" || address.address === "0.0.0.0"
      ? "127.0.0.1"
      : address.address.includes(":")
        ? `[${address.address}]`
        : address.address;

  return { server, url: `http://${host}:${address.port}` };
}

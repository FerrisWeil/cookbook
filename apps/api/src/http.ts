import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import type { ReadyStatus } from "@cookbook/shared";

export type ApiDeps = {
  getReady: () => Promise<ReadyStatus>;
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function requestPath(req: IncomingMessage): string {
  try {
    return new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  } catch {
    return "/";
  }
}

export function createRequestListener(
  deps: ApiDeps,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const path = requestPath(req);

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

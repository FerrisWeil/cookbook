import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { invalidFieldMessage, MESSAGES } from "@cookbook/shared";

import { listen, type ApiDeps } from "../src/http.ts";
import { createMemoryRecipeStore, type RecipeStore } from "../src/recipes/index.ts";
import { createMemorySessionStore } from "../src/sessions/index.ts";

const MCP_TOKEN = "test-api-mcp-token-xx";
const WEB_TOKEN = "test-api-web-token-xx";
const CALLER_TOKENS = [MCP_TOKEN, WEB_TOKEN];
const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../src");

type Started = { url: string; close(): Promise<void> };

async function startApi(deps: ApiDeps): Promise<Started> {
  const listening = await listen("127.0.0.1", 0, deps);
  return { url: listening.url, close: () => listening.close() };
}

type RawResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  raw: string;
  json: unknown;
};

function rawRequest(
  baseUrl: string,
  init: {
    method: string;
    path: string;
    headers?: http.OutgoingHttpHeaders;
    body?: string;
  },
): Promise<RawResponse> {
  const url = new URL(init.path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: init.method,
        headers: init.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json: unknown = undefined;
          if (raw.length > 0) {
            json = JSON.parse(raw);
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, raw, json });
        });
      },
    );
    req.on("error", reject);
    if (init.body !== undefined) {
      req.write(init.body);
    }
    req.end();
  });
}

function jsonHeaders(extra: http.OutgoingHttpHeaders = {}): http.OutgoingHttpHeaders {
  return {
    authorization: `Bearer ${MCP_TOKEN}`,
    "content-type": "application/json",
    ...extra,
  };
}

function assertJsonEnvelope(response: RawResponse): void {
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(response.headers["cache-control"], "no-store");
}

async function seedStore(): Promise<RecipeStore> {
  const store = createMemoryRecipeStore();
  await store.save({
    id: "alpha",
    title: "Example: Alpha",
    steps: ["one", "two"],
    servings: 2,
    actor: "chef",
    favorite: true,
    rating: 4,
    ingredients: [{ line: "salt" }],
    nutrition: { source: "entered", calories: 10 },
  });
  await store.save({
    id: "hidden",
    title: "Example: Hidden",
    steps: ["one"],
    servings: 1,
    actor: "chef",
  });
  await store.hide({ id: "hidden", actor: "chef" });
  return store;
}

const failingStore: RecipeStore = {
  async save() {
    throw new Error("store failed");
  },
  async read() {
    throw new Error("store failed");
  },
  async list() {
    throw new Error("store failed");
  },
  async proteinChoices() {
    throw new Error("store failed");
  },
  async hide() {
    throw new Error("store failed");
  },
  async updateFacts() {
    throw new Error("store failed");
  },
};

describe("HTTP adapter stays out of application modules", () => {
  it("does not import Fastify outside the HTTP adapter and boot wiring", () => {
    const files = [
      "auth.ts",
      "commits.ts",
      "config.ts",
      "health.ts",
      "migrate.ts",
      "mutations.ts",
      "recipe-fields.ts",
      "index.ts",
      "recipes/errors.ts",
      "recipes/index.ts",
      "recipes/memory.ts",
      "recipes/parse.ts",
      "recipes/pg.ts",
      "recipes/query-sql.ts",
      "recipes/types.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(srcDir, file), "utf8");
      assert.equal(source.includes("fastify"), false, file);
      assert.equal(source.includes("Fastify"), false, file);
    }
  });
});

describe("HTTP contract", () => {
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};
  let ready = async () => ({ status: "ok" as const, database: "up" as const, seed: true });

  before(async () => {
    const api = await startApi({
      getReady: () => ready(),
      recipes: await seedStore(),
      sessions: createMemorySessionStore(),
      callerTokens: CALLER_TOKENS,
    });
    baseUrl = api.url;
    close = api.close;
  });

  after(async () => {
    await close();
  });

  it("serves health without a bearer and sets cache headers", async () => {
    const response = await rawRequest(baseUrl, { method: "GET", path: "/health" });
    assert.equal(response.status, 200);
    assertJsonEnvelope(response);
    assert.deepEqual(response.json, { status: "ok" });
  });

  it("keeps HEAD /health on the bearer path", async () => {
    const unauthenticated = await rawRequest(baseUrl, {
      method: "HEAD",
      path: "/health",
    });
    assert.equal(unauthenticated.status, 401);
    assert.equal(
      unauthenticated.headers["www-authenticate"],
      'Bearer realm="cookbook-api"',
    );
    assert.equal(unauthenticated.raw, "");

    const authenticated = await rawRequest(baseUrl, {
      method: "HEAD",
      path: "/health",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(authenticated.status, 404);
    assert.equal(authenticated.raw, "");
  });

  it("does not treat recipe HEAD as GET", async () => {
    const response = await rawRequest(baseUrl, {
      method: "HEAD",
      path: "/recipes",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(response.status, 404);
    assert.equal(response.raw, "");
  });

  it("returns 503 with the degraded envelope when ready throws", async () => {
    const previous = ready;
    ready = async () => {
      throw new Error("ready failed");
    };
    try {
      const response = await rawRequest(baseUrl, {
        method: "GET",
        path: "/health/ready",
      });
      assert.equal(response.status, 503);
      assertJsonEnvelope(response);
      assert.deepEqual(response.json, {
        status: "degraded",
        database: "down",
        seed: false,
      });
    } finally {
      ready = previous;
    }
  });

  it("rejects unknown paths without a bearer before 404", async () => {
    const response = await rawRequest(baseUrl, { method: "GET", path: "/nope" });
    assert.equal(response.status, 401);
    assert.equal(
      response.headers["www-authenticate"],
      'Bearer realm="cookbook-api"',
    );
    assert.deepEqual(response.json, { error: "unauthorized" });
  });

  it("returns a status-only 404 for authenticated unknown methods and paths", async () => {
    const unknown = await rawRequest(baseUrl, {
      method: "GET",
      path: "/nope",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(unknown.status, 404);
    assertJsonEnvelope(unknown);
    assert.deepEqual(unknown.json, { error: "not_found" });

    const post = await rawRequest(baseUrl, {
      method: "POST",
      path: "/recipes",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(post.status, 404);
    assert.deepEqual(post.json, { error: "not_found" });
  });

  it("does not collapse trailing slashes into the collection route", async () => {
    const response = await rawRequest(baseUrl, {
      method: "GET",
      path: "/recipes/",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(response.status, 404);
    assert.deepEqual(response.json, { error: "not_found" });
  });

  it("projects default and requested recipe fields", async () => {
    const defaults = await rawRequest(baseUrl, {
      method: "GET",
      path: "/recipes/alpha",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(defaults.status, 200);
    assert.deepEqual(defaults.json, {
      recipe: {
        title: "Example: Alpha",
        steps: ["one", "two"],
        servings: 2,
        nutrition: {
          source: "entered",
          calories: 10,
          protein: null,
          fat: null,
          carbs: null,
        },
      },
    });

    const kitchen = await rawRequest(baseUrl, {
      method: "GET",
      path: "/recipes/alpha?fields=title,ingredients,steps",
      headers: { authorization: `Bearer ${WEB_TOKEN}` },
    });
    assert.equal(kitchen.status, 200);
    assert.deepEqual(kitchen.json, {
      recipe: {
        title: "Example: Alpha",
        ingredients: [{ line: "salt", amount: null, unit: "", name: "" }],
        steps: ["one", "two"],
      },
    });

    const repeated = await rawRequest(baseUrl, {
      method: "GET",
      path: "/recipes/alpha?fields=id&fields=title",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(repeated.status, 200);
    assert.deepEqual(repeated.json, {
      recipe: { id: "alpha", title: "Example: Alpha" },
    });
  });

  it("rejects an unknown field without leaking Fastify schema errors", async () => {
    const response = await rawRequest(baseUrl, {
      method: "GET",
      path: "/recipes/alpha?fields=nope",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(response.json, {
      error: "invalid",
      message: invalidFieldMessage("nope"),
    });
  });

  it("requires a bearer before mapping a malformed recipe id", async () => {
    const unauthenticated = await rawRequest(baseUrl, {
      method: "GET",
      path: "/recipes/%80",
    });
    assert.equal(unauthenticated.status, 401);
    assert.deepEqual(unauthenticated.json, { error: "unauthorized" });
  });

  it("treats a hidden id as not found with the recipe message", async () => {
    const response = await rawRequest(baseUrl, {
      method: "GET",
      path: "/recipes/hidden",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(response.status, 404);
    assert.deepEqual(response.json, {
      error: "not_found",
      message: MESSAGES.notFound,
    });
  });

  it("accepts a long opaque recipe id instead of a framework param cap", async () => {
    const id = "a".repeat(1200);
    const response = await rawRequest(baseUrl, {
      method: "GET",
      path: `/recipes/${id}`,
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(response.status, 404);
    assert.deepEqual(response.json, {
      error: "not_found",
      message: MESSAGES.notFound,
    });
  });

  it("saves JSON when Content-Type is not a valid media type", async () => {
    const response = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: jsonHeaders({ "content-type": "bogus" }),
      body: JSON.stringify({
        title: "Example: Bogus Type",
        steps: ["mix"],
        servings: 1,
        actor: "chef",
      }),
    });
    assert.equal(response.status, 200);
    const saved = response.json as { recipe: { title: string } };
    assert.equal(saved.recipe.title, "Example: Bogus Type");
  });

  it("resolves dot segments in the request path the way URL.pathname does", async () => {
    const response = await rawRequest(baseUrl, {
      method: "GET",
      path: "/recipes/hidden/../alpha",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(response.status, 200);
    const body = response.json as { recipe: { title: string } };
    assert.equal(body.recipe.title, "Example: Alpha");
  });

  it("saves JSON without requiring application/json", async () => {
    const missingType = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
      body: JSON.stringify({
        title: "Example: No Content-Type",
        steps: ["mix"],
        servings: 1,
        actor: "chef",
      }),
    });
    assert.equal(missingType.status, 200);
    const saved = missingType.json as { recipe: { title: string } };
    assert.equal(saved.recipe.title, "Example: No Content-Type");

    const plain = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: jsonHeaders({ "content-type": "text/plain" }),
      body: JSON.stringify({
        title: "Example: Text Plain",
        steps: ["mix"],
        servings: 1,
        actor: "chef",
      }),
    });
    assert.equal(plain.status, 200);
    const plainSaved = plain.json as { recipe: { title: string } };
    assert.equal(plainSaved.recipe.title, "Example: Text Plain");
  });

  it("keeps the HTTP steps-required check on PUT", async () => {
    const missing = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: "Example: No Steps",
        servings: 1,
        actor: "chef",
      }),
    });
    assert.equal(missing.status, 400);
    assert.deepEqual(missing.json, {
      error: "invalid",
      message: MESSAGES.stepsRequired,
    });

    const empty = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: "Example: Empty Steps",
        steps: [],
        servings: 1,
        actor: "chef",
      }),
    });
    assert.equal(empty.status, 400);
    assert.deepEqual(empty.json, {
      error: "invalid",
      message: MESSAGES.stepsRequired,
    });
  });

  it("rejects malformed JSON with the current invalid envelope", async () => {
    const malformed = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: jsonHeaders(),
      body: "{not json",
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(malformed.json, {
      error: "invalid",
      message: MESSAGES.titleRequired,
    });

    const empty = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: jsonHeaders(),
      body: "",
    });
    assert.equal(empty.status, 400);
    assert.deepEqual(empty.json, {
      error: "invalid",
      message: MESSAGES.stepsRequired,
    });

    const arrayBody = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: jsonHeaders(),
      body: "[]",
    });
    assert.equal(arrayBody.status, 400);
    assert.deepEqual(arrayBody.json, {
      error: "invalid",
      message: MESSAGES.titleRequired,
    });
  });

  it("does not coerce JSON types before domain validation", async () => {
    const response = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: "Example: Coerce",
        steps: ["mix"],
        servings: "1",
        actor: "chef",
      }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(response.json, {
      error: "invalid",
      message: MESSAGES.servingsRequired,
    });
  });

  it("parses prototype keys with JSON.parse the same way the current body reader does", async () => {
    const response = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: jsonHeaders(),
      body: '{"title":"Example: Proto","steps":["mix"],"servings":1,"actor":"chef","__proto__":{"polluted":true}}',
    });
    assert.equal(response.status, 200);
    const saved = response.json as { recipe: { title: string } };
    assert.equal(saved.recipe.title, "Example: Proto");
  });

  it("accepts a PUT body larger than Fastify's default 1MiB cap", async () => {
    const padding = "x".repeat(1.5 * 1024 * 1024);
    const response = await rawRequest(baseUrl, {
      method: "PUT",
      path: "/recipes",
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: "Example: Large",
        steps: [padding],
        servings: 1,
        actor: "chef",
      }),
    });
    assert.equal(response.status, 200);
    const saved = response.json as { recipe: { steps: string[] } };
    assert.equal(saved.recipe.steps[0]?.length, padding.length);
  });
});

describe("HTTP store failures and close", () => {
  it("maps unexpected store errors to unavailable", async () => {
    const api = await startApi({
      getReady: async () => ({ status: "ok", database: "up", seed: true }),
      recipes: failingStore,
      sessions: createMemorySessionStore(),
      callerTokens: CALLER_TOKENS,
    });
    try {
      const listed = await rawRequest(api.url, {
        method: "GET",
        path: "/recipes",
        headers: { authorization: `Bearer ${MCP_TOKEN}` },
      });
      assert.equal(listed.status, 503);
      assert.deepEqual(listed.json, { error: "unavailable" });
    } finally {
      await api.close();
    }
  });

  it("stops accepting connections after close", async () => {
    const api = await startApi({
      getReady: async () => ({ status: "ok", database: "up", seed: true }),
      recipes: createMemoryRecipeStore(),
      sessions: createMemorySessionStore(),
      callerTokens: CALLER_TOKENS,
    });
    await api.close();
    await assert.rejects(
      () => rawRequest(api.url, { method: "GET", path: "/health" }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal((error as NodeJS.ErrnoException).code, "ECONNREFUSED");
        return true;
      },
    );
  });
});

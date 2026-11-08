import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { ReadyStatus } from "@cookbook/shared";
import { verifies } from "@cookbook/test";

import { getReadyStatus } from "../src/health.ts";
import { listen } from "../src/http.ts";
import type { SqlClient } from "../src/migrate.ts";
import { createMemoryRecipeStore } from "../src/recipes/index.ts";
import { createMemorySessionStore } from "../src/sessions/index.ts";

const CALLER_TOKENS = ["test-api-mcp-token-xx", "test-api-web-token-xx"];

describe("getReadyStatus", () => {
  it("reports database up and seed true when app_meta is present", async () => {
    const client: SqlClient = {
      async query() {
        return { rowCount: 1, rows: [{ value: "true" }] };
      },
    };
    assert.deepEqual(await getReadyStatus(client), {
      status: "ok",
      database: "up",
      seed: true,
    });
  });

  it("reports degraded when the database is up but seed is missing", async () => {
    const client: SqlClient = {
      async query() {
        return { rowCount: 0, rows: [] };
      },
    };
    assert.deepEqual(await getReadyStatus(client), {
      status: "degraded",
      database: "up",
      seed: false,
    });
  });

  it("reports database down when the query fails", async () => {
    const client: SqlClient = {
      async query() {
        throw new Error("the database system is starting up");
      },
    };
    assert.deepEqual(await getReadyStatus(client), {
      status: "degraded",
      database: "down",
      seed: false,
    });
  });
});

describe("http health", () => {
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};
  let ready: ReadyStatus = { status: "ok", database: "up", seed: true };

  before(async () => {
    const api = await listen("127.0.0.1", 0, {
      getReady: async () => ready,
      recipes: createMemoryRecipeStore(),
      sessions: createMemorySessionStore(),
      callerTokens: CALLER_TOKENS,
    });
    baseUrl = api.url;
    close = () => api.close();
  });

  after(async () => {
    await close();
  });

  it(
    "serves /health without touching the database",
    verifies("140", "db5d5e336e9799ef", async () => {
      const response = await fetch(`${baseUrl}/health`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "ok" });
    }),
  );

  it("serves /health/ready as 200 when postgres and seed are up", async () => {
    ready = { status: "ok", database: "up", seed: true };
    const response = await fetch(`${baseUrl}/health/ready`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), ready);
  });

  it("serves /health/ready as 503 when seed is missing", async () => {
    ready = { status: "degraded", database: "up", seed: false };
    const response = await fetch(`${baseUrl}/health/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), ready);
  });

  it("serves /health/ready as 503 when postgres is down", async () => {
    ready = { status: "degraded", database: "down", seed: false };
    const response = await fetch(`${baseUrl}/health/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), ready);
  });
});

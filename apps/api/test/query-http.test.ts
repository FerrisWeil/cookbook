import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { MESSAGES, encodeListQueryParam } from "@cookbook/shared";
import { verifies } from "@cookbook/test";

import { listen } from "../src/http.ts";
import { createMemoryRecipeStore } from "../src/recipes/memory.ts";
import { createMemorySessionStore } from "../src/sessions/index.ts";
import {
  TITLE_QUERY,
  seedQueryLibrary,
} from "./query-fixtures.ts";

const TOKEN = "test-api-mcp-token-xx";

describe("recipe list query HTTP", () => {
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};

  before(async () => {
    const recipes = createMemoryRecipeStore();
    await seedQueryLibrary(recipes);
    const listening = await listen("127.0.0.1", 0, {
      getReady: async () => ({ status: "ok", database: "up", seed: true }),
      recipes,
      sessions: createMemorySessionStore(),
      callerTokens: [TOKEN],
    });
    baseUrl = listening.url;
    close = () => listening.close();
  });

  after(async () => {
    await close();
  });

  async function list(query?: string) {
    const url = new URL("/recipes", baseUrl);
    if (query !== undefined) {
      url.searchParams.set("query", query);
    }
    return fetch(url, { headers: { authorization: `Bearer ${TOKEN}` } });
  }

  it("keeps the unfiltered recipe array contract and adds protein choices", async () => {
    const response = await list();
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      recipes: Array<{ id: string }>;
      proteinChoices: string[];
    };
    assert.ok(Array.isArray(body.recipes));
    assert.equal(
      body.recipes.some((item) => item.id === "hidden-query"),
      false,
    );
    assert.ok(body.recipes.some((item) => item.id === "title-hit"));
    assert.ok(body.proteinChoices.includes("chicken"));
    assert.ok(body.proteinChoices.includes("seitan"));
  });

  it(
    "matches the whole library for a title query without loading card details",
    verifies("229", "e6d885dd0e0904c2", async () => {
    const encoded = encodeListQueryParam(TITLE_QUERY);
    assert.ok(encoded);
    const response = await list(encoded);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      recipes: Array<{ id: string; title: string; facts: unknown }>;
    };
    assert.deepEqual(
      body.recipes.map((item) => item.id),
      ["title-hit"],
    );
    assert.equal("ingredients" in body.recipes[0]!, false);
    }),
  );

  it(
    "refuses malformed, unknown, empty, and injected queries",
    verifies("227", "dbc288c2a9e4fbf1", async () => {
    const invalid = [
      "{",
      "{}",
      JSON.stringify({ op: "not", children: [{ field: "title", phrase: "a" }] }),
      JSON.stringify({ field: "sql", phrase: "1=1" }),
      JSON.stringify({ op: "and", children: [] }),
      JSON.stringify({
        op: "and",
        children: Array.from({ length: 17 }, () => ({
          field: "title",
          phrase: "a",
        })),
      }),
    ];
    for (const query of invalid) {
      const response = await list(query);
      assert.equal(response.status, 400, query);
      assert.deepEqual(await response.json(), {
        error: "invalid",
        message: MESSAGES.invalidQuery,
      });
    }
    const literal = await list(
      JSON.stringify({ field: "title", phrase: "a'; DROP TABLE recipes;--" }),
    );
    assert.equal(literal.status, 200);
    const body = (await literal.json()) as { recipes: unknown[] };
    assert.deepEqual(body.recipes, []);
    }),
  );
});

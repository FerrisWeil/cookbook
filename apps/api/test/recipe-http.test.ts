import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { MESSAGES } from "@cookbook/shared";
import { verifies } from "@cookbook/test";

import { listen } from "../src/http.ts";
import { createMemoryRecipeStore } from "../src/recipes/index.ts";

const MCP_TOKEN = "test-api-mcp-token-xx";
const WEB_TOKEN = "test-api-web-token-xx";
const CALLER_TOKENS = [MCP_TOKEN, WEB_TOKEN];

async function seedStore() {
  const store = createMemoryRecipeStore();
  await store.save({
    id: "alpha",
    title: "Example: Alpha",
    steps: ["one", "two"],
    servings: 2,
    actor: "chef",
    favorite: true,
    rating: 4,
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

describe("recipe HTTP", () => {
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};

  before(async () => {
    const { server, url } = await listen("127.0.0.1", 0, {
      getReady: async () => ({ status: "ok", database: "up", seed: true }),
      recipes: await seedStore(),
      callerTokens: CALLER_TOKENS,
    });
    baseUrl = url;
    close = () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
  });

  after(async () => {
    await close();
  });

  it("rejects recipe routes without a caller token", async () => {
    const response = await fetch(`${baseUrl}/recipes`);
    assert.equal(response.status, 401);
    assert.equal(
      response.headers.get("www-authenticate"),
      'Bearer realm="cookbook-api"',
    );
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("accepts either caller token and omits hidden recipes", verifies("82", "45088ea5d955657a", async () => {
    const mcp = await fetch(`${baseUrl}/recipes`, {
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    const web = await fetch(`${baseUrl}/recipes`, {
      headers: { authorization: `Bearer ${WEB_TOKEN}` },
    });
    assert.equal(mcp.status, 200);
    assert.equal(web.status, 200);
    assert.deepEqual(await mcp.json(), {
      recipes: [{ id: "alpha", title: "Example: Alpha" }],
    });
  }));

  it("reads a visible recipe and treats a hidden id as not found", async () => {
    const visible = await fetch(`${baseUrl}/recipes/alpha`, {
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(visible.status, 200);
    const body = (await visible.json()) as { recipe: { title: string } };
    assert.equal(body.recipe.title, "Example: Alpha");

    const hidden = await fetch(`${baseUrl}/recipes/hidden`, {
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(hidden.status, 404);
    assert.deepEqual(await hidden.json(), {
      error: "not_found",
      message: MESSAGES.notFound,
    });
  });

  it("does not crash on a malformed recipe id", async () => {
    const response = await fetch(`${baseUrl}/recipes/%80`, {
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "not_found",
      message: MESSAGES.notFound,
    });
  });

  it("saves a recipe and does not revive a hidden id", async () => {
    const created = await fetch(`${baseUrl}/recipes`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${MCP_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Example: Beta",
        steps: ["mix"],
        servings: 1,
        actor: "chef",
      }),
    });
    assert.equal(created.status, 200);
    const saved = (await created.json()) as { recipe: { id: string; title: string } };
    assert.equal(saved.recipe.title, "Example: Beta");
    assert.ok(saved.recipe.id);

    const revive = await fetch(`${baseUrl}/recipes`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${MCP_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: "hidden",
        title: "Example: Revived",
        steps: ["no"],
        servings: 1,
        actor: "chef",
      }),
    });
    assert.equal(revive.status, 404);
  });
});

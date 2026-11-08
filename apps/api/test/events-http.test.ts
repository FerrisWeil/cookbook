import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  createCommitHub,
  notifyingRecipeStore,
} from "../src/commits.ts";
import { listen } from "../src/http.ts";
import { createMemoryRecipeStore } from "../src/recipes/index.ts";
import { createMemorySessionStore } from "../src/sessions/index.ts";

const MCP_TOKEN = "test-api-mcp-token-xx";
const WEB_TOKEN = "test-api-web-token-xx";

async function readSse(
  response: Response,
  match: (chunk: string) => boolean,
  timeoutMs: number,
): Promise<string> {
  const reader = response.body?.getReader();
  assert.ok(reader);
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const remaining = Math.max(1, deadline - Date.now());
      const result = await Promise.race([
        reader.read(),
        new Promise<undefined>((resolve) => {
          setTimeout(() => resolve(undefined), remaining);
        }),
      ]);
      if (!result) {
        break;
      }
      if (result.done) {
        break;
      }
      text += decoder.decode(result.value, { stream: true });
      if (match(text)) {
        return text;
      }
    }
    throw new Error(`sse timeout: ${text}`);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

describe("committed-change stream", () => {
  const hub = createCommitHub();
  const store = notifyingRecipeStore(createMemoryRecipeStore(), hub);
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};

  before(async () => {
    await store.save({
      id: "alpha",
      title: "Example: Alpha",
      steps: ["one"],
      servings: 1,
      actor: "chef",
    });
    const api = await listen("127.0.0.1", 0, {
      getReady: async () => ({ status: "ok", database: "up", seed: true }),
      recipes: store,
      sessions: createMemorySessionStore(),
      callerTokens: [MCP_TOKEN, WEB_TOKEN],
      commits: hub,
      sseHeartbeatMs: 400,
    });
    baseUrl = api.url;
    close = () => api.close();
  });

  after(async () => {
    await close();
  });

  it("refuses the stream without a caller token", async () => {
    const response = await fetch(`${baseUrl}/recipes/events`);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("does not treat events as a recipe id", async () => {
    const asRecipe = await fetch(`${baseUrl}/recipes/events`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${MCP_TOKEN}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(asRecipe.status, 404);
  });

  it("notifies two subscribers of a later save without polling", async () => {
    const first = await fetch(`${baseUrl}/recipes/events`, {
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    const second = await fetch(`${baseUrl}/recipes/events`, {
      headers: { authorization: `Bearer ${WEB_TOKEN}` },
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.match(first.headers.get("content-type") ?? "", /text\/event-stream/);
    assert.equal(first.headers.get("x-accel-buffering"), "no");
    const saved = await fetch(`${baseUrl}/recipes`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${MCP_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: "alpha",
        title: "Example: Alpha live",
        steps: ["one"],
        servings: 1,
        actor: "chef",
      }),
    });
    assert.equal(saved.status, 200);
    const body = (await saved.json()) as { recipe: { id: string } };
    const firstText = await readSse(
      first,
      (chunk) => chunk.includes("event: committed") && chunk.includes(body.recipe.id),
      4_000,
    );
    const secondText = await readSse(
      second,
      (chunk) => chunk.includes("event: committed") && chunk.includes(body.recipe.id),
      4_000,
    );
    assert.match(firstText, /"op":"saved"/);
    assert.match(secondText, /"op":"saved"/);
    assert.equal(firstText.includes(MCP_TOKEN), false);
    assert.equal(secondText.includes(WEB_TOKEN), false);
  });

  it("keeps an open stream past the HTTP keep-alive timeout and then tears down", async () => {
    const opened = Date.now();
    const response = await fetch(`${baseUrl}/recipes/events`, {
      headers: { authorization: `Bearer ${MCP_TOKEN}` },
    });
    assert.equal(response.status, 200);
    const text = await readSse(
      response,
      (chunk) => Date.now() - opened >= 5_500 && chunk.includes(": keepalive"),
      7_000,
    );
    assert.match(text, /retry: 3000/);
    assert.ok((text.match(/: keepalive/g) ?? []).length >= 2);
    assert.equal(text.includes(MCP_TOKEN), false);
  });
});

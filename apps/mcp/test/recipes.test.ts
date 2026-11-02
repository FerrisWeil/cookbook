import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { invalidFieldMessage, MESSAGES } from "@cookbook/shared";
import { covers } from "@cookbook/test";

import { listen as listenApi } from "../../api/src/http.ts";
import { createMemoryRecipeStore } from "../../api/src/recipes/index.ts";
import { listen as listenMcp } from "../src/http.ts";
import { TEST_API_TOKEN, TEST_TOKEN, testConfig } from "./helpers.ts";

const WEB_TOKEN = "test-api-web-token-xx";

async function seedStore() {
  const store = createMemoryRecipeStore();
  await store.save({
    id: "alpha",
    title: "Example: Alpha",
    steps: ["mix", "bake"],
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
    steps: ["mix"],
    servings: 2,
    actor: "chef",
  });
  await store.hide({ id: "hidden", actor: "chef" });
  await store.save({
    id: "plain",
    title: "Example: Plain",
    steps: ["stir"],
    servings: 1,
    actor: "chef",
  });
  return store;
}

function toolText(result: { content?: unknown }): string {
  const content = result.content;
  if (!Array.isArray(content) || content.length === 0) {
    return "";
  }
  const first = content[0];
  if (
    first !== null &&
    typeof first === "object" &&
    "text" in first &&
    typeof first.text === "string"
  ) {
    return first.text;
  }
  return "";
}

async function connectClient(url: string): Promise<Client> {
  const client = new Client({ name: "cookbook-mcp-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
    requestInit: {
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    },
  });
  await client.connect(transport);
  return client;
}

describe("mcp recipe tools", () => {
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};

  before(async () => {
    const api = await listenApi("127.0.0.1", 0, {
      getReady: async () => ({ status: "ok", database: "up", seed: true }),
      recipes: await seedStore(),
      callerTokens: [TEST_API_TOKEN, WEB_TOKEN],
    });
    const mcp = await listenMcp(
      testConfig({
        apiBaseUrl: api.url,
        apiAuthToken: TEST_API_TOKEN,
      }),
    );
    baseUrl = mcp.url;
    close = async () => {
      await new Promise<void>((resolve, reject) => {
        mcp.server.close((error) => (error ? reject(error) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        api.server.close((error) => (error ? reject(error) : resolve()));
      });
    };
  });

  after(async () => {
    await close();
  });

  it("returns that recipe for a known id", async () => {
    covers("1.1.1");
    const client = await connectClient(baseUrl);
    try {
      const result = await client.callTool({
        name: "read",
        arguments: { id: "alpha", fields: ["id", "title"] },
      });
      assert.equal(result.isError, undefined);
      assert.deepEqual(result.structuredContent, {
        id: "alpha",
        title: "Example: Alpha",
      });
    } finally {
      await client.close();
    }
  });

  it("tells the agent an ID is required", async () => {
    covers("1.1.2");
    const client = await connectClient(baseUrl);
    try {
      const result = await client.callTool({ name: "read", arguments: {} });
      assert.equal(result.isError, true);
      assert.equal(toolText(result), MESSAGES.idRequired);
    } finally {
      await client.close();
    }
  });

  it("tells the agent a missing or hidden recipe was not found", async () => {
    covers("1.1.3", "1.1.4");
    const client = await connectClient(baseUrl);
    try {
      const missing = await client.callTool({
        name: "read",
        arguments: { id: "missing" },
      });
      assert.equal(missing.isError, true);
      assert.equal(toolText(missing), MESSAGES.notFound);
      const hidden = await client.callTool({
        name: "read",
        arguments: { id: "hidden" },
      });
      assert.equal(hidden.isError, true);
      assert.equal(toolText(hidden), MESSAGES.notFound);
    } finally {
      await client.close();
    }
  });

  it("returns only the requested fields", async () => {
    covers("1.1.5");
    const client = await connectClient(baseUrl);
    try {
      const result = await client.callTool({
        name: "read",
        arguments: { id: "alpha", fields: ["id", "favorite"] },
      });
      assert.equal(result.isError, undefined);
      assert.deepEqual(result.structuredContent, {
        id: "alpha",
        favorite: true,
      });
    } finally {
      await client.close();
    }
  });

  it("tells the agent which field is invalid", async () => {
    covers("1.1.6");
    const client = await connectClient(baseUrl);
    try {
      const result = await client.callTool({
        name: "read",
        arguments: { id: "alpha", fields: ["nope"] },
      });
      assert.equal(result.isError, true);
      assert.equal(toolText(result), invalidFieldMessage("nope"));
    } finally {
      await client.close();
    }
  });

  it("returns title, steps, servings, and nutrition when present", async () => {
    covers("1.1.7");
    const client = await connectClient(baseUrl);
    try {
      const withNutrition = await client.callTool({
        name: "read",
        arguments: { id: "alpha" },
      });
      assert.equal(withNutrition.isError, undefined);
      assert.deepEqual(withNutrition.structuredContent, {
        title: "Example: Alpha",
        steps: ["mix", "bake"],
        servings: 2,
        nutrition: {
          source: "entered",
          calories: 10,
          protein: null,
          fat: null,
          carbs: null,
        },
      });
      const withoutNutrition = await client.callTool({
        name: "read",
        arguments: { id: "plain" },
      });
      assert.equal(withoutNutrition.isError, undefined);
      assert.deepEqual(withoutNutrition.structuredContent, {
        title: "Example: Plain",
        steps: ["stir"],
        servings: 1,
      });
    } finally {
      await client.close();
    }
  });

  it("omits a deleted recipe from the list", async () => {
    covers("1.2.1");
    const client = await connectClient(baseUrl);
    try {
      const result = await client.callTool({ name: "list", arguments: {} });
      assert.equal(result.isError, undefined);
      const body = result.structuredContent as {
        recipes: Array<{ id: string; title: string }>;
      };
      const ids = body.recipes.map((recipe) => recipe.id);
      assert.ok(ids.includes("alpha"));
      assert.ok(ids.includes("plain"));
      assert.equal(ids.includes("hidden"), false);
    } finally {
      await client.close();
    }
  });

  it("saves nutrition, actor, title, steps, servings, favorite, and rating", async () => {
    covers("1.3.1", "1.3.2", "1.3.4", "1.3.6", "1.3.8", "1.3.10", "1.3.11");
    const client = await connectClient(baseUrl);
    try {
      const saved = await client.callTool({
        name: "save",
        arguments: {
          id: "created",
          title: "Example: Created",
          steps: ["chop", "cook"],
          servings: 3,
          actor: "chef",
          favorite: true,
          rating: 5,
          nutrition: { source: "copied", calories: 20 },
        },
      });
      assert.equal(saved.isError, undefined);
      const read = await client.callTool({
        name: "read",
        arguments: {
          id: "created",
          fields: [
            "id",
            "title",
            "steps",
            "servings",
            "actor",
            "favorite",
            "rating",
            "nutrition",
          ],
        },
      });
      assert.equal(read.isError, undefined);
      assert.deepEqual(read.structuredContent, {
        id: "created",
        title: "Example: Created",
        steps: ["chop", "cook"],
        servings: 3,
        actor: "chef",
        favorite: true,
        rating: 5,
        nutrition: {
          source: "copied",
          calories: 20,
          protein: null,
          fat: null,
          carbs: null,
        },
      });
    } finally {
      await client.close();
    }
  });

  it("tells the agent when actor, title, steps, or servings are missing", async () => {
    covers("1.3.3", "1.3.5", "1.3.7", "1.3.9");
    const client = await connectClient(baseUrl);
    try {
      const noActor = await client.callTool({
        name: "save",
        arguments: {
          title: "Example: Missing actor",
          steps: ["mix"],
          servings: 1,
        },
      });
      assert.equal(noActor.isError, true);
      assert.equal(toolText(noActor), MESSAGES.actorRequired);

      const noTitle = await client.callTool({
        name: "save",
        arguments: { steps: ["mix"], servings: 1, actor: "chef" },
      });
      assert.equal(noTitle.isError, true);
      assert.equal(toolText(noTitle), MESSAGES.titleRequired);

      const noSteps = await client.callTool({
        name: "save",
        arguments: { title: "Example: Missing steps", servings: 1, actor: "chef" },
      });
      assert.equal(noSteps.isError, true);
      assert.equal(toolText(noSteps), MESSAGES.stepsRequired);

      const noServings = await client.callTool({
        name: "save",
        arguments: {
          title: "Example: Missing servings",
          steps: ["mix"],
          actor: "chef",
        },
      });
      assert.equal(noServings.isError, true);
      assert.equal(toolText(noServings), MESSAGES.servingsRequired);
    } finally {
      await client.close();
    }
  });

  it("tells the agent journal, tag, and search are not available", async () => {
    covers("1.5.1", "1.5.2", "1.5.3");
    const client = await connectClient(baseUrl);
    try {
      for (const name of ["journal", "tag", "search"]) {
        const result = await client.callTool({ name, arguments: {} });
        assert.equal(result.isError, true, name);
        assert.equal(toolText(result), MESSAGES.notAvailable, name);
      }
    } finally {
      await client.close();
    }
  });
});

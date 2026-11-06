import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { invalidFieldMessage, MESSAGES } from "@cookbook/shared";
import { verifies } from "@cookbook/test";

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

  async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = await connectClient(baseUrl);
    try {
      return await fn(client);
    } finally {
      await client.close();
    }
  }

  it(
    "returns that recipe for a known id",
    verifies("6", "c4b8cb4c3b9ed214", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({
          name: "read",
          arguments: { id: "alpha", fields: ["id", "title"] },
        });
        assert.equal(result.isError, undefined);
        assert.deepEqual(result.structuredContent, {
          id: "alpha",
          title: "Example: Alpha",
        });
      });
    }),
  );

  it(
    "tells the agent an ID is required",
    verifies("7", "f4272c3548da20bf", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({ name: "read", arguments: {} });
        assert.equal(result.isError, true);
        assert.equal(toolText(result), MESSAGES.idRequired);
      });
    }),
  );

  it(
    "tells the agent a missing recipe was not found",
    verifies("8", "5838f24e627e217f", async () => {
      await withClient(async (client) => {
        const missing = await client.callTool({
          name: "read",
          arguments: { id: "missing" },
        });
        assert.equal(missing.isError, true);
        assert.equal(toolText(missing), MESSAGES.notFound);
      });
    }),
  );

  it(
    "tells the agent a hidden recipe was not found",
    verifies("9", "ee67cfa455745b62", async () => {
      await withClient(async (client) => {
        const hidden = await client.callTool({
          name: "read",
          arguments: { id: "hidden" },
        });
        assert.equal(hidden.isError, true);
        assert.equal(toolText(hidden), MESSAGES.notFound);
      });
    }),
  );

  it(
    "returns only the requested fields",
    verifies("10", "fb2475e336a9527b", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({
          name: "read",
          arguments: { id: "alpha", fields: ["id", "favorite"] },
        });
        assert.equal(result.isError, undefined);
        assert.deepEqual(result.structuredContent, {
          id: "alpha",
          favorite: true,
        });
      });
    }),
  );

  it(
    "tells the agent which field is invalid",
    verifies("11", "2d4debdfae81448c", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({
          name: "read",
          arguments: { id: "alpha", fields: ["nope"] },
        });
        assert.equal(result.isError, true);
        assert.equal(toolText(result), invalidFieldMessage("nope"));
      });
    }),
  );

  it(
    "returns title, steps, servings, and nutrition when present",
    verifies("12", "e173b2b0baceb2fc", async () => {
      await withClient(async (client) => {
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
      });
    }),
  );

  it(
    "omits a deleted recipe from the list",
    verifies("14", "7076e5f4bd72a2cd", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({ name: "list", arguments: {} });
        assert.equal(result.isError, undefined);
        const body = result.structuredContent as {
          recipes: Array<{ id: string; title: string }>;
        };
        const ids = body.recipes.map((recipe) => recipe.id);
        assert.ok(ids.includes("alpha"));
        assert.ok(ids.includes("plain"));
        assert.equal(ids.includes("hidden"), false);
      });
    }),
  );

  it(
    "saves a nutrition row",
    verifies("15", "41e1339cbfa4f303", async () => {
      await withClient(async (client) => {
        const saved = await client.callTool({
          name: "save",
          arguments: {
            id: "created-nutrition",
            title: "Example: Nutrition",
            steps: ["mix"],
            servings: 1,
            actor: "chef",
            nutrition: { source: "copied", calories: 20 },
          },
        });
        assert.equal(saved.isError, undefined);
        const read = await client.callTool({
          name: "read",
          arguments: { id: "created-nutrition", fields: ["nutrition"] },
        });
        assert.deepEqual(read.structuredContent, {
          nutrition: {
            source: "copied",
            calories: 20,
            protein: null,
            fat: null,
            carbs: null,
          },
        });
      });
    }),
  );

  it(
    "saves an actor",
    verifies("16", "0db27c8c931ca88d", async () => {
      await withClient(async (client) => {
        await client.callTool({
          name: "save",
          arguments: {
            id: "created-actor",
            title: "Example: Actor",
            steps: ["mix"],
            servings: 1,
            actor: "chef",
          },
        });
        const read = await client.callTool({
          name: "read",
          arguments: { id: "created-actor", fields: ["actor"] },
        });
        assert.deepEqual(read.structuredContent, { actor: "chef" });
      });
    }),
  );

  it(
    "tells the agent an actor is required",
    verifies("17", "5dd6eb71fdeb08da", async () => {
      await withClient(async (client) => {
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
      });
    }),
  );

  it(
    "saves a non-empty title",
    verifies("18", "b7ce4640ae4f5ef3", async () => {
      await withClient(async (client) => {
        await client.callTool({
          name: "save",
          arguments: {
            id: "created-title",
            title: "Example: Created",
            steps: ["mix"],
            servings: 1,
            actor: "chef",
          },
        });
        const read = await client.callTool({
          name: "read",
          arguments: { id: "created-title", fields: ["title"] },
        });
        assert.deepEqual(read.structuredContent, { title: "Example: Created" });
      });
    }),
  );

  it(
    "tells the agent a title is required",
    verifies("19", "1311de5739bd6ba1", async () => {
      await withClient(async (client) => {
        const noTitle = await client.callTool({
          name: "save",
          arguments: { steps: ["mix"], servings: 1, actor: "chef" },
        });
        assert.equal(noTitle.isError, true);
        assert.equal(toolText(noTitle), MESSAGES.titleRequired);
      });
    }),
  );

  it(
    "saves steps in order",
    verifies("20", "c3fe40bf94887c63", async () => {
      await withClient(async (client) => {
        await client.callTool({
          name: "save",
          arguments: {
            id: "created-steps",
            title: "Example: Steps",
            steps: ["chop", "cook"],
            servings: 1,
            actor: "chef",
          },
        });
        const read = await client.callTool({
          name: "read",
          arguments: { id: "created-steps", fields: ["steps"] },
        });
        assert.deepEqual(read.structuredContent, { steps: ["chop", "cook"] });
      });
    }),
  );

  it(
    "tells the agent steps are required",
    verifies("21", "93c6bdc492e58cbf", async () => {
      await withClient(async (client) => {
        const noSteps = await client.callTool({
          name: "save",
          arguments: { title: "Example: Missing steps", servings: 1, actor: "chef" },
        });
        assert.equal(noSteps.isError, true);
        assert.equal(toolText(noSteps), MESSAGES.stepsRequired);
      });
    }),
  );

  it(
    "saves servings",
    verifies("22", "39fc39a9f2647f7a", async () => {
      await withClient(async (client) => {
        await client.callTool({
          name: "save",
          arguments: {
            id: "created-servings",
            title: "Example: Servings",
            steps: ["mix"],
            servings: 3,
            actor: "chef",
          },
        });
        const read = await client.callTool({
          name: "read",
          arguments: { id: "created-servings", fields: ["servings"] },
        });
        assert.deepEqual(read.structuredContent, { servings: 3 });
      });
    }),
  );

  it(
    "tells the agent servings are required",
    verifies("23", "fe2b6bc4158042fa", async () => {
      await withClient(async (client) => {
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
      });
    }),
  );

  it(
    "saves a favorite",
    verifies("24", "66c03d1d117246f7", async () => {
      await withClient(async (client) => {
        await client.callTool({
          name: "save",
          arguments: {
            id: "created-favorite",
            title: "Example: Favorite",
            steps: ["mix"],
            servings: 1,
            actor: "chef",
            favorite: true,
          },
        });
        const read = await client.callTool({
          name: "read",
          arguments: { id: "created-favorite", fields: ["favorite"] },
        });
        assert.deepEqual(read.structuredContent, { favorite: true });
      });
    }),
  );

  it(
    "saves a rating",
    verifies("25", "b5e3de80f5ee4ac9", async () => {
      await withClient(async (client) => {
        await client.callTool({
          name: "save",
          arguments: {
            id: "created-rating",
            title: "Example: Rating",
            steps: ["mix"],
            servings: 1,
            actor: "chef",
            rating: 5,
          },
        });
        const read = await client.callTool({
          name: "read",
          arguments: { id: "created-rating", fields: ["rating"] },
        });
        assert.deepEqual(read.structuredContent, { rating: 5 });
      });
    }),
  );

  it(
    "tells the agent journal is not available",
    verifies("28", "901c6415b1cbb6c2", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({ name: "journal", arguments: {} });
        assert.equal(result.isError, true);
        assert.equal(toolText(result), MESSAGES.notAvailable);
      });
    }),
  );

  it(
    "tells the agent tag is not available",
    verifies("29", "c782cf229481b17a", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({ name: "tag", arguments: {} });
        assert.equal(result.isError, true);
        assert.equal(toolText(result), MESSAGES.notAvailable);
      });
    }),
  );

  it(
    "tells the agent search is not available",
    verifies("30", "ccf205dd6927409c", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({ name: "search", arguments: {} });
        assert.equal(result.isError, true);
        assert.equal(toolText(result), MESSAGES.notAvailable);
      });
    }),
  );
});

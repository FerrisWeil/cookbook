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
import { createMemorySessionStore } from "../../api/src/sessions/index.ts";
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
      sessions: createMemorySessionStore(),
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
      await api.close();
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
    verifies("9mar", "32c8001111e0aec3", async () => {
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
    verifies("t9wx", "c91774fc8d8cf31f", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({ name: "read", arguments: {} });
        assert.equal(result.isError, true);
        assert.equal(toolText(result), MESSAGES.idRequired);
      });
    }),
  );

  it(
    "tells the agent a missing recipe was not found",
    verifies("f5ea", "40e5d3fa56dc54d1", async () => {
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
    verifies("tgph", "0f15df104c711f1d", async () => {
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
    verifies("ejq3", "233bf6cca7338f8f", async () => {
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
    verifies("b738", "70ce5fbcdadae422", async () => {
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
    verifies("ddqh", "f44be30f7e9891dc", async () => {
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
    verifies("symt", "fb1e099707c52064", async () => {
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
    verifies("quj5", "224c3e11f8d1d3ae", async () => {
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
    verifies("sb5n", "dd9457446e3b6644", async () => {
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
    verifies("eb8d", "7020e36d2426b479", async () => {
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
    verifies("z6h8", "c4e850fda8370440", async () => {
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
    verifies("zfqe", "189fe7bb37d9e442", async () => {
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
    verifies("czhp", "10b2380b535bab90", async () => {
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
    verifies("tc73", "c024d6b24d5363e5", async () => {
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
    verifies("zw9y", "3ef3237691e94c0e", async () => {
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
    verifies("j76x", "93f5c39d59b09771", async () => {
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
    verifies("k6np", "f4fc4581e8b20f9b", async () => {
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
    verifies("vd2v", "1ec9ea2e99862633", async () => {
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
    verifies("rt8m", "128e257e0c8b83fe", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({ name: "journal", arguments: {} });
        assert.equal(result.isError, true);
        assert.equal(toolText(result), MESSAGES.notAvailable);
      });
    }),
  );

  it(
    "tells the agent tag is not available",
    verifies("m39p", "422d683394890ea9", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({ name: "tag", arguments: {} });
        assert.equal(result.isError, true);
        assert.equal(toolText(result), MESSAGES.notAvailable);
      });
    }),
  );

  it(
    "tells the agent search is not available",
    verifies("5jby", "d6a17d2c8816a0f9", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({ name: "search", arguments: {} });
        assert.equal(result.isError, true);
        assert.equal(toolText(result), MESSAGES.notAvailable);
      });
    }),
  );

  it(
    "returns facts when they are in the field list",
    verifies("5k3y", "31f2fc9b132de0a7", async () => {
      await withClient(async (client) => {
        await client.callTool({
          name: "save",
          arguments: {
            id: "facts-read",
            title: "Example: Facts read",
            steps: ["mix"],
            servings: 1,
            actor: "chef",
            facts: {
              primaryProtein: "tofu/tempeh",
              totalMinutes: 25,
              effort: "low",
              mealTypes: ["lunch"],
            },
          },
        });
        const result = await client.callTool({
          name: "read",
          arguments: { id: "facts-read", fields: ["facts"] },
        });
        assert.equal(result.isError, undefined);
        assert.deepEqual(result.structuredContent, {
          facts: {
            primaryProtein: "tofu/tempeh",
            totalMinutes: 25,
            effort: "low",
            mealTypes: ["lunch"],
          },
        });
        const defaults = await client.callTool({
          name: "read",
          arguments: { id: "facts-read" },
        });
        assert.equal(defaults.isError, undefined);
        assert.equal(
          "facts" in (defaults.structuredContent as object),
          false,
        );
      });
    }),
  );

  it(
    "records facts on save",
    verifies("qm78", "866b7e94cb9c804c", async () => {
      await withClient(async (client) => {
        const saved = await client.callTool({
          name: "save",
          arguments: {
            id: "facts-save",
            title: "Example: Facts save",
            steps: ["mix"],
            servings: 2,
            actor: "chef",
            facts: {
              primaryProtein: "beans/lentils",
              totalMinutes: 40,
              effort: "medium",
              mealTypes: ["dinner", "lunch"],
            },
          },
        });
        assert.equal(saved.isError, undefined);
        const body = saved.structuredContent as {
          facts: {
            primaryProtein: string;
            totalMinutes: number;
            effort: string;
            mealTypes: string[];
          };
        };
        assert.deepEqual(body.facts, {
          primaryProtein: "beans/lentils",
          totalMinutes: 40,
          effort: "medium",
          mealTypes: ["lunch", "dinner"],
        });
      });
    }),
  );

  it(
    "includes facts on the recipe list",
    verifies("qa7w", "298f367481cf26da", async () => {
      await withClient(async (client) => {
        const result = await client.callTool({ name: "list", arguments: {} });
        assert.equal(result.isError, undefined);
        const body = result.structuredContent as {
          recipes: Array<{ id: string; title: string; facts: unknown }>;
        };
        const alpha = body.recipes.find((recipe) => recipe.id === "alpha");
        assert.ok(alpha);
        assert.deepEqual(alpha.facts, {
          primaryProtein: null,
          totalMinutes: null,
          effort: null,
          mealTypes: [],
        });
      });
    }),
  );

  it(
    "lists without a query using the existing recipe array and keeps search unavailable",
    verifies("avr2", "523f72725d720d77", async () => {
      await withClient(async (client) => {
        const listed = await client.callTool({ name: "list", arguments: {} });
        assert.equal(listed.isError, undefined);
        const body = listed.structuredContent as {
          recipes: Array<{ id: string; title: string; facts: unknown }>;
          proteinChoices: string[];
        };
        assert.ok(Array.isArray(body.recipes));
        assert.ok(body.recipes.some((item) => item.id === "alpha"));
        assert.equal(
          body.recipes.some((item) => item.id === "hidden"),
          false,
        );
        for (const item of body.recipes) {
          assert.equal("ingredients" in item, false);
          assert.equal(typeof item.title, "string");
          assert.ok("facts" in item);
        }
        assert.ok(Array.isArray(body.proteinChoices));
        const filtered = await client.callTool({
          name: "list",
          arguments: { query: { field: "title", phrase: "Alpha" } },
        });
        assert.equal(filtered.isError, undefined);
        const filteredBody = filtered.structuredContent as {
          recipes: Array<{ id: string }>;
        };
        assert.deepEqual(
          filteredBody.recipes.map((item) => item.id),
          ["alpha"],
        );
        const search = await client.callTool({ name: "search", arguments: {} });
        assert.equal(search.isError, true);
        assert.equal(toolText(search), MESSAGES.notAvailable);
      });
    }),
  );
});

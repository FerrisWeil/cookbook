import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { MESSAGES, type CookingSession } from "@cookbook/shared";
import { verifies } from "@cookbook/test";

import { listen as listenApi } from "../../api/src/http.ts";
import { createMemoryRecipeStore } from "../../api/src/recipes/index.ts";
import { createMemorySessionStore } from "../../api/src/sessions/index.ts";
import { listen as listenMcp } from "../src/http.ts";
import { TEST_API_TOKEN, TEST_TOKEN, testConfig } from "./helpers.ts";

const WEB_TOKEN = "test-api-web-token-xx";

function toolText(result: { content?: unknown; isError?: boolean }): string {
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

describe("mcp cooking session", () => {
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};

  before(async () => {
    const recipes = createMemoryRecipeStore();
    await recipes.save({
      id: "soup",
      title: "Example: Soup",
      steps: ["Chop.", "Simmer."],
      servings: 2,
      actor: "chef",
      ingredients: [{ line: "1 onion" }],
    });
    const api = await listenApi("127.0.0.1", 0, {
      getReady: async () => ({ status: "ok", database: "up", seed: true }),
      recipes,
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

  it(
    "lets Chef run the session and says when it has ended",
    verifies("207", "ca4c2d5c64cdcd58", async () => {
      const client = await connectClient(baseUrl);
      try {
        const none = await client.callTool({ name: "session_resume", arguments: {} });
        assert.equal(none.isError, true);
        assert.equal(toolText(none), MESSAGES.sessionMissing);

        const started = await client.callTool({
          name: "session_start",
          arguments: { mutationId: "chef-start", recipeId: "soup" },
        });
        assert.equal(started.isError, undefined);
        const session = started.structuredContent as CookingSession;
        assert.equal(session.snapshot.title, "Example: Soup");
        assert.deepEqual(session.snapshot.steps, ["Chop.", "Simmer."]);
        assert.equal(session.displayedStep, 0);
        assert.deepEqual(session.completedSteps, []);

        const shown = await client.callTool({
          name: "session_show",
          arguments: { mutationId: "chef-show", sessionId: session.id, step: 1 },
        });
        assert.equal((shown.structuredContent as CookingSession).displayedStep, 1);
        assert.deepEqual((shown.structuredContent as CookingSession).completedSteps, []);

        const done = await client.callTool({
          name: "session_complete",
          arguments: { mutationId: "chef-done", sessionId: session.id, step: 0 },
        });
        const doneSession = done.structuredContent as CookingSession;
        assert.equal(doneSession.displayedStep, 1);
        assert.deepEqual(doneSession.completedSteps, [0]);

        const undone = await client.callTool({
          name: "session_undo",
          arguments: { mutationId: "chef-undo", sessionId: session.id, step: 0 },
        });
        assert.deepEqual((undone.structuredContent as CookingSession).completedSteps, []);
        assert.equal((undone.structuredContent as CookingSession).displayedStep, 1);

        const finished = await client.callTool({
          name: "session_finish",
          arguments: { mutationId: "chef-finish", sessionId: session.id },
        });
        assert.equal((finished.structuredContent as CookingSession).status, "finished");

        const late = await client.callTool({
          name: "session_complete",
          arguments: { mutationId: "chef-late", sessionId: session.id, step: 0 },
        });
        assert.equal(late.isError, true);
        assert.equal(toolText(late), MESSAGES.sessionEnded);

        const revived = await client.callTool({
          name: "session_start",
          arguments: { mutationId: "chef-start", recipeId: "soup" },
        });
        assert.equal(revived.isError, true);
        assert.equal(toolText(revived), MESSAGES.sessionEnded);

        const after = await client.callTool({ name: "session_resume", arguments: {} });
        assert.equal(after.isError, true);
        assert.equal(toolText(after), MESSAGES.sessionMissing);
      } finally {
        await client.close();
      }
    }),
  );
});

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { MESSAGES } from "@cookbook/shared";
import { verifies } from "@cookbook/test";

import { createCommitHub, notifyingSessionStore } from "../src/commits.ts";
import { listen } from "../src/http.ts";
import { createMemoryRecipeStore } from "../src/recipes/index.ts";
import { createMemorySessionStore } from "../src/sessions/index.ts";

const MCP_TOKEN = "test-api-mcp-token-xx";
const WEB_TOKEN = "test-api-web-token-xx";

async function readSessionEvent(
  response: Response,
  start: () => Promise<Response>,
): Promise<{ text: string; started: Response }> {
  const reader = response.body?.getReader();
  assert.ok(reader);
  const decoder = new TextDecoder();
  let text = "";
  let started: Promise<Response> | undefined;
  const deadline = Date.now() + 2000;
  try {
    while (Date.now() < deadline) {
      const result = await Promise.race([
        reader.read(),
        new Promise<undefined>((resolve) => {
          setTimeout(() => resolve(undefined), Math.max(1, deadline - Date.now()));
        }),
      ]);
      if (!result || result.done) {
        break;
      }
      text += decoder.decode(result.value, { stream: true });
      if (!started && text.includes(": keepalive")) {
        started = start();
      }
      if (started && text.includes("event: session")) {
        return { text, started: await started };
      }
    }
    throw new Error(`sse timeout: ${text}`);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

describe("cooking session HTTP", () => {
  const hub = createCommitHub();
  const recipes = createMemoryRecipeStore();
  const sessions = notifyingSessionStore(createMemorySessionStore(), hub);
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};

  before(async () => {
    await recipes.save({
      id: "soup",
      title: "Example: Soup",
      steps: ["Chop.", "Simmer."],
      servings: 2,
      actor: "chef",
      ingredients: [{ line: "1 onion" }],
    });
    const api = await listen("127.0.0.1", 0, {
      getReady: async () => ({ status: "ok", database: "up", seed: true }),
      recipes,
      sessions,
      callerTokens: [MCP_TOKEN, WEB_TOKEN],
      commits: hub,
      sseHeartbeatMs: 60_000,
    });
    baseUrl = api.url;
    close = () => api.close();
  });

  after(async () => {
    await close();
  });

  function auth(method: string, path: string, body?: unknown) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${WEB_TOKEN}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  it(
    "keeps the snapshot after the recipe changes",
    verifies("200", "c5b91d2e352a2b25", async () => {
      const started = await auth("POST", "/sessions", {
        mutationId: "http-start",
        recipeId: "soup",
      });
      assert.equal(started.status, 200);
      const created = (await started.json()) as {
        session: { snapshot: { title: string; ingredients: string[]; steps: string[] } };
      };
      assert.deepEqual(created.session.snapshot, {
        title: "Example: Soup",
        servings: 2,
        ingredients: ["1 onion"],
        steps: ["Chop.", "Simmer."],
      });
      const saved = await auth("PUT", "/recipes", {
        id: "soup",
        title: "Example: Stew",
        steps: ["Brown."],
        servings: 4,
        actor: "chef",
        ingredients: [{ line: "2 carrots" }],
      });
      assert.equal(saved.status, 200);
      const active = await auth("GET", "/sessions/active");
      assert.equal(active.status, 200);
      const body = (await active.json()) as {
        session: { snapshot: { title: string; ingredients: string[]; steps: string[] } };
      };
      assert.deepEqual(body.session.snapshot, created.session.snapshot);
    }),
  );

  it(
    "names a step change that arrives after finish",
    verifies("204", "c204caff290d410d", async () => {
      const active = await auth("GET", "/sessions/active");
      const current = (await active.json()) as { session: { id: string } };
      const finished = await auth("POST", `/sessions/${current.session.id}/finish`, {
        mutationId: "http-finish",
      });
      assert.equal(finished.status, 200);
      const late = await auth(
        "POST",
        `/sessions/${current.session.id}/steps/0/complete`,
        { mutationId: "http-late" },
      );
      assert.equal(late.status, 409);
      const body = (await late.json()) as { error: string; message: string };
      assert.equal(body.error, "session_ended");
      assert.equal(body.message, MESSAGES.sessionEnded);
      const resume = await auth("GET", "/sessions/active");
      assert.equal(resume.status, 404);
      assert.equal(
        ((await resume.json()) as { message: string }).message,
        MESSAGES.sessionMissing,
      );
    }),
  );

  it(
    "sends a session change on the open event stream",
    verifies("208", "3aa1e397375c1770", async () => {
      const stream = await fetch(`${baseUrl}/recipes/events`, {
        headers: { authorization: `Bearer ${MCP_TOKEN}` },
      });
      assert.equal(stream.status, 200);
      const { text, started: response } = await readSessionEvent(stream, () =>
        auth("POST", "/sessions", {
          mutationId: "http-start-live",
          recipeId: "soup",
        }),
      );
      assert.equal(response.status, 200);
      const session = (await response.json()) as { session: { id: string } };
      assert.match(text, /event: session/);
      assert.match(text, new RegExp(session.session.id));
    }),
  );
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyHttpSend, factsPatchNetwork } from "../src/sync/adapters.ts";

describe("facts PATCH send classification", () => {
  it("maps validation and missing recipes as permanent", () => {
    assert.equal(classifyHttpSend(400, "invalid").kind, "permanent");
    assert.equal(classifyHttpSend(403, "forbidden").kind, "permanent");
    assert.equal(classifyHttpSend(404, "missing").kind, "permanent");
  });

  it("maps transport-class server failures as transient", () => {
    assert.equal(classifyHttpSend(500, "down").kind, "transient");
    assert.equal(classifyHttpSend(503, "unavailable").kind, "transient");
  });

  it("treats success as applied", () => {
    assert.deepEqual(classifyHttpSend(200, "ok"), { ok: true, kind: "applied" });
  });

  it("sends mutation id and only the changed facts fields", async () => {
    const original = globalThis.fetch;
    const calls: { url: string; body: unknown }[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body ?? "{}")),
      });
      return new Response(JSON.stringify({ facts: {}, mutation: { id: "m1" } }), {
        status: 200,
      });
    };
    try {
      const result = await factsPatchNetwork().send({
        id: "m1",
        recipeId: "alpha",
        fields: { primaryProtein: "seitan", title: "ignored" },
      });
      assert.deepEqual(result, { ok: true, kind: "applied" });
      assert.equal(calls[0]?.url, "/api/recipes/alpha/facts");
      assert.deepEqual(calls[0]?.body, {
        mutationId: "m1",
        fields: { primaryProtein: "seitan" },
      });
    } finally {
      globalThis.fetch = original;
    }
  });
});

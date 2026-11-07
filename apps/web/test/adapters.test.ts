import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyHttpSend } from "../src/sync/adapters.ts";

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
});

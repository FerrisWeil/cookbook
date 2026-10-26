import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isStackReady, type ReadyStatus } from "../src/index.ts";

describe("isStackReady", () => {
  it("is true only when status is ok, database is up, and seed ran", () => {
    const ready: ReadyStatus = { status: "ok", database: "up", seed: true };
    assert.equal(isStackReady(ready), true);
  });

  it("is false when the database is down", () => {
    assert.equal(
      isStackReady({ status: "degraded", database: "down", seed: false }),
      false,
    );
  });

  it("is false when migrations ran but seed is missing", () => {
    assert.equal(
      isStackReady({ status: "degraded", database: "up", seed: false }),
      false,
    );
  });
});

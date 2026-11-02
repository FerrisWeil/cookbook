import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCoverIds,
  loadRequirementCatalog,
  type Catalog,
} from "../src/catalog.ts";
import { covers } from "../src/covers.ts";

function fake(
  entries: Record<string, "topic" | "requirement" | "detail" | "removed">,
): Catalog {
  return new Map(Object.entries(entries).map(([id, kind]) => [id, { kind }]));
}

describe("assertCoverIds", () => {
  const ids = fake({
    "1": "topic",
    "1.1": "requirement",
    "1.1.1": "detail",
    "1.1.2": "detail",
    "1.2.1": "removed",
  });

  it("accepts one or more details", () => {
    assertCoverIds(ids, ["1.1.1"]);
    assertCoverIds(ids, ["1.1.1", "1.1.2"]);
  });

  it("rejects an empty list", () => {
    assert.throws(() => assertCoverIds(ids, []), /needs a requirement detail id/);
  });

  it("rejects an unknown id", () => {
    assert.throws(() => assertCoverIds(ids, ["9.9.9"]), /unknown requirement id 9.9.9/);
  });

  it("rejects a removed id", () => {
    assert.throws(() => assertCoverIds(ids, ["1.2.1"]), /requirement id 1.2.1 is removed/);
  });

  it("rejects a topic or requirement id", () => {
    assert.throws(() => assertCoverIds(ids, ["1"]), /requirement id 1 is not a detail/);
    assert.throws(() => assertCoverIds(ids, ["1.1"]), /requirement id 1.1 is not a detail/);
  });

  it("rejects when any id in the list is unknown", () => {
    assert.throws(
      () => assertCoverIds(ids, ["1.1.1", "9.9.9"]),
      /unknown requirement id 9.9.9/,
    );
  });
});

describe("loadRequirementCatalog", () => {
  it("reads details from the repo yaml", () => {
    const loaded = loadRequirementCatalog();
    assert.equal(loaded.get("6.3.1")?.kind, "detail");
    assert.equal(loaded.get("6")?.kind, "topic");
    assert.equal(loaded.get("6.3")?.kind, "requirement");
    assert.equal(loaded.has("9.9.9"), false);
  });
});

describe("covers", () => {
  it("is a function that loads the repo catalog", () => {
    assert.equal(typeof covers, "function");
    const missing = ["9.9.9"] as [string, ...string[]];
    assert.throws(() => covers(...missing), /unknown requirement id 9.9.9/);
  });
});

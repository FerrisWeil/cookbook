import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isLeaf, loadRequirementCatalog, nodeFingerprint } from "../src/catalog.ts";
import { requirementFingerprint } from "../src/fingerprint.ts";
import { verifies as wrap } from "../src/verifies.ts";

describe("loadRequirementCatalog", () => {
  it("reads leaves and shared refs from the repo yaml", () => {
    const loaded = loadRequirementCatalog();
    const secret = loaded.nodes.get("1");
    const shared = loaded.nodes.get("5");
    const recipe = loaded.nodes.get("6");
    assert.equal(secret?.inSharedTree, true);
    assert.equal(secret ? isLeaf(secret) : false, true);
    assert.equal(shared?.isRoot, true);
    assert.equal(shared ? isLeaf(shared) : true, false);
    assert.equal(recipe ? isLeaf(recipe) : false, true);
    assert.equal(loaded.nodes.has("9999"), false);
  });
});

describe("verifies runtime", () => {
  it("rejects an unknown id, a parent id, and a stale fingerprint", async () => {
    await assert.rejects(
      () => wrap("9999", "deadbeefdeadbeef", () => {})(),
      /unknown requirement id 9999/,
    );
    const catalog = loadRequirementCatalog();
    const parent = [...catalog.nodes.values()].find((node) => !isLeaf(node));
    assert.ok(parent);
    await assert.rejects(
      () => wrap(parent.id, nodeFingerprint(parent), () => {})(),
      /is not a leaf/,
    );
    const leaf = catalog.nodes.get("6");
    assert.ok(leaf);
    assert.equal(nodeFingerprint(leaf), requirementFingerprint(leaf.id, leaf.text));
    await assert.rejects(
      () => wrap(leaf.id, "deadbeefdeadbeef", () => {})(),
      /does not match/,
    );
  });
});

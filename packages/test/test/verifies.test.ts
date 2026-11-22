import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isLeaf, loadRequirementCatalog, nodeFingerprint } from "../src/catalog.ts";
import { requirementFingerprint } from "../src/fingerprint.ts";
import { verifies as wrap } from "../src/verifies.ts";

describe("loadRequirementCatalog", () => {
  it("reads leaves and shared refs from the repo yaml", () => {
    const loaded = loadRequirementCatalog();
    const sharedRoot = [...loaded.nodes.values()].find((node) => node.isRoot && node.inSharedTree);
    const sharedLeaf = sharedRoot?.childIds[0] ? loaded.nodes.get(sharedRoot.childIds[0]) : undefined;
    const normalLeaf = [...loaded.nodes.values()].find((node) => !node.inSharedTree && isLeaf(node));
    assert.equal(sharedLeaf?.inSharedTree, true);
    assert.equal(sharedLeaf ? isLeaf(sharedLeaf) : false, true);
    assert.equal(sharedRoot?.isRoot, true);
    assert.equal(sharedRoot ? isLeaf(sharedRoot) : true, false);
    assert.equal(normalLeaf ? isLeaf(normalLeaf) : false, true);
    assert.equal(loaded.nodes.has("zzzz"), false);
  });
});

describe("verifies runtime", () => {
  it("rejects an unknown id, a parent id, and a stale fingerprint", async () => {
    await assert.rejects(
      () => wrap("zzzz", "deadbeefdeadbeef", () => {})(),
      /unknown requirement id zzzz/,
    );
    const catalog = loadRequirementCatalog();
    const parent = [...catalog.nodes.values()].find((node) => !isLeaf(node));
    assert.ok(parent);
    await assert.rejects(
      () => wrap(parent.id, nodeFingerprint(parent), () => {})(),
      /is not a leaf/,
    );
    const leaf = [...catalog.nodes.values()].find((node) => isLeaf(node));
    assert.ok(leaf);
    assert.equal(nodeFingerprint(leaf), requirementFingerprint(leaf.id, leaf.text));
    await assert.rejects(
      () => wrap(leaf.id, "deadbeefdeadbeef", () => {})(),
      /does not match/,
    );
  });
});

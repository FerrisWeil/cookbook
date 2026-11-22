import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requirementFingerprint } from "../src/fingerprint.ts";

describe("requirementFingerprint", () => {
  it("hashes id and text with fp-v1 encoding", () => {
    assert.equal(
      requirementFingerprint(
        "k7m2",
        "Without the shared secret, the agent is told the call is not allowed.",
      ),
      "90bf8e79d16f88da",
    );
  });

  it("changes when the leaf text changes and not when a sibling would", () => {
    const base = requirementFingerprint("p4w9", "Given a recipe ID, the agent receives that recipe.");
    const edited = requirementFingerprint(
      "p4w9",
      "Given a recipe ID, the agent receives that recipe now.",
    );
    const otherId = requirementFingerprint(
      "b3x8",
      "Given a recipe ID, the agent receives that recipe.",
    );
    assert.notEqual(base, edited);
    assert.notEqual(base, otherId);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requirementFingerprint } from "../src/fingerprint.ts";

describe("requirementFingerprint", () => {
  it("hashes id and text with fp-v1 encoding", () => {
    assert.equal(
      requirementFingerprint(
        "1",
        "Without the shared secret, the agent is told the call is not allowed.",
      ),
      "d631eefaf753e9d7",
    );
  });

  it("changes when the leaf text changes and not when a sibling would", () => {
    const base = requirementFingerprint("6", "Given a recipe ID, the agent receives that recipe.");
    const edited = requirementFingerprint(
      "6",
      "Given a recipe ID, the agent receives that recipe now.",
    );
    const otherId = requirementFingerprint(
      "7",
      "Given a recipe ID, the agent receives that recipe.",
    );
    assert.notEqual(base, edited);
    assert.notEqual(base, otherId);
  });
});

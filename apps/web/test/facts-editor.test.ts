import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyRecipeFacts } from "@cookbook/shared";

import { FACTS_SAVE_ERROR } from "../src/api.ts";
import { draftFromFacts } from "../src/facts.ts";
import {
  createFactsEditor,
  submitFactsFields,
} from "../src/useRecipeFactsEditor.ts";
import type { FieldPatch } from "../src/sync/types.ts";

const filled = {
  primaryProtein: "chicken",
  totalMinutes: 30,
  effort: "low" as const,
  mealTypes: ["dinner" as const],
};

describe("facts editor interactions", () => {
  it("queues only submitted facts fields", async () => {
    const queued: FieldPatch[] = [];
    const result = await submitFactsFields(
      async (_id, fields) => {
        queued.push(fields);
      },
      "r1",
      { primaryProtein: "seitan" },
    );
    assert.equal(result, "queued");
    assert.deepEqual(queued, [{ primaryProtein: "seitan" }]);
    assert.equal(
      await submitFactsFields(async () => undefined, "r1", {}),
      "empty",
    );
  });

  it("keeps the draft and marks an error when enqueue fails", async () => {
    const editor = createFactsEditor({
      recipeId: "r1",
      async saveFields() {
        throw new Error("offline");
      },
    });
    editor.setFacts(filled);
    editor.open();
    editor.changeDraft(
      draftFromFacts({ ...filled, primaryProtein: "seitan" }),
    );
    await editor.save({ primaryProtein: "seitan" });
    const state = editor.getState();
    assert.equal(state.editing, true);
    assert.equal(state.draft?.primaryProtein, "seitan");
    assert.equal(state.status.kind, "error");
    if (state.status.kind === "error") {
      assert.equal(state.status.message, FACTS_SAVE_ERROR);
    }
  });

  it("closes after a queued save and resets when the recipe changes", async () => {
    const queued: FieldPatch[] = [];
    const editor = createFactsEditor({
      recipeId: "r1",
      async saveFields(_id, fields) {
        queued.push(fields);
      },
    });
    editor.setFacts(filled);
    editor.open();
    await editor.save({ primaryProtein: "seitan" });
    assert.deepEqual(queued, [{ primaryProtein: "seitan" }]);
    assert.equal(editor.getState().editing, false);
    editor.setFacts(emptyRecipeFacts());
    editor.open();
    assert.equal(editor.getState().draft?.primaryProtein, "");
    editor.setRecipeId("r2");
    assert.equal(editor.getState().editing, false);
    assert.equal(editor.getState().draft, null);
  });
});

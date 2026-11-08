import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { emptyRecipeFacts } from "@cookbook/shared";
import { verifies } from "@cookbook/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { ListScreen } from "../src/ListScreen.tsx";
import { RecipeFacts } from "../src/RecipeFacts.tsx";
import { RecipeFactsForm } from "../src/RecipeFactsForm.tsx";
import { RecipeScreen } from "../src/RecipeScreen.tsx";
import {
  FACTS_DASH,
  MISSING_PROTEIN,
  changedFacts,
  draftFromFacts,
  factsAccessibleSummary,
  proteinExplanation,
  proteinIconKind,
} from "../src/facts.ts";
import type { RecipeView } from "../src/api.ts";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "../src");

function html(node: ReturnType<typeof createElement>): string {
  return renderToString(node).replaceAll("<!-- -->", "");
}

function readSrc(name: string): string {
  return readFileSync(join(webSrc, name), "utf8");
}

const screenIdle = {
  editing: false,
  draft: null,
  formStatus: { kind: "idle" as const },
  onEditFacts() {},
  onDraftChange() {},
  onSaveFacts() {},
  onCancelFacts() {},
};

function view(overrides: Partial<RecipeView> = {}): RecipeView {
  return {
    title: "Example: Lemon chicken bowls",
    ingredients: ["Chicken · 400 g"],
    steps: ["Cook."],
    facts: emptyRecipeFacts(),
    ...overrides,
  };
}

const filledFacts = {
  primaryProtein: "chicken",
  totalMinutes: 30,
  effort: "low" as const,
  mealTypes: ["dinner" as const],
};

describe("kitchen recipe facts", () => {
  it("computes only the facts fields the user changed", () => {
    assert.deepEqual(
      changedFacts(filledFacts, {
        ...filledFacts,
        primaryProtein: "seitan",
      }),
      { primaryProtein: "seitan" },
    );
    assert.deepEqual(
      changedFacts(filledFacts, {
        ...filledFacts,
        primaryProtein: null,
      }),
      { primaryProtein: null },
    );
    assert.deepEqual(
      changedFacts(filledFacts, {
        ...filledFacts,
        mealTypes: ["lunch", "dinner"],
      }),
      { mealTypes: ["lunch", "dinner"] },
    );
    assert.deepEqual(changedFacts(filledFacts, filledFacts), {});
  });


  it(
    "shows each recipe's facts on the list",
    verifies("177", "58e706f6a8e651f9", () => {
      const page = html(
        createElement(ListScreen, {
          state: {
            kind: "ready",
            recipes: [
              {
                id: "bowls",
                title: "Example: Lemon chicken bowls",
                facts: filledFacts,
              },
            ],
          },
          onOpen() {},
          onRetry() {},
        }),
      );
      assert.match(page, />chicken</);
      assert.match(page, /30 min/);
      assert.match(page, /Low/);
      assert.match(page, /Dinner/);
      assert.match(page, /ui-facts/);
      assert.doesNotMatch(page, /<button[^>]*class="[^"]*ui-facts-slot/);
    }),
  );

  it(
    "shows the recipe's facts on the recipe screen",
    verifies("178", "66a37def89c6c3f6", () => {
      const page = html(
        createElement(RecipeScreen, {
          state: { kind: "ready", recipe: view({ facts: filledFacts }) },
          onBack() {},
          onRetry() {},
          ...screenIdle,
        }),
      );
      assert.match(page, /<h1>Example: Lemon chicken bowls<\/h1>/);
      assert.match(page, />chicken</);
      assert.match(page, /30 min/);
      assert.match(page, /Low/);
      assert.match(page, /Dinner/);
      const factsStart = page.indexOf("ui-facts");
      const ingredients = page.indexOf("Ingredients");
      assert.ok(factsStart >= 0 && ingredients > factsStart);
    }),
  );

  it(
    "shows a dash and an accessible explanation for missing facts",
    verifies("180", "abf958cd75c8e6b2", () => {
      const page = html(
        createElement(RecipeFacts, {
          facts: emptyRecipeFacts(),
          explanations: "focusable",
        }),
      );
      assert.equal((page.match(new RegExp(FACTS_DASH, "g")) ?? []).length, 4);
      assert.match(page, new RegExp(MISSING_PROTEIN));
      assert.match(page, /No total time specified/);
      assert.match(page, /No effort specified/);
      assert.match(page, /No meal types specified/);
      const unknown = html(
        createElement(RecipeFacts, {
          facts: {
            primaryProtein: "seitan",
            totalMinutes: null,
            effort: null,
            mealTypes: [],
          },
          explanations: "focusable",
        }),
      );
      assert.match(unknown, /seitan/);
      assert.match(unknown, /Primary protein: seitan/);
      assert.equal(proteinIconKind("seitan"), "generic");
      assert.equal(proteinIconKind("chicken"), "chicken");
      assert.equal(proteinExplanation("no protein"), MISSING_PROTEIN);
      assert.equal(proteinExplanation("No protein"), MISSING_PROTEIN);
      const none = html(
        createElement(RecipeFacts, {
          facts: {
            primaryProtein: "no protein",
            totalMinutes: null,
            effort: null,
            mealTypes: [],
          },
          explanations: "focusable",
        }),
      );
      assert.match(none, new RegExp(FACTS_DASH));
      assert.match(none, new RegExp(MISSING_PROTEIN));
      assert.doesNotMatch(none, />no protein</);
      assert.equal(
        factsAccessibleSummary(emptyRecipeFacts()).includes(MISSING_PROTEIN),
        true,
      );
    }),
  );

  it(
    "offers a form on the recipe screen to edit that recipe's facts",
    verifies("181", "7dd20f8b5a044821", () => {
      const closed = html(
        createElement(RecipeScreen, {
          state: { kind: "ready", recipe: view({ facts: filledFacts }) },
          onBack() {},
          onRetry() {},
          ...screenIdle,
        }),
      );
      assert.match(closed, /Edit recipe facts/);
      assert.doesNotMatch(closed, /<form/);
      const open = html(
        createElement(RecipeScreen, {
          state: { kind: "ready", recipe: view({ facts: filledFacts }) },
          onBack() {},
          onRetry() {},
          ...screenIdle,
          editing: true,
          draft: draftFromFacts(filledFacts),
        }),
      );
      assert.match(open, /<form/);
      assert.match(open, /Edit recipe facts/);
      assert.match(open, /value="chicken"/);
      assert.match(open, /value="30"/);
      assert.match(open, /value="low"/);
      assert.match(open, /value="dinner"/);
      assert.match(open, /Save/);
      assert.match(open, /Cancel/);
    }),
  );

  it(
    "keeps the facts draft and stored facts when a save fails",
    verifies("182", "18530c7138ee4b02", () => {
      const draft = draftFromFacts({
        primaryProtein: "seitan",
        totalMinutes: 15,
        effort: "high",
        mealTypes: ["lunch", "dinner"],
      });
      const page = html(
        createElement(RecipeScreen, {
          state: { kind: "ready", recipe: view({ facts: filledFacts }) },
          onBack() {},
          onRetry() {},
          ...screenIdle,
          editing: true,
          draft,
          formStatus: { kind: "error", message: "Could not save recipe facts." },
        }),
      );
      assert.match(page, /value="seitan"/);
      assert.match(page, /value="15"/);
      assert.match(page, /Could not save recipe facts\./);
      assert.match(page, /Try again/);
      assert.match(page, />chicken</);
      assert.match(page, /30 min/);
    }),
  );

  it(
    "leaves stored facts unchanged when the facts form is canceled",
    verifies("183", "614b901854fb4300", () => {
      const canceled = html(
        createElement(RecipeScreen, {
          state: { kind: "ready", recipe: view({ facts: filledFacts }) },
          onBack() {},
          onRetry() {},
          ...screenIdle,
        }),
      );
      assert.doesNotMatch(canceled, /<form/);
      assert.match(canceled, />chicken</);
      const form = html(
        createElement(RecipeFactsForm, {
          draft: draftFromFacts({
            primaryProtein: "changed",
            totalMinutes: 99,
            effort: "high",
            mealTypes: ["breakfast"],
          }),
          baseline: filledFacts,
          status: { kind: "idle" },
          onDraftChange() {},
          onSave() {},
          onCancel() {},
        }),
      );
      assert.match(form, /type="button"[^>]*>Cancel</);
      assert.match(form, /changed/);
    }),
  );

  it("keeps facts network calls in the adapter, not in display components", () => {
    for (const file of [
      "RecipeFacts.tsx",
      "RecipeFactsForm.tsx",
      "RecipeScreen.tsx",
      "ListScreen.tsx",
    ]) {
      const source = readSrc(file);
      assert.equal(source.includes("updateRecipeFacts"), false, file);
      assert.equal(source.includes("fetch("), false, file);
    }
    assert.match(readSrc("useRecipeFactsEditor.ts"), /saveFields/);
    assert.equal(readSrc("useRecipeFactsEditor.ts").includes("fetch("), false);
    assert.match(readSrc("sync/adapters.ts"), /method: "PATCH"/);
    assert.match(readSrc("sync/adapters.ts"), /mutationId/);
    assert.doesNotMatch(readSrc("api.ts"), /updateRecipeFacts/);
  });
});

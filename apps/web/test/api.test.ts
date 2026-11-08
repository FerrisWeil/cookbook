import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createElement } from "react";
import { renderToString } from "react-dom/server";

import {
  fetchRecipeList,
  fetchRecipeView,
  LIST_ERROR,
  parseRecipeList,
  parseRecipeView,
  RECIPE_ERROR,
  RECIPE_MISSING,
  recipeReadUrl,
  RECIPE_READ_FIELDS,
} from "../src/api.ts";
import { ListScreen } from "../src/ListScreen.tsx";
import { RecipeScreen } from "../src/RecipeScreen.tsx";

function html(node: ReturnType<typeof createElement>): string {
  return renderToString(node).replaceAll("<!-- -->", "");
}

describe("kitchen API mapping", () => {
  it("requests title, ingredient lines, steps, and facts from the read API", () => {
    assert.equal(RECIPE_READ_FIELDS, "title,ingredients,steps,facts");
    assert.equal(
      recipeReadUrl("alpha"),
      "/api/recipes/alpha?fields=title%2Cingredients%2Csteps%2Cfacts",
    );
    const viewed = parseRecipeView({
      recipe: {
        title: "Example: Tomato lentils",
        ingredients: [{ line: "1 cup lentils", amount: 1, unit: "cup", name: "lentils" }],
        steps: ["Simmer.", "Salt."],
        facts: {
          primaryProtein: "chicken",
          totalMinutes: 30,
          effort: "low",
          mealTypes: ["dinner"],
        },
      },
    });
    assert.deepEqual(viewed, {
      title: "Example: Tomato lentils",
      ingredients: ["1 cup lentils"],
      steps: ["Simmer.", "Salt."],
      facts: {
        primaryProtein: "chicken",
        totalMinutes: 30,
        effort: "low",
        mealTypes: ["dinner"],
      },
    });
    assert.deepEqual(
      parseRecipeView({
        recipe: { title: "Example: Plain", steps: ["Stir."] },
      }),
      {
        title: "Example: Plain",
        ingredients: [],
        steps: ["Stir."],
        facts: {
          primaryProtein: null,
          totalMinutes: null,
          effort: null,
          mealTypes: [],
        },
      },
    );
    assert.throws(() => parseRecipeList({}), new Error(LIST_ERROR));
    assert.throws(() => parseRecipeView({}), new Error(RECIPE_ERROR));
  });

  it("maps transport and parse failures to the designed sentences", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    try {
      await assert.rejects(fetchRecipeList(), new Error(LIST_ERROR));
      await assert.rejects(fetchRecipeView("alpha"), new Error(RECIPE_ERROR));
    } finally {
      globalThis.fetch = original;
    }

    globalThis.fetch = async () =>
      new Response("not-json", { status: 200, headers: { "content-type": "application/json" } });
    try {
      await assert.rejects(fetchRecipeList(), new Error(LIST_ERROR));
    } finally {
      globalThis.fetch = original;
    }

    globalThis.fetch = async () => new Response("{}", { status: 404 });
    try {
      await assert.rejects(fetchRecipeView("missing"), new Error(RECIPE_MISSING));
    } finally {
      globalThis.fetch = original;
    }

    const abort = new Error("aborted");
    abort.name = "AbortError";
    globalThis.fetch = async () => {
      throw abort;
    };
    try {
      await assert.rejects(fetchRecipeList(), (error: unknown) => {
        assert.equal(error, abort);
        return true;
      });
    } finally {
      globalThis.fetch = original;
    }

  });

  it("shows empty, missing, and retry states", () => {
    const empty = html(
      createElement(ListScreen, {
        state: { kind: "ready", recipes: [] },
        onOpen() {},
        onRetry() {},
      }),
    );
    assert.match(empty, /No recipes yet/);
    const missing = html(
      createElement(RecipeScreen, {
        state: { kind: "missing" },
        editing: false,
        draft: null,
        formStatus: { kind: "idle" },
        onBack() {},
        onRetry() {},
        onEditFacts() {},
        onDraftChange() {},
        onSaveFacts() {},
        onCancelFacts() {},
      }),
    );
    assert.match(missing, new RegExp(RECIPE_MISSING));
    const loading = html(
      createElement(ListScreen, {
        state: { kind: "loading" },
        onOpen() {},
        onRetry() {},
      }),
    );
    assert.match(loading, /aria-busy="true"/);
    assert.match(loading, /ui-card--skeleton/);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { emptyRecipeFacts } from "@cookbook/shared";
import { verifies } from "@cookbook/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { App } from "../src/App.tsx";
import { LIST_ERROR } from "../src/api.ts";
import { ListScreen } from "../src/ListScreen.tsx";
import { RecipeScreen } from "../src/RecipeScreen.tsx";
import type { RecipeView } from "../src/api.ts";

const root = dirname(fileURLToPath(import.meta.url));

function html(node: ReturnType<typeof createElement>): string {
  return renderToString(node).replaceAll("<!-- -->", "");
}

function readWeb(...parts: string[]): string {
  return readFileSync(join(root, "..", ...parts), "utf8");
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

function listItem(id: string, title: string) {
  return { id, title, facts: emptyRecipeFacts() };
}

function view(overrides: Partial<RecipeView> = {}): RecipeView {
  return {
    title: "Example: Tomato lentils",
    ingredients: ["1 cup lentils"],
    steps: ["Simmer."],
    facts: emptyRecipeFacts(),
    ...overrides,
  };
}

function recipeHtml(state: Parameters<typeof RecipeScreen>[0]["state"]): string {
  return html(
    createElement(RecipeScreen, {
      state,
      onBack() {},
      onRetry() {},
      ...screenIdle,
    }),
  );
}

describe("kitchen session boundaries", () => {
  it("keeps fetch, EventSource, and storage out of screens and hooks", () => {
    const files = [
      readWeb("src/App.tsx"),
      readWeb("src/ListScreen.tsx"),
      readWeb("src/RecipeScreen.tsx"),
      readWeb("src/useKitchen.tsx"),
      readWeb("src/useCookingSession.tsx"),
      readWeb("src/cooking/client.ts"),
      readWeb("src/useRecipeFactsEditor.ts"),
    ];
    for (const source of files) {
      assert.doesNotMatch(source, /\bfetch\s*\(/);
      assert.doesNotMatch(source, /EventSource/);
      assert.doesNotMatch(source, /indexedDB/);
      assert.doesNotMatch(source, /localStorage/);
    }
  });
});

describe("home page", () => {
  it(
    "loads",
    verifies("xt3k", "81cc013aa3b6d3fb", () => {
      const page = html(createElement(App, { initialPath: "/" }));
      assert.match(page, /<h1>Recipes<\/h1>/);
      assert.match(page, /Loading recipes/);
    }),
  );
});

describe("kitchen list and recipe", () => {
  it(
    "tells a failed read in words",
    verifies("nzab", "8ac8024c702f09ff", () => {
      const list = html(
        createElement(ListScreen, {
          state: { kind: "error", message: LIST_ERROR },
          onOpen() {},
          onRetry() {},
        }),
      );
      assert.match(list, /Could not load recipes\./);
      assert.match(list, /Try again/);
      const recipe = recipeHtml({
        kind: "error",
        message: "Could not load this recipe.",
      });
      assert.match(recipe, /Could not load this recipe\./);
      assert.match(recipe, /Try again/);
    }),
  );

  it(
    "shows each recipe title on the list",
    verifies("5xxm", "1cc3e1bcad9fcbfa", () => {
      const page = html(
        createElement(ListScreen, {
          state: {
            kind: "ready",
            recipes: [
              listItem("lentils", "Example: Tomato lentils"),
              listItem("oats", "Example: Weeknight oats"),
            ],
          },
          onOpen() {},
          onRetry() {},
        }),
      );
      assert.match(page, /Example: Tomato lentils/);
      assert.match(page, /Example: Weeknight oats/);
    }),
  );

  it(
    "includes a recipe whose favorite is off",
    verifies("pesf", "d1eca56d52f0e8d8", () => {
      const stored = {
        id: "oats",
        title: "Example: Weeknight oats",
        favorite: false,
      };
      assert.equal(stored.favorite, false);
      const listSource = readWeb("src/ListScreen.tsx") + readWeb("src/App.tsx");
      assert.doesNotMatch(listSource, /favorite/);
      const page = html(
        createElement(ListScreen, {
          state: {
            kind: "ready",
            recipes: [listItem(stored.id, stored.title)],
          },
          onOpen() {},
          onRetry() {},
        }),
      );
      assert.match(page, /Example: Weeknight oats/);
      assert.doesNotMatch(page, /No recipes yet/);
    }),
  );

  it(
    "shows the recipe title",
    verifies("sxey", "e28f7e372805a778", () => {
      const page = recipeHtml({ kind: "ready", recipe: view() });
      assert.match(page, /<h1>Example: Tomato lentils<\/h1>/);
    }),
  );

  it(
    "shows the ingredient lines",
    verifies("jsjn", "c69b83a4b8faaf49", () => {
      const page = recipeHtml({
        kind: "ready",
        recipe: view({ ingredients: ["1 cup lentils", "salt to taste"] }),
      });
      assert.match(page, /1 cup lentils/);
      assert.match(page, /salt to taste/);
      const missing = recipeHtml({
        kind: "ready",
        recipe: view({ ingredients: [] }),
      });
      assert.doesNotMatch(missing, /Ingredients/);
    }),
  );

  it(
    "shows the steps in saved order",
    verifies("kfe8", "37b70e4b2d8cee73", () => {
      const page = recipeHtml({
        kind: "ready",
        recipe: view({
          steps: ["Rinse the lentils.", "Simmer until soft."],
        }),
      });
      const first = page.indexOf("Rinse the lentils.");
      const second = page.indexOf("Simmer until soft.");
      assert.ok(first >= 0 && second > first);
      assert.match(page, /<ol>/);
    }),
  );

  it(
    "shows each ingredient as one written line",
    verifies("6x6h", "33c4846651d37ef0", () => {
      const page = recipeHtml({
        kind: "ready",
        recipe: view({
          ingredients: ["1 cup red lentils", "2 tbsp olive oil"],
        }),
      });
      assert.match(page, /<li>1 cup red lentils<\/li>/);
      assert.match(page, /<li>2 tbsp olive oil<\/li>/);
      assert.doesNotMatch(page, /amount/);
      assert.doesNotMatch(page, /unit/);
    }),
  );

  it(
    "does not overlap recipe text with controls",
    verifies("rdv6", "269856c29b56ac00", () => {
      const page = recipeHtml({ kind: "ready", recipe: view() });
      const back = page.indexOf(">Back<");
      const title = page.indexOf("<h1>Example: Tomato lentils</h1>");
      const ingredient = page.indexOf("1 cup lentils");
      const step = page.indexOf("Simmer.");
      assert.ok(back >= 0 && title > back && ingredient > title && step > ingredient);
      const css = readWeb("src/screens.css") + readWeb("../../packages/ui/src/components.css");
      assert.doesNotMatch(css, /\.ui-back[\s\S]{0,80}position:\s*(fixed|absolute)/);
    }),
  );

  it(
    "makes every action a click or a tap",
    verifies("mwbn", "37bebb3abd01d0d0", () => {
      const list = html(
        createElement(ListScreen, {
          state: {
            kind: "ready",
            recipes: [listItem("lentils", "Example: Tomato lentils")],
          },
          onOpen() {},
          onRetry() {},
        }),
      );
      const recipe = recipeHtml({ kind: "ready", recipe: view() });
      const failed = html(
        createElement(ListScreen, {
          state: { kind: "error", message: LIST_ERROR },
          onOpen() {},
          onRetry() {},
        }),
      );
      for (const page of [list, recipe, failed]) {
        const actions = [...page.matchAll(/<(button|a)\b/g)];
        assert.ok(actions.length > 0, page);
        assert.equal(
          page.includes("onMouseEnter") || page.includes(":hover-only"),
          false,
        );
      }
      assert.match(list, /<a\b[^>]*href="\/recipes\/lentils"/);
      assert.match(recipe, /<button\b[^>]*>Back<\/button>/);
      assert.match(failed, /<button\b[^>]*>Try again<\/button>/);
    }),
  );

  it(
    "makes every action reachable from the keyboard",
    verifies("ry7t", "d21dacf14d3052e5", () => {
      const list = html(
        createElement(ListScreen, {
          state: {
            kind: "ready",
            recipes: [listItem("lentils", "Example: Tomato lentils")],
          },
          onOpen() {},
          onRetry() {},
        }),
      );
      const recipe = recipeHtml({ kind: "ready", recipe: view() });
      const failed = html(
        createElement(ListScreen, {
          state: { kind: "error", message: LIST_ERROR },
          onOpen() {},
          onRetry() {},
        }),
      );
      for (const page of [list, recipe, failed]) {
        assert.doesNotMatch(page, /tabindex="-1"/);
        const actions = [...page.matchAll(/<(button|a)\b[^>]*>/g)].map((match) => match[0]);
        assert.ok(actions.length > 0, page);
        for (const action of actions) {
          assert.match(action, /^<(button|a)\b/);
        }
      }
      assert.match(list, /<a\b[^>]*href="\/recipes\/lentils"/);
      assert.match(recipe, /<button\b[^>]*>Back<\/button>/);
      assert.match(failed, /<button\b[^>]*>Try again<\/button>/);
    }),
  );

  it(
    "lets the user zoom the page",
    verifies("mbvk", "5c58bebc41de4b6f", () => {
      const document = readWeb("index.html");
      assert.match(
        document,
        /name="viewport"[^>]*content="width=device-width, initial-scale=1, viewport-fit=cover"/,
      );
      assert.doesNotMatch(document, /maximum-scale/);
      assert.doesNotMatch(document, /user-scalable=no/);
    }),
  );

  it(
    "responds to the screen size",
    verifies("xpk2", "eea7d4da3a09249e", () => {
      const css = readWeb("src/screens.css");
      assert.match(css, /@media \(min-width: 48rem\)/);
      const wide = css.split("@media (min-width: 48rem)")[1] ?? "";
      assert.match(wide, /grid-template-columns:\s*repeat\(auto-fill/);
      assert.match(wide, /\.recipe-article[\s\S]*grid-template-columns:\s*1fr 1fr/);
      const phone = css.split("@media (min-width: 48rem)")[0] ?? "";
      assert.doesNotMatch(phone, /\.recipe-article[\s\S]*grid-template-columns:\s*1fr 1fr/);
    }),
  );
});

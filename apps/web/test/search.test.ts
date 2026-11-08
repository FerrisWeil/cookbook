import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyListCriteria, emptyRecipeFacts } from "@cookbook/shared";
import { verifies } from "@cookbook/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { LIST_ERROR, recipeListUrl } from "../src/api.ts";
import {
  ListScreen,
  NO_MATCHES,
  UPDATING,
} from "../src/ListScreen.tsx";
import { activeFiltersFrom } from "../src/useKitchen.tsx";

function html(node: ReturnType<typeof createElement>): string {
  return renderToString(node).replaceAll("<!-- -->", "");
}

const criteria = {
  ...emptyListCriteria(),
  title: "lemon",
  ingredients: ["garlic"],
  proteins: ["chicken"],
  maxTotalMinutes: 30,
  efforts: ["low" as const],
  mealTypes: ["dinner" as const],
};

function searchProps(
  overrides: Partial<Parameters<typeof ListScreen>[0]["search"]> = {},
): NonNullable<Parameters<typeof ListScreen>[0]["search"]> {
  return {
    title: "lemon",
    onTitleChange() {},
    filtersOpen: false,
    onOpenFilters() {},
    onCloseFilters() {},
    onClearAll() {},
    activeFilters: activeFiltersFrom(criteria),
    onRemoveFilter() {},
    criteria,
    onChangeCriteria() {},
    proteinChoices: ["chicken", "seitan"],
    customProtein: "",
    onCustomProteinChange() {},
    onAddCustomProtein() {},
    onAddIngredient() {},
    ...overrides,
  };
}

describe("kitchen list search", () => {
  it("encodes the compiled query on the list URL", () => {
    assert.equal(recipeListUrl(null), "/api/recipes");
    assert.match(
      recipeListUrl({ field: "title", phrase: "lemon chicken" }),
      /\/api\/recipes\?query=/,
    );
    assert.match(recipeListUrl({ field: "title", phrase: "100%" }), /%25/);
  });

  it(
    "shows a labeled title search, filters, removable chips, and clear all",
    verifies("232", "a761124937ca6732", () => {
    const page = html(
      createElement(ListScreen, {
        state: {
          kind: "ready",
          recipes: [
            {
              id: "a",
              title: "Example: Lemon chicken",
              facts: emptyRecipeFacts(),
            },
          ],
        },
        onOpen() {},
        onRetry() {},
        search: searchProps(),
      }),
    );
    assert.match(page, /for="[^"]*">Recipe name</);
    assert.match(page, /Filters/);
    assert.match(page, /Clear all/);
    assert.match(page, /Remove garlic/);
    assert.match(page, /Example: Lemon chicken/);
    assert.doesNotMatch(page, /autofocus/);
    }),
  );

  it(
    "keeps empty library, no matches, pending, and failure distinct",
    verifies("234", "da18f2b3e5684924", () => {
    const empty = html(
      createElement(ListScreen, {
        state: { kind: "ready", recipes: [] },
        onOpen() {},
        onRetry() {},
      }),
    );
    assert.match(empty, /No recipes yet/);
    assert.doesNotMatch(empty, new RegExp(NO_MATCHES));

    const none = html(
      createElement(ListScreen, {
        state: { kind: "ready", recipes: [] },
        onOpen() {},
        onRetry() {},
        search: searchProps(),
      }),
    );
    assert.match(none, new RegExp(NO_MATCHES));
    assert.match(none, /Remove garlic/);
    assert.match(none, /Clear all/);
    assert.doesNotMatch(none, /No recipes yet/);

    const pending = html(
      createElement(ListScreen, {
        state: { kind: "loading" },
        onOpen() {},
        onRetry() {},
        search: searchProps(),
      }),
    );
    assert.match(pending, /Loading recipes/);
    assert.match(pending, /lemon/);

    const failed = html(
      createElement(ListScreen, {
        state: { kind: "error", message: LIST_ERROR },
        onOpen() {},
        onRetry() {},
        search: searchProps(),
      }),
    );
    assert.match(failed, /Could not load recipes/);
    assert.match(failed, /Try again/);
    assert.match(failed, /lemon/);
    }),
  );

  it(
    "announces a settled count and closes the filters dialog",
    verifies("235", "9dc5493ce8ea025a", () => {
    const open = html(
      createElement(ListScreen, {
        state: {
          kind: "ready",
          recipes: [
            { id: "a", title: "Example: One", facts: emptyRecipeFacts() },
          ],
          updating: false,
        },
        onOpen() {},
        onRetry() {},
        search: searchProps({ filtersOpen: true }),
      }),
    );
    assert.match(open, /aria-live="polite"/);
    assert.match(open, /1 recipe\./);
    assert.match(open, /<dialog\b/);
    assert.match(open, /aria-labelledby="list-filters-title"/);
    assert.match(open, /aria-expanded="true"/);

    const updating = html(
      createElement(ListScreen, {
        state: {
          kind: "ready",
          recipes: [
            { id: "a", title: "Example: Prior", facts: emptyRecipeFacts() },
          ],
          updating: true,
        },
        onOpen() {},
        onRetry() {},
        search: searchProps(),
      }),
    );
    assert.match(updating, /Updating recipes/);
    assert.match(updating, /Example: Prior/);
    assert.doesNotMatch(updating, /1 recipe\./);
    }),
  );
});

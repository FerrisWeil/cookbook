import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  QUERY_LIMITS,
  compileListCriteria,
  emptyListCriteria,
  emptyRecipeFacts,
  listCriteriaFromSearch,
  listSearchFromCriteria,
  matchRecipe,
  mergeProteinChoices,
  normalizeMatchText,
  omitBlankPhrases,
  parseListQuery,
  type MatchableRecipe,
  type QueryNode,
} from "../src/index.ts";

function ingredient(name: string, line = name) {
  return { line, amount: null, unit: "", name };
}

function recipe(
  title: string,
  extras: Partial<MatchableRecipe> = {},
): MatchableRecipe {
  return {
    title,
    ingredients: extras.ingredients ?? [],
    facts: extras.facts ?? emptyRecipeFacts(),
  };
}

describe("list query parse", () => {
  it("treats missing and null as the full library", () => {
    assert.deepEqual(parseListQuery(undefined), { ok: true, query: null });
    assert.deepEqual(parseListQuery(null), { ok: true, query: null });
  });

  it("refuses malformed, unknown, empty, and over-limit queries", () => {
    const invalid = [
      {},
      { op: "not", children: [{ field: "title", phrase: "soup" }] },
      { op: "and", children: [] },
      { field: "steps", phrase: "mix" },
      { field: "title", phrase: "   " },
      { field: "title", phrase: "x".repeat(QUERY_LIMITS.maxPhraseLength + 1) },
      { field: "title", phrase: "soup", extra: true },
      { field: "maxTotalMinutes", minutes: -1 },
      { field: "effort", value: "easy" },
      { field: "mealType", value: "brunch" },
      "SELECT 1",
      { op: "and", children: [{ field: "title", phrase: "a" }], sql: "1=1" },
    ];
    for (const value of invalid) {
      const parsed = parseListQuery(value);
      assert.equal(parsed.ok, false, JSON.stringify(value));
    }

    const tooDeep: QueryNode = { field: "title", phrase: "a" };
    let nested: QueryNode = tooDeep;
    for (let i = 0; i < QUERY_LIMITS.maxDepth; i += 1) {
      nested = { op: "and", children: [nested] };
    }
    assert.equal(parseListQuery(nested).ok, false);

    const tooMany: QueryNode = {
      op: "and",
      children: Array.from({ length: QUERY_LIMITS.maxChildren + 1 }, () => ({
        field: "title" as const,
        phrase: "a",
      })),
    };
    assert.equal(parseListQuery(tooMany).ok, false);
  });

  it("normalizes phrase leaves and accepts a typed tree", () => {
    const parsed = parseListQuery({
      op: "and",
      children: [
        { field: "title", phrase: "  Lemon   Chicken " },
        { field: "ingredient", phrase: "garlic" },
        { field: "primaryProtein", phrase: "chicken" },
        { field: "maxTotalMinutes", minutes: 30 },
        { field: "effort", value: "low" },
        { field: "mealType", value: "dinner" },
      ],
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.deepEqual(parsed.query, {
        op: "and",
        children: [
          { field: "title", phrase: "lemon chicken" },
          { field: "ingredient", phrase: "garlic" },
          { field: "primaryProtein", phrase: "chicken" },
          { field: "maxTotalMinutes", minutes: 30 },
          { field: "effort", value: "low" },
          { field: "mealType", value: "dinner" },
        ],
      });
    }
  });
});

describe("list matching", () => {
  it("matches a title phrase in the title and not in ingredients", () => {
    const query = parseListQuery({
      field: "title",
      phrase: "chicken breast",
    });
    assert.equal(query.ok, true);
    if (!query.ok) {
      return;
    }
    assert.equal(
      matchRecipe(
        recipe("Example: Chicken breast bake"),
        query.query,
      ),
      true,
    );
    assert.equal(
      matchRecipe(
        recipe("Example: Pan supper", {
          ingredients: [
            ingredient("chicken stock"),
            ingredient("turkey breast"),
          ],
        }),
        query.query,
      ),
      false,
    );
  });

  it("keeps an ingredient phrase inside one ingredient name", () => {
    const query = parseListQuery({
      field: "ingredient",
      phrase: "chicken breast",
    });
    assert.equal(query.ok, true);
    if (!query.ok) {
      return;
    }
    assert.equal(
      matchRecipe(
        recipe("Example: One bowl", {
          ingredients: [ingredient("chicken breast"), ingredient("rice")],
        }),
        query.query,
      ),
      true,
    );
    assert.equal(
      matchRecipe(
        recipe("Example: Split trap", {
          ingredients: [
            ingredient("chicken stock"),
            ingredient("turkey breast"),
          ],
        }),
        query.query,
      ),
      false,
    );
  });

  it("requires every ingredient entry and allows extra ingredients", () => {
    const query = compileListCriteria({
      ...emptyListCriteria(),
      ingredients: ["garlic", "lemon"],
    });
    const both = recipe("Example: Both", {
      ingredients: [
        ingredient("garlic"),
        ingredient("lemon zest"),
        ingredient("oil"),
      ],
    });
    const one = recipe("Example: One", {
      ingredients: [ingredient("garlic"), ingredient("oil")],
    });
    assert.equal(matchRecipe(both, query), true);
    assert.equal(matchRecipe(one, query), false);
  });

  it("ORs within a category and ANDs active categories, including nested groups", () => {
    const query = parseListQuery({
      op: "and",
      children: [
        {
          op: "or",
          children: [
            { field: "effort", value: "low" },
            { field: "effort", value: "medium" },
          ],
        },
        {
          op: "or",
          children: [
            { field: "mealType", value: "lunch" },
            { field: "mealType", value: "dinner" },
          ],
        },
        { field: "title", phrase: "bowl" },
      ],
    });
    assert.equal(query.ok, true);
    if (!query.ok) {
      return;
    }
    const hit = recipe("Example: Lunch bowl", {
      facts: {
        ...emptyRecipeFacts(),
        effort: "low",
        mealTypes: ["lunch"],
      },
    });
    const nestedOr = recipe("Example: Dinner bowl", {
      facts: {
        ...emptyRecipeFacts(),
        effort: "high",
        mealTypes: ["dinner"],
      },
    });
    const missTitle = recipe("Example: Lunch stew", {
      facts: {
        ...emptyRecipeFacts(),
        effort: "low",
        mealTypes: ["lunch"],
      },
    });
    assert.equal(matchRecipe(hit, query.query), true);
    assert.equal(matchRecipe(nestedOr, query.query), false);
    assert.equal(matchRecipe(missTitle, query.query), false);
  });

  it("includes max minutes inclusively and excludes unknown or missing values", () => {
    const time = compileListCriteria({
      ...emptyListCriteria(),
      maxTotalMinutes: 30,
    });
    assert.equal(
      matchRecipe(
        recipe("Example: Fast", {
          facts: { ...emptyRecipeFacts(), totalMinutes: 30 },
        }),
        time,
      ),
      true,
    );
    assert.equal(
      matchRecipe(
        recipe("Example: Slow", {
          facts: { ...emptyRecipeFacts(), totalMinutes: 31 },
        }),
        time,
      ),
      false,
    );
    assert.equal(
      matchRecipe(recipe("Example: Unknown time"), time),
      false,
    );
    const effort = compileListCriteria({
      ...emptyListCriteria(),
      efforts: ["low"],
    });
    assert.equal(matchRecipe(recipe("Example: No effort"), effort), false);
    assert.equal(matchRecipe(recipe("Example: No effort"), null), true);
  });

  it("treats %, _, and backslash as literal characters in a phrase", () => {
    const query = parseListQuery({ field: "title", phrase: "100%_wheat\\" });
    assert.equal(query.ok, true);
    if (!query.ok) {
      return;
    }
    assert.equal(
      matchRecipe(recipe("Example: 100%_wheat\\ loaf"), query.query),
      true,
    );
    assert.equal(
      matchRecipe(recipe("Example: 100X wheat loaf"), query.query),
      false,
    );
  });

  it("applies the same whitespace collapse to queries and stored text", () => {
    assert.equal(normalizeMatchText("  Lemon   Chicken  "), "lemon chicken");
    const query = parseListQuery({ field: "title", phrase: "lemon   chicken" });
    assert.equal(query.ok, true);
    if (!query.ok) {
      return;
    }
    assert.equal(
      matchRecipe(recipe("Example: Lemon    Chicken"), query.query),
      true,
    );
  });
});

describe("list criteria", () => {
  it("omits whitespace-only entries before compiling a query", () => {
    assert.deepEqual(omitBlankPhrases(["  ", "garlic", "\t"]), ["garlic"]);
    assert.equal(
      compileListCriteria({
        ...emptyListCriteria(),
        title: "   ",
        ingredients: ["  "],
      }),
      null,
    );
    const query = compileListCriteria({
      ...emptyListCriteria(),
      title: " Soup ",
      ingredients: [" garlic ", "  "],
      proteins: ["chicken"],
      maxTotalMinutes: 30,
      efforts: ["low", "medium"],
      mealTypes: ["dinner"],
    });
    assert.deepEqual(query, {
      op: "and",
      children: [
        { field: "title", phrase: "soup" },
        { field: "ingredient", phrase: "garlic" },
        { field: "primaryProtein", phrase: "chicken" },
        { field: "maxTotalMinutes", minutes: 30 },
        {
          op: "or",
          children: [
            { field: "effort", value: "low" },
            { field: "effort", value: "medium" },
          ],
        },
        { field: "mealType", value: "dinner" },
      ],
    });
  });

  it("round-trips list search params without sending blank entries", () => {
    const criteria = {
      ...emptyListCriteria(),
      title: " lemon ",
      ingredients: ["garlic", "  "],
      proteins: ["seitan"],
      maxTotalMinutes: 45,
      efforts: ["high" as const],
      mealTypes: ["lunch" as const],
    };
    const search = listSearchFromCriteria(criteria);
    assert.equal(
      search,
      "?title=lemon&ingredient=garlic&protein=seitan&maxMinutes=45&effort=high&meal=lunch",
    );
    assert.deepEqual(listCriteriaFromSearch(search), {
      title: "lemon",
      ingredients: ["garlic"],
      proteins: ["seitan"],
      maxTotalMinutes: 45,
      efforts: ["high"],
      mealTypes: ["lunch"],
    });
    assert.equal(listSearchFromCriteria(emptyListCriteria()), "");
  });

  it("merges recommended proteins with full-library values", () => {
    const choices = mergeProteinChoices(["seitan", "Chicken", "  "]);
    assert.equal(choices[0], "chicken");
    assert.ok(choices.includes("seitan"));
    assert.equal(choices.filter((item) => item.toLowerCase() === "chicken").length, 1);
    assert.ok(!choices.includes(""));
  });
});

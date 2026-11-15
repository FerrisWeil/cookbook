import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyListCriteria } from "@cookbook/shared";

import { filterSampleRecipesByCriteria } from "../src/prototype/data.ts";
import { SAMPLE_RECIPES } from "../src/prototype/sample-recipes.ts";

function ids(criteria: Parameters<typeof filterSampleRecipesByCriteria>[1]): string[] {
  return filterSampleRecipesByCriteria(SAMPLE_RECIPES, {
    ...emptyListCriteria(),
    ...criteria,
  }).map((recipe) => recipe.id);
}

describe("prototype sample library", () => {
  it("has about 25 made-up recipes covering the TAY-36 edge cases", () => {
    assert.ok(SAMPLE_RECIPES.length >= 25);
    assert.ok(SAMPLE_RECIPES.length <= 30);
    const byId = new Set(SAMPLE_RECIPES.map((recipe) => recipe.id));
    assert.equal(byId.size, SAMPLE_RECIPES.length);
    assert.ok(
      SAMPLE_RECIPES.some((recipe) => recipe.title.length > 80),
      "long title",
    );
    assert.ok(
      SAMPLE_RECIPES.some(
        (recipe) =>
          recipe.facts.primaryProtein === null &&
          recipe.facts.totalMinutes === null &&
          recipe.facts.effort === null &&
          recipe.facts.mealTypes.length === 0,
      ),
      "missing facts",
    );
    assert.ok(
      SAMPLE_RECIPES.some((recipe) => recipe.facts.primaryProtein === "no protein"),
      "no protein",
    );
    assert.ok(
      SAMPLE_RECIPES.some((recipe) => recipe.facts.primaryProtein === "seitan"),
      "custom protein",
    );
    assert.ok(
      SAMPLE_RECIPES.some(
        (recipe) =>
          recipe.facts.mealTypes.includes("lunch") &&
          recipe.facts.mealTypes.includes("dinner"),
      ),
      "lunch and dinner",
    );
    assert.ok(
      SAMPLE_RECIPES.some(
        (recipe) => recipe.facts.totalMinutes === 180 && recipe.facts.effort === "low",
      ),
      "3-hour low-effort stew",
    );
    assert.ok(
      SAMPLE_RECIPES.some(
        (recipe) =>
          recipe.facts.totalMinutes !== null &&
          recipe.facts.totalMinutes <= 15 &&
          recipe.facts.effort === "high",
      ),
      "quick high-effort",
    );
    assert.ok(
      SAMPLE_RECIPES.some((recipe) => recipe.ingredients.length >= 15),
      "many ingredients",
    );
    assert.ok(
      SAMPLE_RECIPES.some((recipe) =>
        recipe.ingredients.some((item) => item.name === "chicken thighs"),
      ),
    );
    assert.ok(
      SAMPLE_RECIPES.some((recipe) =>
        recipe.ingredients.some((item) => item.name === "ground chicken"),
      ),
    );
    const stew = SAMPLE_RECIPES.find((recipe) => recipe.id === "three-hour-sunday-beef-stew");
    const timed = stew?.steps.filter((step) => (step.durationSeconds ?? 0) > 0) ?? [];
    assert.ok(timed.length >= 2, "overlapping timers live on the stew");
  });
});

describe("prototype filter rules", () => {
  it("ORs within a category and ANDs across categories", () => {
    const hits = ids({
      efforts: ["low", "medium"],
      mealTypes: ["dessert"],
    });
    assert.ok(hits.includes("olive-oil-citrus-cake"));
    assert.equal(hits.includes("chocolate-espresso-souffle"), false);
    assert.equal(hits.includes("three-hour-sunday-beef-stew"), false);
  });

  it("requires every ingredient phrase", () => {
    const both = ids({ ingredients: ["garlic", "lemon"] });
    assert.ok(both.includes("lemon-chicken-bowls"));
    assert.equal(both.includes("garlic-butter-shrimp"), false);
    const garlic = ids({ ingredients: ["garlic"] });
    assert.ok(garlic.includes("garlic-butter-shrimp"));
  });

  it("matches protein by whole terms, not fish inside shellfish", () => {
    const fish = ids({ proteins: ["fish"] });
    assert.ok(fish.includes("miso-glazed-cod"));
    assert.equal(fish.includes("garlic-butter-shrimp"), false);
    assert.equal(fish.includes("seared-scallop-supper"), false);
    const shellfish = ids({ proteins: ["shellfish"] });
    assert.ok(shellfish.includes("garlic-butter-shrimp"));
    assert.ok(shellfish.includes("seared-scallop-supper"));
    assert.equal(shellfish.includes("miso-glazed-cod"), false);
  });

  it("does not treat chicken thighs as a hit for ground chicken", () => {
    const thighs = ids({ ingredients: ["chicken thighs"] });
    assert.ok(thighs.includes("chicken-thigh-sheet-pan"));
    assert.equal(thighs.includes("ground-chicken-lettuce-cups"), false);
    const ground = ids({ ingredients: ["ground chicken"] });
    assert.ok(ground.includes("ground-chicken-lettuce-cups"));
    assert.equal(ground.includes("chicken-thigh-sheet-pan"), false);
  });

  it("excludes unknown times when a maximum is set", () => {
    const fast = ids({ maxTotalMinutes: 30 });
    assert.ok(fast.includes("seared-scallop-supper"));
    assert.equal(fast.includes("three-hour-sunday-beef-stew"), false);
    assert.equal(fast.includes("roast-chicken-missing-time"), false);
    assert.equal(fast.includes("draft-with-no-facts"), false);
  });

  it("returns nothing for a name that is not in the sample set", () => {
    assert.deepEqual(ids({ title: "zzzznope" }), []);
  });
});

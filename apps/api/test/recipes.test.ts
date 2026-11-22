import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { verifies } from "@cookbook/test";

import { RecipeError } from "../src/recipes/errors.ts";
import { createMemoryRecipeStore } from "../src/recipes/memory.ts";
import type { SaveRecipeInput } from "../src/recipes/types.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function base(overrides: SaveRecipeInput = {}): SaveRecipeInput {
  return {
    actor: "chef",
    title: "Example: Soup",
    servings: 4,
    steps: ["Heat the pot."],
    ...overrides,
  };
}

async function reject(code: string, input: SaveRecipeInput): Promise<void> {
  const store = createMemoryRecipeStore();
  await assert.rejects(() => store.save(input), (error: unknown) => {
    assert.ok(error instanceof RecipeError);
    assert.equal(error.code, code);
    return true;
  });
}

describe("recipe schema", () => {
  it(
    "ships taylor, chef, and system as actors in git",
    verifies("mrjj", "52e6000fb4435005", () => {
      const sql = readFileSync(
        join(repoRoot, "db/migrations/0002_recipes.sql"),
        "utf8",
      );
      assert.match(sql, /CREATE TABLE actors/);
      assert.match(
        sql,
        /INSERT INTO actors \(name\) VALUES \('chef'\), \('system'\), \('taylor'\)/,
      );
    }),
  );
});

describe("ingredients", () => {
  it(
    "allows empty amount, unit, and name",
    verifies("8dvg", "7c4b8517f3144046", async () => {
      const store = createMemoryRecipeStore();
      const recipe = await store.save(
        base({
          ingredients: [{ line: "salt to taste" }],
        }),
      );
      assert.equal(recipe.ingredients[0]?.amount, null);
      assert.equal(recipe.ingredients[0]?.unit, "");
      assert.equal(recipe.ingredients[0]?.name, "");
    }),
  );

  it(
    "stores unstated amount, unit, or name empty given a written line",
    verifies("8wxr", "3fdf7ba1aaee681e", async () => {
      const store = createMemoryRecipeStore();
      const recipe = await store.save(
        base({
          ingredients: [{ line: "salt to taste" }],
        }),
      );
      assert.deepEqual(recipe.ingredients, [
        { line: "salt to taste", amount: null, unit: "", name: "" },
      ]);
    }),
  );

  it(
    "requires the written ingredient line",
    verifies("b4fe", "276758ef60482d41", async () => {
      await reject("ingredient_line_required", base({ ingredients: [{ name: "salt" }] }));
    }),
  );

  it(
    "keeps ingredient order",
    verifies("cww3", "82ad09895c8f7733", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          ingredients: [
            { line: "1 cup water", amount: 1, unit: "cup", name: "water" },
            { line: "salt to taste" },
          ],
        }),
      );
      assert.deepEqual(
        created.ingredients.map((item) => item.line),
        ["1 cup water", "salt to taste"],
      );
    }),
  );

  it(
    "replaces the ingredient list on save",
    verifies("duwp", "55bbe295eea9ff6c", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          ingredients: [
            { line: "1 cup water", amount: 1, unit: "cup", name: "water" },
            { line: "salt to taste" },
          ],
        }),
      );
      const updated = await store.save(
        base({
          id: created.id,
          ingredients: [{ line: "2 eggs", amount: 2, name: "eggs" }],
        }),
      );
      assert.deepEqual(updated.ingredients, [
        { line: "2 eggs", amount: 2, unit: "", name: "eggs" },
      ]);
    }),
  );
});

describe("favorite and rating", () => {
  it(
    "stores one favorite",
    verifies("scfv", "02dffbd077d36f98", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base());
      assert.equal(typeof created.favorite, "boolean");
      const flagged = await store.save(base({ id: created.id, favorite: true }));
      assert.equal(flagged.favorite, true);
      await reject("invalid_favorite", base({ favorite: "true" }));
    }),
  );

  it(
    "treats favorite as the household's one flag",
    verifies("yfxf", "7bbb86a41d33ad3f", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base({ favorite: true }));
      const rated = await store.save(
        base({ id: created.id, actor: "taylor", rating: 4 }),
      );
      assert.equal(rated.favorite, true);
      assert.equal(rated.actor, "chef");
    }),
  );

  it(
    "defaults favorite to off",
    verifies("2fp6", "cc77b6936a00e413", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base());
      assert.equal(created.favorite, false);
    }),
  );

  it(
    "stores a rating empty or 1 to 5",
    verifies("9zcr", "d742906d51ecfe4b", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base());
      assert.equal(created.rating, null);
      const rated = await store.save(base({ id: created.id, rating: 5 }));
      assert.equal(rated.rating, 5);
      await reject("invalid_rating", base({ rating: 0 }));
      await reject("invalid_rating", base({ rating: 6 }));
      await reject("invalid_rating", base({ rating: 3.5 }));
    }),
  );

  it(
    "keeps favorite when a rating is set",
    verifies("gfnm", "6feb0f90570b5cbc", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base({ favorite: true }));
      const rated = await store.save(base({ id: created.id, rating: 5 }));
      assert.equal(rated.favorite, true);
    }),
  );

  it(
    "allows a favorite with an empty rating",
    verifies("5xwe", "66fc8d6ced390227", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base({ favorite: true }));
      assert.equal(created.favorite, true);
      assert.equal(created.rating, null);
    }),
  );
});

describe("nutrition", () => {
  it(
    "stores one nutrition row",
    verifies("chgk", "d35b87ca1092c551", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          nutrition: { source: "entered", calories: 100, protein: 10, fat: 5, carbs: 8 },
        }),
      );
      assert.equal(created.nutrition?.source, "entered");
      assert.equal(created.nutrition?.calories, 100);
    }),
  );

  it(
    "stores nutrition numbers with the recipe",
    verifies("xtvz", "dd2b34014f4e7f96", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          servings: 4,
          nutrition: { source: "entered", calories: 100 },
        }),
      );
      assert.equal(created.nutrition?.calories, 100);
      assert.equal(created.servings, 4);
    }),
  );

  it("accepts the estimated nutrition label without calculating numbers", async () => {
    const store = createMemoryRecipeStore();
    const estimated = await store.save(
      base({
        nutrition: { source: "estimated", calories: 250 },
      }),
    );
    assert.equal(estimated.nutrition?.source, "estimated");
  });

  it(
    "stores the entered nutrition label",
    verifies("9yha", "6d13650b7a1e01bf", async () => {
      const store = createMemoryRecipeStore();
      const entered = await store.save(
        base({
          nutrition: { source: "entered", calories: 240 },
        }),
      );
      assert.equal(entered.nutrition?.source, "entered");
    }),
  );

  it(
    "stores the copied nutrition label",
    verifies("tr86", "eacb6a02c2b8b139", async () => {
      const store = createMemoryRecipeStore();
      const copied = await store.save(
        base({
          nutrition: { source: "copied", calories: 260 },
        }),
      );
      assert.equal(copied.nutrition?.source, "copied");
    }),
  );

  it(
    "rejects a nutrition label that is not estimated, entered, or copied",
    verifies("ra6n", "13dfe97a287796aa", async () => {
      await reject(
        "invalid_nutrition",
        base({ nutrition: { source: "guessed", calories: 1 } }),
      );
    }),
  );

  it(
    "keeps stored servings alongside nutrition",
    verifies("78dv", "1dfe1e93c12d8a81", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          servings: 4,
          nutrition: { source: "entered", calories: 100 },
        }),
      );
      assert.equal(created.servings, 4);
    }),
  );

  it(
    "refuses nutrition when servings is not greater than zero",
    verifies("a5bm", "284cf21cbaafd3e6", async () => {
      await reject("servings_required", base({ servings: 0 }));
    }),
  );

  it(
    "keeps nutrition when a save omits it",
    verifies("z3ua", "57a0a80c34df031c", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({ nutrition: { source: "copied", calories: 90 } }),
      );
      const omitted = await store.save(base({ id: created.id, title: "Example: Stew" }));
      assert.deepEqual(omitted.nutrition, {
        source: "copied",
        calories: 90,
        protein: null,
        fat: null,
        carbs: null,
      });
    }),
  );

  it(
    "removes nutrition when a save clears it",
    verifies("89xm", "c45ae300266b7f2c", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({ nutrition: { source: "copied", calories: 90 } }),
      );
      const cleared = await store.save(base({ id: created.id, nutrition: null }));
      assert.equal(cleared.nutrition, null);
    }),
  );
});

describe("delete", () => {
  it(
    "hides a deleted recipe from read and list",
    verifies("chjv", "548f270ecb447de8", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base());
      await store.hide({ id: created.id, actor: "taylor" });
      await assert.rejects(() => store.read(created.id), /not found/);
      assert.deepEqual(await store.list(), []);
    }),
  );

  it(
    "keeps a deleted recipe stored",
    verifies("p6wz", "ba6c5ba9a12a27dd", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base());
      await store.hide({ id: created.id, actor: "taylor" });
      const stored = store.inspect(created.id);
      assert.ok(stored);
      assert.equal(stored.title, "Example: Soup");
    }),
  );

  it(
    "does not make a hidden recipe visible again on save",
    verifies("zdgk", "9979fe712be0d9f7", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base());
      await store.hide({ id: created.id, actor: "chef" });
      await assert.rejects(
        () => store.save(base({ id: created.id, title: "Example: Visible" })),
        /not found/,
      );
      const stored = store.inspect(created.id);
      assert.equal(stored?.title, "Example: Soup");
      assert.ok(stored?.hiddenAt);
    }),
  );

  it(
    "records when a recipe was hidden",
    verifies("7zay", "3e983e4b4b251862", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base());
      const before = Date.now();
      await store.hide({ id: created.id, actor: "taylor" });
      const after = Date.now();
      const stored = store.inspect(created.id);
      assert.ok(stored?.hiddenAt);
      assert.ok(stored.hiddenAt.getTime() >= before);
      assert.ok(stored.hiddenAt.getTime() <= after);
    }),
  );

  it(
    "records who hid a recipe",
    verifies("pwz2", "c286b23c3db325f8", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base());
      await store.hide({ id: created.id, actor: "taylor" });
      assert.equal(store.inspect(created.id)?.hiddenBy, "taylor");
    }),
  );
});

describe("actors, title, steps, servings, and id", () => {
  it(
    "refuses a save without an actor",
    verifies("2ajm", "05424e1f82f05ed8", async () => {
      await reject("actor_required", {
        title: "Example: Soup",
        servings: 2,
        steps: ["Mix."],
      });
      await reject("unknown_actor", base({ actor: "guest" }));
    }),
  );

  it(
    "requires a non-empty title",
    verifies("v2vv", "b2b22b25e337d756", async () => {
      await reject("title_required", base({ title: "" }));
      await reject("title_required", base({ title: "   " }));
    }),
  );

  it(
    "allows two recipes to share a title",
    verifies("b8yu", "676ccaa693da1b4e", async () => {
      const store = createMemoryRecipeStore();
      const first = await store.save(base({ title: "Example: Bread" }));
      const second = await store.save(base({ title: "Example: Bread" }));
      assert.equal(first.title, "Example: Bread");
      assert.equal(second.title, "Example: Bread");
      assert.notEqual(first.id, second.id);
    }),
  );

  it(
    "stores steps in the saved order",
    verifies("amu3", "889e2e1f2488cb1a", async () => {
      const store = createMemoryRecipeStore();
      const recipe = await store.save(
        base({ steps: ["Chop.", "Stir.", "Serve."] }),
      );
      assert.deepEqual(recipe.steps, ["Chop.", "Stir.", "Serve."]);
    }),
  );

  it(
    "stores a step as plain text",
    verifies("8tpz", "89ab0c6a7c807f75", async () => {
      const store = createMemoryRecipeStore();
      const recipe = await store.save(base({ steps: ["Chop."] }));
      assert.equal(typeof recipe.steps[0], "string");
      await reject("invalid_steps", base({ steps: [{ text: "Chop." }] }));
    }),
  );

  it(
    "stores servings",
    verifies("r6t9", "5aa99857e658c715", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base({ servings: 2 }));
      assert.equal(created.servings, 2);
    }),
  );

  it(
    "refuses a servings count that is not greater than zero",
    verifies("x4mp", "be001f530f59c17c", async () => {
      await reject("servings_required", base({ servings: 0 }));
      await reject("servings_required", base({ servings: -1 }));
      await reject("servings_required", base({ servings: Number.POSITIVE_INFINITY }));
    }),
  );

  it("changing stored servings is not a scaled view", async () => {
    const store = createMemoryRecipeStore();
    const created = await store.save(
      base({
        servings: 2,
        ingredients: [
          { line: "2 cups flour", amount: 2, unit: "cups", name: "flour" },
        ],
      }),
    );
    const viewed = await store.save(base({ id: created.id, servings: 6, steps: undefined }));
    assert.equal(viewed.servings, 6);
    assert.deepEqual(viewed.ingredients, created.ingredients);
  });

  it(
    "keeps an opaque id",
    verifies("pjr8", "d62c01eec6c38133", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base({ title: "Example: Soup" }));
      assert.notEqual(created.id, "Example: Soup");
      assert.notEqual(created.id.toLowerCase(), "example-soup");
    }),
  );

  it(
    "uses a caller-supplied id",
    verifies("qe3z", "351c91bcf401d4ea", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({ id: "family-soup", title: "Example: Soup" }),
      );
      assert.equal(created.id, "family-soup");
    }),
  );

  it(
    "updates a visible recipe with that id",
    verifies("jk6v", "da02e6ce30fe4d61", async () => {
      const store = createMemoryRecipeStore();
      await store.save(base({ id: "family-soup", title: "Example: Soup" }));
      const updated = await store.save(
        base({ id: "family-soup", title: "Example: Soup for two" }),
      );
      assert.equal(updated.id, "family-soup");
      assert.equal(updated.title, "Example: Soup for two");
      assert.deepEqual(await store.list(), [
        {
          id: "family-soup",
          title: "Example: Soup for two",
          facts: {
            primaryProtein: null,
            totalMinutes: null,
            effort: null,
            mealTypes: [],
          },
        },
      ]);
    }),
  );

  it(
    "does not change the actor recorded at creation",
    verifies("djas", "e694b6573bbe01c2", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base({ actor: "chef" }));
      const renamed = await store.save(
        base({
          id: created.id,
          actor: "taylor",
          title: "Example: Onion soup",
        }),
      );
      assert.equal(renamed.actor, "chef");
    }),
  );

  it(
    "keeps the recipe id when the title changes",
    verifies("mn6v", "d5abc2c19ec0b992", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base({ title: "Example: Soup" }));
      const renamed = await store.save(
        base({
          id: created.id,
          title: "Example: Onion soup",
        }),
      );
      assert.equal(renamed.id, created.id);
      assert.equal(renamed.title, "Example: Onion soup");
    }),
  );
});

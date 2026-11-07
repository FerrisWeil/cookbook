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
    verifies("116", "8b7c3d56c5da0273", () => {
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
    verifies("85", "a82fdf573329d5c4", async () => {
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
    verifies("86", "0b45c5d6c11092a2", async () => {
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
    verifies("87", "a72739fa7243d52a", async () => {
      await reject("ingredient_line_required", base({ ingredients: [{ name: "salt" }] }));
    }),
  );

  it(
    "keeps ingredient order",
    verifies("88", "6c7386061e85ceb0", async () => {
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
    verifies("89", "5eddb2cbd429516c", async () => {
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
    verifies("91", "e9afc5245ac5d455", async () => {
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
    verifies("92", "711356ef3ce0baef", async () => {
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
    verifies("93", "621bb3a1b8b98224", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base());
      assert.equal(created.favorite, false);
    }),
  );

  it(
    "stores a rating empty or 1 to 5",
    verifies("95", "530a3e18f96faa88", async () => {
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
    verifies("96", "b03ac5f300d241ca", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base({ favorite: true }));
      const rated = await store.save(base({ id: created.id, rating: 5 }));
      assert.equal(rated.favorite, true);
    }),
  );

  it(
    "allows a favorite with an empty rating",
    verifies("97", "cf977ae0ce2f49df", async () => {
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
    verifies("99", "ddc4561a4a458152", async () => {
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
    verifies("100", "7996b985b5f029f0", async () => {
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
    verifies("102", "9f97cede8d96da75", async () => {
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
    verifies("103", "98dc876c434b1d33", async () => {
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
    verifies("104", "768f762c2850fc2d", async () => {
      await reject(
        "invalid_nutrition",
        base({ nutrition: { source: "guessed", calories: 1 } }),
      );
    }),
  );

  it(
    "keeps stored servings alongside nutrition",
    verifies("105", "76f56d1171f4098d", async () => {
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
    verifies("106", "dda39dd9104875ae", async () => {
      await reject("servings_required", base({ servings: 0 }));
    }),
  );

  it(
    "keeps nutrition when a save omits it",
    verifies("107", "2b5d86aad780a337", async () => {
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
    verifies("108", "227bb00061587758", async () => {
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
    verifies("110", "3796df269fe022c2", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base());
      await store.hide({ id: created.id, actor: "taylor" });
      await assert.rejects(() => store.read(created.id), /not found/);
      assert.deepEqual(await store.list(), []);
    }),
  );

  it(
    "keeps a deleted recipe stored",
    verifies("111", "4f86e079e1493fd2", async () => {
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
    verifies("112", "4818651add947ab0", async () => {
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
    verifies("113", "47cccb6ce54d246e", async () => {
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
    verifies("114", "ed6414509931f047", async () => {
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
    verifies("117", "f92872e5387c8d0c", async () => {
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
    verifies("119", "5dfb1e27522f24cc", async () => {
      await reject("title_required", base({ title: "" }));
      await reject("title_required", base({ title: "   " }));
    }),
  );

  it(
    "allows two recipes to share a title",
    verifies("120", "c63c9fe17a0f4860", async () => {
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
    verifies("122", "da3db214349a5e37", async () => {
      const store = createMemoryRecipeStore();
      const recipe = await store.save(
        base({ steps: ["Chop.", "Stir.", "Serve."] }),
      );
      assert.deepEqual(recipe.steps, ["Chop.", "Stir.", "Serve."]);
    }),
  );

  it(
    "stores a step as plain text",
    verifies("123", "6a02abd53b3af739", async () => {
      const store = createMemoryRecipeStore();
      const recipe = await store.save(base({ steps: ["Chop."] }));
      assert.equal(typeof recipe.steps[0], "string");
      await reject("invalid_steps", base({ steps: [{ text: "Chop." }] }));
    }),
  );

  it(
    "stores servings",
    verifies("125", "7445b95dc576d161", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base({ servings: 2 }));
      assert.equal(created.servings, 2);
    }),
  );

  it(
    "refuses a servings count that is not greater than zero",
    verifies("126", "e24706aa609101b0", async () => {
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
    verifies("129", "44fbb8c06fade29b", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(base({ title: "Example: Soup" }));
      assert.notEqual(created.id, "Example: Soup");
      assert.notEqual(created.id.toLowerCase(), "example-soup");
    }),
  );

  it(
    "uses a caller-supplied id",
    verifies("130", "a2a5381da39b6112", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({ id: "family-soup", title: "Example: Soup" }),
      );
      assert.equal(created.id, "family-soup");
    }),
  );

  it(
    "updates a visible recipe with that id",
    verifies("131", "b752570ec05e3a3d", async () => {
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
    verifies("132", "ea0af45c4be35606", async () => {
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
    verifies("133", "67246a8e6e1b486e", async () => {
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

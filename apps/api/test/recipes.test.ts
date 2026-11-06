import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { covers } from "@cookbook/test";

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
  it("ships taylor, chef, and system as actors in git", () => {
    covers("5.6.1");
    const sql = readFileSync(
      join(repoRoot, "db/migrations/0002_recipes.sql"),
      "utf8",
    );
    assert.match(sql, /CREATE TABLE actors/);
    assert.match(
      sql,
      /INSERT INTO actors \(name\) VALUES \('chef'\), \('system'\), \('taylor'\)/,
    );
    assert.match(sql, /CREATE TABLE recipes/);
    assert.match(sql, /CREATE TABLE recipe_ingredients/);
    assert.match(sql, /CREATE TABLE recipe_steps/);
    assert.match(sql, /CREATE TABLE recipe_nutrition/);
    assert.match(sql, /source IN \('estimated', 'entered', 'copied'\)/);
  });
});

describe("ingredients", () => {
  it("stores a written line and leaves amount, unit, and name empty when unstated", async () => {
    covers("5.1.1", "5.1.2", "5.1.3");
    const store = createMemoryRecipeStore();
    const recipe = await store.save(
      base({
        ingredients: [{ line: "salt to taste" }],
      }),
    );
    assert.deepEqual(recipe.ingredients, [
      { line: "salt to taste", amount: null, unit: "", name: "" },
    ]);
    await reject("ingredient_line_required", base({ ingredients: [{ name: "salt" }] }));
  });

  it("keeps ingredient order and replaces the list on save", async () => {
    covers("5.1.4", "5.1.5");
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
    const updated = await store.save(
      base({
        id: created.id,
        ingredients: [{ line: "2 eggs", amount: 2, name: "eggs" }],
      }),
    );
    assert.deepEqual(updated.ingredients, [
      { line: "2 eggs", amount: 2, unit: "", name: "eggs" },
    ]);
  });
});

describe("favorite and rating", () => {
  it("stores one household favorite that defaults to off", async () => {
    covers("5.2.1", "5.2.2", "5.2.3");
    const store = createMemoryRecipeStore();
    const created = await store.save(base());
    assert.equal(created.favorite, false);
    const flagged = await store.save(base({ id: created.id, favorite: true }));
    assert.equal(flagged.favorite, true);
    const rated = await store.save(
      base({ id: created.id, actor: "taylor", rating: 4 }),
    );
    assert.equal(rated.favorite, true);
    assert.equal(rated.actor, "chef");
    assert.equal(typeof rated.favorite, "boolean");
    await reject("invalid_favorite", base({ favorite: "true" }));
  });

  it("stores one optional rating without changing favorite", async () => {
    covers("5.3.1", "5.3.2", "5.3.3");
    const store = createMemoryRecipeStore();
    const created = await store.save(base({ favorite: true }));
    assert.equal(created.rating, null);
    assert.equal(created.favorite, true);
    const rated = await store.save(base({ id: created.id, rating: 5 }));
    assert.equal(rated.rating, 5);
    assert.equal(rated.favorite, true);
    await reject("invalid_rating", base({ rating: 0 }));
    await reject("invalid_rating", base({ rating: 6 }));
    await reject("invalid_rating", base({ rating: 3.5 }));
  });
});

describe("nutrition", () => {
  it("stores at most one per-serving row using the recipe servings as the divisor", async () => {
    covers("5.4.1", "5.4.2", "5.4.6", "5.4.7", "5.4.8");
    const store = createMemoryRecipeStore();
    const created = await store.save(
      base({
        servings: 4,
        nutrition: {
          source: "entered",
          calories: 100,
          protein: 10,
          fat: 5,
          carbs: 8,
        },
      }),
    );
    assert.equal(created.nutrition?.source, "entered");
    assert.equal(created.nutrition?.calories, 100);
    assert.equal(created.servings, 4);
    const scaledView = await store.save(base({ id: created.id, servings: 8 }));
    assert.equal(scaledView.nutrition?.calories, 100);
    assert.equal(scaledView.servings, 8);
    await reject("servings_required", base({ servings: 0 }));
    await reject(
      "invalid_nutrition",
      base({ nutrition: { source: "guessed", calories: 1 } }),
    );
  });

  it("records estimated, entered, or copied as the nutrition source label", async () => {
    covers("5.4.3", "5.4.4", "5.4.5");
    const store = createMemoryRecipeStore();
    const estimated = await store.save(
      base({
        nutrition: { source: "estimated", calories: 250 },
      }),
    );
    assert.equal(estimated.nutrition?.source, "estimated");
    const entered = await store.save(
      base({
        id: estimated.id,
        nutrition: { source: "entered", calories: 240 },
      }),
    );
    assert.equal(entered.nutrition?.source, "entered");
    const copied = await store.save(
      base({
        id: estimated.id,
        nutrition: { source: "copied", calories: 260 },
      }),
    );
    assert.equal(copied.nutrition?.source, "copied");
  });

  it("keeps nutrition when a save omits it and removes it when a save clears it", async () => {
    covers("5.4.9", "5.4.10");
    const store = createMemoryRecipeStore();
    const created = await store.save(
      base({ nutrition: { source: "copied", calories: 90 } }),
    );
    const omitted = await store.save(base({ id: created.id, title: "Example: Stew" }));
    assert.deepEqual(omitted.nutrition, { source: "copied", calories: 90, protein: null, fat: null, carbs: null });
    const cleared = await store.save(base({ id: created.id, nutrition: null }));
    assert.equal(cleared.nutrition, null);
  });
});

describe("delete", () => {
  it("hides a recipe from read and list and keeps the row with time and actor", async () => {
    covers("5.5.1", "5.5.2", "5.5.4", "5.5.5");
    const store = createMemoryRecipeStore();
    const created = await store.save(base());
    const before = Date.now();
    await store.hide({ id: created.id, actor: "taylor" });
    const after = Date.now();
    await assert.rejects(() => store.read(created.id), /not found/);
    assert.deepEqual(await store.list(), []);
    const stored = store.inspect(created.id);
    assert.ok(stored);
    assert.equal(stored.title, "Example: Soup");
    assert.equal(stored.hiddenBy, "taylor");
    assert.ok(stored.hiddenAt);
    assert.ok(stored.hiddenAt.getTime() >= before);
    assert.ok(stored.hiddenAt.getTime() <= after);
  });

  it("does not make a hidden recipe visible again on save", async () => {
    covers("5.5.3");
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
  });
});

describe("actors, title, steps, servings, and id", () => {
  it("refuses a save without an actor", async () => {
    covers("5.6.2");
    await reject("actor_required", {
      title: "Example: Soup",
      servings: 2,
      steps: ["Mix."],
    });
    await reject("unknown_actor", base({ actor: "guest" }));
  });

  it("requires a non-empty title and allows two recipes to share one", async () => {
    covers("5.7.1", "5.7.2");
    const store = createMemoryRecipeStore();
    await reject("title_required", base({ title: "" }));
    await reject("title_required", base({ title: "   " }));
    const first = await store.save(base({ title: "Example: Bread" }));
    const second = await store.save(base({ title: "Example: Bread" }));
    assert.equal(first.title, "Example: Bread");
    assert.equal(second.title, "Example: Bread");
    assert.notEqual(first.id, second.id);
  });

  it("stores steps as plain text in the saved order", async () => {
    covers("5.8.1", "5.8.2");
    const store = createMemoryRecipeStore();
    const recipe = await store.save(
      base({ steps: ["Chop.", "Stir.", "Serve."] }),
    );
    assert.deepEqual(recipe.steps, ["Chop.", "Stir.", "Serve."]);
    await reject("invalid_steps", base({ steps: [{ text: "Chop." }] }));
  });

  it("stores servings greater than zero and keeps the authored recipe when servings change", async () => {
    covers("5.9.1", "5.9.2", "5.9.3");
    const store = createMemoryRecipeStore();
    const created = await store.save(
      base({
        servings: 2,
        ingredients: [
          { line: "2 cups flour", amount: 2, unit: "cups", name: "flour" },
        ],
        steps: ["Mix the flour."],
      }),
    );
    assert.equal(created.servings, 2);
    const viewed = await store.save(
      base({ id: created.id, servings: 6, steps: undefined }),
    );
    assert.equal(viewed.servings, 6);
    assert.deepEqual(viewed.ingredients, created.ingredients);
    assert.deepEqual(viewed.steps, created.steps);
    await reject("servings_required", base({ servings: 0 }));
    await reject("servings_required", base({ servings: -1 }));
    await reject("servings_required", base({ servings: Number.POSITIVE_INFINITY }));
  });

  it("keeps an opaque id when the title changes and records the creating actor once", async () => {
    covers("5.10.1", "5.10.4", "5.10.5");
    const store = createMemoryRecipeStore();
    const created = await store.save(base({ actor: "chef", title: "Example: Soup" }));
    assert.notEqual(created.id, "Example: Soup");
    assert.notEqual(created.id.toLowerCase(), "example-soup");
    assert.equal(created.actor, "chef");
    const renamed = await store.save(
      base({
        id: created.id,
        actor: "taylor",
        title: "Example: Onion soup",
      }),
    );
    assert.equal(renamed.id, created.id);
    assert.equal(renamed.title, "Example: Onion soup");
    assert.equal(renamed.actor, "chef");
  });

  it("uses a caller-supplied id and updates that visible recipe", async () => {
    covers("5.10.2", "5.10.3");
    const store = createMemoryRecipeStore();
    const created = await store.save(
      base({ id: "family-soup", title: "Example: Soup" }),
    );
    assert.equal(created.id, "family-soup");
    const updated = await store.save(
      base({ id: "family-soup", title: "Example: Soup for two" }),
    );
    assert.equal(updated.id, "family-soup");
    assert.equal(updated.title, "Example: Soup for two");
    assert.deepEqual(await store.list(), [
      { id: "family-soup", title: "Example: Soup for two" },
    ]);
  });
});

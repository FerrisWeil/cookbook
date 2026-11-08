import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyRecipeFacts, MESSAGES } from "@cookbook/shared";
import { verifies } from "@cookbook/test";

import { RecipeError } from "../src/recipes/errors.ts";
import { createMemoryRecipeStore } from "../src/recipes/memory.ts";
import type { SaveRecipeInput } from "../src/recipes/types.ts";

function base(overrides: SaveRecipeInput = {}): SaveRecipeInput {
  return {
    actor: "chef",
    title: "Example: Soup",
    servings: 4,
    steps: ["Heat the pot."],
    ingredients: [{ line: "1 onion" }],
    ...overrides,
  };
}

describe("recipe facts", () => {
  it(
    "stores a primary protein as arbitrary text or unset",
    verifies("165", "6a24393e2b7f6916", async () => {
      const store = createMemoryRecipeStore();
      const unset = await store.save(base());
      assert.equal(unset.facts.primaryProtein, null);
      const named = await store.save(
        base({
          id: unset.id,
          facts: {
            primaryProtein: "chicken",
            totalMinutes: null,
            effort: null,
            mealTypes: [],
          },
        }),
      );
      assert.equal(named.facts.primaryProtein, "chicken");
      const other = await store.save(
        base({
          id: unset.id,
          facts: {
            primaryProtein: "seitan",
            totalMinutes: null,
            effort: null,
            mealTypes: [],
          },
        }),
      );
      assert.equal(other.facts.primaryProtein, "seitan");
      const cleared = await store.save(
        base({
          id: unset.id,
          facts: {
            primaryProtein: "no protein",
            totalMinutes: null,
            effort: null,
            mealTypes: [],
          },
        }),
      );
      assert.equal(cleared.facts.primaryProtein, null);
    }),
  );

  it(
    "stores total elapsed time as whole minutes including prep and waiting, or unset",
    verifies("166", "5ca8730f39ef61db", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          facts: {
            primaryProtein: null,
            totalMinutes: 180,
            effort: null,
            mealTypes: [],
          },
        }),
      );
      assert.equal(created.facts.totalMinutes, 180);
      const zero = await store.save(
        base({
          id: created.id,
          facts: {
            primaryProtein: null,
            totalMinutes: 0,
            effort: null,
            mealTypes: [],
          },
        }),
      );
      assert.equal(zero.facts.totalMinutes, 0);
    }),
  );

  it(
    "stores effort as low, medium, or high, or unset",
    verifies("167", "baef8ae9fe2e5d7c", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          facts: {
            primaryProtein: null,
            totalMinutes: null,
            effort: "medium",
            mealTypes: [],
          },
        }),
      );
      assert.equal(created.facts.effort, "medium");
      const cleared = await store.save(
        base({
          id: created.id,
          facts: emptyRecipeFacts(),
        }),
      );
      assert.equal(cleared.facts.effort, null);
    }),
  );

  it(
    "stores meal types as a subset of breakfast, lunch, dinner, snack, and dessert",
    verifies("168", "8486562569d7cf0f", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          facts: {
            primaryProtein: null,
            totalMinutes: null,
            effort: null,
            mealTypes: ["dinner", "lunch", "snack"],
          },
        }),
      );
      assert.deepEqual(created.facts.mealTypes, ["lunch", "dinner", "snack"]);
    }),
  );

  it(
    "keeps stored facts when a save omits them",
    verifies("169", "3305becfd4a352bd", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          facts: {
            primaryProtein: "pork",
            totalMinutes: 45,
            effort: "low",
            mealTypes: ["dinner"],
          },
        }),
      );
      const omitted = await store.save(
        base({ id: created.id, title: "Example: Stew" }),
      );
      assert.equal(omitted.title, "Example: Stew");
      assert.deepEqual(omitted.facts, {
        primaryProtein: "pork",
        totalMinutes: 45,
        effort: "low",
        mealTypes: ["dinner"],
      });
    }),
  );

  it(
    "clears facts when a save or facts update unsets them",
    verifies("170", "cd5af3ea736a979c", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          facts: {
            primaryProtein: "fish",
            totalMinutes: 20,
            effort: "high",
            mealTypes: ["lunch"],
          },
        }),
      );
      const cleared = await store.save(base({ id: created.id, facts: null }));
      assert.deepEqual(cleared.facts, emptyRecipeFacts());
      const reset = await store.save(
        base({
          id: created.id,
          facts: {
            primaryProtein: "eggs",
            totalMinutes: 10,
            effort: "low",
            mealTypes: ["breakfast"],
          },
        }),
      );
      assert.equal(reset.facts.primaryProtein, "eggs");
      const updated = await store.updateFacts(created.id, emptyRecipeFacts());
      assert.deepEqual(updated.facts, emptyRecipeFacts());
    }),
  );

  it(
    "refuses invalid facts and leaves the stored recipe unchanged",
    verifies("171", "c932a496bb0f6796", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          title: "Example: Keep me",
          facts: {
            primaryProtein: "chicken",
            totalMinutes: 30,
            effort: "low",
            mealTypes: ["dinner"],
          },
        }),
      );
      const invalid: unknown[] = [
        { primaryProtein: 12, totalMinutes: null, effort: null, mealTypes: [] },
        {
          primaryProtein: "x".repeat(81),
          totalMinutes: null,
          effort: null,
          mealTypes: [],
        },
        { primaryProtein: null, totalMinutes: -1, effort: null, mealTypes: [] },
        {
          primaryProtein: null,
          totalMinutes: 30.5,
          effort: null,
          mealTypes: [],
        },
        {
          primaryProtein: null,
          totalMinutes: Number.POSITIVE_INFINITY,
          effort: null,
          mealTypes: [],
        },
        {
          primaryProtein: null,
          totalMinutes: 10081,
          effort: null,
          mealTypes: [],
        },
        { primaryProtein: null, totalMinutes: null, effort: "Low", mealTypes: [] },
        {
          primaryProtein: null,
          totalMinutes: null,
          effort: null,
          mealTypes: ["brunch"],
        },
        {
          primaryProtein: null,
          totalMinutes: null,
          effort: null,
          mealTypes: ["dinner", "dinner"],
        },
        { title: "nope" },
      ];
      for (const facts of invalid) {
        await assert.rejects(
          () => store.save(base({ id: created.id, facts })),
          (error: unknown) => {
            assert.ok(error instanceof RecipeError);
            return true;
          },
        );
        await assert.rejects(
          () => store.updateFacts(created.id, facts),
          (error: unknown) => {
            assert.ok(error instanceof RecipeError);
            return true;
          },
        );
      }
      const stored = await store.read(created.id);
      assert.equal(stored.title, "Example: Keep me");
      assert.deepEqual(stored.facts, {
        primaryProtein: "chicken",
        totalMinutes: 30,
        effort: "low",
        mealTypes: ["dinner"],
      });
    }),
  );

  it(
    "leaves title, ingredients, steps, servings, nutrition, favorite, rating, and actor unchanged on a facts-only update",
    verifies("172", "29785d2e0ff21215", async () => {
      const store = createMemoryRecipeStore();
      const created = await store.save(
        base({
          actor: "chef",
          title: "Example: Bowls",
          servings: 3,
          favorite: true,
          rating: 4,
          ingredients: [{ line: "400 g chicken", amount: 400, unit: "g", name: "chicken" }],
          steps: ["Roast.", "Serve."],
          nutrition: { source: "entered", calories: 500 },
        }),
      );
      const updated = await store.updateFacts(created.id, {
        primaryProtein: "chicken",
        totalMinutes: 30,
        effort: "low",
        mealTypes: ["dinner"],
      });
      assert.equal(updated.title, "Example: Bowls");
      assert.equal(updated.servings, 3);
      assert.equal(updated.favorite, true);
      assert.equal(updated.rating, 4);
      assert.equal(updated.actor, "chef");
      assert.deepEqual(updated.ingredients, created.ingredients);
      assert.deepEqual(updated.steps, ["Roast.", "Serve."]);
      assert.deepEqual(updated.nutrition, created.nutrition);
      assert.deepEqual(updated.facts, {
        primaryProtein: "chicken",
        totalMinutes: 30,
        effort: "low",
        mealTypes: ["dinner"],
      });
      await assert.rejects(
        () => store.updateFacts("missing", emptyRecipeFacts()),
        (error: unknown) => {
          assert.ok(error instanceof RecipeError);
          assert.equal(error.message, MESSAGES.notFound);
          return true;
        },
      );
    }),
  );
});

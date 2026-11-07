import { randomUUID } from "node:crypto";

import type { RecipeFacts } from "@cookbook/shared";

import { RecipeError } from "./errors.js";
import {
  factsOrEmpty,
  parseFactsField,
  parseHide,
  parseSave,
  type ParsedSave,
} from "./parse.js";
import type {
  HideRecipeInput,
  Ingredient,
  Nutrition,
  Recipe,
  RecipeListItem,
  RecipeStore,
  SaveRecipeInput,
} from "./types.js";
import type { ReleasableClient, SqlClient } from "../migrate.js";

type RecipeRow = {
  id: unknown;
  title: unknown;
  servings: unknown;
  favorite: unknown;
  rating: unknown;
  actor: unknown;
  primary_protein?: unknown;
  total_minutes?: unknown;
  effort?: unknown;
  meal_types?: unknown;
};

type IngredientRow = {
  line: unknown;
  amount: unknown;
  unit: unknown;
  name: unknown;
};

type NutritionRow = {
  source: unknown;
  calories: unknown;
  protein: unknown;
  fat: unknown;
  carbs: unknown;
};

async function transaction<T>(
  checkout: () => Promise<ReleasableClient>,
  fn: (client: SqlClient) => Promise<T>,
): Promise<T> {
  const client = await checkout();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original failure is the one callers need.
    }
    throw error;
  } finally {
    client.release();
  }
}

function asString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("expected text");
  }
  return value;
}

function asBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error("expected boolean");
  }
  return value;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  throw new Error("expected number");
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return asNumber(value);
}

function asNullableInt(value: unknown): number | null {
  const parsed = asNullableNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function asNullableText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return asString(value);
}

function factsFromRow(row: RecipeRow): RecipeFacts {
  const mealTypes = row.meal_types;
  return {
    primaryProtein: asNullableText(row.primary_protein),
    totalMinutes: asNullableInt(row.total_minutes),
    effort: asNullableText(row.effort) as RecipeFacts["effort"],
    mealTypes: Array.isArray(mealTypes)
      ? (mealTypes.map((item) => asString(item)) as RecipeFacts["mealTypes"])
      : [],
  };
}

function factsParams(facts: RecipeFacts): unknown[] {
  return [
    facts.primaryProtein,
    facts.totalMinutes,
    facts.effort,
    facts.mealTypes,
  ];
}

async function requireActor(client: SqlClient, actor: string): Promise<void> {
  const result = await client.query("SELECT 1 FROM actors WHERE name = $1", [
    actor,
  ]);
  if ((result.rowCount ?? 0) === 0) {
    throw new RecipeError("unknown_actor", "That actor is not known.");
  }
}

async function loadVisible(
  client: SqlClient,
  id: string,
): Promise<Recipe | null> {
  const result = await client.query(
    `SELECT id, title, servings, favorite, rating, actor,
            primary_protein, total_minutes, effort, meal_types
     FROM recipes
     WHERE id = $1 AND hidden_at IS NULL`,
    [id],
  );
  const row = result.rows[0] as RecipeRow | undefined;
  if (!row) {
    return null;
  }
  return assemble(client, row);
}

async function assemble(client: SqlClient, row: RecipeRow): Promise<Recipe> {
  const id = asString(row.id);
  const ingredients = await client.query(
    `SELECT line, amount, unit, name
     FROM recipe_ingredients
     WHERE recipe_id = $1
     ORDER BY position`,
    [id],
  );
  const steps = await client.query(
    `SELECT body FROM recipe_steps WHERE recipe_id = $1 ORDER BY position`,
    [id],
  );
  const nutrition = await client.query(
    `SELECT source, calories, protein, fat, carbs
     FROM recipe_nutrition
     WHERE recipe_id = $1`,
    [id],
  );
  const nutritionRow = nutrition.rows[0] as NutritionRow | undefined;
  return {
    id,
    title: asString(row.title),
    servings: asNumber(row.servings),
    favorite: asBoolean(row.favorite),
    rating: asNullableInt(row.rating),
    actor: asString(row.actor),
    ingredients: ingredients.rows.map((item) => {
      const ingredient = item as IngredientRow;
      return {
        line: asString(ingredient.line),
        amount: asNullableNumber(ingredient.amount),
        unit: ingredient.unit === null ? "" : asString(ingredient.unit),
        name: ingredient.name === null ? "" : asString(ingredient.name),
      } satisfies Ingredient;
    }),
    steps: steps.rows.map((item) => asString(item["body"])),
    nutrition: nutritionRow
      ? ({
          source: asString(nutritionRow.source) as Nutrition["source"],
          calories: asNullableNumber(nutritionRow.calories),
          protein: asNullableNumber(nutritionRow.protein),
          fat: asNullableNumber(nutritionRow.fat),
          carbs: asNullableNumber(nutritionRow.carbs),
        } satisfies Nutrition)
      : null,
    facts: factsFromRow(row),
  };
}

async function replaceChildren(
  client: SqlClient,
  id: string,
  parsed: ParsedSave,
): Promise<void> {
  if (parsed.ingredients !== undefined) {
    await client.query("DELETE FROM recipe_ingredients WHERE recipe_id = $1", [
      id,
    ]);
    for (const [index, item] of parsed.ingredients.entries()) {
      await client.query(
        `INSERT INTO recipe_ingredients (recipe_id, position, line, amount, unit, name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          index,
          item.line,
          item.amount,
          item.unit === "" ? null : item.unit,
          item.name === "" ? null : item.name,
        ],
      );
    }
  }
  if (parsed.steps !== undefined) {
    await client.query("DELETE FROM recipe_steps WHERE recipe_id = $1", [id]);
    for (const [index, body] of parsed.steps.entries()) {
      await client.query(
        `INSERT INTO recipe_steps (recipe_id, position, body) VALUES ($1, $2, $3)`,
        [id, index, body],
      );
    }
  }
  if (parsed.nutrition === null) {
    await client.query("DELETE FROM recipe_nutrition WHERE recipe_id = $1", [
      id,
    ]);
  } else if (parsed.nutrition) {
    await client.query("DELETE FROM recipe_nutrition WHERE recipe_id = $1", [
      id,
    ]);
    await client.query(
      `INSERT INTO recipe_nutrition (recipe_id, source, calories, protein, fat, carbs)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        parsed.nutrition.source,
        parsed.nutrition.calories,
        parsed.nutrition.protein,
        parsed.nutrition.fat,
        parsed.nutrition.carbs,
      ],
    );
  }
}

async function writeFacts(
  client: SqlClient,
  id: string,
  facts: RecipeFacts,
): Promise<void> {
  await client.query(
    `UPDATE recipes
     SET primary_protein = $2, total_minutes = $3, effort = $4, meal_types = $5
     WHERE id = $1 AND hidden_at IS NULL`,
    [id, ...factsParams(facts)],
  );
}

export function createPgRecipeStore(
  checkout: () => Promise<ReleasableClient>,
): RecipeStore {
  return {
    async save(input: SaveRecipeInput): Promise<Recipe> {
      const parsed = parseSave(input);
      return transaction(checkout, async (client) => {
        await requireActor(client, parsed.actor);
        const requestedId = parsed.id;
        if (requestedId) {
          const existing = await client.query(
            "SELECT id, hidden_at, actor FROM recipes WHERE id = $1",
            [requestedId],
          );
          const row = existing.rows[0] as
            | { id: unknown; hidden_at: unknown; actor: unknown }
            | undefined;
          if (row?.["hidden_at"]) {
            throw new RecipeError("not_found", "The recipe was not found.");
          }
          if (row) {
            const current = await loadVisible(client, requestedId);
            if (!current) {
              throw new RecipeError("not_found", "The recipe was not found.");
            }
            const favorite = parsed.favorite ?? current.favorite;
            const rating =
              parsed.rating === undefined ? current.rating : parsed.rating;
            await client.query(
              `UPDATE recipes
               SET title = $2, servings = $3, favorite = $4, rating = $5
               WHERE id = $1 AND hidden_at IS NULL`,
              [
                requestedId,
                parsed.title,
                parsed.servings,
                favorite,
                rating,
              ],
            );
            await replaceChildren(client, requestedId, parsed);
            if (parsed.facts !== undefined) {
              await writeFacts(client, requestedId, factsOrEmpty(parsed.facts));
            }
            const updated = await loadVisible(client, requestedId);
            if (!updated) {
              throw new RecipeError("not_found", "The recipe was not found.");
            }
            return updated;
          }
        }

        const id = requestedId ?? randomUUID();
        const facts = factsOrEmpty(parsed.facts);
        await client.query(
          `INSERT INTO recipes (
             id, title, servings, favorite, rating, actor,
             primary_protein, total_minutes, effort, meal_types
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            id,
            parsed.title,
            parsed.servings,
            parsed.favorite ?? false,
            parsed.rating ?? null,
            parsed.actor,
            ...factsParams(facts),
          ],
        );
        await replaceChildren(client, id, parsed);
        const created = await loadVisible(client, id);
        if (!created) {
          throw new RecipeError("not_found", "The recipe was not found.");
        }
        return created;
      });
    },

    async read(id: string): Promise<Recipe> {
      return transaction(checkout, async (client) => {
        const recipe = await loadVisible(client, id);
        if (!recipe) {
          throw new RecipeError("not_found", "The recipe was not found.");
        }
        return recipe;
      });
    },

    async list(): Promise<RecipeListItem[]> {
      return transaction(checkout, async (client) => {
        const result = await client.query(
          `SELECT id, title, primary_protein, total_minutes, effort, meal_types
           FROM recipes
           WHERE hidden_at IS NULL
           ORDER BY created_at ASC, id ASC`,
        );
        return result.rows.map((row) => {
          const item = row as RecipeRow;
          return {
            id: asString(item.id),
            title: asString(item.title),
            facts: factsFromRow(item),
          };
        });
      });
    },

    async hide(input: HideRecipeInput): Promise<void> {
      const parsed = parseHide(input);
      return transaction(checkout, async (client) => {
        await requireActor(client, parsed.actor);
        const result = await client.query(
          `UPDATE recipes
           SET hidden_at = now(), hidden_by = $2
           WHERE id = $1 AND hidden_at IS NULL`,
          [parsed.id, parsed.actor],
        );
        if ((result.rowCount ?? 0) === 0) {
          throw new RecipeError("not_found", "The recipe was not found.");
        }
      });
    },

    async updateFacts(id: string, facts: unknown): Promise<Recipe> {
      const parsed = parseFactsField(facts);
      if (parsed === undefined) {
        throw new RecipeError("invalid_facts", "Facts are required.");
      }
      const next = factsOrEmpty(parsed);
      return transaction(checkout, async (client) => {
        const current = await loadVisible(client, id);
        if (!current) {
          throw new RecipeError("not_found", "The recipe was not found.");
        }
        await writeFacts(client, id, next);
        const updated = await loadVisible(client, id);
        if (!updated) {
          throw new RecipeError("not_found", "The recipe was not found.");
        }
        return updated;
      });
    },
  };
}

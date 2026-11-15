import { randomUUID } from "node:crypto";

import {
  emptyRecipeFacts,
  matchRecipe,
  mergeProteinChoices,
  type QueryNode,
  type RecipeFacts,
} from "@cookbook/shared";

import { MutationAckError, canonicalFingerprint } from "../mutations.js";
import { RecipeError } from "./errors.js";
import {
  applyFactsPatch,
  factsOrEmpty,
  parseFactsField,
  parseFactsPatch,
  parseHide,
  parseSave,
} from "./parse.js";
import {
  SHIPPED_ACTORS,
  type HideRecipeInput,
  type Recipe,
  type RecipeListItem,
  type RecipeStore,
  type SaveRecipeInput,
  type StoredRecipe,
} from "./types.js";

function cloneFacts(facts: RecipeFacts): RecipeFacts {
  return {
    primaryProtein: facts.primaryProtein,
    totalMinutes: facts.totalMinutes,
    effort: facts.effort,
    mealTypes: [...facts.mealTypes],
  };
}

function cloneRecipe(recipe: StoredRecipe): StoredRecipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((item) => ({ ...item })),
    steps: [...recipe.steps],
    nutrition: recipe.nutrition ? { ...recipe.nutrition } : null,
    facts: cloneFacts(recipe.facts),
    hiddenAt: recipe.hiddenAt ? new Date(recipe.hiddenAt) : null,
  };
}

function visible(recipe: StoredRecipe): Recipe {
  const copy = cloneRecipe(recipe);
  return {
    id: copy.id,
    title: copy.title,
    servings: copy.servings,
    favorite: copy.favorite,
    rating: copy.rating,
    actor: copy.actor,
    ingredients: copy.ingredients,
    steps: copy.steps,
    nutrition: copy.nutrition,
    facts: copy.facts,
  };
}

function listItem(recipe: StoredRecipe): RecipeListItem {
  return {
    id: recipe.id,
    title: recipe.title,
    facts: cloneFacts(recipe.facts),
  };
}

export class MemoryRecipeStore implements RecipeStore {
  private readonly actors: Set<string>;
  private readonly recipes = new Map<string, StoredRecipe>();
  private readonly order: string[] = [];
  private readonly acks = new Map<
    string,
    { fingerprint: string; recipeId: string }
  >();

  constructor(actors: readonly string[] = SHIPPED_ACTORS) {
    this.actors = new Set(actors);
  }

  inspect(id: string): StoredRecipe | undefined {
    const stored = this.recipes.get(id);
    return stored ? cloneRecipe(stored) : undefined;
  }

  async save(input: SaveRecipeInput): Promise<Recipe> {
    const parsed = parseSave(input);
    this.requireActor(parsed.actor);
    const existing = parsed.id ? this.recipes.get(parsed.id) : undefined;
    if (existing?.hiddenAt) {
      throw new RecipeError("not_found", "The recipe was not found.");
    }

    const id = existing?.id ?? parsed.id ?? randomUUID();
    const ingredients = parsed.ingredients ?? existing?.ingredients ?? [];
    const steps = parsed.steps ?? existing?.steps ?? [];
    const stored: StoredRecipe = {
      id,
      title: parsed.title,
      servings: parsed.servings,
      favorite: parsed.favorite ?? existing?.favorite ?? false,
      rating:
        parsed.rating === undefined ? (existing?.rating ?? null) : parsed.rating,
      actor: existing?.actor ?? parsed.actor,
      ingredients: ingredients.map((item) => ({ ...item })),
      steps: [...steps],
      nutrition:
        parsed.nutrition === undefined
          ? existing?.nutrition
            ? { ...existing.nutrition }
            : null
          : parsed.nutrition === null
            ? null
            : { ...parsed.nutrition },
      facts:
        parsed.facts === undefined
          ? cloneFacts(existing?.facts ?? emptyRecipeFacts())
          : factsOrEmpty(parsed.facts),
      hiddenAt: null,
      hiddenBy: null,
    };

    if (!existing) {
      this.recipes.set(id, stored);
      this.order.push(id);
    } else {
      this.recipes.set(id, stored);
    }
    return visible(stored);
  }

  async read(id: string): Promise<Recipe> {
    const stored = this.recipes.get(id);
    if (!stored || stored.hiddenAt) {
      throw new RecipeError("not_found", "The recipe was not found.");
    }
    return visible(stored);
  }

  async list(query: QueryNode | null = null): Promise<RecipeListItem[]> {
    return this.order.flatMap((id) => {
      const stored = this.recipes.get(id);
      if (!stored || stored.hiddenAt) {
        return [];
      }
      if (!matchRecipe(stored, query)) {
        return [];
      }
      return [listItem(stored)];
    });
  }

  async proteinChoices(): Promise<string[]> {
    const values: string[] = [];
    for (const id of this.order) {
      const stored = this.recipes.get(id);
      if (!stored || stored.hiddenAt || stored.facts.primaryProtein === null) {
        continue;
      }
      values.push(stored.facts.primaryProtein);
    }
    return mergeProteinChoices(values);
  }

  async hide(input: HideRecipeInput): Promise<void> {
    const parsed = parseHide(input);
    this.requireActor(parsed.actor);
    const stored = this.recipes.get(parsed.id);
    if (!stored || stored.hiddenAt) {
      throw new RecipeError("not_found", "The recipe was not found.");
    }
    stored.hiddenAt = new Date();
    stored.hiddenBy = parsed.actor;
  }

  async updateFacts(id: string, facts: unknown): Promise<Recipe> {
    const patch = parseFactsPatch(facts);
    const fingerprint = canonicalFingerprint(patch.fields);
    const stored = this.recipes.get(id);
    if (!stored || stored.hiddenAt) {
      throw new RecipeError("not_found", "The recipe was not found.");
    }
    const existing = this.acks.get(patch.mutationId);
    if (existing) {
      if (
        existing.recipeId === id &&
        existing.fingerprint === fingerprint
      ) {
        return visible(stored);
      }
      throw new MutationAckError();
    }
    stored.facts = applyFactsPatch(stored.facts, patch.fields);
    this.acks.set(patch.mutationId, { fingerprint, recipeId: id });
    return visible(stored);
  }

  private requireActor(actor: string): void {
    if (!this.actors.has(actor)) {
      throw new RecipeError("unknown_actor", "That actor is not known.");
    }
  }
}

export function createMemoryRecipeStore(
  actors?: readonly string[],
): MemoryRecipeStore {
  return new MemoryRecipeStore(actors);
}

import {
  compileListCriteria,
  emptyListCriteria,
  emptyRecipeFacts,
  parseListQuery,
  type QueryNode,
} from "@cookbook/shared";

import type { RecipeStore, SaveRecipeInput } from "../src/recipes/types.ts";

function base(overrides: SaveRecipeInput): SaveRecipeInput {
  return {
    actor: "chef",
    servings: 2,
    steps: ["Cook."],
    ...overrides,
  };
}

export async function seedQueryLibrary(store: RecipeStore): Promise<void> {
  await store.save(
    base({
      id: "title-hit",
      title: "Example: Chicken breast bake",
      ingredients: [{ line: "rice", name: "rice" }],
    }),
  );
  await store.save(
    base({
      id: "split-trap",
      title: "Example: Pan supper",
      ingredients: [
        { line: "chicken stock", name: "chicken stock" },
        { line: "turkey breast", name: "turkey breast" },
      ],
    }),
  );
  await store.save(
    base({
      id: "ingredient-hit",
      title: "Example: Named breast",
      ingredients: [{ line: "2 chicken breasts", name: "chicken breast" }],
    }),
  );
  await store.save(
    base({
      id: "both-ings",
      title: "Example: Lemon garlic",
      ingredients: [
        { line: "garlic", name: "garlic" },
        { line: "lemon zest", name: "lemon zest" },
        { line: "oil", name: "oil" },
      ],
    }),
  );
  await store.save(
    base({
      id: "one-ing",
      title: "Example: Garlic oil",
      ingredients: [
        { line: "garlic", name: "garlic" },
        { line: "oil", name: "oil" },
      ],
    }),
  );
  await store.save(
    base({
      id: "lunch-bowl",
      title: "Example: Lunch bowl",
      facts: {
        ...emptyRecipeFacts(),
        effort: "low",
        mealTypes: ["lunch"],
      },
    }),
  );
  await store.save(
    base({
      id: "dinner-bowl",
      title: "Example: Dinner bowl",
      facts: {
        ...emptyRecipeFacts(),
        effort: "high",
        mealTypes: ["dinner"],
      },
    }),
  );
  await store.save(
    base({
      id: "lunch-stew",
      title: "Example: Lunch stew",
      facts: {
        ...emptyRecipeFacts(),
        effort: "low",
        mealTypes: ["lunch"],
      },
    }),
  );
  await store.save(
    base({
      id: "fast-30",
      title: "Example: Fast",
      facts: { ...emptyRecipeFacts(), totalMinutes: 30 },
    }),
  );
  await store.save(
    base({
      id: "slow-31",
      title: "Example: Slow",
      facts: { ...emptyRecipeFacts(), totalMinutes: 31 },
    }),
  );
  await store.save(
    base({
      id: "unknown-time",
      title: "Example: Unknown time",
    }),
  );
  await store.save(
    base({
      id: "wildcard-title",
      title: "Example: 100%_wheat\\ loaf",
    }),
  );
  await store.save(
    base({
      id: "spaced-title",
      title: "Example: Lemon    Chicken",
    }),
  );
  await store.save(
    base({
      id: "protein-chicken",
      title: "Example: Protein chicken",
      facts: { ...emptyRecipeFacts(), primaryProtein: "chicken" },
    }),
  );
  await store.save(
    base({
      id: "protein-seitan",
      title: "Example: Protein seitan",
      facts: { ...emptyRecipeFacts(), primaryProtein: "seitan" },
    }),
  );
  await store.save(
    base({
      id: "no-facts",
      title: "Example: No facts",
    }),
  );
  await store.save(
    base({
      id: "hidden-query",
      title: "Example: Hidden query",
      ingredients: [{ line: "garlic", name: "garlic" }],
    }),
  );
  await store.hide({ id: "hidden-query", actor: "chef" });
}

export function idsOf(
  recipes: { id: string }[],
  expected: string[],
): string[] {
  return recipes.filter((item) => expected.includes(item.id)).map((item) => item.id);
}

export async function listedIds(
  store: RecipeStore,
  query: QueryNode | null,
): Promise<string[]> {
  return (await store.list(query)).map((item) => item.id);
}

function mustQuery(value: unknown): QueryNode {
  const parsed = parseListQuery(value);
  if (!parsed.ok || parsed.query === null) {
    throw new Error("invalid fixture query");
  }
  return parsed.query;
}

export const TITLE_QUERY = mustQuery({
  field: "title",
  phrase: "chicken breast",
});

export const INGREDIENT_PHRASE_QUERY = mustQuery({
  field: "ingredient",
  phrase: "chicken breast",
});

export const MULTI_INGREDIENT_QUERY = compileListCriteria({
  ...emptyListCriteria(),
  ingredients: ["garlic", "lemon"],
});

export const CATEGORY_NESTED_QUERY = mustQuery({
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

export const TIME_QUERY = compileListCriteria({
  ...emptyListCriteria(),
  maxTotalMinutes: 30,
});

export const WILDCARD_QUERY = mustQuery({
  field: "title",
  phrase: "100%_wheat\\",
});

export const SPACED_QUERY = mustQuery({
  field: "title",
  phrase: "lemon   chicken",
});

export const FULL_LIBRARY_ORDER = [
  "title-hit",
  "split-trap",
  "ingredient-hit",
  "both-ings",
  "one-ing",
  "lunch-bowl",
  "dinner-bowl",
  "lunch-stew",
  "fast-30",
  "slow-31",
  "unknown-time",
  "wildcard-title",
  "spaced-title",
  "protein-chicken",
  "protein-seitan",
  "no-facts",
];

import {
  DEFAULT_READ_FIELDS,
  invalidFieldMessage,
  isRecipeField,
  type Recipe,
  type RecipeField,
} from "@cookbook/shared";

export type FieldResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function parseFieldList(
  value: string | string[] | undefined,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parts = (Array.isArray(value) ? value : value.split(","))
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parts;
}

export function projectRecipe(
  recipe: Recipe,
  fields: string[] | undefined,
): FieldResult<Partial<Recipe>> {
  if (fields === undefined) {
    const projected: Partial<Recipe> = {
      title: recipe.title,
      steps: recipe.steps,
      servings: recipe.servings,
    };
    if (recipe.nutrition) {
      projected.nutrition = recipe.nutrition;
    }
    return { ok: true, value: projected };
  }
  const projected: Partial<Recipe> = {};
  for (const field of fields) {
    if (!isRecipeField(field)) {
      return { ok: false, message: invalidFieldMessage(field) };
    }
    const key = field as RecipeField;
    projected[key] = recipe[key] as never;
  }
  return { ok: true, value: projected };
}

export { DEFAULT_READ_FIELDS };

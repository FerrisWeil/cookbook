import {
  MAX_TOTAL_MINUTES,
  MESSAGES,
  RECOMMENDED_PROTEINS,
  isRecipeEffort,
  isRecipeMealType,
  isUnsetPrimaryProtein,
  type Ingredient,
  type RecipeEffort,
  type RecipeFacts,
  type RecipeMealType,
} from "./recipe.js";

export const QUERY_LIMITS = {
  maxDepth: 4,
  maxNodes: 32,
  maxChildren: 16,
  maxPhraseLength: 80,
} as const;

export type QueryGroup = {
  op: "and" | "or";
  children: QueryNode[];
};

export type QueryLeaf =
  | { field: "title"; phrase: string }
  | { field: "ingredient"; phrase: string }
  | { field: "primaryProtein"; phrase: string }
  | { field: "maxTotalMinutes"; minutes: number }
  | { field: "effort"; value: RecipeEffort }
  | { field: "mealType"; value: RecipeMealType };

export type QueryNode = QueryGroup | QueryLeaf;

export type ListCriteria = {
  title: string;
  ingredients: string[];
  proteins: string[];
  maxTotalMinutes: number | null;
  efforts: RecipeEffort[];
  mealTypes: RecipeMealType[];
};

export type QueryParseResult =
  | { ok: true; query: QueryNode | null }
  | { ok: false; message: string };

export type MatchableRecipe = {
  title: string;
  ingredients: readonly Ingredient[];
  facts: RecipeFacts;
};

export const QUERY_SCHEMA_DESCRIPTION =
  "Optional list query: a bounded AND/OR tree of typed leaves (title, ingredient, primaryProtein, maxTotalMinutes, effort, mealType). No NOT, code, or SQL. Omit it to return the full visible library.";

export function emptyListCriteria(): ListCriteria {
  return {
    title: "",
    ingredients: [],
    proteins: [],
    maxTotalMinutes: null,
    efforts: [],
    mealTypes: [],
  };
}

export function normalizeMatchText(value: string): string {
  return value.trim().replace(/ +/g, " ").toLowerCase();
}

export function normalizePhrase(value: string): string | null {
  const normalized = normalizeMatchText(value);
  return normalized === "" ? null : normalized;
}

export function ingredientNameText(ingredient: Ingredient): string {
  const name = normalizeMatchText(ingredient.name);
  if (name !== "") {
    return name;
  }
  return normalizeMatchText(ingredient.line);
}

export function containsPhrase(haystack: string, phrase: string): boolean {
  return haystack.includes(phrase);
}

export function isQueryGroup(node: QueryNode): node is QueryGroup {
  return "op" in node;
}

export function criteriaIsEmpty(criteria: ListCriteria): boolean {
  return (
    normalizePhrase(criteria.title) === null &&
    omitBlankPhrases(criteria.ingredients).length === 0 &&
    omitBlankPhrases(criteria.proteins).length === 0 &&
    criteria.maxTotalMinutes === null &&
    criteria.efforts.length === 0 &&
    criteria.mealTypes.length === 0
  );
}

export function omitBlankPhrases(values: readonly string[]): string[] {
  const phrases: string[] = [];
  for (const value of values) {
    const phrase = normalizePhrase(value);
    if (phrase !== null) {
      phrases.push(phrase);
    }
  }
  return phrases;
}

function boundedNormalizedPhrase(value: string): string | null {
  const phrase = normalizePhrase(value);
  if (phrase === null) {
    return null;
  }
  return phrase.slice(0, QUERY_LIMITS.maxPhraseLength);
}

export function compileListCriteria(criteria: ListCriteria): QueryNode | null {
  const children: QueryNode[] = [];
  const title = boundedNormalizedPhrase(criteria.title);
  if (title !== null) {
    children.push({ field: "title", phrase: title });
  }
  const ingredients = omitBlankPhrases(criteria.ingredients).map(
    (phrase) => phrase.slice(0, QUERY_LIMITS.maxPhraseLength),
  );
  if (ingredients.length === 1) {
    children.push({ field: "ingredient", phrase: ingredients[0] ?? "" });
  } else if (ingredients.length > 1) {
    children.push({
      op: "and",
      children: ingredients.map((phrase) => ({
        field: "ingredient" as const,
        phrase,
      })),
    });
  }
  const proteins = omitBlankPhrases(criteria.proteins).map((phrase) =>
    phrase.slice(0, QUERY_LIMITS.maxPhraseLength),
  );
  if (proteins.length === 1) {
    children.push({ field: "primaryProtein", phrase: proteins[0] ?? "" });
  } else if (proteins.length > 1) {
    children.push({
      op: "or",
      children: proteins.map((phrase) => ({
        field: "primaryProtein" as const,
        phrase,
      })),
    });
  }
  if (criteria.maxTotalMinutes !== null) {
    const minutes = Math.min(
      Math.max(criteria.maxTotalMinutes, 0),
      MAX_TOTAL_MINUTES,
    );
    if (Number.isInteger(criteria.maxTotalMinutes)) {
      children.push({
        field: "maxTotalMinutes",
        minutes,
      });
    }
  }
  if (criteria.efforts.length === 1) {
    const value = criteria.efforts[0];
    if (value) {
      children.push({ field: "effort", value });
    }
  } else if (criteria.efforts.length > 1) {
    children.push({
      op: "or",
      children: criteria.efforts.map((value) => ({
        field: "effort" as const,
        value,
      })),
    });
  }
  if (criteria.mealTypes.length === 1) {
    const value = criteria.mealTypes[0];
    if (value) {
      children.push({ field: "mealType", value });
    }
  } else if (criteria.mealTypes.length > 1) {
    children.push({
      op: "or",
      children: criteria.mealTypes.map((value) => ({
        field: "mealType" as const,
        value,
      })),
    });
  }
  if (children.length === 0) {
    return null;
  }
  if (children.length === 1) {
    return children[0] ?? null;
  }
  return { op: "and", children };
}

export function parseListQuery(value: unknown): QueryParseResult {
  if (value === undefined || value === null) {
    return { ok: true, query: null };
  }
  try {
    const parsed = parseNode(value, 1, { nodes: 0 });
    return { ok: true, query: parsed.node };
  } catch (error) {
    return {
      ok: false,
      message: MESSAGES.invalidQuery,
    };
  }
}

export function matchRecipe(
  recipe: MatchableRecipe,
  query: QueryNode | null,
): boolean {
  if (query === null) {
    return true;
  }
  return matchNode(recipe, query);
}

export function mergeProteinChoices(libraryValues: readonly string[]): string[] {
  const seen = new Set<string>();
  const choices: string[] = [];
  function add(raw: string): void {
    if (isUnsetPrimaryProtein(raw)) {
      return;
    }
    const display = raw.trim().replace(/ +/g, " ");
    const key = display.toLowerCase();
    if (key === "" || seen.has(key)) {
      return;
    }
    seen.add(key);
    choices.push(display);
  }
  for (const recommended of RECOMMENDED_PROTEINS) {
    add(recommended);
  }
  const extras = [...libraryValues]
    .map((value) => value.trim().replace(/ +/g, " "))
    .filter((value) => {
      if (isUnsetPrimaryProtein(value)) {
        return false;
      }
      return !seen.has(value.toLowerCase());
    })
    .sort((left, right) => left.localeCompare(right, "en"));
  for (const extra of extras) {
    add(extra);
  }
  return choices;
}

function encodeQueryValue(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function decodeQueryValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function searchPairs(search: string): Array<[string, string]> {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (raw === "") {
    return [];
  }
  const pairs: Array<[string, string]> = [];
  for (const part of raw.split("&")) {
    if (part === "") {
      continue;
    }
    const eq = part.indexOf("=");
    const key = decodeQueryValue(eq < 0 ? part : part.slice(0, eq));
    const value = decodeQueryValue(eq < 0 ? "" : part.slice(eq + 1));
    pairs.push([key, value]);
  }
  return pairs;
}

function valuesNamed(pairs: Array<[string, string]>, name: string): string[] {
  return pairs.filter(([key]) => key === name).map(([, value]) => value);
}

export function listCriteriaFromSearch(search: string): ListCriteria {
  const pairs = searchPairs(search);
  const maxRaw = valuesNamed(pairs, "maxMinutes")[0];
  let maxTotalMinutes: number | null = null;
  if (maxRaw !== undefined && maxRaw.trim() !== "") {
    const parsed = Number(maxRaw);
    if (
      Number.isInteger(parsed) &&
      parsed >= 0 &&
      parsed <= MAX_TOTAL_MINUTES
    ) {
      maxTotalMinutes = parsed;
    }
  }
  return {
    title: valuesNamed(pairs, "title")[0] ?? "",
    ingredients: valuesNamed(pairs, "ingredient"),
    proteins: valuesNamed(pairs, "protein"),
    maxTotalMinutes,
    efforts: valuesNamed(pairs, "effort").filter((item): item is RecipeEffort =>
      isRecipeEffort(item),
    ),
    mealTypes: valuesNamed(pairs, "meal").filter((item): item is RecipeMealType =>
      isRecipeMealType(item),
    ),
  };
}

export function listSearchFromCriteria(criteria: ListCriteria): string {
  const parts: string[] = [];
  function append(key: string, value: string): void {
    parts.push(`${encodeQueryValue(key)}=${encodeQueryValue(value)}`);
  }
  const title = criteria.title.trim().replace(/ +/g, " ");
  if (title !== "") {
    append("title", title);
  }
  for (const ingredient of criteria.ingredients) {
    const phrase = ingredient.trim().replace(/ +/g, " ");
    if (phrase !== "") {
      append("ingredient", phrase);
    }
  }
  for (const protein of criteria.proteins) {
    const phrase = protein.trim().replace(/ +/g, " ");
    if (phrase !== "") {
      append("protein", phrase);
    }
  }
  if (criteria.maxTotalMinutes !== null) {
    append("maxMinutes", String(criteria.maxTotalMinutes));
  }
  for (const effort of criteria.efforts) {
    append("effort", effort);
  }
  for (const meal of criteria.mealTypes) {
    append("meal", meal);
  }
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

export function encodeListQueryParam(query: QueryNode | null): string | null {
  if (query === null) {
    return null;
  }
  return JSON.stringify(query);
}

type ParseState = { nodes: number };

function parseNode(
  value: unknown,
  depth: number,
  state: ParseState,
): { node: QueryNode; depth: number } {
  if (depth > QUERY_LIMITS.maxDepth) {
    throw new Error(MESSAGES.invalidQuery);
  }
  state.nodes += 1;
  if (state.nodes > QUERY_LIMITS.maxNodes) {
    throw new Error(MESSAGES.invalidQuery);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(MESSAGES.invalidQuery);
  }
  const record = value as Record<string, unknown>;
  if ("op" in record) {
    return parseGroup(record, depth, state);
  }
  if ("field" in record) {
    return { node: parseLeaf(record), depth };
  }
  throw new Error(MESSAGES.invalidQuery);
}

function parseGroup(
  record: Record<string, unknown>,
  depth: number,
  state: ParseState,
): { node: QueryGroup; depth: number } {
  const keys = Object.keys(record);
  if (keys.some((key) => key !== "op" && key !== "children")) {
    throw new Error(MESSAGES.invalidQuery);
  }
  const op = record["op"];
  if (op !== "and" && op !== "or") {
    throw new Error(MESSAGES.invalidQuery);
  }
  const childrenValue = record["children"];
  if (!Array.isArray(childrenValue) || childrenValue.length === 0) {
    throw new Error(MESSAGES.invalidQuery);
  }
  if (childrenValue.length > QUERY_LIMITS.maxChildren) {
    throw new Error(MESSAGES.invalidQuery);
  }
  const children: QueryNode[] = [];
  let maxChildDepth = depth;
  for (const child of childrenValue) {
    const parsed = parseNode(child, depth + 1, state);
    children.push(parsed.node);
    maxChildDepth = Math.max(maxChildDepth, parsed.depth);
  }
  return { node: { op, children }, depth: maxChildDepth };
}

function parseLeaf(record: Record<string, unknown>): QueryLeaf {
  const field = record["field"];
  if (typeof field !== "string") {
    throw new Error(MESSAGES.invalidQuery);
  }
  if (field === "title" || field === "ingredient" || field === "primaryProtein") {
    const keys = Object.keys(record);
    if (keys.some((key) => key !== "field" && key !== "phrase")) {
      throw new Error(MESSAGES.invalidQuery);
    }
    const phraseValue = record["phrase"];
    if (typeof phraseValue !== "string") {
      throw new Error(MESSAGES.invalidQuery);
    }
    const phrase = normalizePhrase(phraseValue);
    if (phrase === null || phrase.length > QUERY_LIMITS.maxPhraseLength) {
      throw new Error(MESSAGES.invalidQuery);
    }
    return { field, phrase };
  }
  if (field === "maxTotalMinutes") {
    const keys = Object.keys(record);
    if (keys.some((key) => key !== "field" && key !== "minutes")) {
      throw new Error(MESSAGES.invalidQuery);
    }
    const minutes = record["minutes"];
    if (
      typeof minutes !== "number" ||
      !Number.isInteger(minutes) ||
      minutes < 0 ||
      minutes > MAX_TOTAL_MINUTES
    ) {
      throw new Error(MESSAGES.invalidQuery);
    }
    return { field, minutes };
  }
  if (field === "effort") {
    const keys = Object.keys(record);
    if (keys.some((key) => key !== "field" && key !== "value")) {
      throw new Error(MESSAGES.invalidQuery);
    }
    const value = record["value"];
    if (typeof value !== "string" || !isRecipeEffort(value)) {
      throw new Error(MESSAGES.invalidQuery);
    }
    return { field, value };
  }
  if (field === "mealType") {
    const keys = Object.keys(record);
    if (keys.some((key) => key !== "field" && key !== "value")) {
      throw new Error(MESSAGES.invalidQuery);
    }
    const value = record["value"];
    if (typeof value !== "string" || !isRecipeMealType(value)) {
      throw new Error(MESSAGES.invalidQuery);
    }
    return { field, value };
  }
  throw new Error(MESSAGES.invalidQuery);
}

function matchNode(recipe: MatchableRecipe, node: QueryNode): boolean {
  if (isQueryGroup(node)) {
    if (node.op === "and") {
      return node.children.every((child) => matchNode(recipe, child));
    }
    return node.children.some((child) => matchNode(recipe, child));
  }
  return matchLeaf(recipe, node);
}

function matchLeaf(recipe: MatchableRecipe, leaf: QueryLeaf): boolean {
  if (leaf.field === "title") {
    return containsPhrase(normalizeMatchText(recipe.title), leaf.phrase);
  }
  if (leaf.field === "ingredient") {
    return recipe.ingredients.some((ingredient) =>
      containsPhrase(ingredientNameText(ingredient), leaf.phrase),
    );
  }
  if (leaf.field === "primaryProtein") {
    const protein = recipe.facts.primaryProtein;
    if (protein === null || isUnsetPrimaryProtein(protein)) {
      return false;
    }
    return containsPhrase(normalizeMatchText(protein), leaf.phrase);
  }
  if (leaf.field === "maxTotalMinutes") {
    const minutes = recipe.facts.totalMinutes;
    if (minutes === null) {
      return false;
    }
    return minutes <= leaf.minutes;
  }
  if (leaf.field === "effort") {
    return recipe.facts.effort === leaf.value;
  }
  return recipe.facts.mealTypes.includes(leaf.value);
}

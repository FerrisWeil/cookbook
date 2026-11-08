import {
  isQueryGroup,
  type QueryLeaf,
  type QueryNode,
} from "@cookbook/shared";

export function compileListSql(query: QueryNode | null): {
  sql: string;
  params: unknown[];
} {
  if (query === null) {
    return { sql: "TRUE", params: [] };
  }
  const params: unknown[] = [];
  return { sql: compileNode(query, params), params };
}

function compileNode(node: QueryNode, params: unknown[]): string {
  if (isQueryGroup(node)) {
    const parts = node.children.map((child) => compileNode(child, params));
    const joiner = node.op === "and" ? " AND " : " OR ";
    return `(${parts.join(joiner)})`;
  }
  return compileLeaf(node, params);
}

function compileLeaf(leaf: QueryLeaf, params: unknown[]): string {
  if (leaf.field === "title") {
    return phraseSql("recipes.title", leaf.phrase, params);
  }
  if (leaf.field === "ingredient") {
    params.push(leaf.phrase);
    const index = params.length;
    return `EXISTS (
      SELECT 1
      FROM recipe_ingredients i
      WHERE i.recipe_id = recipes.id
        AND strpos(
          lower(btrim(regexp_replace(
            CASE
              WHEN i.name IS NOT NULL AND btrim(i.name) <> '' THEN i.name
              ELSE i.line
            END,
            ' +', ' ', 'g'))),
          $${index}
        ) > 0
    )`;
  }
  if (leaf.field === "primaryProtein") {
    return `(
      recipes.primary_protein IS NOT NULL
      AND btrim(recipes.primary_protein) <> ''
      AND lower(btrim(recipes.primary_protein)) <> 'no protein'
      AND ${phraseSql("recipes.primary_protein", leaf.phrase, params)}
    )`;
  }
  if (leaf.field === "maxTotalMinutes") {
    params.push(leaf.minutes);
    return `(recipes.total_minutes IS NOT NULL AND recipes.total_minutes <= $${params.length})`;
  }
  if (leaf.field === "effort") {
    params.push(leaf.value);
    return `(recipes.effort IS NOT NULL AND recipes.effort = $${params.length})`;
  }
  params.push(leaf.value);
  return `(recipes.meal_types IS NOT NULL AND recipes.meal_types && ARRAY[$${params.length}]::text[])`;
}

function phraseSql(expr: string, phrase: string, params: unknown[]): string {
  params.push(phrase);
  return `strpos(lower(btrim(regexp_replace(${expr}, ' +', ' ', 'g'))), $${params.length}) > 0`;
}

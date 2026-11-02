import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

export type CatalogKind = "topic" | "requirement" | "detail" | "removed";

export type CatalogEntry = {
  kind: CatalogKind;
};

export type Catalog = Map<string, CatalogEntry>;

function findRepoRoot(): string {
  const starts = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const start of starts) {
    let dir = start;
    for (;;) {
      if (
        existsSync(join(dir, "pnpm-workspace.yaml")) &&
        existsSync(join(dir, "docs", "requirements"))
      ) {
        return dir;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error("covers() cannot find docs/requirements from the repo root");
}

function add(catalog: Catalog, id: unknown, kind: CatalogKind): void {
  if (typeof id !== "string" || id.length === 0) return;
  catalog.set(id, { kind });
}

export function loadRequirementCatalog(root = findRepoRoot()): Catalog {
  const catalog: Catalog = new Map();
  const dir = join(root, "docs", "requirements");
  const names = readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .sort();
  for (const name of names) {
    const doc = parse(readFileSync(join(dir, name), "utf8")) as {
      id?: unknown;
      requirements?: unknown;
    } | null;
    if (!doc || typeof doc !== "object") {
      throw new Error(`covers() could not parse ${name}`);
    }
    add(catalog, doc.id, "topic");
    if (!Array.isArray(doc.requirements)) continue;
    for (const req of doc.requirements) {
      if (!req || typeof req !== "object") continue;
      const requirement = req as {
        id?: unknown;
        removed?: unknown;
        details?: unknown;
      };
      if (requirement.removed === true) {
        add(catalog, requirement.id, "removed");
        continue;
      }
      add(catalog, requirement.id, "requirement");
      if (!Array.isArray(requirement.details)) continue;
      for (const detail of requirement.details) {
        if (!detail || typeof detail !== "object") continue;
        const item = detail as { id?: unknown; removed?: unknown };
        if (item.removed === true) {
          add(catalog, item.id, "removed");
          continue;
        }
        add(catalog, item.id, "detail");
      }
    }
  }
  return catalog;
}

export function assertCoverIds(catalog: Catalog, ids: readonly string[]): void {
  if (ids.length === 0) {
    throw new Error("covers() needs a requirement detail id");
  }
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0) {
      throw new Error("covers() ids must be non-empty strings");
    }
    const entry = catalog.get(id);
    if (!entry) {
      throw new Error(`unknown requirement id ${id}`);
    }
    if (entry.kind === "removed") {
      throw new Error(`requirement id ${id} is removed`);
    }
    if (entry.kind !== "detail") {
      throw new Error(`requirement id ${id} is not a detail`);
    }
  }
}

let cached: Catalog | undefined;

export function repoCatalog(): Catalog {
  cached ??= loadRequirementCatalog();
  return cached;
}

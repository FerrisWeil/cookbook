import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { requirementFingerprint } from "./fingerprint.js";

export type RequirementStatus = "accepted" | "implemented" | "verified";

export type CatalogNode = {
  id: string;
  text: string;
  status: RequirementStatus;
  parentId: string | null;
  childIds: string[];
  refIds: string[];
  inSharedTree: boolean;
  isRoot: boolean;
};

export type Catalog = {
  nodes: Map<string, CatalogNode>;
  roots: string[];
};

export function findRepoRoot(): string {
  const starts = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const start of starts) {
    let dir = start;
    for (;;) {
      if (
        existsSync(join(dir, "pnpm-workspace.yaml")) &&
        existsSync(join(dir, "docs", "requirements", "requirements.yaml"))
      ) {
        return dir;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error("cannot find docs/requirements/requirements.yaml from the repo root");
}

function asId(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string" && /^[1-9][0-9]*$/.test(value)) return value;
  return null;
}

export function loadRequirementCatalog(root = findRepoRoot()): Catalog {
  const file = join(root, "docs", "requirements", "requirements.yaml");
  const doc = parse(readFileSync(file, "utf8")) as {
    requirements?: unknown;
  } | null;
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.requirements)) {
    throw new Error("requirements catalog must be a mapping with a requirements list");
  }
  const nodes = new Map<string, CatalogNode>();
  const roots: string[] = [];

  function add(
    raw: unknown,
    parentId: string | null,
    inSharedTree: boolean,
    isRoot: boolean,
  ): string | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as {
      id?: unknown;
      ref?: unknown;
      text?: unknown;
      status?: unknown;
      kind?: unknown;
      children?: unknown;
    };
    if (item.ref !== undefined) return null;
    const id = asId(item.id);
    if (!id || typeof item.text !== "string") return null;
    const shared = isRoot ? item.kind === "shared" : inSharedTree;
    const childIds: string[] = [];
    const refIds: string[] = [];
    const node: CatalogNode = {
      id,
      text: item.text,
      status: item.status as RequirementStatus,
      parentId,
      childIds,
      refIds,
      inSharedTree: shared,
      isRoot,
    };
    nodes.set(id, node);
    if (isRoot) roots.push(id);
    if (!Array.isArray(item.children)) return id;
    for (const child of item.children) {
      if (!child || typeof child !== "object" || Array.isArray(child)) continue;
      const childItem = child as { ref?: unknown; id?: unknown };
      const refId = asId(childItem.ref);
      if (refId) {
        refIds.push(refId);
        continue;
      }
      const childId = add(child, id, shared, false);
      if (childId) childIds.push(childId);
    }
    return id;
  }

  for (const rootNode of doc.requirements) add(rootNode, null, false, true);
  return { nodes, roots };
}

export function isLeaf(node: CatalogNode): boolean {
  return node.childIds.length === 0 && node.refIds.length === 0;
}

export function nodeFingerprint(node: CatalogNode): string {
  return requirementFingerprint(node.id, node.text);
}

let cached: Catalog | undefined;

export function repoCatalog(): Catalog {
  cached ??= loadRequirementCatalog();
  return cached;
}

export function evidenceDir(root = findRepoRoot()): string {
  return join(root, ".requirements-evidence");
}

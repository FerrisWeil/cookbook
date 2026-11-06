import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  evidenceDir,
  isLeaf,
  nodeFingerprint,
  repoCatalog,
} from "./catalog.js";

export type VerifiedTestFn = (...args: never[]) => unknown | Promise<unknown>;

function record(id: string, fingerprint: string, passed: boolean): void {
  const dir = evidenceDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${id}.json`),
    `${JSON.stringify({ id, fingerprint, passed })}\n`,
  );
}

export function verifies(id: string, fingerprint: string, fn: VerifiedTestFn): VerifiedTestFn {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("verifies() needs a requirement id");
  }
  if (typeof fingerprint !== "string" || fingerprint.length === 0) {
    throw new Error("verifies() needs a literal fingerprint");
  }
  if (typeof fn !== "function") {
    throw new Error("verifies(id, fingerprint, fn) must wrap the test function");
  }

  return async function verifiedTest(this: unknown, ...args: never[]): Promise<unknown> {
    const node = repoCatalog().nodes.get(id);
    if (!node) {
      throw new Error(`unknown requirement id ${id}`);
    }
    if (!isLeaf(node)) {
      throw new Error(`requirement id ${id} is not a leaf`);
    }
    const actual = nodeFingerprint(node);
    if (actual !== fingerprint) {
      throw new Error(
        `requirement id ${id} fingerprint ${fingerprint} does not match ${actual}`,
      );
    }
    try {
      const result = await fn.apply(this, args);
      record(id, fingerprint, true);
      return result;
    } catch (error) {
      record(id, fingerprint, false);
      throw error;
    }
  };
}

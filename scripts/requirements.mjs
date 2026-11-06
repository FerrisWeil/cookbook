#!/usr/bin/env node

// Requirement catalog check. Policy is CONTRIBUTING.md.
// Fixture IDs stay in this file. The reference scan does not read it.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMap, isScalar, isSeq, LineCounter, parseDocument } from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = path.join(ROOT, "scripts", "requirements.mjs");
const REQUIREMENTS_DIR = path.join(ROOT, "docs", "requirements");
const CATALOG_NAME = "requirements.yaml";
const DECISIONS_DIR = path.join(ROOT, "docs", "decisions");
const EVIDENCE_DIR = path.join(ROOT, ".requirements-evidence");
const SCHEMA = JSON.parse(readFileSync(path.join(REQUIREMENTS_DIR, "schema.json"), "utf8"));

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage", ".requirements-evidence"]);
const STATUSES = new Set(["accepted", "implemented", "verified"]);
const ID_RE = /^[1-9][0-9]*$/;
const PART = "[1-9][0-9]*";
const LETTER_ID_RE = new RegExp(`(?<![A-Za-z0-9.])[FNS]${PART}(?:\\.${PART}){0,2}(?![A-Za-z0-9.])`, "g");
const LETTER_OVERLONG_RE = new RegExp(`(?<![A-Za-z0-9.])[FNS]${PART}(?:\\.${PART}){3,}(?![A-Za-z0-9.])`, "g");
const REQ_REF_RE = new RegExp(`(?<![A-Za-z0-9_])req:(${PART})(?![A-Za-z0-9])`, "g");
const TEST_CALL_RE =
  /(?:^|\n)[ \t]*(?:await\s+)?(?:[A-Za-z_$][\w$]*\.)?(?:it|test)(?![A-Za-z0-9_$])(?:\.(skip|only|todo))?\s*\(\s*(?:\n[ \t]*)?"([^"\n]*)"/g;

function requirementFingerprint(id, text) {
  const payload = JSON.stringify({ v: 1, id: String(id), text });
  return createHash("sha256").update("cookbook.req.fp.v1\n").update(payload).digest("hex").slice(0, 16);
}

function isIdentChar(char) {
  return typeof char === "string" && /[A-Za-z0-9_$]/.test(char);
}

function skipTrivia(text, index) {
  let i = index;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      i += 2;
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i = Math.min(n, i + 2);
      continue;
    }
    break;
  }
  return i;
}

function describeSkipOpen(text, i) {
  if (isIdentChar(text[i - 1])) return -1;
  if (!text.startsWith("describe", i) || isIdentChar(text[i + "describe".length])) return -1;
  let j = skipTrivia(text, i + "describe".length);
  if (text[j] !== ".") return -1;
  j = skipTrivia(text, j + 1);
  const which = text.startsWith("skip", j) ? "skip" : text.startsWith("todo", j) ? "todo" : "";
  if (!which || isIdentChar(text[j + which.length])) return -1;
  j = skipTrivia(text, j + which.length);
  return text[j] === "(" ? j : -1;
}

function maskInactiveRegions(text) {
  const out = text.split("");
  const n = text.length;
  const stack = [];
  let i = 0;

  function mask(from, to) {
    for (let k = from; k < to; k += 1) {
      if (out[k] !== "\n") out[k] = " ";
    }
  }

  function activeSkip() {
    for (let s = stack.length - 1; s >= 0; s -= 1) {
      if (stack[s].type === "skip") return stack[s];
    }
    return null;
  }

  while (i < n) {
    const frame = stack[stack.length - 1];
    const c = text[i];
    if (frame && frame.type === "str") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (frame.q === "`" && c === "$" && text[i + 1] === "{") {
        stack.push({ type: "expr", depth: 1 });
        i += 2;
        continue;
      }
      if (c === frame.q) stack.pop();
      i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i = Math.min(n, i + 2);
      mask(start, i);
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      stack.push({ type: "str", q: c });
      i += 1;
      continue;
    }
    const skipOpen = describeSkipOpen(text, i);
    if (skipOpen >= 0) {
      stack.push({ type: "skip", depth: 1, start: skipOpen + 1 });
      i = skipOpen + 1;
      continue;
    }
    if (c === "(") {
      const skip = activeSkip();
      if (skip) skip.depth += 1;
      i += 1;
      continue;
    }
    if (c === ")") {
      const skip = activeSkip();
      if (skip) {
        skip.depth -= 1;
        if (skip.depth === 0) {
          mask(skip.start, i);
          stack.splice(stack.lastIndexOf(skip), 1);
        }
      }
      i += 1;
      continue;
    }
    if (frame && frame.type === "expr" && c === "{") {
      frame.depth += 1;
      i += 1;
      continue;
    }
    if (frame && frame.type === "expr" && c === "}") {
      frame.depth -= 1;
      if (frame.depth === 0) stack.pop();
      i += 1;
      continue;
    }
    i += 1;
  }
  return out.join("");
}

function objectDeclaresSkipOrTodo(text, open) {
  let i = open + 1;
  let depth = 1;
  let quote = null;
  let top = "";
  const n = text.length;
  while (i < n && depth > 0) {
    const c = text[i];
    if (quote) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i = Math.min(n, i + 2);
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      i += 1;
      continue;
    }
    if (c === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (c === "}") {
      depth -= 1;
      if (depth === 0) break;
      i += 1;
      continue;
    }
    if (depth === 1) top += c;
    i += 1;
  }
  if (depth !== 0) return false;
  return /(?:^|[^A-Za-z0-9_$])(?:skip|todo)\s*:\s*true\b/.test(top);
}

function skipMatching(text, start) {
  const open = text[start];
  const close = open === "(" ? ")" : open === "{" ? "}" : open === "[" ? "]" : "";
  if (!close) return start;
  const stack = [{ type: "g", close }];
  let i = start + 1;
  const n = text.length;
  while (i < n && stack.length > 0) {
    const frame = stack[stack.length - 1];
    const c = text[i];
    if (frame.type === "str") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (frame.q === "`" && c === "$" && text[i + 1] === "{") {
        stack.push({ type: "g", close: "}" });
        i += 2;
        continue;
      }
      if (c === frame.q) stack.pop();
      i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i = Math.min(n, i + 2);
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      stack.push({ type: "str", q: c });
      i += 1;
      continue;
    }
    if (c === "(" || c === "{" || c === "[") {
      stack.push({ type: "g", close: c === "(" ? ")" : c === "{" ? "}" : "]" });
      i += 1;
      continue;
    }
    if (c === ")" || c === "}" || c === "]") {
      if (c === frame.close) stack.pop();
      i += 1;
      continue;
    }
    i += 1;
  }
  return i;
}

function readStringLiteral(text, start) {
  const q = text[start];
  if (q !== "'" && q !== '"' && q !== "`") return null;
  let i = start + 1;
  let value = "";
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === "\\") {
      value += text[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (q === "`" && c === "$" && text[i + 1] === "{") return null;
    if (c === q) return { value, end: i + 1 };
    if (c === "\n" && q !== "`") return null;
    value += c;
    i += 1;
  }
  return null;
}

function parseVerifiesCall(text, start) {
  if (text[start] !== "(") return null;
  let i = skipTrivia(text, start + 1);
  const idLit = readStringLiteral(text, i);
  if (!idLit) return null;
  i = skipTrivia(text, idLit.end);
  if (text[i] !== ",") return null;
  i = skipTrivia(text, i + 1);
  const fpLit = readStringLiteral(text, i);
  if (!fpLit) return null;
  i = skipTrivia(text, fpLit.end);
  if (text[i] !== ",") return null;
  i = skipTrivia(text, i + 1);
  const fnStart = i;
  if (text[i] === ")") return null;
  const fnEnd = skipMatching(text, start);
  return { id: idLit.value, fingerprint: fpLit.value, fnStart, fnEnd };
}

function callNameAt(text, i, name) {
  return !isIdentChar(text[i - 1]) && text.startsWith(name, i) && !isIdentChar(text[i + name.length]);
}

function leftoverCalls(text, name) {
  const hits = [];
  let i = 0;
  const n = text.length;
  const stack = [];
  while (i < n) {
    const frame = stack[stack.length - 1];
    const c = text[i];
    if (frame && frame.type === "str") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (frame.q === "`" && c === "$" && text[i + 1] === "{") {
        stack.push({ type: "g", close: "}" });
        i += 2;
        continue;
      }
      if (c === frame.q) stack.pop();
      i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < n && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i = Math.min(n, i + 2);
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      stack.push({ type: "str", q: c });
      i += 1;
      continue;
    }
    if (c === "(" || c === "{" || c === "[") {
      stack.push({ type: "g", close: c === "(" ? ")" : c === "{" ? "}" : "]" });
      i += 1;
      continue;
    }
    if (c === ")" || c === "}" || c === "]") {
      if (frame && c === frame.close) stack.pop();
      i += 1;
      continue;
    }
    if (callNameAt(text, i, name)) {
      const after = skipTrivia(text, i + name.length);
      if (text[after] === "(") hits.push(i);
    }
    i += 1;
  }
  return hits;
}

function leftoverReqPrefix(fileName, title) {
  const errors = [];
  REQ_REF_RE.lastIndex = 0;
  for (const match of title.matchAll(REQ_REF_RE)) {
    errors.push(`${fileName}: req:${match[1]} is not coverage; use verifies("${match[1]}", fingerprint, fn)`);
  }
  return errors;
}

function evidenceFromTests(text) {
  const masked = maskInactiveRegions(text);
  const calls = [];
  const extraErrors = [];
  const wrapperSites = new Set();
  TEST_CALL_RE.lastIndex = 0;
  for (const call of masked.matchAll(TEST_CALL_RE)) {
    extraErrors.push(...leftoverReqPrefix("", call[2]));
    const skipped = call[1] === "skip" || call[1] === "todo";
    let i = skipTrivia(masked, call.index + call[0].length);
    if (masked[i] !== ",") {
      calls.push({ skipped, binding: null });
      continue;
    }
    i = skipTrivia(masked, i + 1);
    let optionsSkip = false;
    if (masked[i] === "{") {
      optionsSkip = objectDeclaresSkipOrTodo(masked, i);
      i = skipMatching(masked, i);
      i = skipTrivia(masked, i);
      if (masked[i] !== ",") {
        calls.push({ skipped: skipped || optionsSkip, binding: null });
        continue;
      }
      i = skipTrivia(masked, i + 1);
    }
    if (callNameAt(masked, i, "verifies")) {
      const afterName = skipTrivia(masked, i + "verifies".length);
      const parsed = parseVerifiesCall(masked, afterName);
      if (!parsed) {
        extraErrors.push("verifies() must be verifies(id, fingerprint, fn)");
        calls.push({ skipped: skipped || optionsSkip, binding: null });
        continue;
      }
      wrapperSites.add(i);
      calls.push({
        skipped: skipped || optionsSkip,
        binding: { id: parsed.id, fingerprint: parsed.fingerprint },
      });
      continue;
    }
    calls.push({ skipped: skipped || optionsSkip, binding: null });
  }

  for (const index of leftoverCalls(masked, "verifies")) {
    if (!wrapperSites.has(index)) {
      extraErrors.push('verifies() must wrap the test function at the it() or test() call');
    }
  }
  for (const _ of leftoverCalls(masked, "covers")) {
    extraErrors.push("covers() is removed; use verifies(id, fingerprint, fn)");
    break;
  }
  return { calls, extraErrors };
}

const SCHEMA_SKIP = new Set(["$schema", "$id", "title", "description", "$defs"]);
const SCHEMA_KEYS = new Set([
  "type",
  "additionalProperties",
  "required",
  "properties",
  "items",
  "oneOf",
  "enum",
  "const",
  "pattern",
  "minLength",
  "minItems",
  "$ref",
]);

function validateAgainstSchema(value, name) {
  const defs = SCHEMA.$defs ?? {};

  function check(sub, val, loc) {
    if (sub.$ref) {
      const ref = sub.$ref.startsWith("#/$defs/") ? sub.$ref.slice("#/$defs/".length) : "";
      if (!defs[ref]) return [`${loc}: unknown schema ref ${sub.$ref}`];
      return check(defs[ref], val, loc);
    }
    const unknown = Object.keys(sub).filter((key) => !SCHEMA_SKIP.has(key) && !SCHEMA_KEYS.has(key));
    if (unknown.length > 0) return [`${loc}: unsupported schema keyword ${unknown[0]}`];
    if (sub.oneOf) {
      const attempts = sub.oneOf.map((option) => check(option, val, loc));
      const matched = attempts.filter((list) => list.length === 0);
      if (matched.length === 1) return [];
      if (matched.length > 1) return [`${loc}: matches more than one schema`];
      return attempts.sort((a, b) => a.length - b.length)[0] ?? [`${loc}: does not match schema`];
    }
    const errors = [];
    if (sub.type === "object") {
      if (!val || typeof val !== "object" || Array.isArray(val)) return [`${loc}: must be an object`];
    } else if (sub.type === "array") {
      if (!Array.isArray(val)) return [`${loc}: must be a list`];
    } else if (sub.type === "string") {
      if (typeof val !== "string") return [`${loc}: must be a string`];
    }
    if (Object.hasOwn(sub, "const") && !Object.is(val, sub.const)) {
      errors.push(`${loc}: must be ${JSON.stringify(sub.const)}`);
    }
    if (sub.enum && !sub.enum.includes(val)) errors.push(`${loc}: must be ${sub.enum.join(", ")}`);
    if (sub.pattern && typeof val === "string" && !new RegExp(sub.pattern).test(val)) {
      errors.push(`${loc}: must match ${sub.pattern}`);
    }
    if (typeof sub.minLength === "number" && typeof val === "string" && val.length < sub.minLength) {
      errors.push(`${loc}: must not be empty`);
    }
    if (sub.type === "object") {
      const props = sub.properties ?? {};
      if (sub.additionalProperties === false) {
        for (const key of Object.keys(val)) {
          if (!Object.hasOwn(props, key)) errors.push(`${loc}/${key}: unknown property`);
        }
      }
      for (const key of sub.required ?? []) {
        if (!Object.hasOwn(val, key)) errors.push(`${loc}: missing ${key}`);
      }
      for (const [key, child] of Object.entries(props)) {
        if (Object.hasOwn(val, key)) errors.push(...check(child, val[key], `${loc}/${key}`));
      }
    }
    if (sub.type === "array") {
      if (typeof sub.minItems === "number" && val.length < sub.minItems) {
        errors.push(`${loc}: need at least ${sub.minItems} entries`);
      }
      if (sub.items) {
        val.forEach((item, index) => {
          errors.push(...check(sub.items, item, `${loc}/${index}`));
        });
      }
    }
    return errors;
  }

  return check(SCHEMA, value, name);
}

const TIMED_WORD_RE = /\b(?:v\d+|version|release|phase|for now|yet|initially|currently|later)\b/i;

function yamlLine(lineCounter, node) {
  if (!node?.range) return 1;
  return lineCounter.linePos(node.range[0]).line;
}

function yamlPair(map, key) {
  if (!isMap(map)) return undefined;
  return map.items.find((pair) => isScalar(pair.key) && pair.key.value === key);
}

function rollupStatus(statuses) {
  if (statuses.some((status) => status === "accepted")) return "accepted";
  if (statuses.length > 0 && statuses.every((status) => status === "verified")) return "verified";
  return "implemented";
}

function parseCatalog(name, text) {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, uniqueKeys: true });
  const problems = [...doc.errors, ...doc.warnings];
  if (problems.length > 0) {
    return {
      errors: problems.map((problem) => {
        const line = problem.linePos?.[0]?.line ?? 1;
        return `${name}:${line}: ${problem.message}`;
      }),
      nodes: [],
    };
  }

  const root = doc.contents;
  const errors = [];
  if (!isMap(root)) {
    return { errors: [`${name}:1: catalog must be a mapping`], nodes: [] };
  }

  function at(node) {
    return yamlLine(lineCounter, node);
  }

  function rejectFlow(node) {
    if (!node || typeof node !== "object") return;
    if (node.flow === true) {
      errors.push(`${name}:${yamlLine(lineCounter, node)}: use block style, not flow style`);
    }
    if (!node.items) return;
    for (const item of node.items) {
      rejectFlow(item);
      if (item?.key) rejectFlow(item.key);
      if (item?.value) rejectFlow(item.value);
    }
  }

  rejectFlow(root);

  function rejectUnknown(map, allowed) {
    for (const pair of map.items) {
      const keyNode = pair.key;
      if (!isScalar(keyNode) || typeof keyNode.value !== "string") {
        errors.push(`${name}:${at(keyNode)}: key must be a string`);
        continue;
      }
      if (!allowed.has(keyNode.value)) {
        errors.push(`${name}:${at(keyNode)}: unknown key ${keyNode.value}`);
      }
    }
  }

  function takeQuotedId(map, key) {
    const pair = yamlPair(map, key);
    if (!pair) {
      errors.push(`${name}:${at(map)}: missing ${key}`);
      return null;
    }
    const node = pair.value;
    if (!isScalar(node) || node.type !== "QUOTE_DOUBLE" || typeof node.value !== "string") {
      errors.push(`${name}:${at(node ?? pair.key)}: ${key} must be a double-quoted string`);
      return null;
    }
    if (!ID_RE.test(node.value)) {
      errors.push(`${name}:${at(node)}: ${key} must be a positive integer id`);
      return null;
    }
    return { text: node.value, line: at(node) };
  }

  function takeString(map, key) {
    const pair = yamlPair(map, key);
    if (!pair) {
      errors.push(`${name}:${at(map)}: missing ${key}`);
      return null;
    }
    const value = pair.value;
    const scalar = isScalar(value) && typeof value.value === "string" ? value.value : null;
    if (!scalar) {
      errors.push(`${name}:${at(value ?? pair.key)}: ${key} must be a string`);
      return null;
    }
    if (scalar.includes("\n") || scalar !== scalar.trim()) {
      errors.push(`${name}:${at(value)}: ${key} must be one line`);
      return null;
    }
    return { text: scalar, line: at(value) };
  }

  function takeStatus(map) {
    const pair = yamlPair(map, "status");
    if (!pair) {
      errors.push(`${name}:${at(map)}: missing status`);
      return null;
    }
    const value = isScalar(pair.value) ? pair.value.value : null;
    if (!STATUSES.has(value)) {
      errors.push(`${name}:${at(pair.value ?? pair.key)}: status must be accepted, implemented, or verified`);
      return null;
    }
    return value;
  }

  const nodes = [];
  const seen = new Set();

  function addNode(fields) {
    if (seen.has(fields.id)) {
      errors.push(`${name}:${fields.line}: duplicate id ${fields.id}`);
      return;
    }
    seen.add(fields.id);
    nodes.push(fields);
  }

  function parseNode(map, parentId, inShared, isRoot) {
    if (yamlPair(map, "ref") && yamlPair(map, "id")) {
      errors.push(`${name}:${at(map)}: a reference cannot also be a node`);
      return null;
    }
    if (yamlPair(map, "ref")) {
      rejectUnknown(map, new Set(["ref"]));
      const refId = takeQuotedId(map, "ref");
      if (!refId) return null;
      return { type: "ref", id: refId.text, line: refId.line };
    }

    const allowed = isRoot
      ? new Set(["id", "kind", "status", "text", "children"])
      : new Set(["id", "status", "text", "children"]);
    rejectUnknown(map, allowed);
    const idField = takeQuotedId(map, "id");
    const textField = takeString(map, "text");
    const status = takeStatus(map);
    let kind = "normal";
    const kindPair = yamlPair(map, "kind");
    if (kindPair) {
      if (!isRoot) {
        errors.push(`${name}:${at(kindPair.key)}: kind is only allowed on a root`);
      }
      const value = isScalar(kindPair.value) ? kindPair.value.value : null;
      if (value !== "normal" && value !== "shared") {
        errors.push(`${name}:${at(kindPair.value ?? kindPair.key)}: kind must be normal or shared`);
      } else {
        kind = value;
      }
    }
    if (textField && TIMED_WORD_RE.test(textField.text)) {
      errors.push(`${name}:${textField.line}: ${idField ? idField.text : "text"} names a version or a time`);
    }

    const shared = isRoot ? kind === "shared" : inShared;
    const childEntries = [];
    const childrenPair = yamlPair(map, "children");
    if (childrenPair) {
      if (!isSeq(childrenPair.value)) {
        errors.push(`${name}:${at(childrenPair.value)}: children must be a list`);
      } else if (childrenPair.value.items.length < 2) {
        errors.push(`${name}:${at(childrenPair.value)}: children must have at least two entries`);
      } else {
        for (const item of childrenPair.value.items) {
          if (!isMap(item)) {
            errors.push(`${name}:${at(item)}: child must be a mapping`);
            continue;
          }
          const child = parseNode(item, idField ? idField.text : null, shared, false);
          if (child) childEntries.push(child);
        }
      }
    }

    if (!idField || !textField || !status) return null;
    const childIds = childEntries.filter((child) => child.type === "node").map((child) => child.id);
    const refIds = childEntries.filter((child) => child.type === "ref").map((child) => child.id);
    addNode({
      type: "node",
      id: idField.text,
      line: idField.line,
      file: name,
      text: textField.text,
      status,
      kind,
      parentId,
      childIds,
      refIds,
      inSharedTree: shared,
      isRoot,
      fingerprint: requirementFingerprint(idField.text, textField.text),
    });
    return { type: "node", id: idField.text };
  }

  rejectUnknown(root, new Set(["requirements"]));
  const requirementsPair = yamlPair(root, "requirements");
  if (!requirementsPair) {
    errors.push(`${name}:${at(root)}: missing requirements`);
  } else if (!isSeq(requirementsPair.value)) {
    errors.push(`${name}:${at(requirementsPair.value)}: requirements must be a list`);
  } else {
    for (const item of requirementsPair.value.items) {
      if (!isMap(item)) {
        errors.push(`${name}:${at(item)}: root must be a mapping`);
        continue;
      }
      parseNode(item, null, false, true);
    }
  }

  errors.push(...validateAgainstSchema(doc.toJS(), name));
  return { errors, nodes };
}

function loadEvidenceFiles(dir) {
  if (!existsSync(dir)) return [];
  const rows = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(readFileSync(path.join(dir, name), "utf8"));
      rows.push({
        id: String(raw.id ?? ""),
        fingerprint: String(raw.fingerprint ?? ""),
        passed: raw.passed === true,
      });
    } catch {
      rows.push({ id: name, fingerprint: "", passed: false, invalid: true });
    }
  }
  return rows;
}

function isLeaf(node) {
  return node.childIds.length === 0 && node.refIds.length === 0;
}

function check({ requirementFiles, testFiles, decisionFiles = [], evidence = [] }) {
  const errors = [];
  const byId = new Map();
  const files = [...requirementFiles].sort((a, b) => a.name.localeCompare(b.name));
  const yamlFiles = files.filter((file) => file.name.endsWith(".yaml"));

  for (const file of files) {
    if (file.name === "README.md" || file.name === "migration.md") continue;
    if (file.name.endsWith(".md")) {
      errors.push(`${file.name}: the catalog is ${CATALOG_NAME}`);
    }
  }
  for (const file of yamlFiles) {
    if (file.name !== CATALOG_NAME) {
      errors.push(`${file.name}: the catalog is ${CATALOG_NAME}`);
      continue;
    }
    const parsed = parseCatalog(file.name, file.text);
    errors.push(...parsed.errors);
    for (const node of parsed.nodes) {
      const prior = byId.get(node.id);
      if (prior) {
        errors.push(`${node.file}:${node.line}: duplicate id ${node.id} (also ${prior.file}:${prior.line})`);
        continue;
      }
      byId.set(node.id, node);
    }
  }

  for (const node of byId.values()) {
    for (const refId of node.refIds) {
      const target = byId.get(refId);
      if (!target) {
        errors.push(`${node.file}:${node.line}: ${node.id} references unknown id ${refId}`);
        continue;
      }
      if (!target.inSharedTree) {
        errors.push(
          `${node.file}:${node.line}: ${node.id} references ${refId}, which is not in a shared tree`,
        );
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function walk(id, stack) {
    if (visiting.has(id)) {
      errors.push(`cycle: ${[...stack, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id)) return;
    const node = byId.get(id);
    if (!node) return;
    visiting.add(id);
    for (const childId of [...node.childIds, ...node.refIds]) walk(childId, [...stack, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) walk(id, []);

  for (const node of byId.values()) {
    if (isLeaf(node)) continue;
    const statuses = [];
    for (const childId of node.childIds) {
      const child = byId.get(childId);
      if (child) statuses.push(child.status);
    }
    for (const refId of node.refIds) {
      const child = byId.get(refId);
      if (child) statuses.push(child.status);
    }
    const expected = rollupStatus(statuses);
    if (node.status !== expected) {
      errors.push(
        `${node.file}:${node.line}: ${node.id} status ${node.status} does not roll up to ${expected}`,
      );
    }
  }

  const bindings = new Map();
  const tests = [...testFiles].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of tests) {
    const text = file.text.replace(/\r\n/g, "\n");
    const evidenceScan = evidenceFromTests(text);
    for (const extra of evidenceScan.extraErrors) {
      errors.push(extra.startsWith(": ") ? `${file.name}${extra}` : `${file.name}: ${extra}`);
    }
    LETTER_ID_RE.lastIndex = 0;
    LETTER_OVERLONG_RE.lastIndex = 0;
    for (const match of text.matchAll(LETTER_ID_RE)) {
      errors.push(`unknown id ${match[0]} in ${file.name}`);
    }
    for (const match of text.matchAll(LETTER_OVERLONG_RE)) {
      errors.push(`invalid id ${match[0]} in ${file.name}`);
    }
    for (const call of evidenceScan.calls) {
      if (!call.binding || call.skipped) continue;
      const list = bindings.get(call.binding.id) ?? [];
      list.push({ ...call.binding, file: file.name });
      bindings.set(call.binding.id, list);
    }
  }

  for (const [id, list] of [...bindings.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const node = byId.get(id);
    if (!node) {
      errors.push(`unknown id ${id} in ${list[0].file}`);
      continue;
    }
    if (!isLeaf(node)) {
      errors.push(`${list[0].file}: ${id} is not a leaf`);
      continue;
    }
    if (list.length > 1) {
      errors.push(`${node.file}:${node.line}: ${id} is bound by more than one test`);
    }
    for (const binding of list) {
      if (binding.fingerprint !== node.fingerprint) {
        errors.push(
          `${binding.file}: ${id} fingerprint ${binding.fingerprint} does not match ${node.fingerprint}`,
        );
      }
    }
  }

  const passed = new Map();
  for (const row of evidence) {
    if (row.invalid || !row.passed) continue;
    passed.set(row.id, row);
  }

  for (const node of byId.values()) {
    if (!isLeaf(node) || node.status !== "verified") continue;
    const bound = bindings.get(node.id) ?? [];
    if (bound.length === 0) {
      errors.push(`${node.file}:${node.line}: ${node.id} is verified and has no test binding`);
      continue;
    }
    const run = passed.get(node.id);
    if (!run || run.fingerprint !== node.fingerprint) {
      errors.push(
        `${node.file}:${node.line}: ${node.id} is verified without an executed passing test`,
      );
    }
  }

  const decisions = [...decisionFiles].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of decisions) {
    if (file.text.includes("verifies(") || file.text.includes("covers(")) {
      errors.push(`${file.name}: cites a requirement test helper`);
    }
    REQ_REF_RE.lastIndex = 0;
    for (const match of file.text.matchAll(REQ_REF_RE)) {
      errors.push(`${file.name}: cites requirement id ${match[1]}`);
    }
    LETTER_ID_RE.lastIndex = 0;
    for (const match of file.text.matchAll(LETTER_ID_RE)) {
      errors.push(`${file.name}: cites requirement id ${match[0]}`);
    }
  }

  return {
    errors,
    ids: [...byId.keys()].sort((a, b) => Number(a) - Number(b)),
  };
}

function sameIds(got, want) {
  if (got.length !== want.length) return false;
  const pending = new Set(got);
  for (const id of want) {
    if (!pending.delete(id)) return false;
  }
  return pending.size === 0;
}

function catalogYaml(body) {
  return `requirements:\n${body}`;
}

function twoLeaves(status = "accepted") {
  return [
    '  - id: "1"',
    `    status: ${status}`,
    '    text: Agents can read a recipe.',
    "    children:",
    '      - id: "2"',
    `        status: ${status}`,
    '        text: Given a recipe ID, the agent receives that recipe.',
    '      - id: "3"',
    `        status: ${status}`,
    '        text: Without a recipe ID, the agent is told an ID is required.',
    "",
  ].join("\n");
}

function runCanary() {
  const failures = [];
  const fp2 = requirementFingerprint("2", "Given a recipe ID, the agent receives that recipe.");
  const fp3 = requirementFingerprint("3", "Without a recipe ID, the agent is told an ID is required.");

  function pass(label, input, ids) {
    const result = check(input);
    if (result.errors.length > 0) {
      failures.push(`${label}: expected pass, got ${result.errors.join(" || ")}`);
      return;
    }
    if (ids && !sameIds(result.ids, ids)) {
      failures.push(`${label}: ids ${result.ids.join(",")} want ${ids.join(",")}`);
    }
  }

  function fail(label, input, snippet) {
    const result = check(input);
    if (!result.errors.some((error) => error.includes(snippet))) {
      failures.push(
        `${label}: expected ${JSON.stringify(snippet)}, got ${result.errors.join(" || ") || "no errors"}`,
      );
    }
  }

  pass("empty", { requirementFiles: [], testFiles: [] }, []);
  pass(
    "readme is not the catalog",
    { requirementFiles: [{ name: "README.md", text: "# Requirements\n" }], testFiles: [] },
    [],
  );

  const accepted = [{ name: CATALOG_NAME, text: catalogYaml(twoLeaves("accepted")) }];
  pass("accepted leaves need no test", { requirementFiles: accepted, testFiles: [] }, ["1", "2", "3"]);

  const implemented = [{ name: CATALOG_NAME, text: catalogYaml(twoLeaves("implemented")) }];
  pass("implemented leaves need no test", { requirementFiles: implemented, testFiles: [] }, ["1", "2", "3"]);

  const verifiedYaml = catalogYaml(twoLeaves("verified"));
  fail(
    "verified leaf needs a binding",
    { requirementFiles: [{ name: CATALOG_NAME, text: verifiedYaml }], testFiles: [] },
    "is verified and has no test binding",
  );

  const verifiedTests = [
    {
      name: "read.test.ts",
      text: `it("receives that recipe", verifies("2", "${fp2}", () => {\n  assert.ok(true);\n}));\nit("requires an id", verifies("3", "${fp3}", () => {\n  assert.ok(true);\n}));\n`,
    },
  ];
  fail(
    "verified without executed evidence",
    {
      requirementFiles: [{ name: CATALOG_NAME, text: verifiedYaml }],
      testFiles: verifiedTests,
      evidence: [],
    },
    "without an executed passing test",
  );
  pass(
    "verified with executed evidence",
    {
      requirementFiles: [{ name: CATALOG_NAME, text: verifiedYaml }],
      testFiles: verifiedTests,
      evidence: [
        { id: "2", fingerprint: fp2, passed: true },
        { id: "3", fingerprint: fp3, passed: true },
      ],
    },
    ["1", "2", "3"],
  );
  fail(
    "skipped test is not executed evidence",
    {
      requirementFiles: [{ name: CATALOG_NAME, text: verifiedYaml }],
      testFiles: [
        {
          name: "read.test.ts",
          text: `it.skip("receives that recipe", verifies("2", "${fp2}", () => {}));\nit("requires an id", verifies("3", "${fp3}", () => {}));\n`,
        },
      ],
      evidence: [
        { id: "2", fingerprint: fp2, passed: true },
        { id: "3", fingerprint: fp3, passed: true },
      ],
    },
    "is verified and has no test binding",
  );
  fail(
    "failing evidence is not verified",
    {
      requirementFiles: [{ name: CATALOG_NAME, text: verifiedYaml }],
      testFiles: verifiedTests,
      evidence: [
        { id: "2", fingerprint: fp2, passed: false },
        { id: "3", fingerprint: fp3, passed: true },
      ],
    },
    "without an executed passing test",
  );
  fail(
    "stale fingerprint",
    {
      requirementFiles: [{ name: CATALOG_NAME, text: verifiedYaml }],
      testFiles: [
        {
          name: "read.test.ts",
          text: `it("receives that recipe", verifies("2", "deadbeefdeadbeef", () => {}));\nit("requires an id", verifies("3", "${fp3}", () => {}));\n`,
        },
      ],
      evidence: [
        { id: "2", fingerprint: fp2, passed: true },
        { id: "3", fingerprint: fp3, passed: true },
      ],
    },
    "does not match",
  );
  fail(
    "binding to a parent",
    {
      requirementFiles: [{ name: CATALOG_NAME, text: catalogYaml(twoLeaves("accepted")) }],
      testFiles: [
        {
          name: "read.test.ts",
          text: `it("parent", verifies("1", "${requirementFingerprint("1", "Agents can read a recipe.")}", () => {}));\n`,
        },
      ],
    },
    "is not a leaf",
  );
  fail(
    "one test per leaf",
    {
      requirementFiles: [{ name: CATALOG_NAME, text: catalogYaml(twoLeaves("accepted")) }],
      testFiles: [
        {
          name: "read.test.ts",
          text: `it("a", verifies("2", "${fp2}", () => {}));\nit("b", verifies("2", "${fp2}", () => {}));\n`,
        },
      ],
    },
    "bound by more than one test",
  );
  fail(
    "verifies inside the body is not a binding",
    {
      requirementFiles: [{ name: CATALOG_NAME, text: verifiedYaml }],
      testFiles: [
        {
          name: "read.test.ts",
          text: `it("receives that recipe", () => {\n  verifies("2", "${fp2}");\n});\nit("requires an id", verifies("3", "${fp3}", () => {}));\n`,
        },
      ],
      evidence: [
        { id: "2", fingerprint: fp2, passed: true },
        { id: "3", fingerprint: fp3, passed: true },
      ],
    },
    "must wrap the test function",
  );
  fail(
    "covers is removed",
    {
      requirementFiles: accepted,
      testFiles: [{ name: "read.test.ts", text: 'it("reads", () => {\n  covers("2");\n});\n' }],
    },
    "covers() is removed",
  );
  fail(
    "single child list",
    {
      requirementFiles: [
        {
          name: CATALOG_NAME,
          text: catalogYaml(
            [
              '  - id: "1"',
              "    status: accepted",
              '    text: Agents can list recipes.',
              "    children:",
              '      - id: "2"',
              "        status: accepted",
              '        text: Given a deleted recipe, the list does not include it.',
              "",
            ].join("\n"),
          ),
        },
      ],
      testFiles: [],
    },
    "at least two entries",
  );
  fail(
    "unquoted id",
    {
      requirementFiles: [{ name: CATALOG_NAME, text: catalogYaml(twoLeaves("accepted")).replace('id: "1"', "id: 1") }],
      testFiles: [],
    },
    "double-quoted",
  );
  fail(
    "missing reference",
    {
      requirementFiles: [
        {
          name: CATALOG_NAME,
          text: catalogYaml(
            [
              '  - id: "1"',
              "    kind: shared",
              "    status: accepted",
              '    text: Shared auth.',
              "    children:",
              '      - id: "2"',
              "        status: accepted",
              '        text: Without the secret, the call is refused.',
              '      - id: "3"',
              "        status: accepted",
              '        text: Liveness does not ask for the secret.',
              '  - id: "4"',
              "    status: accepted",
              '    text: Recipe calls require the secret.',
              "    children:",
              '      - ref: "2"',
              '      - ref: "9"',
              "",
            ].join("\n"),
          ),
        },
      ],
      testFiles: [],
    },
    "unknown id 9",
  );
  fail(
    "reference to a normal tree node",
    {
      requirementFiles: [
        {
          name: CATALOG_NAME,
          text: catalogYaml(
            [
              '  - id: "1"',
              "    status: accepted",
              '    text: Kitchen UI.',
              "    children:",
              '      - id: "2"',
              "        status: accepted",
              '        text: The list shows each recipe title.',
              '      - id: "3"',
              "        status: accepted",
              '        text: The list shows each favorite.',
              '  - id: "4"',
              "    status: accepted",
              '    text: Another screen.',
              "    children:",
              '      - ref: "2"',
              '      - id: "5"',
              "        status: accepted",
              '        text: Settings uses the same list row.',
              "",
            ].join("\n"),
          ),
        },
      ],
      testFiles: [],
    },
    "not in a shared tree",
  );
  fail(
    "cycle through references",
    {
      requirementFiles: [
        {
          name: CATALOG_NAME,
          text: catalogYaml(
            [
              '  - id: "1"',
              "    kind: shared",
              "    status: accepted",
              '    text: Shared a.',
              "    children:",
              '      - id: "2"',
              "        status: accepted",
              '        text: Leaf a.',
              '      - ref: "3"',
              '  - id: "3"',
              "    kind: shared",
              "    status: accepted",
              '    text: Shared b.',
              "    children:",
              '      - id: "4"',
              "        status: accepted",
              '        text: Leaf b.',
              '      - ref: "1"',
              "",
            ].join("\n"),
          ),
        },
      ],
      testFiles: [],
    },
    "cycle",
  );
  fail(
    "parent verified with mixed children",
    {
      requirementFiles: [
        {
          name: CATALOG_NAME,
          text: catalogYaml(
            [
              '  - id: "1"',
              "    status: verified",
              '    text: Agents can read a recipe.',
              "    children:",
              '      - id: "2"',
              "        status: implemented",
              '        text: Given a recipe ID, the agent receives that recipe.',
              '      - id: "3"',
              "        status: verified",
              '        text: Without a recipe ID, the agent is told an ID is required.',
              "",
            ].join("\n"),
          ),
        },
      ],
      testFiles: [],
    },
    "does not roll up",
  );
  pass(
    "mixed implemented and verified rolls up to implemented",
    {
      requirementFiles: [
        {
          name: CATALOG_NAME,
          text: catalogYaml(
            [
              '  - id: "1"',
              "    status: implemented",
              '    text: Agents can read a recipe.',
              "    children:",
              '      - id: "2"',
              "        status: implemented",
              '        text: Given a recipe ID, the agent receives that recipe.',
              '      - id: "3"',
              "        status: verified",
              '        text: Without a recipe ID, the agent is told an ID is required.',
              "",
            ].join("\n"),
          ),
        },
      ],
      testFiles: [
        {
          name: "read.test.ts",
          text: `it("requires an id", verifies("3", "${fp3}", () => {}));\n`,
        },
      ],
      evidence: [{ id: "3", fingerprint: fp3, passed: true }],
    },
    ["1", "2", "3"],
  );
  pass(
    "shared refs count toward children and rollup",
    {
      requirementFiles: [
        {
          name: CATALOG_NAME,
          text: catalogYaml(
            [
              '  - id: "10"',
              "    kind: shared",
              "    status: verified",
              '    text: MCP liveness.',
              "    children:",
              '      - id: "11"',
              "        status: verified",
              '        text: Liveness does not ask for a secret.',
              '      - id: "12"',
              "        status: verified",
              '        text: Liveness does not return recipes.',
              '  - id: "13"',
              "    status: verified",
              '    text: Health checks.',
              "    children:",
              '      - id: "14"',
              "        status: verified",
              '        text: The API answers without a secret.',
              '      - ref: "11"',
              "",
            ].join("\n"),
          ),
        },
      ],
      testFiles: [
        {
          name: "health.test.ts",
          text: [
            `it("mcp no secret", verifies("11", "${requirementFingerprint("11", "Liveness does not ask for a secret.")}", () => {}));`,
            `it("mcp no recipes", verifies("12", "${requirementFingerprint("12", "Liveness does not return recipes.")}", () => {}));`,
            `it("api no secret", verifies("14", "${requirementFingerprint("14", "The API answers without a secret.")}", () => {}));`,
            "",
          ].join("\n"),
        },
      ],
      evidence: [
        {
          id: "11",
          fingerprint: requirementFingerprint("11", "Liveness does not ask for a secret."),
          passed: true,
        },
        {
          id: "12",
          fingerprint: requirementFingerprint("12", "Liveness does not return recipes."),
          passed: true,
        },
        {
          id: "14",
          fingerprint: requirementFingerprint("14", "The API answers without a secret."),
          passed: true,
        },
      ],
    },
    ["10", "11", "12", "13", "14"],
  );
  fail(
    "kind on a nested node",
    {
      requirementFiles: [
        {
          name: CATALOG_NAME,
          text: catalogYaml(twoLeaves("accepted")).replace(
            '      - id: "2"\n        status: accepted',
            '      - id: "2"\n        kind: shared\n        status: accepted',
          ),
        },
      ],
      testFiles: [],
    },
    "kind is only allowed on a root",
  );
  fail(
    "second yaml file",
    {
      requirementFiles: [
        { name: CATALOG_NAME, text: catalogYaml(twoLeaves("accepted")) },
        { name: "1-mcp.yaml", text: "id: 1\n" },
      ],
      testFiles: [],
    },
    `the catalog is ${CATALOG_NAME}`,
  );
  fail(
    "adr cites req prefix",
    {
      requirementFiles: accepted,
      testFiles: [],
      decisionFiles: [{ name: "docs/decisions/0001-choice.md", text: "See req:2.\n" }],
    },
    "cites requirement id 2",
  );
  pass(
    "wcag 2.2 is not a requirement id",
    {
      requirementFiles: accepted,
      testFiles: [],
      decisionFiles: [{ name: "docs/decisions/0016-kitchen-ui.md", text: "The floor is WCAG 2.2 AA.\n" }],
    },
    ["1", "2", "3"],
  );
  fail(
    "yaml names a time",
    {
      requirementFiles: [
        {
          name: CATALOG_NAME,
          text: catalogYaml(twoLeaves("accepted")).replace(
            "Given a recipe ID, the agent receives that recipe.",
            "Search comes later.",
          ),
        },
      ],
      testFiles: [],
    },
    "names a version",
  );
  fail(
    "req prefix in a title",
    {
      requirementFiles: accepted,
      testFiles: [{ name: "read.test.ts", text: 'it("req:2 reads", () => {});\n' }],
    },
    "is not coverage",
  );
  fail(
    "unknown verifies id",
    {
      requirementFiles: accepted,
      testFiles: [
        {
          name: "read.test.ts",
          text: `it("missing", verifies("9", "${requirementFingerprint("9", "nope")}", () => {}));\n`,
        },
      ],
    },
    "unknown id 9",
  );

  const known = requirementFingerprint(
    "1",
    "Without the shared secret, the agent is told the call is not allowed.",
  );
  if (known !== "d631eefaf753e9d7") {
    failures.push(`fingerprint fixture: got ${known}`);
  }

  return failures;
}

async function walk(dir, visit) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, visit);
    else await visit(full);
  }
}

function isTestFile(filePath) {
  return /\.(?:test|spec)\.(?:js|mjs|cjs|ts|tsx|jsx)$/.test(filePath);
}

async function loadRepo() {
  const requirementNames = (await readdir(REQUIREMENTS_DIR)).sort();
  const requirementFiles = [];
  for (const name of requirementNames) {
    if (!name.endsWith(".md") && !name.endsWith(".yaml")) continue;
    requirementFiles.push({
      name,
      text: await readFile(path.join(REQUIREMENTS_DIR, name), "utf8"),
    });
  }

  const testFiles = [];
  await walk(ROOT, async (full) => {
    if (isTestFile(full)) {
      testFiles.push({ name: path.relative(ROOT, full), text: await readFile(full, "utf8") });
    }
  });

  const decisionFiles = [];
  async function walkDecisions(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walkDecisions(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        decisionFiles.push({ name: path.relative(ROOT, full), text: await readFile(full, "utf8") });
      }
    }
  }
  await walkDecisions(DECISIONS_DIR);

  return {
    requirementFiles,
    testFiles,
    decisionFiles,
    evidence: loadEvidenceFiles(EVIDENCE_DIR),
  };
}

function report(header, lines) {
  console.error([header, ...lines.map((line) => `  ${line}`)].join("\n"));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SELF;
if (isMain) {
  if (process.argv.includes("--reset-evidence")) {
    rmSync(EVIDENCE_DIR, { recursive: true, force: true });
    process.exit(0);
  }
  if (process.argv.includes("--fingerprints")) {
    const parsed = parseCatalog(
      CATALOG_NAME,
      readFileSync(path.join(REQUIREMENTS_DIR, CATALOG_NAME), "utf8"),
    );
    for (const node of parsed.nodes) {
      if (!isLeaf(node)) continue;
      console.log(`${node.id}\t${node.status}\t${node.fingerprint}\t${node.text}`);
    }
    process.exit(parsed.errors.length > 0 ? 1 : 0);
  }
  const canary = runCanary();
  if (canary.length > 0) {
    report("requirements canary failed:", canary);
    process.exit(1);
  }
  const result = check(await loadRepo());
  if (result.errors.length > 0) {
    report("requirements:", result.errors);
    process.exit(1);
  }
  const count = result.ids.length;
  console.log(count === 0 ? "requirements ok" : `requirements ok (${count} ids)`);
}

export { check, requirementFingerprint, parseCatalog, isLeaf };

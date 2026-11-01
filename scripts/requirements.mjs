#!/usr/bin/env node

// Requirement ID check. Policy is CONTRIBUTING.md. File shape is docs/requirements/README.md.
// Fixture IDs stay in this file. The reference scan does not read it.
// Markdown under docs/decisions is scanned for requirement IDs. Other docs are not.

import { readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMap, isScalar, isSeq, LineCounter, parseDocument } from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = path.join(ROOT, "scripts", "requirements.mjs");
const REQUIREMENTS_DIR = path.join(ROOT, "docs", "requirements");
const DECISIONS_DIR = path.join(ROOT, "docs", "decisions");

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage"]);

const PART = "[1-9][0-9]*";
const ID_SOURCE = `[FNS]${PART}(?:\\.${PART}){0,2}`;
const TOKEN_RE = new RegExp(`(?<![A-Za-z0-9.])${ID_SOURCE}(?![A-Za-z0-9.])`, "g");
const OVERLONG_RE = new RegExp(`(?<![A-Za-z0-9.])[FNS]${PART}(?:\\.${PART}){3,}(?![A-Za-z0-9.])`, "g");
const YAML_FILE_RE = new RegExp(`^(${PART})-[a-z0-9]+(?:-[a-z0-9]+)*\\.yaml$`);
const YAML_TYPES = new Set(["functional", "non-functional", "system"]);
const NUMERIC_ID_RE = new RegExp(`(?<![A-Za-z0-9.])${PART}(?:\\.${PART}){1,2}(?![A-Za-z0-9.])`, "g");
const REQ_REF_RE = new RegExp(`(?<![A-Za-z0-9_])req:(${PART}(?:\\.${PART}){1,2})(?![A-Za-z0-9.])`, "g");
const SCHEMA = JSON.parse(readFileSync(path.join(REQUIREMENTS_DIR, "schema.json"), "utf8"));
const INDEX_PATH = path.join(REQUIREMENTS_DIR, "index.md");
const TEST_CALL_RE =
  /(?:^|\n)[ \t]*(?:await\s+)?(?:[A-Za-z_$][\w$]*\.)?(?:it|test)(?![A-Za-z0-9_$])(?:\.(skip|only|todo))?\s*\(\s*(?:\n[ \t]*)?(['"`])([^'"`\n]*)\2/g;

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

// Blank block comments and the arguments of describe.skip / describe.todo.
// Line comments stay in the source the reference scan reads.
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

function followingOptionsSkip(text, index) {
  let i = skipTrivia(text, index);
  if (text[i] !== ",") return false;
  i = skipTrivia(text, i + 1);
  if (text[i] !== "{") return false;
  return objectDeclaresSkipOrTodo(text, i);
}

function evidenceFromTests(text) {
  const masked = maskInactiveRegions(text);
  const calls = [];
  TEST_CALL_RE.lastIndex = 0;
  for (const call of masked.matchAll(TEST_CALL_RE)) {
    if (call[1] === "skip" || call[1] === "todo") continue;
    if (followingOptionsSkip(masked, call.index + call[0].length)) continue;
    const title = call[3];
    const reqIds = [];
    const seen = new Set();
    REQ_REF_RE.lastIndex = 0;
    for (const match of title.matchAll(REQ_REF_RE)) {
      if (seen.has(match[1])) continue;
      seen.add(match[1]);
      reqIds.push(match[1]);
    }
    calls.push({ reqIds });
  }
  return calls;
}

function yamlChildId(parent) {
  return new RegExp(`^${parent.replaceAll(".", "\\.")}\\.${PART}$`);
}

function parentOf(id) {
  const dot = id.lastIndexOf(".");
  return dot === -1 ? null : id.slice(0, dot);
}

function scanIds(text) {
  return {
    ids: [...text.matchAll(TOKEN_RE)].map((match) => match[0]),
    invalid: [...text.matchAll(OVERLONG_RE)].map((match) => match[0]),
  };
}

// A trailing period is a boundary, so "F3." still counts. A dot before a number stays in the ID.
const DECISION_PERIOD_RE = new RegExp(
  `(?<![A-Za-z0-9.])(${ID_SOURCE}(?:\\.${PART})*)\\.(?![0-9])`,
  "g",
);

function decisionIdErrors(name, text) {
  DECISION_PERIOD_RE.lastIndex = 0;
  const scanned = scanIds(text.replace(DECISION_PERIOD_RE, "$1 "));
  return [...scanned.ids, ...scanned.invalid].map((id) => `${name}: cites requirement id ${id}`);
}

const NUMERIC_DECISION_PERIOD_RE = new RegExp(
  `(?<![A-Za-z0-9.])(${PART}(?:\\.${PART}){1,2})\\.(?![0-9])`,
  "g",
);

function decisionNumericIdErrors(name, text, knownIds) {
  const normalized = text.replace(NUMERIC_DECISION_PERIOD_RE, "$1 ");
  const errors = [];
  NUMERIC_ID_RE.lastIndex = 0;
  for (const match of normalized.matchAll(NUMERIC_ID_RE)) {
    if (knownIds.has(match[0])) errors.push(`${name}: cites requirement id ${match[0]}`);
  }
  return errors;
}

function yamlLine(lineCounter, node) {
  if (!node?.range) return 1;
  return lineCounter.linePos(node.range[0]).line;
}

function yamlPair(map, key) {
  if (!isMap(map)) return undefined;
  return map.items.find((pair) => isScalar(pair.key) && pair.key.value === key);
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
    } else if (sub.type === "boolean") {
      if (typeof val !== "boolean") return [`${loc}: must be true or false`];
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
      if (typeof sub.minItems === "number" && val.length < sub.minItems) errors.push(`${loc}: must not be empty`);
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

function compareId(a, b) {
  const as = a.split(".").map(Number);
  const bs = b.split(".").map(Number);
  const count = Math.max(as.length, bs.length);
  for (let i = 0; i < count; i += 1) {
    const diff = (as[i] ?? -1) - (bs[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return 0;
}

function renderIndex(entries) {
  const lines = entries
    .filter((entry) => entry.kind === "requirement" || entry.kind === "detail" || entry.kind === "removed")
    .slice()
    .sort((a, b) => compareId(a.id, b.id))
    .map((entry) => (entry.kind === "removed" ? `${entry.id} removed` : `${entry.id} ${entry.text}`));
  return [
    "# Requirements",
    "",
    "Generated from the YAML topic files. Do not edit. `pnpm requirements:index` rewrites this file.",
    "",
    ...lines,
    "",
  ].join("\n");
}

function parseYamlCategory(name, text) {
  const fileMatch = YAML_FILE_RE.exec(name);
  if (!fileMatch) {
    return {
      errors: [`${name}: topic file name must look like 1-mcp.yaml`],
      reqs: [],
    };
  }

  const categoryId = fileMatch[1];
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, uniqueKeys: true });
  const problems = [...doc.errors, ...doc.warnings];
  if (problems.length > 0) {
    return {
      errors: problems.map((problem) => {
        const line = problem.linePos?.[0]?.line ?? 1;
        return `${name}:${line}: ${problem.message}`;
      }),
      reqs: [],
    };
  }

  const root = doc.contents;
  if (!isMap(root)) {
    return { errors: [`${name}:1: topic file must be a mapping`], reqs: [] };
  }

  const errors = [];

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
  const reqs = [];
  const seen = new Set();

  function at(node) {
    return yamlLine(lineCounter, node);
  }

  function addReq(id, line, fields) {
    const parent = parentOf(id);
    if (parent && !seen.has(parent)) {
      errors.push(`${name}:${line}: ${id} is missing parent ${parent}`);
    }
    if (seen.has(id)) {
      errors.push(`${name}:${line}: duplicate id ${id}`);
      return;
    }
    seen.add(id);
    reqs.push({
      id,
      line,
      file: name,
      status: null,
      manual: false,
      kind: "topic",
      text: null,
      see: [],
      implementedFalse: false,
      skipCoverage: false,
      ...fields,
    });
  }

  function isRemoved(map) {
    const pair = yamlPair(map, "removed");
    if (!pair) return false;
    const node = pair.value;
    if (!isScalar(node) || node.value !== true) {
      errors.push(`${name}:${at(node ?? pair.key)}: removed must be true`);
    }
    return true;
  }

  function takeSee(map) {
    const pair = yamlPair(map, "see");
    if (!pair) return [];
    if (!isSeq(pair.value)) {
      errors.push(`${name}:${at(pair.value ?? pair.key)}: see must be a list`);
      return [];
    }
    if (pair.value.items.length === 0) {
      errors.push(`${name}:${at(pair.value)}: see must name an id`);
      return [];
    }
    const ids = [];
    const seeRe = new RegExp(`^${PART}(?:\\.${PART}){1,2}$`);
    for (const item of pair.value.items) {
      if (!isScalar(item) || item.type !== "QUOTE_DOUBLE" || typeof item.value !== "string" || !seeRe.test(item.value)) {
        errors.push(`${name}:${at(item)}: see id must be a double-quoted requirement id`);
        continue;
      }
      ids.push(item.value);
    }
    return ids;
  }

  function takeManual(map) {
    const pair = yamlPair(map, "check");
    if (!pair) return false;
    if (!isScalar(pair.value) || pair.value.value !== "manual") {
      errors.push(`${name}:${at(pair.value ?? pair.key)}: check must be manual`);
      return false;
    }
    return true;
  }

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

  function takeId(map, key) {
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
    if (!node.value || node.value !== node.value.trim() || node.value.includes("\n")) {
      errors.push(`${name}:${at(node)}: ${key} must be an id`);
      return null;
    }
    return { text: node.value, line: at(node) };
  }

  rejectUnknown(root, new Set(["id", "title", "requirements"]));
  const idField = takeId(root, "id");
  takeString(root, "title");
  if (idField && idField.text !== categoryId) {
    errors.push(`${name}:${idField.line}: ${idField.text} does not match file category ${categoryId}`);
  } else if (idField) {
    addReq(idField.text, idField.line, { kind: "topic" });
  }

  const requirementsPair = yamlPair(root, "requirements");
  if (!requirementsPair) {
    errors.push(`${name}:${at(root)}: missing requirements`);
  } else if (!isSeq(requirementsPair.value)) {
    errors.push(`${name}:${at(requirementsPair.value)}: requirements must be a list`);
  } else {
    for (const item of requirementsPair.value.items) {
      if (!isMap(item)) {
        errors.push(`${name}:${at(item)}: requirement must be a mapping`);
        continue;
      }
      if (isRemoved(item)) {
        rejectUnknown(item, new Set(["id", "removed"]));
        const removedId = takeId(item, "id");
        const removedOk = removedId && yamlChildId(categoryId).test(removedId.text);
        if (removedId && !removedOk) {
          errors.push(`${name}:${removedId.line}: ${removedId.text} is outside category ${categoryId}`);
        } else if (removedId) {
          addReq(removedId.text, removedId.line, { kind: "removed" });
        }
        continue;
      }
      rejectUnknown(item, new Set(["id", "type", "text", "details", "see"]));
      const reqId = takeId(item, "id");
      const typePair = yamlPair(item, "type");
      if (!typePair) {
        errors.push(`${name}:${at(item)}: missing type`);
      } else if (!isScalar(typePair.value) || !YAML_TYPES.has(typePair.value.value)) {
        errors.push(
          `${name}:${at(typePair.value ?? typePair.key)}: type must be functional, non-functional, or system`,
        );
      }
      const reqText = takeString(item, "text");
      const reqSee = takeSee(item);
      const reqOk = reqId && yamlChildId(categoryId).test(reqId.text);
      if (reqId && !reqOk) {
        errors.push(`${name}:${reqId.line}: ${reqId.text} is outside category ${categoryId}`);
      } else if (reqId) {
        addReq(reqId.text, reqId.line, {
          kind: "requirement",
          text: reqText ? reqText.text : null,
          see: reqSee,
        });
      }

      const detailsPair = yamlPair(item, "details");
      if (!detailsPair) {
        errors.push(`${name}:${at(item)}: missing details`);
        continue;
      }
      if (!isSeq(detailsPair.value)) {
        errors.push(`${name}:${at(detailsPair.value)}: details must be a list`);
        continue;
      }
      for (const detail of detailsPair.value.items) {
        if (!isMap(detail)) {
          errors.push(`${name}:${at(detail)}: detail must be a mapping`);
          continue;
        }
        if (isRemoved(detail)) {
          rejectUnknown(detail, new Set(["id", "removed"]));
          const removedId = takeId(detail, "id");
          const parentId = reqOk ? reqId.text : null;
          const removedOk = removedId && parentId && yamlChildId(parentId).test(removedId.text);
          if (removedId && !removedOk) {
            const why = parentId
              ? `${removedId.text} is not under ${parentId}`
              : `${removedId.text} is outside category ${categoryId}`;
            errors.push(`${name}:${removedId.line}: ${why}`);
          } else if (removedId) {
            addReq(removedId.text, removedId.line, { kind: "removed" });
          }
          continue;
        }
        rejectUnknown(detail, new Set(["id", "text", "implemented", "check", "see"]));
        const detailId = takeId(detail, "id");
        const detailText = takeString(detail, "text");
        const detailSee = takeSee(detail);
        const manual = takeManual(detail);
        const implementedPair = yamlPair(detail, "implemented");
        let status = "Implemented";
        let implementedFalse = false;
        let skipCoverage = false;
        if (implementedPair) {
          const value = isScalar(implementedPair.value) ? implementedPair.value.value : null;
          if (value !== true && value !== false) {
            const where = implementedPair.value ?? implementedPair.key;
            errors.push(`${name}:${at(where)}: implemented must be true or false`);
            status = null;
            skipCoverage = true;
          } else if (value === false) {
            status = null;
            implementedFalse = true;
          }
        }
        const parentId = reqOk ? reqId.text : null;
        const detailOk = detailId && parentId && yamlChildId(parentId).test(detailId.text);
        if (detailId && !detailOk) {
          const why = parentId
            ? `${detailId.text} is not under ${parentId}`
            : `${detailId.text} is outside category ${categoryId}`;
          errors.push(`${name}:${detailId.line}: ${why}`);
        } else if (detailId) {
          addReq(detailId.text, detailId.line, {
            kind: "detail",
            text: detailText ? detailText.text : null,
            status,
            manual,
            see: detailSee,
            implementedFalse,
            skipCoverage,
          });
        }
      }
    }
  }

  errors.push(...validateAgainstSchema(doc.toJS(), name));
  return { errors, reqs };
}

function check({ requirementFiles, testFiles, scriptFiles, decisionFiles = [] }) {
  const errors = [];
  const byId = new Map();
  let indexReady = true;
  const files = [...requirementFiles].sort((a, b) => a.name.localeCompare(b.name));

  for (const file of files) {
    if (file.name === "README.md" || file.name === "index.md") continue;
    if (!file.name.endsWith(".yaml")) {
      if (file.name.endsWith(".md")) {
        errors.push(`${file.name}: topic files are YAML, named like 1-mcp.yaml`);
      }
      continue;
    }
    const parsed = parseYamlCategory(file.name, file.text);
    if (parsed.errors.length > 0) indexReady = false;
    errors.push(...parsed.errors);
    for (const req of parsed.reqs) {
      const prior = byId.get(req.id);
      if (prior) {
        errors.push(`${req.file}:${req.line}: duplicate id ${req.id} (also ${prior.file}:${prior.line})`);
        continue;
      }
      byId.set(req.id, req);
    }
  }

  const referenced = new Map();
  const detailTests = new Map();

  function note(id, where) {
    if (!referenced.has(id)) referenced.set(id, where);
  }

  function noteDetail(id, where) {
    const list = detailTests.get(id) ?? [];
    list.push(where);
    detailTests.set(id, list);
    note(id, where);
  }

  const tests = [...testFiles].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of tests) {
    const text = file.text.replace(/\r\n/g, "\n");
    const scanned = scanIds(text);
    for (const id of scanned.ids) note(id, file.name);
    for (const id of scanned.invalid) errors.push(`invalid id ${id} in ${file.name}`);
    for (const call of evidenceFromTests(text)) {
      for (const id of call.reqIds) noteDetail(id, file.name);
    }
  }

  const scripts = [...scriptFiles].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of scripts) {
    const scanned = scanIds(file.text);
    for (const id of scanned.ids) note(id, file.name);
    for (const id of scanned.invalid) errors.push(`invalid id ${id} in ${file.name}`);
  }

  for (const [id, where] of [...referenced.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!byId.has(id)) errors.push(`unknown id ${id} in ${where}`);
  }

  function yamlCover(req) {
    const named = detailTests.get(req.id) ?? [];
    if (req.skipCoverage) return;
    if (req.kind === "topic" || req.kind === "requirement") {
      if (named.length > 0) errors.push(`${req.file}:${req.line}: req:${req.id} is not a detail`);
      return;
    }
    if (req.kind === "removed") {
      if (named.length > 0) errors.push(`${req.file}:${req.line}: ${req.id} is removed and is named in a test`);
      return;
    }
    if (req.kind !== "detail") return;
    if (req.implementedFalse && req.manual) {
      errors.push(`${req.file}:${req.line}: ${req.id} is implemented: false and uses check: manual`);
    }
    if (req.implementedFalse) {
      if (named.length > 0) {
        errors.push(`${req.file}:${req.line}: ${req.id} is implemented: false and is named in a test`);
      }
      return;
    }
    if (req.manual) {
      if (named.length > 0) {
        errors.push(`${req.file}:${req.line}: ${req.id} uses check: manual and is named in a test`);
      }
      return;
    }
    if (named.length === 0) {
      errors.push(`${req.file}:${req.line}: ${req.id} (Implemented) has no test that names req:${req.id}`);
    }
    if (named.length > 1) {
      errors.push(`${req.file}:${req.line}: ${req.id} is named in more than one test`);
    }
  }

  for (const req of byId.values()) {
    yamlCover(req);
    for (const target of req.see ?? []) {
      if (target === req.id) {
        errors.push(`${req.file}:${req.line}: ${req.id} see itself`);
        continue;
      }
      const other = byId.get(target);
      if (!other) errors.push(`${req.file}:${req.line}: ${req.id} see ${target} is unknown`);
      else if (other.kind === "removed") {
        errors.push(`${req.file}:${req.line}: ${req.id} see ${target} is removed`);
      }
    }
  }

  const decisions = [...decisionFiles].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of decisions) {
    errors.push(...decisionIdErrors(file.name, file.text));
    errors.push(...decisionNumericIdErrors(file.name, file.text, byId));
  }

  return {
    errors,
    ids: [...byId.keys()].sort(),
    entries: [...byId.values()].filter((req) => req.file.endsWith(".yaml")),
    indexReady,
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

function runCanary() {
  const failures = [];

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

  pass("empty", { requirementFiles: [], testFiles: [], scriptFiles: [] }, []);
  pass(
    "readme is not a category",
    {
      requirementFiles: [{ name: "README.md", text: "# F3 Meals\n\nStatus: Implemented\n" }],
      testFiles: [],
      scriptFiles: [],
    },
    [],
  );
  fail(
    "markdown topic file",
    { requirementFiles: [{ name: "F3-meals.md", text: "# F3 Meals\n" }], testFiles: [], scriptFiles: [] },
    "topic files are YAML",
  );
  pass(
    "adr without an id",
    {
      requirementFiles: [],
      testFiles: [],
      scriptFiles: [],
      decisionFiles: [
        {
          name: "docs/decisions/0001-choice.md",
          text: "# Choice\n\n* Status: accepted\n\nStore meals in one place. Requirements stay in the requirements docs.\n",
        },
      ],
    },
    [],
  );
  fail(
    "adr cites an id",
    {
      requirementFiles: [],
      testFiles: [],
      scriptFiles: [],
      decisionFiles: [
        {
          name: "docs/decisions/0001-choice.md",
          text: "# Choice\n\n* Status: accepted\n\nSave a meal (F3.2).\n",
        },
      ],
    },
    "docs/decisions/0001-choice.md: cites requirement id F3.2",
  );
  fail(
    "letter id in a test is unknown",
    {
      requirementFiles: [],
      testFiles: [{ name: "save.test.ts", text: "// see F3.2 later\n" }],
      scriptFiles: [],
    },
    "unknown id F3.2 in save.test.ts",
  );

  const yamlProposed = [
    'id: "1"',
    "title: MCP",
    "requirements:",
    '  - id: "1.1"',
    "    type: functional",
    "    text: Agents can read a recipe.",
    "    details:",
    '      - id: "1.1.1"',
    "        text: Given a deleted recipe, the agent does not receive it.",
    "        implemented: false",
    '      - id: "1.1.2"',
    "        text: Given a recipe, the agent receives its title.",
    "        implemented: false",
    "",
  ].join("\n");
  const yamlImplemented = yamlProposed.replaceAll("        implemented: false\n", "");
  const yamlFile = (text) => [{ name: "1-mcp.yaml", text }];

  pass("yaml unimplemented needs no test", { requirementFiles: yamlFile(yamlProposed), testFiles: [], scriptFiles: [] }, [
    "1",
    "1.1",
    "1.1.1",
    "1.1.2",
  ]);
  pass(
    "yaml one test can name several details",
    {
      requirementFiles: yamlFile(yamlImplemented),
      testFiles: [{ name: "read.test.ts", text: 'it("req:1.1.1 and req:1.1.2 read", () => {});\n' }],
      scriptFiles: [],
    },
    ["1", "1.1", "1.1.1", "1.1.2"],
  );
  fail(
    "yaml file name",
    { requirementFiles: [{ name: "notes.yaml", text: "id: 1\n" }], testFiles: [], scriptFiles: [] },
    "topic file name must look like 1-mcp.yaml",
  );
  fail(
    "yaml letter id file name",
    { requirementFiles: [{ name: "F1-mcp.yaml", text: "id: 1\n" }], testFiles: [], scriptFiles: [] },
    "topic file name must look like 1-mcp.yaml",
  );
  fail(
    "yaml implemented detail needs a test",
    { requirementFiles: yamlFile(yamlImplemented), testFiles: [], scriptFiles: [] },
    "1.1.1 (Implemented) has no test that names req:1.1.1",
  );
  fail(
    "yaml requirement id is not a detail",
    {
      requirementFiles: yamlFile(yamlImplemented),
      testFiles: [{ name: "read.test.ts", text: 'it("req:1.1 reads", () => {});\n' }],
      scriptFiles: [],
    },
    "is not a detail",
  );
  fail(
    "yaml id in the test body does not count",
    {
      requirementFiles: yamlFile(yamlImplemented),
      testFiles: [{ name: "read.test.ts", text: 'it("reads", () => {\n  const id = "1.1.1";\n});\n' }],
      scriptFiles: [],
    },
    "1.1.1 (Implemented) has no test that names req:1.1.1",
  );
  fail(
    "yaml script mention does not cover a detail",
    {
      requirementFiles: yamlFile(yamlImplemented),
      testFiles: [],
      scriptFiles: [{ name: "scripts/smoke.sh", text: "# 1.1.1\n" }],
    },
    "1.1.1 (Implemented) has no test that names req:1.1.1",
  );
  fail(
    "yaml implemented true still needs a test",
    {
      requirementFiles: yamlFile(yamlProposed.replaceAll("implemented: false", "implemented: true")),
      testFiles: [],
      scriptFiles: [],
    },
    "1.1.1 (Implemented) has no test that names req:1.1.1",
  );
  fail(
    "yaml proposed key",
    {
      requirementFiles: yamlFile(yamlProposed.replaceAll("implemented: false", "proposed: true")),
      testFiles: [],
      scriptFiles: [],
    },
    "unknown key proposed",
  );
  fail(
    "yaml missing type",
    {
      requirementFiles: yamlFile(yamlProposed.replace("    type: functional\n", "")),
      testFiles: [],
      scriptFiles: [],
    },
    "missing type",
  );
  fail(
    "yaml flow style",
    {
      requirementFiles: yamlFile(
        [
          "id: 1",
          "title: MCP",
          'requirements: [{id: "1.1", type: functional, text: Agents can read a recipe., details: [{id: "1.1.1", text: Given a deleted recipe, the agent does not receive it., implemented: false}]}]',
          "",
        ].join("\n"),
      ),
      testFiles: [],
      scriptFiles: [],
    },
    "not flow style",
  );
  fail(
    "yaml category mismatch",
    {
      requirementFiles: yamlFile(yamlProposed.replace('id: "1"\n', 'id: "2"\n')),
      testFiles: [],
      scriptFiles: [],
    },
    "2 does not match file category 1",
  );
  fail(
    "yaml id in a decision",
    {
      requirementFiles: yamlFile(yamlProposed),
      testFiles: [],
      scriptFiles: [],
      decisionFiles: [{ name: "docs/decisions/0001-choice.md", text: "See 1.1.1.\n" }],
    },
    "cites requirement id 1.1.1",
  );
  pass(
    "wcag version is not a requirement id",
    {
      requirementFiles: yamlFile(yamlProposed),
      testFiles: [],
      scriptFiles: [],
      decisionFiles: [{ name: "docs/decisions/0016-kitchen-ui.md", text: "The floor is WCAG 2.2 AA.\n" }],
    },
    ["1", "1.1", "1.1.1", "1.1.2"],
  );
  pass(
    "yaml text may contain more than one period",
    {
      requirementFiles: yamlFile(
        yamlProposed.replace(
          "Given a deleted recipe, the agent does not receive it.",
          "Given a deleted recipe, the agent does not receive it. The row stays.",
        ),
      ),
      testFiles: [],
      scriptFiles: [],
    },
    ["1", "1.1", "1.1.1", "1.1.2"],
  );
  pass(
    "index is not a category",
    {
      requirementFiles: [{ name: "index.md", text: "1.1 Agents can read.\n" }],
      testFiles: [],
      scriptFiles: [],
    },
    [],
  );
  const yamlGap = [
    'id: "1"',
    "title: MCP",
    "requirements:",
    '  - id: "1.1"',
    "    type: functional",
    "    text: Agents can read a recipe.",
    "    details:",
    '      - id: "1.1.1"',
    "        text: Given a recipe, the agent receives its title.",
    "        implemented: false",
    '  - id: "1.3"',
    "    removed: true",
    "",
  ].join("\n");
  pass(
    "yaml ids may gap and a removed marker keeps its number",
    { requirementFiles: yamlFile(yamlGap), testFiles: [], scriptFiles: [] },
    ["1", "1.1", "1.1.1", "1.3"],
  );
  fail(
    "yaml removed id in a test",
    {
      requirementFiles: yamlFile(yamlGap),
      testFiles: [{ name: "read.test.ts", text: 'it("req:1.3 stays", () => {});\n' }],
      scriptFiles: [],
    },
    "is removed and is named in a test",
  );
  pass(
    "yaml quoted 1.10 keeps its id",
    {
      requirementFiles: yamlFile(
        [
          'id: "1"',
          "title: Ten",
          "requirements:",
          '  - id: "1.10"',
          "    type: system",
          "    text: Agents can reach the tenth requirement.",
          "    details:",
          '      - id: "1.10.1"',
          "        text: Given a call, the agent is told the tenth detail.",
          "        implemented: false",
          "",
        ].join("\n"),
      ),
      testFiles: [],
      scriptFiles: [],
    },
    ["1", "1.10", "1.10.1"],
  );
  fail(
    "yaml unquoted id",
    {
      requirementFiles: yamlFile(yamlProposed.replace('id: "1.1"\n', "id: 1.1\n")),
      testFiles: [],
      scriptFiles: [],
    },
    "double-quoted",
  );
  fail(
    "yaml implemented false already has a test",
    {
      requirementFiles: yamlFile(yamlProposed),
      testFiles: [{ name: "read.test.ts", text: 'it("req:1.1.1 reads", () => {});\n' }],
      scriptFiles: [],
    },
    "implemented: false and is named in a test",
  );
  fail(
    "yaml detail named in two tests",
    {
      requirementFiles: yamlFile(yamlImplemented),
      testFiles: [
        {
          name: "read.test.ts",
          text: 'it("req:1.1.1 reads", () => {});\nit("req:1.1.1 again", () => {});\nit("req:1.1.2 reads", () => {});\n',
        },
      ],
      scriptFiles: [],
    },
    "named in more than one test",
  );
  fail(
    "yaml bare id in a title does not count",
    {
      requirementFiles: yamlFile(yamlImplemented),
      testFiles: [{ name: "read.test.ts", text: 'it("1.1.1 and 1.1.2 read", () => {});\n' }],
      scriptFiles: [],
    },
    "has no test that names req:1.1.1",
  );
  fail(
    "yaml skipped test does not count",
    {
      requirementFiles: yamlFile(yamlImplemented),
      testFiles: [
        {
          name: "read.test.ts",
          text: 'test.skip("req:1.1.1 reads", () => {});\nit.todo("req:1.1.2 later");\n',
        },
      ],
      scriptFiles: [],
    },
    "has no test that names req:1.1.1",
  );
  fail(
    "yaml describe.skip does not count",
    {
      requirementFiles: yamlFile(yamlImplemented),
      testFiles: [
        {
          name: "read.test.ts",
          text: 'describe.skip("suite", () => { it("req:1.1.1 reads", () => {}); });\n',
        },
      ],
      scriptFiles: [],
    },
    "has no test that names req:1.1.1",
  );
  fail(
    "yaml unknown req id",
    {
      requirementFiles: yamlFile(yamlProposed),
      testFiles: [{ name: "read.test.ts", text: 'it("req:9.9.9 missing", () => {});\n' }],
      scriptFiles: [],
    },
    "unknown id 9.9.9",
  );
  const yamlManual = yamlProposed.replace(
    '      - id: "1.1.2"\n        text: Given a recipe, the agent receives its title.\n        implemented: false\n',
    '      - id: "1.1.2"\n        text: Given a NAS boot, the documented token is rejected.\n        check: manual\n',
  );
  pass("yaml check manual needs no test", { requirementFiles: yamlFile(yamlManual), testFiles: [], scriptFiles: [] }, [
    "1",
    "1.1",
    "1.1.1",
    "1.1.2",
  ]);
  fail(
    "yaml check manual with a test",
    {
      requirementFiles: yamlFile(yamlManual),
      testFiles: [{ name: "read.test.ts", text: 'it("req:1.1.2 rejects the token", () => {});\n' }],
      scriptFiles: [],
    },
    "uses check: manual and is named in a test",
  );
  fail(
    "yaml implemented false cannot use check manual",
    {
      requirementFiles: yamlFile(
        yamlProposed.replace(
          '      - id: "1.1.2"\n        text: Given a recipe, the agent receives its title.\n        implemented: false\n',
          '      - id: "1.1.2"\n        text: Given a NAS boot, the documented token is rejected.\n        implemented: false\n        check: manual\n',
        ),
      ),
      testFiles: [],
      scriptFiles: [],
    },
    "implemented: false and uses check: manual",
  );
  pass(
    "yaml see names another id",
    {
      requirementFiles: yamlFile(
        yamlProposed.replace(
          '      - id: "1.1.2"\n        text: Given a recipe, the agent receives its title.\n        implemented: false\n',
          '      - id: "1.1.2"\n        text: Given a recipe, the agent receives its title.\n        implemented: false\n        see:\n          - "1.1.1"\n',
        ),
      ),
      testFiles: [],
      scriptFiles: [],
    },
    ["1", "1.1", "1.1.1", "1.1.2"],
  );
  fail(
    "yaml see target must exist",
    {
      requirementFiles: yamlFile(
        yamlProposed.replace(
          '      - id: "1.1.2"\n        text: Given a recipe, the agent receives its title.\n        implemented: false\n',
          '      - id: "1.1.2"\n        text: Given a recipe, the agent receives its title.\n        implemented: false\n        see:\n          - "9.9"\n',
        ),
      ),
      testFiles: [],
      scriptFiles: [],
    },
    "see 9.9 is unknown",
  );

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

function isScriptMention(filePath) {
  if (path.resolve(filePath) === SELF) return false;
  const relative = path.relative(ROOT, filePath);
  if (!relative.startsWith(`scripts${path.sep}`)) return false;
  return /\.(?:sh|mjs|js|cjs)$/.test(filePath);
}

async function loadRepo() {
  const requirementNames = (await readdir(REQUIREMENTS_DIR))
    .filter((name) => name.endsWith(".md") || name.endsWith(".yaml"))
    .sort();
  const requirementFiles = [];
  for (const name of requirementNames) {
    requirementFiles.push({
      name,
      text: await readFile(path.join(REQUIREMENTS_DIR, name), "utf8"),
    });
  }

  const testFiles = [];
  const scriptFiles = [];
  await walk(ROOT, async (full) => {
    const name = path.relative(ROOT, full);
    if (isTestFile(full)) {
      testFiles.push({ name, text: await readFile(full, "utf8") });
    } else if (isScriptMention(full)) {
      scriptFiles.push({ name, text: await readFile(full, "utf8") });
    }
  });

  if (scriptFiles.some((file) => path.resolve(ROOT, file.name) === SELF)) {
    throw new Error("requirements checker scanned itself");
  }

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

  return { requirementFiles, testFiles, scriptFiles, decisionFiles };
}

function report(header, lines) {
  console.error([header, ...lines.map((line) => `  ${line}`)].join("\n"));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SELF;
if (isMain) {
  const canary = runCanary();
  if (canary.length > 0) {
    report("requirements canary failed:", canary);
    process.exit(1);
  }
  const result = check(await loadRepo());
  if (result.indexReady) {
    const index = renderIndex(result.entries);
    if (process.argv.includes("--write-index")) {
      await writeFile(INDEX_PATH, index);
    } else {
      let current = "";
      try {
        current = await readFile(INDEX_PATH, "utf8");
      } catch {
        current = "";
      }
      if (current !== index) result.errors.push("docs/requirements/index.md is stale. Run pnpm requirements:index");
    }
  }
  if (result.errors.length > 0) {
    report("requirements:", result.errors);
    process.exit(1);
  }
  const count = result.ids.length;
  console.log(count === 0 ? "requirements ok" : `requirements ok (${count} ids)`);
}

#!/usr/bin/env node

// Requirement ID check. Policy is CONTRIBUTING.md. File shape is docs/requirements/README.md.
// A topic is a heading. A requirement is one sentence. A detail is a dash item.
// [Proposed] is allowed only on a detail, and that detail needs no test.
// Fixture IDs stay in this file. The reference scan does not read it.
// Markdown under docs/decisions is scanned for requirement IDs. Other docs are not.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = path.join(ROOT, "scripts", "requirements.mjs");
const REQUIREMENTS_DIR = path.join(ROOT, "docs", "requirements");
const DECISIONS_DIR = path.join(ROOT, "docs", "decisions");

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage"]);

const PART = "[1-9][0-9]*";
const ID_SOURCE = `[FNS]${PART}(?:\\.${PART}){0,2}`;
const TOKEN_RE = new RegExp(`(?<![A-Za-z0-9.])${ID_SOURCE}(?![A-Za-z0-9.])`, "g");
const OVERLONG_RE = new RegExp(`(?<![A-Za-z0-9.])[FNS]${PART}(?:\\.${PART}){3,}(?![A-Za-z0-9.])`, "g");
const FILE_RE = new RegExp(`^([FNS]${PART})-[a-z0-9]+(?:-[a-z0-9]+)*\\.md$`);
const TOPIC_ID_RE = new RegExp(`^[FNS]${PART}$`);
const REQ_ID_RE = new RegExp(`^[FNS]${PART}\\.${PART}$`);
const DETAIL_ID_RE = new RegExp(`^[FNS]${PART}\\.${PART}\\.${PART}$`);
const SENTENCE_RE = /^[^.!?]+[.!?]$/;
const TEST_CALL_RE =
  /(?:^|\n)[ \t]*(?:await\s+)?(?:[A-Za-z_$][\w$]*\.)?(?:it|test)(?![A-Za-z0-9_$])(?:\.(skip|only|todo))?\s*\(\s*(?:\n[ \t]*)?(['"`])([^'"`\n]*)\2/g;
const DESCRIBE_CALL_RE =
  /(?:^|\n)[ \t]*(?:await\s+)?(?:[A-Za-z_$][\w$]*\.)?describe(?![A-Za-z0-9_$])(?:\.(skip|only|todo))?\s*\(\s*(?:\n[ \t]*)?(['"`])([^'"`\n]*)\2/g;

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

function scanBraces(text, open) {
  let i = open + 1;
  let depth = 1;
  let quote = null;
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
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

function callbackBodyRange(text, index) {
  let i = skipTrivia(text, index);
  if (text[i] === ",") {
    i = skipTrivia(text, i + 1);
    if (text[i] === "{") {
      const close = scanBraces(text, i);
      if (close < 0) return { start: -1, end: -1 };
      i = skipTrivia(text, close + 1);
    }
  }
  const n = text.length;
  while (i < n && text[i] !== "{") {
    const c = text[i];
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
      const q = c;
      i += 1;
      while (i < n && text[i] !== q) {
        if (text[i] === "\\") i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  if (text[i] !== "{") return { start: -1, end: -1 };
  const end = scanBraces(text, i);
  if (end < 0) return { start: -1, end: -1 };
  return { start: i, end };
}

function analyzeTests(text) {
  const masked = maskInactiveRegions(text);
  const describes = [];
  DESCRIBE_CALL_RE.lastIndex = 0;
  for (const call of masked.matchAll(DESCRIBE_CALL_RE)) {
    const end = call.index + call[0].length;
    const skipped = call[1] === "skip" || call[1] === "todo" || followingOptionsSkip(masked, end);
    const body = callbackBodyRange(masked, end);
    describes.push({
      skipped,
      start: body.start,
      end: body.end,
      ids: scanIds(call[3]).ids,
    });
  }

  const tests = [];
  TEST_CALL_RE.lastIndex = 0;
  for (const call of masked.matchAll(TEST_CALL_RE)) {
    const end = call.index + call[0].length;
    let skipped = call[1] === "skip" || call[1] === "todo" || followingOptionsSkip(masked, end);
    const inside = [];
    for (const block of describes) {
      if (block.start < 0 || call.index <= block.start || call.index >= block.end) continue;
      inside.push(block);
      if (block.skipped) skipped = true;
    }
    tests.push({ skipped, ids: scanIds(call[3]).ids, inside });
  }
  return { describes, tests };
}

function parentOf(id) {
  const dot = id.lastIndexOf(".");
  return dot === -1 ? null : id.slice(0, dot);
}

function checkContiguous(name, reqs, errors) {
  const children = new Map();
  for (const req of reqs) {
    const parent = parentOf(req.id);
    if (!parent) continue;
    const segment = Number(req.id.slice(parent.length + 1));
    let segments = children.get(parent);
    if (!segments) {
      segments = new Set();
      children.set(parent, segments);
    }
    segments.add(segment);
  }
  for (const [parent, segments] of children) {
    const nums = [...segments].sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i += 1) {
      if (nums[i] !== i + 1) {
        errors.push(`${name}: ${parent} skips ${parent}.${i + 1}`);
        break;
      }
    }
  }
}

function scanIds(text) {
  TOKEN_RE.lastIndex = 0;
  OVERLONG_RE.lastIndex = 0;
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

function idShape(token) {
  if (TOPIC_ID_RE.test(token)) return "topic";
  if (REQ_ID_RE.test(token)) return "requirement";
  if (DETAIL_ID_RE.test(token)) return "detail";
  if (/^[FNS][0-9]/.test(token)) return "invalid";
  return null;
}

function oneSentence(text) {
  return SENTENCE_RE.test(text);
}

function parseTagBlock(rest) {
  const match = /((?:\s+\[[A-Za-z]+\])+)\s*$/.exec(rest);
  if (!match) return { sentence: rest.trim(), tags: [] };
  const tags = [...match[1].matchAll(/\[([A-Za-z]+)\]/g)].map((item) => item[1]);
  return { sentence: rest.slice(0, match.index).trim(), tags };
}

function hasRetired(line) {
  return /Status:\s*Retired\b/i.test(line) || /\[Retired\]/.test(line);
}

function parseTopic(name, text) {
  const errors = [];
  const fileMatch = FILE_RE.exec(name);
  if (!fileMatch) {
    return { errors: [`${name}: topic file name must look like F3-slug.md`], reqs: [] };
  }

  const topicId = fileMatch[1];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const reqs = [];
  const seen = new Set();
  let fence = false;

  function record(id, lineNo, kind, proposed) {
    if (seen.has(id)) {
      errors.push(`${name}:${lineNo}: duplicate id ${id}`);
      return;
    }
    const parent = parentOf(id);
    if (parent && !seen.has(parent)) {
      errors.push(`${name}:${lineNo}: ${id} is missing parent ${parent}`);
    }
    seen.add(id);
    reqs.push({ id, line: lineNo, file: name, kind, proposed: Boolean(proposed) });
  }

  function inTopic(id) {
    return id === topicId || id.startsWith(`${topicId}.`);
  }

  function markerError(lineNo, id, tags, allowProposed) {
    if (allowProposed && tags.length === 1 && tags[0] === "Proposed") return true;
    for (const tag of tags) {
      errors.push(
        tag === "Retired"
          ? `${name}:${lineNo}: Retired is not a status`
          : `${name}:${lineNo}: ${id} [${tag}] is not allowed`,
      );
    }
    return false;
  }

  function markersOf(sentence, tags) {
    const inline = [...sentence.matchAll(/\[([A-Za-z]+)\]/g)].map((item) => item[1]);
    return [...inline, ...tags];
  }

  function parseHeading(lineNo, rest) {
    const parts = /^(\S+)(?:\s+(\S.*))?$/.exec(rest);
    const token = parts[1];
    const title = parts[2] ? parts[2].trim() : "";
    const shape = idShape(token);
    if (shape === "requirement") {
      errors.push(`${name}:${lineNo}: ${token} is a sentence line, not a heading`);
      return;
    }
    if (shape === "detail") {
      errors.push(`${name}:${lineNo}: ${token} is a list item, not a heading`);
      return;
    }
    if (shape === "invalid") {
      errors.push(`${name}:${lineNo}: ${token} is not a valid id`);
      return;
    }
    if (shape !== "topic") return;
    if (!title) {
      errors.push(`${name}:${lineNo}: ${token} heading needs a title`);
      return;
    }
    if (token !== topicId) {
      errors.push(`${name}:${lineNo}: ${token} does not match file topic ${topicId}`);
      return;
    }
    if (/\[[A-Za-z]+\]/.test(title) || /Status:/i.test(title)) {
      errors.push(`${name}:${lineNo}: ${token} topic is a heading only`);
      return;
    }
    record(token, lineNo, "topic", false);
  }

  function parseDetail(lineNo, rest) {
    const parts = /^([FNS][0-9][0-9A-Za-z.]*)(?:\s+(\S.*))?$/.exec(rest);
    if (!parts) return;
    const token = parts[1];
    const body = parts[2] ? parts[2].trim() : "";
    const shape = idShape(token);
    if (shape === "invalid") {
      errors.push(`${name}:${lineNo}: ${token} is not a valid id`);
      return;
    }
    if (shape === "topic") {
      errors.push(`${name}:${lineNo}: ${token} is a heading, not a list item`);
      return;
    }
    if (shape === "requirement") {
      errors.push(`${name}:${lineNo}: ${token} is a sentence line, not a list item`);
      return;
    }
    if (shape !== "detail") return;
    if (!inTopic(token)) {
      errors.push(`${name}:${lineNo}: ${token} is outside topic ${topicId}`);
      return;
    }
    const parsed = parseTagBlock(body);
    if (!oneSentence(parsed.sentence)) errors.push(`${name}:${lineNo}: ${token} must be one sentence`);
    const proposed = markerError(lineNo, token, markersOf(parsed.sentence, parsed.tags), true);
    record(token, lineNo, "detail", proposed);
  }

  function parseIdLine(lineNo, line) {
    const parts = /^([FNS][0-9][0-9A-Za-z.]*)(?:\s+(\S.*))?$/.exec(line);
    const token = parts[1];
    const body = parts[2] ? parts[2].trim() : "";
    const shape = idShape(token);
    if (shape === "invalid") {
      errors.push(`${name}:${lineNo}: ${token} is not a valid id`);
      return;
    }
    if (shape === "topic") {
      errors.push(`${name}:${lineNo}: ${token} is a heading, not a sentence`);
      return;
    }
    if (shape === "detail") {
      errors.push(`${name}:${lineNo}: ${token} is a list item, not a sentence`);
      return;
    }
    if (shape !== "requirement") return;
    if (!inTopic(token)) {
      errors.push(`${name}:${lineNo}: ${token} is outside topic ${topicId}`);
      return;
    }
    const parsed = parseTagBlock(body);
    if (!oneSentence(parsed.sentence)) errors.push(`${name}:${lineNo}: ${token} must be one sentence`);
    markerError(lineNo, token, markersOf(parsed.sentence, parsed.tags), false);
    record(token, lineNo, "requirement", false);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const line = lines[index].trim();
    if (line.startsWith("```")) {
      fence = !fence;
      if (hasRetired(line)) errors.push(`${name}:${lineNo}: Retired is not a status`);
      continue;
    }
    if (hasRetired(line)) {
      errors.push(`${name}:${lineNo}: Retired is not a status`);
      continue;
    }
    if (fence || line === "") continue;
    if (/^Status:/i.test(line)) {
      errors.push(`${name}:${lineNo}: status is not used`);
      continue;
    }
    if (/^Check:/i.test(line)) {
      errors.push(`${name}:${lineNo}: Check is not used`);
      continue;
    }

    const heading = /^(#{1,6})\s+(\S.*)$/.exec(line);
    if (heading) {
      parseHeading(lineNo, heading[2]);
      continue;
    }

    const item = /^-\s+(\S.*)$/.exec(line);
    if (item && /^[FNS][0-9]/.test(item[1])) {
      parseDetail(lineNo, item[1]);
      continue;
    }

    if (/^[FNS][0-9]/.test(line)) parseIdLine(lineNo, line);
  }

  if (fence) errors.push(`${name}: unclosed code fence`);
  if (!seen.has(topicId)) errors.push(`${name}: missing topic heading for ${topicId}`);
  checkContiguous(name, reqs, errors);
  return { errors, reqs };
}

function check({ requirementFiles, testFiles, scriptFiles, decisionFiles = [] }) {
  const errors = [];
  const byId = new Map();
  const files = [...requirementFiles].sort((a, b) => a.name.localeCompare(b.name));

  for (const file of files) {
    if (file.name === "README.md" || !file.name.endsWith(".md")) continue;
    const parsed = parseTopic(file.name, file.text);
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
  function note(id, where) {
    if (!referenced.has(id)) referenced.set(id, where);
  }

  const tests = [...testFiles].sort((a, b) => a.name.localeCompare(b.name));
  const structures = [];
  for (const file of tests) {
    const text = file.text.replace(/\r\n/g, "\n");
    const scanned = scanIds(text);
    for (const id of scanned.ids) note(id, file.name);
    for (const id of scanned.invalid) errors.push(`invalid id ${id} in ${file.name}`);
    structures.push(analyzeTests(text));
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

  const detailsOf = new Map();
  for (const req of byId.values()) {
    if (req.kind !== "detail") continue;
    const parent = parentOf(req.id);
    const list = detailsOf.get(parent);
    if (list) list.push(req);
    else detailsOf.set(parent, [req]);
  }

  function hasDescribe(id) {
    for (const structure of structures) {
      for (const block of structure.describes) {
        if (!block.skipped && block.ids.includes(id)) return true;
      }
    }
    return false;
  }

  function hasTest(id) {
    for (const structure of structures) {
      for (const test of structure.tests) {
        if (!test.skipped && test.ids.includes(id)) return true;
      }
    }
    return false;
  }

  for (const req of byId.values()) {
    if (req.kind !== "requirement") continue;
    const details = detailsOf.get(req.id) ?? [];
    const unmarked = details.filter((detail) => !detail.proposed);
    if (details.length > 0 && unmarked.length === 0) continue;
    if (!hasDescribe(req.id)) {
      errors.push(`${req.file}:${req.line}: ${req.id} has no describe`);
    }
    if (details.length === 0) {
      if (!hasTest(req.id)) errors.push(`${req.file}:${req.line}: ${req.id} has no test`);
      continue;
    }
    for (const detail of unmarked) {
      if (hasTest(detail.id)) continue;
      errors.push(`${detail.file}:${detail.line}: ${detail.id} has no test`);
    }
  }

  const decisions = [...decisionFiles].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of decisions) {
    errors.push(...decisionIdErrors(file.name, file.text));
  }

  return { errors, ids: [...byId.keys()].sort() };
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

  const meals = (body) => [{ name: "F3-meals.md", text: body }];
  const tests = (text) => [{ name: "save.test.ts", text }];
  const bare = "## F3 Meals\nF3.1 The meal is saved.\n";
  const withDetail = "## F3 Meals\nF3.1 The meal is saved.\n- F3.1.1 An empty name is rejected.\n";
  const mixed =
    "## F3 Meals\nF3.1 The meal is saved.\n- F3.1.1 Results are sorted by title.\n- F3.1.2 An empty name is rejected. [Proposed]\n";
  const allProposed =
    "## F3 Meals\nF3.1 The meal is saved.\n- F3.1.1 An empty name is rejected. [Proposed]\n- F3.1.2 A long name is rejected. [Proposed]\n";
  const covered = 'describe("F3.1 save", () => {\n  it("F3.1 saves", () => {});\n});\n';
  const detailCovered = 'describe("F3.1 save", () => {\n  it("F3.1.1 rejects an empty name", () => {});\n});\n';

  pass("empty", { requirementFiles: [], testFiles: [], scriptFiles: [] }, []);
  pass(
    "readme example is not a requirement",
    {
      requirementFiles: [
        {
          name: "README.md",
          text: [
            "# Requirements",
            "## F1 MCP",
            "F1.2 The MCP lists recipes.",
            "- F1.2.1 Results are sorted by title.",
            "- F1.2.2 An empty cookbook returns an empty list. [Proposed]",
          ].join("\n"),
        },
      ],
      testFiles: [],
      scriptFiles: [],
    },
    [],
  );
  pass("prose is not an id", { requirementFiles: meals("## F3 Meals\nSee F3.2.1 in prose.\n"), testFiles: [], scriptFiles: [] }, ["F3"]);
  pass(
    "fenced line is not an id",
    {
      requirementFiles: meals("## F3 Meals\n```md\nF9.9 The plant is saved.\n```\n"),
      testFiles: [],
      scriptFiles: [],
    },
    ["F3"],
  );
  pass("topic only needs no test", { requirementFiles: meals("## F3 Meals\n"), testFiles: [], scriptFiles: [] }, ["F3"]);
  pass(
    "level-1 topic heading counts",
    {
      requirementFiles: meals("# F3 Meals\nF3.1 The meal is kept.\n- F3.1.1 A blank name is rejected. [Proposed]\n"),
      testFiles: [],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.1.1"],
  );
  pass(
    "proposed details need no test",
    { requirementFiles: meals(allProposed), testFiles: [], scriptFiles: [] },
    ["F3", "F3.1", "F3.1.1", "F3.1.2"],
  );
  pass(
    "it title counts",
    { requirementFiles: meals(bare), testFiles: tests(covered), scriptFiles: [] },
    ["F3", "F3.1"],
  );
  pass(
    "test title counts",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  test(\'F3.1 saves\', () => {});\n});\n'),
      scriptFiles: [],
    },
    ["F3", "F3.1"],
  );
  pass(
    "a test can sit outside the describe",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {});\nit("F3.1 saves", () => {});\n'),
      scriptFiles: [],
    },
    ["F3", "F3.1"],
  );
  pass(
    "multiline title counts",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe(\n  "F3.1 save",\n  () => {\n    it(\n      "F3.1 saves",\n      () => {},\n    );\n  },\n);\n'),
      scriptFiles: [],
    },
    ["F3", "F3.1"],
  );
  pass(
    "subtest title counts",
    {
      requirementFiles: meals(bare),
      testFiles: tests(
        'describe("F3.1 save", () => {\n  test("meals", async (t) => {\n    await t.test("F3.1 saves", async () => {});\n  });\n});\n',
      ),
      scriptFiles: [],
    },
    ["F3", "F3.1"],
  );
  pass(
    "it.only counts",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  it.only("F3.1 runs", () => {});\n});\n'),
      scriptFiles: [],
    },
    ["F3", "F3.1"],
  );
  pass(
    "describe.only counts",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe.only("F3.1 save", () => {\n  it("F3.1 saves", () => {});\n});\n'),
      scriptFiles: [],
    },
    ["F3", "F3.1"],
  );
  pass(
    "an unmarked detail needs a test and a describe",
    { requirementFiles: meals(mixed), testFiles: tests(detailCovered), scriptFiles: [] },
    ["F3", "F3.1", "F3.1.1", "F3.1.2"],
  );
  pass(
    "a detail test can sit outside the describe",
    {
      requirementFiles: meals(withDetail),
      testFiles: tests('describe("F3.1 save", () => {});\nit("F3.1.1 rejects an empty name", () => {});\n'),
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.1.1"],
  );
  pass(
    "n and s ids",
    {
      requirementFiles: [
        {
          name: "N1-speed.md",
          text: "## N1 Speed\nN1.1 The list returns quickly.\n- N1.1.1 The list is small. [Proposed]\n",
        },
        { name: "S2-backup.md", text: "## S2 Backup\n" },
      ],
      testFiles: [],
      scriptFiles: [],
    },
    ["N1", "N1.1", "N1.1.1", "S2"],
  );

  fail("bad file name", { requirementFiles: [{ name: "notes.md", text: "hello\n" }], testFiles: [], scriptFiles: [] }, "topic file name must look like F3-slug.md");
  fail("bad slug", { requirementFiles: [{ name: "F3-Meals.md", text: bare }], testFiles: [], scriptFiles: [] }, "topic file name must look like F3-slug.md");
  fail("a requirement with no details needs a describe", { requirementFiles: meals(bare), testFiles: [], scriptFiles: [] }, "F3.1 has no describe");
  fail(
    "a requirement with no details needs a test",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  it("saves", () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no test",
  );
  fail(
    "a test does not replace the describe",
    { requirementFiles: meals(bare), testFiles: tests('it("F3.1 saves", () => {});\n'), scriptFiles: [] },
    "F3.1 has no describe",
  );
  fail(
    "skip does not count",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  it.skip("F3.1 skipped", () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no test",
  );
  fail(
    "todo does not count",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  it.todo("F3.1 later");\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no test",
  );
  fail(
    "body mention does not satisfy",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  const id = "F3.1";\n  it("saves", () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no test",
  );
  fail(
    "a longer id does not cover the shorter one",
    {
      requirementFiles: meals(withDetail),
      testFiles: tests('describe("F3.1.1 empty", () => {\n  it("F3.1.1 rejects an empty name", () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no describe",
  );
  fail(
    "a detail test does not replace the describe",
    {
      requirementFiles: meals(withDetail),
      testFiles: tests('it("F3.1.1 rejects an empty name", () => {});\n'),
      scriptFiles: [],
    },
    "F3.1 has no describe",
  );
  fail(
    "a missing detail test fails",
    {
      requirementFiles: meals(`${withDetail}- F3.1.2 A long name is rejected.\n`),
      testFiles: tests(detailCovered),
      scriptFiles: [],
    },
    "F3.1.2 has no test",
  );
  fail(
    "a proposed detail still needs the describe when another detail is unmarked",
    {
      requirementFiles: meals(mixed),
      testFiles: tests('it("F3.1.1 sorts by title", () => {});\n'),
      scriptFiles: [],
    },
    "F3.1 has no describe",
  );
  fail(
    "script mention does not count",
    {
      requirementFiles: meals(bare),
      testFiles: [],
      scriptFiles: [{ name: "scripts/smoke.sh", text: "# checks F3.1\n" }],
    },
    "F3.1 has no describe",
  );
  fail(
    "script mention does not cover a detail",
    {
      requirementFiles: meals(withDetail),
      testFiles: tests('describe("F3.1 save", () => {});\n'),
      scriptFiles: [{ name: "scripts/smoke.sh", text: "# checks F3.1.1\n" }],
    },
    "F3.1.1 has no test",
  );
  fail(
    "unknown test id",
    { requirementFiles: [], testFiles: tests("test('N9.1 missing', () => {});\n"), scriptFiles: [] },
    "unknown id N9.1 in save.test.ts",
  );
  fail(
    "unknown script id",
    { requirementFiles: [], testFiles: [], scriptFiles: [{ name: "scripts/smoke.sh", text: "echo F8\n" }] },
    "unknown id F8 in scripts/smoke.sh",
  );
  fail(
    "overlong id",
    { requirementFiles: [], testFiles: tests("test('F3.1.1.1 too deep', () => {});\n"), scriptFiles: [] },
    "invalid id F3.1.1.1 in save.test.ts",
  );
  fail(
    "requirement is not a heading",
    { requirementFiles: meals("## F3 Meals\n## F3.1 Save\n"), testFiles: [], scriptFiles: [] },
    "F3.1 is a sentence line, not a heading",
  );
  fail(
    "detail is not a heading",
    { requirementFiles: meals("## F3 Meals\n### F3.1.1 Early\n"), testFiles: [], scriptFiles: [] },
    "F3.1.1 is a list item, not a heading",
  );
  fail(
    "missing parent",
    { requirementFiles: meals("## F3 Meals\n- F3.2.1 An early detail is rejected.\n"), testFiles: [], scriptFiles: [] },
    "F3.2.1 is missing parent F3.2",
  );
  fail(
    "missing topic heading",
    { requirementFiles: meals("F3.1 The meal is kept.\n"), testFiles: [], scriptFiles: [] },
    "missing topic heading",
  );
  for (const tag of ["Proposed", "Accepted", "Implemented", "Verified", "Manual"]) {
    fail(
      `${tag} on a requirement is rejected`,
      { requirementFiles: meals(`## F3 Meals\nF3.1 The meal is saved. [${tag}]\n`), testFiles: [], scriptFiles: [] },
      `[${tag}] is not allowed`,
    );
  }
  fail(
    "retired tag is rejected",
    { requirementFiles: meals("## F3 Meals\nF3.1 The meal is saved. [Retired]\n"), testFiles: [], scriptFiles: [] },
    "Retired is not a status",
  );
  fail(
    "retired status line is rejected",
    { requirementFiles: meals("## F3 Meals\nStatus: Retired\n"), testFiles: [], scriptFiles: [] },
    "Retired is not a status",
  );
  fail(
    "retired on a detail is rejected",
    {
      requirementFiles: meals("## F3 Meals\nF3.1 The meal is saved.\n- F3.1.1 An empty name is rejected. [Retired]\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "Retired is not a status",
  );
  fail(
    "old status line is rejected",
    { requirementFiles: meals("# F3 Meals\n\nStatus: Proposed\n\n## F3.1 Save\n\nStatus: Implemented\n"), testFiles: [], scriptFiles: [] },
    "status is not used",
  );
  fail(
    "sibling ids have a gap",
    { requirementFiles: meals("## F3 Meals\nF3.2 The meal is saved.\n"), testFiles: [], scriptFiles: [] },
    "F3 skips F3.1",
  );
  fail(
    "detail ids have a gap",
    {
      requirementFiles: meals("## F3 Meals\nF3.1 The meal is saved.\n- F3.1.2 An empty name is rejected.\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "F3.1 skips F3.1.1",
  );
  pass(
    "sibling ids are contiguous",
    {
      requirementFiles: meals(
        "## F3 Meals\nF3.1 The first meal is kept.\n- F3.1.1 A blank name is rejected. [Proposed]\nF3.2 The second meal is kept.\n- F3.2.1 A long name is rejected. [Proposed]\n",
      ),
      testFiles: [],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.1.1", "F3.2", "F3.2.1"],
  );
  fail(
    "two markers on a requirement",
    { requirementFiles: meals("## F3 Meals\nF3.1 The meal is saved. [Proposed] [Accepted]\n"), testFiles: [], scriptFiles: [] },
    "[Proposed] is not allowed",
  );
  fail(
    "topic mismatch",
    { requirementFiles: meals("## F4 Other\n"), testFiles: [], scriptFiles: [] },
    "F4 does not match file topic F3",
  );
  fail(
    "duplicate id",
    {
      requirementFiles: [
        { name: "F3-a.md", text: "## F3 Meals\n" },
        { name: "F3-b.md", text: "## F3 Other\n" },
      ],
      testFiles: [],
      scriptFiles: [],
    },
    "duplicate id F3",
  );
  fail(
    "duplicate id in one file",
    { requirementFiles: meals("## F3 Meals\n## F3 Again\n"), testFiles: [], scriptFiles: [] },
    "duplicate id F3",
  );
  fail(
    "overlong heading",
    { requirementFiles: meals("## F3 Meals\n#### F3.1.1.1 Too deep\n"), testFiles: [], scriptFiles: [] },
    "F3.1.1.1 is not a valid id",
  );
  fail(
    "manual on a detail is rejected",
    {
      requirementFiles: meals("## F3 Meals\nF3.1 The meal is saved.\n- F3.1.1 An empty name is rejected. [Manual]\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "[Manual] is not allowed",
  );
  fail(
    "verified on a detail is rejected",
    {
      requirementFiles: meals("## F3 Meals\nF3.1 The meal is saved.\n- F3.1.1 An empty name is rejected. [Verified]\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "[Verified] is not allowed",
  );
  fail(
    "check line is rejected",
    { requirementFiles: meals(`${bare}Check: manual\n`), testFiles: [], scriptFiles: [] },
    "Check is not used",
  );
  fail(
    "requirement is one sentence",
    { requirementFiles: meals("## F3 Meals\nF3.1 Save it. Then list it.\n"), testFiles: [], scriptFiles: [] },
    "must be one sentence",
  );
  fail(
    "detail is one sentence",
    {
      requirementFiles: meals("## F3 Meals\nF3.1 The meal is saved.\n- F3.1.1 Save it. Then list it.\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "must be one sentence",
  );
  fail(
    "topic is a heading only",
    { requirementFiles: meals("## F3 Meals [Proposed]\n"), testFiles: [], scriptFiles: [] },
    "topic is a heading only",
  );
  fail(
    "outside topic",
    { requirementFiles: meals("## F3 Meals\nF4.1 The other topic is saved.\n"), testFiles: [], scriptFiles: [] },
    "F4.1 is outside topic F3",
  );
  fail(
    "unclosed fence",
    { requirementFiles: meals("## F3 Meals\n```\nF3.1 The meal is saved.\n"), testFiles: [], scriptFiles: [] },
    "unclosed code fence",
  );
  fail(
    "test options skip does not count",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  test("F3.1 saves", { skip: true }, () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no test",
  );
  fail(
    "test options todo does not count",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  test("F3.1 saves", { todo: true }, () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no test",
  );
  fail(
    "it options skip does not count",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  it(\n    "F3.1 saves",\n    { skip: true },\n    () => {},\n  );\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no test",
  );
  fail(
    "it options todo does not count",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  it("F3.1 saves", { todo: true }, () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no test",
  );
  fail(
    "describe.skip does not count",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe.skip("F3.1 save", () => { it("F3.1 saves", () => {}); });\n'),
      scriptFiles: [],
    },
    "F3.1 has no describe",
  );
  fail(
    "describe.todo does not count",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe.todo("F3.1 save", () => {\n  it("F3.1 saves", () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no describe",
  );
  fail(
    "describe options skip does not count",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", { skip: true }, () => {\n  it("F3.1 saves", () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no describe",
  );
  fail(
    "a skipped detail test does not count",
    {
      requirementFiles: meals(withDetail),
      testFiles: tests('describe("F3.1 save", () => {\n  it.skip("F3.1.1 rejects an empty name", () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1.1 has no test",
  );
  fail(
    "block comment does not count",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n/*\nit("F3.1 saves", () => {});\n*/\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no test",
  );
  fail(
    "line comment is not a test",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("F3.1 save", () => {\n  // it("F3.1 saves", () => {});\n});\n'),
      scriptFiles: [],
    },
    "F3.1 has no test",
  );
  fail(
    "line comment unknown id still fails",
    { requirementFiles: [], testFiles: tests("// see F3.1 later\n"), scriptFiles: [] },
    "unknown id F3.1 in save.test.ts",
  );
  fail(
    "block comment unknown id still fails",
    { requirementFiles: [], testFiles: tests("/* see N4.4 later */\n"), scriptFiles: [] },
    "unknown id N4.4 in save.test.ts",
  );
  pass(
    "running options still count",
    {
      requirementFiles: meals(bare),
      testFiles: tests(
        'describe("F3.1 save", { timeout: 1000 }, () => {\n  test("F3.1 saves", { timeout: 1000 }, () => {});\n});\n',
      ),
      scriptFiles: [],
    },
    ["F3", "F3.1"],
  );
  pass(
    "describe keeps a test",
    {
      requirementFiles: meals(bare),
      testFiles: tests('describe("meals F3.1", () => {\n  it("F3.1 saves", () => {});\n});\n'),
      scriptFiles: [],
    },
    ["F3", "F3.1"],
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
          text: "# Choice\n\n* Status: accepted\n\nSave a meal (F3.1).\n",
        },
      ],
    },
    "docs/decisions/0001-choice.md: cites requirement id F3.1",
  );
  pass(
    "a real test still counts beside skipped ones",
    {
      requirementFiles: meals(bare),
      testFiles: tests(
        [
          'test("F3.1 saves", { skip: true }, () => {});',
          'test("F3.1 saves", { todo: true }, () => {});',
          'it("F3.1 saves", { skip: true }, () => {});',
          'it("F3.1 saves", { todo: true }, () => {});',
          'describe.skip("F3.1 save", () => { it("F3.1 saves", () => {}); });',
          'describe.todo("F3.1 save", () => { it("F3.1 saves", () => {}); });',
          "/*",
          'it("F3.1 saves", () => {});',
          "*/",
          'test.skip("F3.1 saves", () => {});',
          'it.todo("F3.1 later");',
          'describe("F3.1 save", () => {',
          '  it("F3.1 saves", () => {});',
          "});",
        ].join("\n"),
      ),
      scriptFiles: [],
    },
    ["F3", "F3.1"],
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
  const requirementNames = (await readdir(REQUIREMENTS_DIR)).filter((name) => name.endsWith(".md")).sort();
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
  if (result.errors.length > 0) {
    report("requirements:", result.errors);
    process.exit(1);
  }
  const count = result.ids.length;
  console.log(count === 0 ? "requirements ok" : `requirements ok (${count} ids)`);
}

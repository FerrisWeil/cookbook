#!/usr/bin/env node

// Requirement ID check. Policy is CONTRIBUTING.md. File shape is docs/requirements/README.md.
// Fixture IDs stay in this file. The reference scan does not read it.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = path.join(ROOT, "scripts", "requirements.mjs");
const REQUIREMENTS_DIR = path.join(ROOT, "docs", "requirements");

const NEEDS_EVIDENCE = new Set(["Implemented", "Verified"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage"]);

const PART = "[1-9][0-9]*";
const ID_SOURCE = `[FNS]${PART}(?:\\.${PART}){0,2}`;
const ID_RE = new RegExp(`^${ID_SOURCE}$`);
const TOKEN_RE = new RegExp(`(?<![A-Za-z0-9.])${ID_SOURCE}(?![A-Za-z0-9.])`, "g");
const OVERLONG_RE = new RegExp(`(?<![A-Za-z0-9.])[FNS]${PART}(?:\\.${PART}){3,}(?![A-Za-z0-9.])`, "g");
const FILE_RE = new RegExp(`^([FNS]${PART})-[a-z0-9]+(?:-[a-z0-9]+)*\\.md$`);
const HEADING_RE = new RegExp(`^(#{1,3}) +(${ID_SOURCE}) +(.+)$`);
const LOOSE_HEADING_RE = /^(#{1,6}) +([FNS][0-9][0-9A-Za-z.]*) *(.*)$/;
const STATUS_RE = /^Status:\s+(Proposed|Accepted|Implemented|Verified)(?:\s*\([^)]*\))?$/;
const MANUAL_RE = /^Check:\s+manual(?:\s+.+)?$/;
const TEST_CALL_RE =
  /(?:^|\n)[ \t]*(?:await\s+)?(?:[A-Za-z_$][\w$]*\.)?(?:it|test)(?![A-Za-z0-9_$])(?:\.(skip|only|todo))?\s*\(\s*(?:\n[ \t]*)?(['"`])([^'"`\n]*)\2/g;

const STATUS_HINT = "Status: Proposed, Accepted, Implemented, or Verified";

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

function evidenceIdsInTest(text) {
  const masked = maskInactiveRegions(text);
  const ids = [];
  TEST_CALL_RE.lastIndex = 0;
  for (const call of masked.matchAll(TEST_CALL_RE)) {
    if (call[1] === "skip" || call[1] === "todo") continue;
    if (followingOptionsSkip(masked, call.index + call[0].length)) continue;
    ids.push(...scanIds(call[3]).ids);
  }
  return ids;
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
  return {
    ids: [...text.matchAll(TOKEN_RE)].map((match) => match[0]),
    invalid: [...text.matchAll(OVERLONG_RE)].map((match) => match[0]),
  };
}

function parseCategory(name, text) {
  const errors = [];
  const fileMatch = FILE_RE.exec(name);
  if (!fileMatch) {
    return {
      errors: [`${name}: category file name must look like F3-slug.md`],
      reqs: [],
    };
  }

  const categoryId = fileMatch[1];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const reqs = [];
  const seen = new Set();
  let fence = false;
  let current = null;

  function closeSection() {
    if (!current) return;
    const req = current;
    current = null;
    if (req.statuses.length === 0 && !req.badStatus) {
      errors.push(`${name}:${req.line}: ${req.id} is missing Status`);
    } else if (req.statuses.length > 1) {
      errors.push(`${name}:${req.line}: ${req.id} has more than one Status`);
    }
    const parent = parentOf(req.id);
    if (parent && !seen.has(parent)) {
      errors.push(`${name}:${req.line}: ${req.id} is missing parent ${parent}`);
    }
    if (seen.has(req.id)) {
      errors.push(`${name}:${req.line}: duplicate id ${req.id}`);
      return;
    }
    seen.add(req.id);
    reqs.push({
      id: req.id,
      line: req.line,
      file: name,
      status: req.statuses.length === 1 ? req.statuses[0] : null,
      manual: req.manual,
    });
  }

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const line = lines[index].trim();
    if (line.startsWith("```")) {
      fence = !fence;
      continue;
    }
    if (fence) continue;

    const heading = HEADING_RE.exec(line);
    if (heading) {
      closeSection();
      const level = heading[1].length;
      const id = heading[2];
      const depth = id.split(".").length;
      if (level !== depth) {
        errors.push(`${name}:${lineNo}: ${id} needs a level-${depth} heading`);
      }
      if (depth === 1 && id !== categoryId) {
        errors.push(`${name}:${lineNo}: ${id} does not match file category ${categoryId}`);
      } else if (depth > 1 && !id.startsWith(`${categoryId}.`)) {
        errors.push(`${name}:${lineNo}: ${id} is outside category ${categoryId}`);
      }
      current = { id, line: lineNo, statuses: [], manual: false, badStatus: false };
      continue;
    }

    const loose = LOOSE_HEADING_RE.exec(line);
    if (loose) {
      closeSection();
      const token = loose[2];
      const title = loose[3].trim();
      if (!ID_RE.test(token)) {
        errors.push(`${name}:${lineNo}: ${token} is not a valid requirement heading`);
      } else if (!title) {
        errors.push(`${name}:${lineNo}: ${token} heading needs a title`);
      } else {
        errors.push(`${name}:${lineNo}: ${token} needs a level-${token.split(".").length} heading`);
      }
      continue;
    }

    if (!current) {
      if (/^Status:/i.test(line)) errors.push(`${name}:${lineNo}: Status outside a heading`);
      continue;
    }
    const status = STATUS_RE.exec(line);
    if (status) {
      current.statuses.push(status[1]);
      continue;
    }
    if (/^Status:/i.test(line)) {
      current.badStatus = true;
      errors.push(`${name}:${lineNo}: status line must be ${STATUS_HINT}`);
      continue;
    }
    if (MANUAL_RE.test(line)) {
      current.manual = true;
      continue;
    }
    if (/^Check:/i.test(line)) {
      errors.push(`${name}:${lineNo}: Check must be "Check: manual"`);
    }
  }

  closeSection();
  if (fence) errors.push(`${name}: unclosed code fence`);
  if (!seen.has(categoryId)) {
    errors.push(`${name}: missing category heading for ${categoryId}`);
  }
  checkContiguous(name, reqs, errors);
  return { errors, reqs };
}

function check({ requirementFiles, testFiles, scriptFiles }) {
  const errors = [];
  const byId = new Map();
  const files = [...requirementFiles].sort((a, b) => a.name.localeCompare(b.name));

  for (const file of files) {
    if (file.name === "README.md" || !file.name.endsWith(".md")) continue;
    const parsed = parseCategory(file.name, file.text);
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

  const evidence = new Set();
  const referenced = new Map();

  function note(id, where) {
    if (!referenced.has(id)) referenced.set(id, where);
  }

  const tests = [...testFiles].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of tests) {
    const text = file.text.replace(/\r\n/g, "\n");
    const scanned = scanIds(text);
    for (const id of scanned.ids) note(id, file.name);
    for (const id of scanned.invalid) errors.push(`invalid id ${id} in ${file.name}`);
    for (const id of evidenceIdsInTest(text)) evidence.add(id);
  }

  const scripts = [...scriptFiles].sort((a, b) => a.name.localeCompare(b.name));
  for (const file of scripts) {
    const scanned = scanIds(file.text);
    for (const id of scanned.ids) {
      note(id, file.name);
      evidence.add(id);
    }
    for (const id of scanned.invalid) errors.push(`invalid id ${id} in ${file.name}`);
  }

  for (const req of byId.values()) {
    if (req.manual) evidence.add(req.id);
  }

  for (const [id, where] of [...referenced.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!byId.has(id)) errors.push(`unknown id ${id} in ${where}`);
  }

  for (const req of byId.values()) {
    if (req.status && NEEDS_EVIDENCE.has(req.status) && !evidence.has(req.id)) {
      errors.push(
        `${req.file}:${req.line}: ${req.id} (${req.status}) has no test, script mention, or Check: manual`,
      );
    }
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
  const proposed = "# F3 Meals\n\nStatus: Proposed\n";
  const implemented =
    "# F3 Meals\n\nStatus: Proposed\n\n## F3.1 Keep\n\nStatus: Proposed\n\n## F3.2 Save\n\nStatus: Implemented\n";

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
  pass("prose is not an id", { requirementFiles: meals(`${proposed}\nSee F3.2.1 in prose.\n`), testFiles: [], scriptFiles: [] }, ["F3"]);
  pass(
    "fenced heading is not an id",
    {
      requirementFiles: meals(`${proposed}\n\`\`\`md\n## F9.9 Planted\n\nStatus: Implemented\n\`\`\`\n`),
      testFiles: [],
      scriptFiles: [],
    },
    ["F3"],
  );
  pass("proposed needs no test", { requirementFiles: meals(proposed), testFiles: [], scriptFiles: [] }, ["F3"]);
  pass(
    "accepted needs no test",
    {
      requirementFiles: meals(
        "# F3 Meals\n\nStatus: Accepted\n\n## F3.1 Save\n\nStatus: Accepted\n",
      ),
      testFiles: [],
      scriptFiles: [],
    },
    ["F3", "F3.1"],
  );
  pass(
    "it title counts",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: 'it("F3.2 saves", () => {});\n' }],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.2"],
  );
  pass(
    "test title counts",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: "test('F3.2 saves', () => {});\n" }],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.2"],
  );
  pass(
    "multiline title counts",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: 'it(\n  "F3.2 saves",\n  () => {},\n);\n' }],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.2"],
  );
  pass(
    "accepted may say merged",
    {
      requirementFiles: meals("# F3 Meals\n\nStatus: Accepted (merged)\n"),
      testFiles: [],
      scriptFiles: [],
    },
    ["F3"],
  );
  pass(
    "subtest title counts",
    {
      requirementFiles: meals(implemented),
      testFiles: [
        {
          name: "save.test.ts",
          text: 'test("meals", async (t) => {\n  await t.test("F3.2 saves", async () => {});\n});\n',
        },
      ],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.2"],
  );
  pass(
    "it.only counts",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: 'it.only("F3.2 runs", () => {});\n' }],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.2"],
  );
  pass(
    "script mention counts",
    {
      requirementFiles: meals(implemented),
      testFiles: [],
      scriptFiles: [{ name: "scripts/smoke.sh", text: "# checks F3.2\n" }],
    },
    ["F3", "F3.1", "F3.2"],
  );
  pass(
    "manual label counts for that id only",
    {
      requirementFiles: meals(
        `${implemented}\n### F3.2.1 Empty name\n\nStatus: Verified\nCheck: manual\n`,
      ),
      testFiles: [{ name: "save.test.ts", text: 'it("F3.2 saves", () => {});\n' }],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.2", "F3.2.1"],
  );

  fail("bad file name", { requirementFiles: [{ name: "notes.md", text: "hello\n" }], testFiles: [], scriptFiles: [] }, "category file name must look like F3-slug.md");
  fail("bad slug", { requirementFiles: [{ name: "F3-Meals.md", text: proposed }], testFiles: [], scriptFiles: [] }, "category file name must look like F3-slug.md");
  fail("implemented without evidence", { requirementFiles: meals(implemented), testFiles: [], scriptFiles: [] }, "F3.2 (Implemented) has no test");
  fail(
    "verified without evidence",
    {
      requirementFiles: meals("# F3 Meals\n\nStatus: Verified\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "F3 (Verified) has no test",
  );
  fail(
    "skip does not count",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: 'it.skip("F3.2 skipped", () => {});\n' }],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "todo does not count",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: 'it.todo("F3.2 later");\n' }],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "body mention does not satisfy",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: 'const id = "F3.2";\nit("saves", () => {});\n' }],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "a longer id does not cover the shorter one",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: "test('F3.2.1 empty', () => {});\n" }],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "a child id does not cover the category",
    {
      requirementFiles: meals("# F3 Meals\n\nStatus: Implemented\n\n## F3.2 Save\n\nStatus: Proposed\n"),
      testFiles: [{ name: "save.test.ts", text: "test('F3.2 saves', () => {});\n" }],
      scriptFiles: [],
    },
    "F3 (Implemented) has no test",
  );
  fail(
    "unknown test id",
    {
      requirementFiles: [],
      testFiles: [{ name: "save.test.ts", text: "test('N9.1 missing', () => {});\n" }],
      scriptFiles: [],
    },
    "unknown id N9.1 in save.test.ts",
  );
  fail(
    "unknown script id",
    {
      requirementFiles: [],
      testFiles: [],
      scriptFiles: [{ name: "scripts/smoke.sh", text: "echo F8\n" }],
    },
    "unknown id F8 in scripts/smoke.sh",
  );
  fail(
    "overlong id",
    {
      requirementFiles: [],
      testFiles: [{ name: "save.test.ts", text: "test('F3.2.1.1 too deep', () => {});\n" }],
      scriptFiles: [],
    },
    "invalid id F3.2.1.1 in save.test.ts",
  );
  fail(
    "wrong heading level",
    { requirementFiles: meals("## F3 Meals\n\nStatus: Proposed\n"), testFiles: [], scriptFiles: [] },
    "F3 needs a level-1 heading",
  );
  fail(
    "missing parent",
    {
      requirementFiles: meals("# F3 Meals\n\nStatus: Proposed\n\n### F3.2.1 Early\n\nStatus: Proposed\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "F3.2.1 is missing parent F3.2",
  );
  fail(
    "missing status",
    { requirementFiles: meals("# F3 Meals\n"), testFiles: [], scriptFiles: [] },
    "F3 is missing Status",
  );
  fail(
    "bad status",
    { requirementFiles: meals("# F3 Meals\n\nStatus: Done\n"), testFiles: [], scriptFiles: [] },
    "status line must be",
  );
  fail(
    "retired is rejected",
    {
      requirementFiles: meals("# F3 Meals\n\nStatus: Accepted\n\n## F3.1 Save\n\nStatus: Retired\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "status line must be",
  );
  fail(
    "sibling ids have a gap",
    {
      requirementFiles: meals("# F3 Meals\n\nStatus: Proposed\n\n## F3.2 Save\n\nStatus: Proposed\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "F3 skips F3.1",
  );
  fail(
    "detail ids have a gap",
    {
      requirementFiles: meals(
        "# F3 Meals\n\nStatus: Proposed\n\n## F3.1 Save\n\nStatus: Proposed\n\n### F3.1.2 Empty\n\nStatus: Proposed\n",
      ),
      testFiles: [],
      scriptFiles: [],
    },
    "F3.1 skips F3.1.1",
  );
  pass(
    "sibling ids are contiguous",
    {
      requirementFiles: meals(
        "# F3 Meals\n\nStatus: Proposed\n\n## F3.1 First\n\nStatus: Proposed\n\n## F3.2 Second\n\nStatus: Accepted\n",
      ),
      testFiles: [],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.2"],
  );
  fail(
    "two statuses",
    {
      requirementFiles: meals("# F3 Meals\n\nStatus: Proposed\nStatus: Accepted\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "F3 has more than one Status",
  );
  fail(
    "category mismatch",
    { requirementFiles: meals("# F4 Other\n\nStatus: Proposed\n"), testFiles: [], scriptFiles: [] },
    "F4 does not match file category F3",
  );
  fail(
    "duplicate id",
    {
      requirementFiles: [
        { name: "F3-a.md", text: proposed },
        { name: "F3-b.md", text: "# F3 Other\n\nStatus: Proposed\n" },
      ],
      testFiles: [],
      scriptFiles: [],
    },
    "duplicate id F3",
  );
  fail(
    "overlong heading",
    {
      requirementFiles: meals("# F3 Meals\n\nStatus: Proposed\n\n#### F3.2.1.1 Too deep\n\nStatus: Proposed\n"),
      testFiles: [],
      scriptFiles: [],
    },
    "F3.2.1.1 is not a valid requirement heading",
  );
  fail(
    "manual does not cover the parent",
    {
      requirementFiles: meals(
        "# F3 Meals\n\nStatus: Implemented\n\n## F3.2 Save\n\nStatus: Proposed\nCheck: manual\n",
      ),
      testFiles: [],
      scriptFiles: [],
    },
    "F3 (Implemented) has no test",
  );
  fail(
    "unclosed fence",
    { requirementFiles: meals(`${proposed}\n\`\`\`\n## F3.2 Hidden\n`), testFiles: [], scriptFiles: [] },
    "unclosed code fence",
  );
  fail(
    "test options skip does not count",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: 'test("F3.2 saves", { skip: true }, () => {});\n' }],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "test options todo does not count",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: 'test("F3.2 saves", { todo: true }, () => {});\n' }],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "it options skip does not count",
    {
      requirementFiles: meals(implemented),
      testFiles: [
        {
          name: "save.test.ts",
          text: 'it(\n  "F3.2 saves",\n  { skip: true },\n  () => {},\n);\n',
        },
      ],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "it options todo does not count",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: 'it("F3.2 saves", { todo: true }, () => {});\n' }],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "describe.skip does not count",
    {
      requirementFiles: meals(implemented),
      testFiles: [
        {
          name: "save.test.ts",
          text: 'describe.skip("suite", () => { it("F3.2 saves", () => {}); });\n',
        },
      ],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "describe.todo does not count",
    {
      requirementFiles: meals(implemented),
      testFiles: [
        {
          name: "save.test.ts",
          text: 'describe.todo("suite", () => {\n  it("F3.2 saves", () => {});\n});\n',
        },
      ],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "block comment does not count",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: '/*\nit("F3.2 saves", () => {});\n*/\n' }],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "line comment is not a test",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: '// it("F3.2 saves", () => {});\n' }],
      scriptFiles: [],
    },
    "F3.2 (Implemented) has no test",
  );
  fail(
    "line comment unknown id still fails",
    {
      requirementFiles: [],
      testFiles: [{ name: "save.test.ts", text: "// see F3.2 later\n" }],
      scriptFiles: [],
    },
    "unknown id F3.2 in save.test.ts",
  );
  fail(
    "block comment unknown id still fails",
    {
      requirementFiles: [],
      testFiles: [{ name: "save.test.ts", text: "/* see N4.4 later */\n" }],
      scriptFiles: [],
    },
    "unknown id N4.4 in save.test.ts",
  );
  pass(
    "running options still count",
    {
      requirementFiles: meals(implemented),
      testFiles: [{ name: "save.test.ts", text: 'test("F3.2 saves", { timeout: 1000 }, () => {});\n' }],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.2"],
  );
  pass(
    "describe keeps a test",
    {
      requirementFiles: meals(implemented),
      testFiles: [
        {
          name: "save.test.ts",
          text: 'describe("meals", () => {\n  it("F3.2 saves", () => {});\n});\n',
        },
      ],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.2"],
  );
  pass(
    "a real test still counts beside skipped ones",
    {
      requirementFiles: meals(implemented),
      testFiles: [
        {
          name: "save.test.ts",
          text: [
            'test("F3.2 saves", { skip: true }, () => {});',
            'test("F3.2 saves", { todo: true }, () => {});',
            'it("F3.2 saves", { skip: true }, () => {});',
            'it("F3.2 saves", { todo: true }, () => {});',
            'describe.skip("suite", () => { it("F3.2 saves", () => {}); });',
            'describe.todo("suite", () => { it("F3.2 saves", () => {}); });',
            "/*",
            'it("F3.2 saves", () => {});',
            "*/",
            'test.skip("F3.2 saves", () => {});',
            'it.todo("F3.2 later");',
            'it("F3.2 saves", () => {});',
          ].join("\n"),
        },
      ],
      scriptFiles: [],
    },
    ["F3", "F3.1", "F3.2"],
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
  return { requirementFiles, testFiles, scriptFiles };
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

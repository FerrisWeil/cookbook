# Requirements

The catalog is [requirements.yaml](requirements.yaml). The shape is [schema.json](schema.json). Rules are in [CONTRIBUTING.md](../../CONTRIBUTING.md#docs). YAML catalogs portable application behavior. `verifies(id, fingerprint, fn)` binds one test case to one leaf. That binding is not acceptance. An ADR does not cite a requirement ID.

This README is not the catalog.

## File

One forest. Several roots. Arbitrary depth. Parent and leaf are properties of the tree, not node-type fields.

- `id` is a stable positive integer, written as a double-quoted string (`"12"`). YAML `12` and `"12"` would be the same identity if both were accepted; unquoted numbers are rejected so YAML does not coerce `12` / `012` / `1e2`. IDs do not encode position. Do not renumber because a node moved.
- `status` is `accepted`, `implemented`, or `verified`. New leaves start `accepted`.
- `text` is one line of testable behavior.
- `children`, when present, has at least two entries. No empty or single-child list. Collapse a single remaining child into the parent.
- A child is a nested node or `{ ref: "12" }`. A ref is not a node: it has no id, status, text, or children.
- Roots may set `kind: shared`. Omit `kind` (or `kind: normal`) for a normal root. `kind` is only valid on a root.

Shared roots hold reusable behavior. Other nodes point at them with `ref`. A ref counts as a child and uses the referenced node's status for rollup. Refs may only target a node in a shared tree. Missing refs and cycles fail `pnpm check`.

## Status

- `accepted`: agreed behavior, possibly unimplemented. May lack a test.
- `implemented`: behavior is built. A test is allowed, not required.
- `verified`: one executed passing `verifies()` binding, and a person reviewed that the assertions match the text.

Parent status is declared and must match rollup over children and refs:

- any child or ref is `accepted` → parent is `accepted`
- every child or ref is `verified` → parent is `verified`
- otherwise → parent is `implemented`

A parent cannot be `verified` until every child and shared dependency is `verified`. Hashes check that the bound leaf text is fresh. They do not judge assertion quality.

## Tests

Exactly one test case per leaf. Parent nodes are not bound. Split a leaf rather than attach several cases.

```js
import { verifies } from "@cookbook/test";

it(
  "returns that recipe",
  verifies("6", "c4b8cb4c3b9ed214", () => {
    // assertions
  }),
);
```

The fingerprint is `fp-v1`: the first 16 hex characters of SHA-256 over `cookbook.req.fp.v1\n` plus `JSON.stringify({ v: 1, id, text })`. Put the literal in the test source. Do not compute the expected value from the YAML at test time. Editing that leaf's id or text breaks the binding. Editing a parent does not change a child's fingerprint; review still checks the parent text against its children.

`pnpm requirements --fingerprints` prints current leaf hashes for authors. CI never rewrites stored hashes or statuses.

`it.skip`, `test.todo`, `{ skip: true }`, and `describe.skip` do not count. A `verifies()` call inside the test body does not count. `covers()` is removed.

## Check

`pnpm check` runs [scripts/requirements.mjs](../../scripts/requirements.mjs) after the unit tests. The check:

- schema, quoted ids, uniqueness, `children` length, refs, cycles, status rollup
- one binding per leaf, matching hashes, no parent or missing ids
- executed passing evidence in `.requirements-evidence/` for every `verified` leaf

Skipped, failing, or un-run tests cannot support `verified`. Static source is not executed evidence.

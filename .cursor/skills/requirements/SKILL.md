---
name: requirements
description: Use when writing or editing a requirements YAML file, a requirement ID, or a test that names one.
---

# Requirements

Read [CONTRIBUTING.md](../../../CONTRIBUTING.md#docs) and [docs/requirements/README.md](../../../docs/requirements/README.md). Do not restate them.

The catalog is `docs/requirements/requirements.yaml`. The shape is `docs/requirements/schema.json`. `pnpm check` enforces it. Do not add a web view. YAML catalogs portable application behavior. `verifies(id, fingerprint, fn)` binds one test to one leaf; it is not acceptance. An ADR never cites a requirement ID.

## IDs

Quote every ID: `"12"`. IDs are stable integers. Do not renumber because a node moved. Do not reuse a deleted id.

New leaves start `status: accepted`. `children`, when present, has at least two entries.

## Tests

A leaf has at most one test. That test wraps `verifies("12", "<fp-v1 hex>", fn)` from `@cookbook/test` at the `it()` call. The title is the behavior, not the ID. `pnpm requirements --fingerprints` prints current hashes. Put the literal in the test. Parent edits do not change a child's fingerprint.

```js
import { verifies } from "@cookbook/test";

it("returns that recipe", verifies("6", "c4b8cb4c3b9ed214", () => {
  // assertions
}));
```

Do not call `verifies()` inside the test body. Do not use `covers()`.

`verified` needs that binding plus an executed passing run. `accepted` may lack a test. Hosting and operator steps are not catalog entries.

## Commands

`pnpm format` writes Prettier on the YAML. `pnpm check` runs Prettier with `--check`, the schema, and the ID rules. Search the YAML for a sentence. There is no generated index.

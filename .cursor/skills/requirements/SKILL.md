---
name: requirements
description: Use when writing or editing a requirements YAML file, a requirement ID, or a test that names one.
---

# Requirements

Read [CONTRIBUTING.md](../../../CONTRIBUTING.md#docs) and [docs/requirements/README.md](../../../docs/requirements/README.md). Do not restate them.

The shape is `docs/requirements/schema.json`. `pnpm check` enforces it. Do not add a web view. YAML catalogs behavior. `covers()` traces an ID; it is not acceptance. An ADR never cites a requirement ID.

## IDs

Quote every ID: `"1"`, `"1.2"`, `"1.2.1"`.

An ID with `implemented: false` may be deleted. Renumber what follows so the numbers stay contiguous. Do not leave a gap. Do not write `removed: true`.

Once a detail has a test, its ID stays. Do not renumber it. Deleting that one leaves a gap, or:

```yaml
- id: "1.2.2"
  removed: true
```

Batch wording in one pull request. Split the pull request when the behavior change is risky.

## Details

`implemented` defaults to true. Write `implemented: false` until the behavior exists. Remove that field in the same commit that adds the one test. A detail has one test. That test calls `covers("1.1.1")` from `@cookbook/test`. The title is the behavior, not the ID.

```js
import { covers } from "@cookbook/test";

it("returns that recipe", () => {
  covers("1.1.1");
});
```

One test may cover several details:

```js
covers("1.1.2", "1.1.3");
```

The helper fails on an unknown or removed ID. `pnpm check` fails if the ID is not a detail, if `implemented: false` still remains, or if a second test covers the same detail. Do not put `req:` in the title.

`check: manual` is only for behavior outside this repo. `see` is rare.

## Examples

Good, from the pilot. Not built yet, so the flag stays:

```yaml
- id: "1.1.3"
  text: Given an ID that matches no recipe, the agent is told the recipe was not found.
  implemented: false
```

Bad. Visual style. It belongs in the design doc:

```yaml
- id: "9.1.1"
  text: Controls use an opaque fill.
  implemented: false
```

Bad. A version or a point in time:

```yaml
- id: "9.1.2"
  text: Search comes later.
  implemented: false
```

Bad. Two behaviors, and an error code:

```yaml
- id: "1.1.4"
  text: Given a deleted recipe, the agent receives 404 and the list omits it.
  implemented: false
```

## Commands

`pnpm format` writes Prettier on the YAML. `pnpm check` runs Prettier with `--check`, the schema, and the ID rules. Search the YAML for a sentence. There is no generated index.

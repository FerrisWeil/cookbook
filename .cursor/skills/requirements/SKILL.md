---
name: requirements
description: Use when writing or editing a requirements YAML file, a requirement ID, or a test that names one.
---

# Requirements

The pilot is `docs/requirements/1-mcp.yaml`. The shape is `docs/requirements/schema.json`. `pnpm check` enforces it. Do not add a web view. Do not add a `covers()` helper. Test titles use `req:1.1.1` until that helper exists.

An ADR never cites a requirement ID.

## IDs

Quote every ID: `"1"`, `"1.2"`, `"1.2.1"`. Never renumber. Never reuse a number. Deleting a requirement or detail leaves a gap, or:

```yaml
- id: "1.2.2"
  removed: true
```

Batch wording in one pull request. Split the pull request when the behavior change is risky.

## Details

One behavior. Condition, then outcome. No error code, status code, or response body.

`implemented` defaults to true. Write `implemented: false` until the behavior exists. Remove that field in the same commit that adds the one test. A detail has one test. The title contains `req:1.1.1`.

`check: manual` is only for behavior outside this repo. A NAS, the tailnet, or a person's eyes. A function or file in this repo gets a test.

`see` points at another ID when the behavior is the same and repeating it would drift. The pilot has no `see`. Leave it out unless you would otherwise copy a sentence.

## Examples

Good, from the pilot. Not built yet, so the flag stays:

```yaml
- id: "1.1.3"
  text: Given an ID that matches no recipe, the agent is told the recipe was not found.
  implemented: false
```

```yaml
- id: "1.5.3"
  text: Given a search request, the agent is told that operation is not available.
  implemented: false
```

Good test, in the commit that deletes `implemented: false`:

```js
it("req:1.1.1 returns that recipe", () => {});
```

Bad. Two behaviors, and an error code:

```yaml
- id: "1.1.4"
  text: Given a deleted recipe, the agent receives 404 and the list omits it.
  implemented: false
```

Bad. The flag is still set after a test exists, or a second test names the same detail. `pnpm check` fails both.

Bad. Renumbering the next detail onto a deleted number. Keep `"1.2.2"` as `removed: true`, or leave the gap.

## Commands

`pnpm format` writes Prettier on the YAML. `pnpm check` runs Prettier with `--check`, the schema, and the ID rules. Search the YAML for a sentence. There is no generated index.

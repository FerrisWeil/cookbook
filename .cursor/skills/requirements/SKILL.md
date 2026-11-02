---
name: requirements
description: Use when writing or editing a requirements YAML file, a requirement ID, or a test that names one.
---

# Requirements

The pilot is `docs/requirements/1-mcp.yaml`. The shape is `docs/requirements/schema.json`. `pnpm check` enforces it. Do not add a web view. Do not add a `covers()` helper. Test titles use `req:1.1.1` until that helper exists.

An ADR never cites a requirement ID.

## IDs

Quote every ID: `"1"`, `"1.2"`, `"1.2.1"`.

An ID with `implemented: false` may be deleted. Renumber what follows so the numbers stay contiguous. Do not leave a gap. Do not write `removed: true`.

Once a detail has a test, its ID stays. Do not renumber it. Deleting that one leaves a gap, or:

```yaml
- id: "1.2.2"
  removed: true
```

Batch wording in one pull request. Split the pull request when the behavior change is risky.

A topic pull request changes only its own topic YAML, plus tests and code when implementing. Shared docs change in their own pull request: `docs/requirements/README.md`, `CONTRIBUTING.md`, this skill, and `docs/requirements/schema.json`. The README does not list topics.

Good. The pull request edits only `docs/requirements/2-kitchen-ui.yaml`.

Bad. That same pull request adds the filename to `docs/requirements/README.md`.

## What belongs

A requirement states testable product behavior. Condition, then outcome. No error code, status code, or response body. A requirement is timeless. It names no version, release, phase, or point in time ("for now", "yet", "initially", "currently", "later"). State the behavior that is true. Good: "The MCP offers only the read, list, and save tools." Bad: "Search comes later."

Prefer a positive, testable statement. A negative is allowed only when it guards a real limit: permission, data safety, or security. Good: "On the recipe screen, no control overlaps the title, ingredient lines, or steps." Bad: "Recipe text is never read through a control."

A requirement names no specific person. An actor value such as taylor, chef, or system may stay when it is data. Good: "A user can open the app on a desktop browser or a phone." Bad: "Taylor and his wife can open the app."

A design idea, a visual style, a version name, and a scope or non-goal live in docs or an ADR. They are not requirements.

## Details

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

Bad. Visual style. It belongs in the design doc:

```yaml
- id: "9.1.1"
  text: Controls use an opaque fill.
  implemented: false
```

Bad. A version or a point in time. The same limit, as behavior, is the search example above:

```yaml
- id: "9.1.2"
  text: Search comes later.
  implemented: false
```

Good. A negative that guards a real limit:

```yaml
- id: "2.6.3"
  text: A phone write leaves the title, ingredient lines, steps, servings, and nutrition unchanged.
  implemented: false
```

Bad. Two behaviors, and an error code:

```yaml
- id: "1.1.4"
  text: Given a deleted recipe, the agent receives 404 and the list omits it.
  implemented: false
```

Bad. The flag is still set after a test exists, or a second test names the same detail. `pnpm check` fails both.

Bad. Renumbering an ID that already has a test. That number stays. Delete it with a gap or `removed: true`.

Good. Nothing in the requirement has a test, a detail is deleted, and the next detail takes its number.

## Commands

`pnpm format` writes Prettier on the YAML. `pnpm check` runs Prettier with `--check`, the schema, and the ID rules. Search the YAML for a sentence. There is no generated index.

# Requirements

Taylor confirmed this format on 2026-10-31. The rules are in [CONTRIBUTING.md](../../CONTRIBUTING.md#docs). YAML catalogs behavior. `covers()` traces an ID; it is not acceptance. An ADR does not cite a requirement ID.

Topic files are the YAML files in this directory. This README is not a topic file. The check skips it, so the examples below are not requirements. Do not list topics here.

## File

The shape is [schema.json](schema.json). IDs are double-quoted strings with no type letter. Write block lists, not flow style (`[]` or `{}`). `pnpm format` writes Prettier. `pnpm check` runs Prettier with `--check` and rejects flow style.

- `id` is the topic number (`"1"`) and matches the file name. `title` is a short heading.
- Each requirement has `id` (`"1.2"`), `type` (`functional`, `non-functional`, or `system`), `text`, and `details`.
- Each detail has `id` (`"1.2.1"`) and `text` (one behavior: the condition and the outcome). Do not put an error code or a response body in the text.
- What a requirement may say is [CONTRIBUTING.md](../../CONTRIBUTING.md#docs).
- `implemented: false` means the behavior is not built. Omit `implemented` once it is built. The same commit adds the test. A detail marked `implemented: false` must not already have a test.
- An implemented detail is named by exactly one test, which calls `covers("1.2.1")`. That maps the test to the ID. It is not acceptance. One test may cover several details: `covers("1.2.1", "1.2.2")`. Import `covers` from `@cookbook/test`. A skipped or to-do test does not count. A mention in the title or a string in the body does not count.
- `check: manual` replaces that test when the behavior is outside this repo. It is not for a function or a file in this repo.
- `see` is an optional list of other IDs. Use it rarely.
- An ID with `implemented: false` may be deleted and the following IDs renumbered. Do not leave a gap or a `removed` marker. Once a detail has a test, its ID stays. Deleting that one leaves a gap, or `removed: true` on that number.

## Check

```js
import { covers } from "@cookbook/test";

it("returns that recipe", () => {
  covers("1.2.1");
});
```

`pnpm check` runs [scripts/requirements.mjs](../../scripts/requirements.mjs).

- A detail without `implemented: false` needs `covers("1.2.1")` in one test. `implemented: false` must not already have a test.
- `check: manual` is the check for that detail. A test must not also cover it.
- `skip` and `todo` do not count. A mention only in a comment, a string, or the title does not count.
- An unknown ID in `covers()` fails. `covers()` on a requirement or a removed ID fails. A leftover `req:` title prefix fails. A detail in more than one test fails.
- A decision must not cite a requirement ID.
- No topic files and no ID references is a pass.

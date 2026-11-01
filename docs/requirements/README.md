# Requirements

Taylor confirmed this format on 2026-10-31. The rules are in [CONTRIBUTING.md](../../CONTRIBUTING.md#docs). An ADR does not cite a requirement ID.

Topic files are YAML: `docs/requirements/1-mcp.yaml`. This README is not a topic file. The check skips it, so the examples below are not requirements.

## File

The shape is [schema.json](schema.json). IDs are double-quoted strings with no type letter. Write block lists, not flow style (`[]` or `{}`). `pnpm format` writes Prettier. `pnpm check` runs Prettier with `--check` and rejects flow style.

- `id` is the topic number (`"1"`) and matches the file name. `title` is a short heading.
- Each requirement has `id` (`"1.2"`), `type` (`functional`, `non-functional`, or `system`), `text`, and `details`.
- Each detail has `id` (`"1.2.1"`) and `text` (one behavior: the condition and the outcome). Do not put an error code or a response body in the text.
- `implemented: false` means the behavior is not built. Omit `implemented` once it is built. The same commit adds the test. A detail marked `implemented: false` must not already have a test.
- An implemented detail is named by exactly one test title, as `req:1.2.1`. A skipped or to-do test does not count. A mention in the test body does not count.
- `check: manual` replaces that test when the behavior is outside this repo. It is not for a function or a file in this repo.
- `see` is an optional list of other IDs. Use it rarely.
- A deleted requirement or detail keeps its number with `removed: true`, or leaves a gap. Do not renumber. Do not reuse an ID.

## Check

`pnpm check` runs [scripts/requirements.mjs](../../scripts/requirements.mjs).

- A detail without `implemented: false` needs `req:1.2.1` in one test title. `implemented: false` must not already have a test.
- `check: manual` is the check for that detail. A test must not also name it.
- `skip` and `todo` do not count. A mention only in the test body does not count.
- An unknown `req:` ID fails. `req:` on a requirement fails. A detail in more than one test fails.
- A decision must not cite a requirement ID.
- No topic files and no ID references is a pass.

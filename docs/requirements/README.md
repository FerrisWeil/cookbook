# Requirements

Taylor confirmed this format on 2026-10-31. The rules are in [CONTRIBUTING.md](../../CONTRIBUTING.md#docs). An ADR does not cite a requirement ID.

The pilot topic file is `docs/requirements/1-mcp.yaml`. This README is not a topic file. The check skips it, so the examples below are not requirements. The check still accepts a Markdown category file shaped like `F3-slug.md`.

The sentence list is [index.md](index.md). It is generated. `pnpm requirements:index` rewrites it, and `pnpm check` fails when it is stale.

## File

- Name the file with the category ID, a hyphen, and a lowercase slug: `F3-slug.md`.
- `# F3 Title` is the category. `## F3.2 Title` is a requirement. `### F3.2.1 Title` is a detail or edge case.
- Heading level matches the ID: one, two, or three parts. A number does not start with 0. Text in a paragraph is not an ID.
- Put one status line in that section: `Status: Proposed`, `Status: Accepted`, `Status: Implemented`, or `Status: Verified`. A parenthetical may follow, as in `Status: Accepted (merged)`.
- Put a child after its parent, in the same file.
- An ID is never reused and never renumbered. Deleting one leaves a gap.

## YAML

The pilot file is `1-mcp.yaml`. The shape is [schema.json](schema.json). IDs are double-quoted strings with no type letter. Write block lists, not flow style (`[]` or `{}`). `pnpm format` writes Prettier. `pnpm check` runs Prettier with `--check` and rejects flow style.

- `id` is the topic number (`"1"`) and matches the file name. `title` is a short heading.
- Each requirement has `id` (`"1.2"`), `type` (`functional`, `non-functional`, or `system`), `text`, and `details`.
- Each detail has `id` (`"1.2.1"`) and `text` (one behavior: the condition and the outcome). Do not put an error code or a response body in the text.
- `implemented: false` means the behavior is not built. Omit `implemented` once it is built. The same commit adds the test. A detail marked `implemented: false` must not already have a test.
- An implemented detail is named by exactly one test title, as `req:1.2.1`. A skipped or to-do test does not count. A mention in the test body does not count.
- `check: manual` replaces that test when the behavior is outside this repo. It is not for a function or a file in this repo.
- `see` is an optional list of other IDs. Use it rarely.
- A deleted requirement or detail keeps its number with `removed: true`, or leaves a gap. Do not renumber.

## Check

`pnpm check` runs [scripts/requirements.mjs](../../scripts/requirements.mjs).

- Proposed and Accepted need no test.
- Implemented and Verified need the ID in a `test('F3.2.1 …')` or `it('F3.2.1 …')` name, a mention in another file under `scripts/`, or a `Check: manual` line on that ID.
- `skip` and `todo` do not count. A mention only in the test body does not count.
- An ID in a test or script must be an ID in a category file. The Markdown shape is `F`, `N`, or `S` plus a number (`F3`, `F3.2`, `F3.2.1`).
- A YAML detail ID in a test title uses the `req:` prefix (`req:1.2.1`). An unknown ID fails. `req:` on a requirement fails. A detail in more than one test fails.
- A decision must not cite a requirement ID.
- No category files and no ID references is a pass.

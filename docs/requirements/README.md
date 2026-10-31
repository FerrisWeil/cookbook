# Requirements

Taylor confirmed this format on 2026-10-31. The rules are in [CONTRIBUTING.md](../../CONTRIBUTING.md#docs). This file is the index. An ADR does not cite a requirement ID.

A Markdown category file is `docs/requirements/<ID>-slug.md` (example shape `F3-slug.md`). The MCP pilot is `docs/requirements/F1-mcp.yaml`. This README is not a category file. The check skips it, so the examples below are not requirements.

## File

- Name the file with the category ID, a hyphen, and a lowercase slug: `F3-slug.md`.
- `# F3 Title` is the category. `## F3.2 Title` is a requirement. `### F3.2.1 Title` is a detail or edge case.
- Heading level matches the ID: one, two, or three parts. A number does not start with 0. Text in a paragraph is not an ID.
- Put one status line in that section: `Status: Proposed`, `Status: Accepted`, `Status: Implemented`, or `Status: Verified`. A parenthetical may follow, as in `Status: Accepted (merged)`.
- Put a child after its parent, in the same file.
- Removing a requirement deletes it and renumbers later siblings so IDs stay contiguous. Update tests that name the moved IDs in the same pull request.

## YAML

A pilot category file may be `F1-mcp.yaml`. Write block lists, not flow style (`[]` or `{}`). `pnpm check` runs Prettier on these files and rejects flow style.

- Top-level keys are `id`, `title`, and `requirements`. `id` matches the file name (`F1`).
- Each requirement has `id`, `text` (one sentence), and `details`.
- Each detail has `id`, `text` (one sentence), and `proposed: true` when it is not implemented. Omit `proposed` once the detail is implemented; it then needs a test.
- IDs stay contiguous, in the same file as their parent.

## Check

`pnpm check` runs [scripts/requirements.mjs](../../scripts/requirements.mjs).

- Proposed and Accepted need no test.
- Implemented and Verified need the ID in a `test('F3.2.1 …')` or `it('F3.2.1 …')` name, a mention in another file under `scripts/`, or a `Check: manual` line on that ID.
- `skip` and `todo` do not count. A mention only in the test body does not count.
- An ID in a test or script must be an ID in a category file. The shape is `F`, `N`, or `S` plus a number (`F3`, `F3.2`, `F3.2.1`).
- Sibling numbers in one category file have no gaps.
- No category files and no ID references is a pass.

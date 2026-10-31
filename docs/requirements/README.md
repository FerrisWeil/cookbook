# Requirements

Taylor confirmed this format on 2026-10-31. The rules are in [CONTRIBUTING.md](../../CONTRIBUTING.md#docs). This file is the index. An ADR does not cite a requirement ID.

No topic files exist yet. A topic file is `docs/requirements/<ID>-slug.md` (for example `F1-mcp.md`). This README is not a topic file. The check skips it, so the example below is not a requirement.

## F1 MCP
F1.2 The MCP lists recipes. [Proposed]
- F1.2.1 Results are sorted by title.
- F1.2.2 An empty cookbook returns an empty list.

A topic is a short heading. A requirement is one sentence and a status tag: `[Proposed]`, `[Accepted]`, `[Implemented]`, or `[Verified]`. A detail is one sentence under it. Edge cases are details. Topics and details have no status.

Removing a requirement deletes it and renumbers later siblings so IDs stay contiguous. Update tests that name the moved IDs in the same pull request.

`pnpm check` runs [scripts/requirements.mjs](../../scripts/requirements.mjs).

- Proposed and Accepted need no test.
- Implemented and Verified need a `describe` whose name contains the requirement ID. Each detail needs a `test` or `it` name that contains the detail ID. A requirement with no details needs a test that names the requirement ID inside that describe.
- A `[Manual]` tag on the requirement line covers that requirement and its details. A mention in another file under `scripts/` covers the named ID.
- `skip` and `todo` do not count. A mention only in the test body does not count.
- An ID in a test or script must be a topic, requirement, or detail in a topic file. Sibling numbers in one topic file have no gaps.
- No topic files and no ID references is a pass.

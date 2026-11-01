# Requirements

Taylor confirmed this format on 2026-10-31. The rules are in [CONTRIBUTING.md](../../CONTRIBUTING.md#docs). This file is the index. An ADR does not cite a requirement ID.

The kitchen UI topic is `docs/requirements/F3-kitchen-ui.md`. A topic file is `docs/requirements/<ID>-slug.md`. This README is not a topic file. The check skips it, so the example below is not a requirement.

## F1 MCP
F1.2 The MCP lists recipes.
- F1.2.1 Results are sorted by title.
- F1.2.2 An empty cookbook returns an empty list. [Proposed]

F1.2.1 needs a test. F1.2 needs a describe because F1.2.1 is unmarked. F1.2.2 needs no test.

A topic is a short heading. A requirement is one sentence. A detail is one sentence. `[Proposed]` is the only marker, and only on a detail.

Removing a requirement deletes it and renumbers later siblings so IDs stay contiguous. Update tests that name the moved IDs in the same pull request.

`pnpm check` runs [scripts/requirements.mjs](../../scripts/requirements.mjs).

- An unmarked detail needs a `test` or `it` name that contains its ID. `[Proposed]` details need none. A `describe` named with the requirement ID is required when any detail is unmarked. If every detail is `[Proposed]`, no describe and no tests are required.
- A requirement with no details needs that describe and a test named with its ID.
- `skip` and `todo` do not count. A mention only in the test body does not count.
- An ID in a test or script must be a topic, requirement, or detail in a topic file. Sibling numbers in one topic file have no gaps.
- No topic files and no ID references is a pass.

## Type

- Type: Feature | Task | Docs | Bug | Spike | Chore | Security fix
- ADR: yes | no
- Link:

Rules for the type and for the ADR axis: CONTRIBUTING.md.

## What

## Why

## ADRs

Merged means accepted (Taylor, 2026-10-26): an ADR merged to `master` is accepted. Do not mark this PR ready while a decision below is still unconfirmed.

ADR text has no versions, ports, file paths, env names, commands, or schemas. Those belong in the linked doc.

- Accepted (Taylor confirmed in chat, or already merged to `master`):
- Proposed (this PR stays draft until Taylor confirms these):

## Requirements

Batch wording changes in one pull request. Use a separate pull request when the behavior change is risky. List the IDs. The format is in CONTRIBUTING.md.

- IDs:

## Demo

Fill this when the type requires a demo. The rule is in CONTRIBUTING.md.

## Security

Run `docs/security-review.md` before this PR is marked ready. Add this section only when that checklist finds a problem or an exception. A clean change leaves it out.

## How to run

```bash
cp .env.example .env
# set the three POSTGRES_* passwords; do not commit .env
docker compose up --build
```

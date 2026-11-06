## Type

- Type: Feature | Task | Docs | Bug | Spike | Chore | Security fix
- Link:

Rules: CONTRIBUTING.md.

## What

For a Feature: outcome, scope, YAML IDs, the scenario, and open questions. Do not attach a separate plan file.

## Why

## Decisions

Do not add a new ADR file. Durable rationale belongs in the living topic doc.

- Living docs:
- Existing ADRs retired or amended:

## Requirements

Batch wording changes in one pull request. Use a separate pull request when the behavior change is risky. List the IDs. The format is in CONTRIBUTING.md. `covers()` traces an ID; it is not acceptance. Say what is proven, what is only mapped, and what is unproven.

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

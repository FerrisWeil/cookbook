## What

## Why

## ADRs

Merged means accepted (Taylor, 2026-10-26): an ADR merged to `master` is accepted. Do not mark this PR ready while a decision below is still unconfirmed.

- Accepted (Taylor confirmed in chat, or already merged to `master`):
- Proposed (this PR stays draft until Taylor confirms these):

## Security

Add this section only when `docs/security-review.md` finds a problem or an exception. A clean change leaves it out.

## Demo

Screenshots or a recording, **or** Taylor ran it locally. Functional tests wait until that confirmation.

## How to run

```bash
cp .env.example .env
# set the three POSTGRES_* passwords; do not commit .env
docker compose up --build
```

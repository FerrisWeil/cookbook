## What

## Why

## ADRs

- Accepted (Taylor confirmed in chat):
- Proposed (do not merge as accepted):

## Security review

Fill every item. Name a path or paste command output. `n/a` only with the files that were opened. Taylor confirms the filled checklist. Docs-only PRs fill it too.

### Dependencies

- New or updated direct dependencies, and why this PR needs them.
- Who maintains each one, and whether it is abandoned.
- Install scripts. `allowBuilds` in `pnpm-workspace.yaml` is the gate. Name any new entry.
- `pnpm audit --audit-level=high` output. Moderate advisories are listed here and do not fail CI.
- Lockfile updated in the same PR as any manifest or `packageManager` change.
- `minimumReleaseAgeExclude` and `audit.ignore` are unchanged, or each entry is named.

### Secrets and env

- No new secret, token, recipe, or note in git. `.env.example` gained placeholders only.
- No default password or token in a Compose file.

### Auth and tokens

- Every new API route and MCP tool says whether the MCP bearer token is required.
- Unauthenticated responses stay status-only. No recipe, note, or token in that body.

### Network

- NAS Compose gained no `ports:` and no Tailscale Funnel.
- Every published local port is named, with the bind address. Postgres is not in that list.
- Web and MCP are not on the database network. If a PR puts them there, it says why.

### Images and Compose

- Image, capabilities, mounts, and env for each service this PR changes.
- Third-party image refs include a digest. Actions this PR touches are full SHAs.
- `permissions` are unchanged, or the new permission is named and is not on a `pull_request` job.
- Read the local Compose file and `deploy/nas/docker-compose.yml` separately. This PR does not edit the NAS file unless it owns that stack.

### Data and logging

- Logs, errors, fixtures, and screenshots contain no recipes, notes, or tokens.

## Demo

Screenshots or a recording, **or** Taylor ran it locally. Functional tests wait until that confirmation.

## How to run

```bash
cp .env.example .env
# set the three POSTGRES_* passwords; do not commit .env
docker compose up --build
```

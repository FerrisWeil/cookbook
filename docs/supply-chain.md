# Supply chain

Current detail for [0014](decisions/0014-supply-chain.md). The checklist rows are in [security-review.md](security-review.md).

## Dependabot

`.github/dependabot.yml` is the schedule. It is weekly, on Monday, with no automerge.

- `npm` at `/`. One group for `minor` and `patch`. Majors are outside that group. `cooldown.default-days: 1`. Cooldown applies to version updates only.
- `github-actions` at `/`. One group for every Action.
- `docker` at `/docker`. One group for `minor` and `patch`. The Dockerfiles live in that directory.
- `docker-compose` at `/`, `directory: /`. One group for `minor` and `patch`.

`open-pull-requests-limit` is 5 for version updates. Security updates are not in those groups, so one advisory is not stuck behind a bundle. Security updates stay enabled.

`cooldown` does not delay security updates. `minimumReleaseAge` does: pnpm refuses a release younger than one day on any install, including a security bump. Dependabot rebases. That wait is accepted.

## Lockfile and audit

`packageManager` is pinned in `package.json`. `pnpm-lock.yaml` is two YAML documents. Do not set `pmOnFail: ignore`. That would flatten the lockfile and stop pnpm from enforcing the pin. npm security alerts stay blind until GitHub's graph reads the second document. `pnpm audit` is the gate until then.

- CI and Docker install with `pnpm install --frozen-lockfile`. A manifest or `packageManager` change updates the lockfile in the same pull request.
- `pnpm-workspace.yaml` sets `audit.level: high`, `minimumReleaseAge: 1440`, `strictDepBuilds: true`.
- `pnpm check` runs `pnpm audit --audit-level=high` with no `--ignore-registry-errors`, `--prod`, or `--ignore-unfixable`.
- `allowBuilds` is `esbuild: true` only. A new entry is a checklist item.
- `audit.ignore` is empty. An entry is a GHSA id named on the checklist.
- `minimumReleaseAgeExclude` is unset. An entry is a checklist item.
- `blockExoticSubdeps` stays at its default, true.
- No Socket, Snyk, OSV-Scanner, Trivy, or dependency-review action.

## Pins

- GitHub Actions in `.github/workflows/ci.yml` are full commit SHAs with a trailing version comment. `actions/checkout` sets `persist-credentials: false`. Workflow `permissions` are `contents: read`.
- Third-party images in the Dockerfiles and the root `docker-compose.yml` are `name:tag@sha256:…` with a specific version tag.
- Images this repo builds are not digest-pinned.
- The NAS file still uses floating tags (`postgres:16-alpine`, `tailscale/tailscale:stable`). Pinning that file is part of the production Compose work, which is not in the tree.

## Review

CI is the merge bar. Write a Security section only for a hit: audit output when it is not clean, a change to `allowBuilds`, `audit.ignore`, or `minimumReleaseAgeExclude`, a new install script, an Action that is not a full SHA, an image without a digest, or a new `ports:` key. A clean diff has no Security section. A bot pull request is not a new ADR.

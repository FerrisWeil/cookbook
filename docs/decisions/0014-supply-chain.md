# 0014. Dependency updates and supply-chain hygiene

* Status: **proposed**
* Date: 2026-10-26
* Confirmed: (none — do not treat as accepted)

> **Proposed.** Taylor has not confirmed this in chat. Do not add Dependabot, change `pnpm check`, pin images, or edit Compose until he confirms the items below.

## Context

[0013](0013-security-review.md) is accepted. Taylor said so on 2026-10-26: the merged foundation ADRs, including 0013, count as confirmed. This ADR does not edit 0013's status line. Another agent is updating those headers.

0013 already decides the per-PR checklist, `pnpm audit --audit-level=high`, gitleaks, and the Postgres shape (separate roles, an internal network shared only by `db` and `api`, no published `5432`, no well-known password). Those are not reopened here. The comparison and the follow-up that is still open are in [supply chain](../supply-chain.md).

What 0013 does not decide is how version updates are scheduled and grouped, how a bot PR is reviewed, what happens while GitHub's dependency graph cannot see this repo's pnpm 12 lockfile, or how install scripts, Actions, and images stay pinned. The app holds recipes and notes on a private NAS, and Taylor will not audit every package himself. The repo is public, so a mutable Action tag or image tag is a real path onto that machine once CI or Unraid pulls it.

## Options considered

1. **Dependabot, with grouped weekly version updates and immediate security updates.** Built into GitHub. No extra app. Covers the npm ecosystem (this repo's pnpm lockfile), Docker, Docker Compose, and GitHub Actions. Version PRs are grouped so Taylor is not asked to merge one PR per package. Security PRs stay separate. Recommended.
2. **Renovate.** It reads this repo's two-document pnpm 12 lockfile, which GitHub's dependency graph currently does not, so it can open npm security PRs that Dependabot alerts will not. It also groups more precisely. The cost is the Mend GitHub App, or a self-hosted workflow with a token. That is a second party and a second config for a workspace this size.
3. **Security updates only, as 0013 worded it.** No weekly version PRs. Known CVEs get a PR when the graph can see them. Everything else drifts until someone notices. Taylor has already said he will not audit packages one by one, so drift is the likely outcome.

## Decision (proposed)

Use option 1. Detail, including the Renovate comparison and the pnpm 12 lockfile limit, is in [supply chain](../supply-chain.md).

Confirm each item on its own. Unconfirmed items stay proposed.

1. **Dependabot, not Renovate.** Version updates run weekly, grouped: npm minor and patch in one PR, majors left ungrouped; GitHub Actions in one PR; Docker minor and patch in one PR; Compose minor and patch in one PR. `cooldown.default-days` matches the release age in item 5 (1 day at 1440 minutes, 7 days if that item is 10080). Security updates stay enabled and ungrouped, and cooldown does not delay them. No automerge. This supersedes only one sentence of 0013, the sentence that limits Dependabot to security updates and rejects a weekly bump. The rest of 0013 stands. If this item is rejected, that sentence stands.
2. **Bot PRs use the 0013 checklist**, plus the rows in [supply chain](../supply-chain.md). The reviewer pastes `pnpm audit` output and says whether `allowBuilds`, `audit.ignore`, or `minimumReleaseAgeExclude` changed. A green checklist is the merge bar. A bot PR is not a new ADR.
3. **`pnpm audit --audit-level=high` stays the npm vulnerability gate** inside `pnpm check`, including devDependencies. `audit.level: high` is set in `pnpm-workspace.yaml` so a bare `pnpm audit` matches CI. The command does not pass `--ignore-registry-errors`, `--prod`, or `--ignore-unfixable`. `audit.ignore` stays empty until a GHSA is named on the checklist. No Socket, Snyk, OSV-Scanner, Trivy, or dependency-review action.
4. **Do not flatten the pnpm 12 lockfile** with `pmOnFail: ignore`. That setting turns off enforcement of the pinned package manager. npm security alerts stay blind until GitHub's graph reads the second document. `pnpm audit` is the gate in the meantime. Docker and Actions alerts do not depend on that parser.
5. **Supply-chain pins.** CI and Docker keep `pnpm install --frozen-lockfile`. A manifest change updates `pnpm-lock.yaml` in the same PR. `trustLockfile` stays off. `allowBuilds` stays limited to `esbuild: true` unless a package this tree already needs must be added, and that addition is a checklist item. `strictDepBuilds: true`. `minimumReleaseAge: 1440` is set explicitly, which turns on strict mode. `blockExoticSubdeps` stays at its default, true. GitHub Actions are pinned to a full commit SHA with a trailing version comment, and `actions/checkout` sets `persist-credentials: false`. Third-party images in Dockerfiles and the local Compose file are `name:tag@sha256:…` with a specific version tag. Images this repo builds are not digest-pinned.
6. **The feature PR implements 0013 on the local Compose file and implements this ADR.** It does not edit `deploy/nas/`. Requirements for that file and for GHCR publishing are in [supply chain](../supply-chain.md), for the agent that owns them.

## Consequences (if accepted)

* One follow-up PR, after this one merges, if item 6 is accepted. It adds `.github/dependabot.yml`, the pnpm settings above, `pnpm audit` inside `pnpm check`, SHA pins in `.github/workflows/ci.yml`, digest pins in the Dockerfiles and the root `docker-compose.yml`, the 0013 local Postgres shape (roles, internal `db` network, no published port, no default password), and the checklist rows on the PR template and in [security review](../security-review.md). `pnpm check` and `pnpm smoke` stay green. No Playwright tests. Smoke is expected to pass in GitHub CI, where containers on the same Compose network can reach each other. The database port stays unpublished even where a nested VM cannot route that traffic. If item 6 is rejected, the follow-up still does the accepted supply-chain items and leaves the local Postgres file as it is.
* `deploy/nas/docker-compose.yml` is out of that PR. The other agent applies the same Postgres rules and the same image pins there.
* A security update younger than one day can fail `pnpm install` until the release ages. That wait is accepted for a household app that is not on the public internet.
* Rejecting item 1 leaves 0013's "security updates only" sentence in force. Items 2–6 can still be accepted.
* Does not decide API authentication, image signing, or a second scanner. Priority for those is in [supply chain](../supply-chain.md).

# Supply chain

Detail for [0014](decisions/0014-supply-chain.md). Status is **accepted** (Taylor, 2026-10-25, agent chat). The feature PR applies it. This page does not edit `deploy/nas/`.

## Already decided

Taylor confirmed [0013](decisions/0013-security-review.md) on 2026-10-26 by treating the merged foundation as accepted. This page does not reopen it. The status line inside that file is being updated separately.

These stay as 0013 wrote them:

* Every PR fills the checklist in [security review](security-review.md). Taylor confirms the filled checklist. There is no second review bot.
* `pnpm audit --audit-level=high` fails CI. Moderate advisories are listed on the checklist and do not fail CI.
* gitleaks stays inside `pnpm check`.
* Postgres uses `cookbook_app` for requests and `cookbook_migrator` for migrations. The image superuser is init-only. Passwords come from the env file. Compose has no default password.
* The database has no `ports:` key. It sits on an internal network with the API only. `docker compose exec db psql` is how a human reaches it. Binding `127.0.0.1:5432` was considered in 0013 and rejected, because a `ports:` key is the edit a later change widens to every interface.
* Socket and Snyk are out. A password does not encrypt `data/postgres`. Backups and directory modes are the ones 0013 names (`0700` for the data directory, `0600` for `.env`, `pg_dump` while Postgres is running).

The local Compose file still publishes `5432` and still falls back to the password `cookbook`. The NAS file still connects the API as the superuser on one shared network. That is unfinished implementation. The feature PR does the local half. It does not edit `deploy/nas/`.

## 1. Dependabot and Renovate

The repo pins `packageManager` to pnpm 12.15.0 ([0009](decisions/0009-repo-layout.md)). `pnpm-lock.yaml` is two YAML documents: a boot document for pnpm itself, then the project graph. Both start with `---`. GitHub's dependency graph still reads the first document only, so it sees pnpm's own packages and none of the app's dependencies. Dependabot version updates still work. Dependabot alerts and npm security updates are not created for those dependencies until GitHub fixes the parser. That limit is the [2026-10-20 changelog](https://github.blog/changelog/2026-10-20-dependabot-now-supports-npm-12-pnpm-11-and-12-and-bun-1-4/) and [dependabot-core#15904](https://github.com/dependabot/dependabot-core/issues/15904).

`pmOnFail: ignore` would write a single-document lockfile again. It also stops pnpm from enforcing the pinned package manager. We do not do that. CI and Docker already install with `--frozen-lockfile`, which is the enforcement we want.

| | Dependabot | Renovate |
| --- | --- | --- |
| Who runs it | GitHub, on a public repo, no extra app | Mend's GitHub App, or a workflow we host with a token |
| pnpm 12 lockfile | Version updates work. npm alerts and npm security PRs do not, until the graph reads the second document | Parses multi-document lockfiles since Renovate 43.209.5 (2026-06-03). With vulnerability alerts enabled, it can open the npm security PRs Dependabot currently cannot. Lockfile updates work on pnpm 12.3.4 and later; we are on 12.15.0 |
| Docker and Actions | Security updates and version updates. Actions pinned to a full SHA are updated, including the version comment. An image that already has a digest keeps a digest | Same coverage, plus helpers that add digests on their own |
| Grouping | Per ecosystem, by semver level. Security updates can be left out of the group | Finer rules, a dashboard, and `stabilityDays` |
| What Taylor trusts | GitHub, which already hosts the public repo | Mend, or a bot token in CI |
| What fails a bad npm bump today | `pnpm audit` in `pnpm check`, which reads the lockfile with pnpm and is not affected by the graph bug | The same `pnpm audit` gate, plus a bot PR that arrives sooner |

Renovate is the better bot for npm security PRs on this lockfile. It is the wrong amount of machinery once `pnpm audit` is in `pnpm check`, as 0013 requires, and while Docker and Actions alerts do not have the lockfile bug. A missed npm security PR then turns CI red and a person opens the bump. A vulnerable tree does not merge on a green build.

Recommendation: Dependabot. Revisit Renovate in a new ADR if GitHub's graph is still blind and a high advisory has sat with no bot PR long enough that the red build is being ignored. Do not install the Renovate app in the meantime.

### Cadence and grouping

0013 says Dependabot opens security updates only, and rejects a weekly bump-all. That sentence is the one item 1 of 0014 would supersede. A weekly bump of every package as its own PR is noise. A weekly bump that never happens is how a household app stays on abandoned releases. Grouping is the middle.

Accepted `dependabot.yml` shape, written in the feature PR:

* `npm` at `/`, weekly. One group for `minor` and `patch`. Major updates do not match that group, so each major is its own PR. `cooldown.default-days: 1`. Cooldown applies to version updates only.
* `github-actions` at `/`, weekly, one group for every Action.
* `docker` at `/`, weekly, one group for `minor` and `patch`. A major image bump is its own PR. This covers the Dockerfiles.
* `docker-compose` at `/`, weekly, the same minor/patch group. `directory: /` includes `docker-compose.yml` and `deploy/nas/docker-compose.yml`. A Dependabot PR may edit the NAS file to bump an image. That is the point of the bot. Hand-editing that file is still reserved for the agent that owns the production stack.
* `open-pull-requests-limit: 5` for version updates. Security updates have their own limit and do not count toward it.
* Groups do not set `applies-to: security-updates`. Security PRs stay ungrouped so one CVE is not stuck behind a bundle.
* No automerge. No reviewers block that auto-approves.

`cooldown` does not delay security updates. `minimumReleaseAge` does, because pnpm will refuse a release younger than one day on any install, including a security bump. A security PR opened the hour a patch is published can fail CI until the next day. Dependabot rebases. For an app that is not on the public internet, that wait is accepted.

### How an update PR is reviewed

Same bar as any other PR under 0013. The person or agent who wants it merged fills the checklist. They paste:

* `pnpm audit --audit-level=high` output.
* Whether `allowBuilds`, `audit.ignore`, or `minimumReleaseAgeExclude` changed. A change names the package or the GHSA and why.
* For an npm PR: the lockfile diff is the update, and no install script was added.
* For an Actions PR: the diff is a full SHA and its version comment.
* For an image PR: the diff is a tag and a digest, and no `ports:` key was added.

Taylor confirms the filled checklist is enough. He does not read every changelog. Merging the PR does not require a new ADR.

## 2. Vulnerability scanning in CI

`pnpm audit` asks the registry about the lockfile pnpm itself parsed, so the two-document bug does not apply. On 2026-10-26, `pnpm audit --audit-level=high` on this lockfile reported no known vulnerabilities. That fact will go stale. The threshold should not.

| Gate | What it catches | Cost on this repo |
| --- | --- | --- |
| `pnpm audit --audit-level=high` | High and critical npm advisories, including devDependencies | One command inside `pnpm check`. Needs the registry. Fails closed if omitted flags below are respected |
| `pnpm audit` with no level | Low and moderate too | Noisy at this size. 0013 already keeps moderate on the checklist |
| `pnpm audit --audit-level=critical` | Only critical | Lets a high advisory through onto a machine that stores family notes |
| `pnpm audit --prod` | Production deps only | Hides a compromised dev tool. esbuild's install script already runs here. DevDependencies stay in the audit |
| `--ignore-registry-errors` | Nothing, when the registry errors | Turns a failed lookup into a green build. Forbidden |
| `--ignore-unfixable` | Hides highs that have no patched release | The checklist is where an unfixable advisory is discussed. A blanket flag is forbidden |
| Dependabot alerts | npm, once the graph works; Docker and Actions now | Free with GitHub. Not a CI gate. Taylor turns the alerts and the security updates on in the repo settings. This repo cannot commit that click |
| Socket, Snyk, OSV-Scanner | Overlapping npm coverage, sometimes install-script behavior | Another account. 0013 rejected this class of tool |
| `dependency-review-action` | The PR diff, from GitHub's graph | Same blind spot as npm alerts on this lockfile, plus another Action to pin |
| Trivy or Grype | Image CVEs | A third scanner and registry rate limits. Digest pins plus Dependabot docker updates come first |

Operational rules, on top of the threshold 0013 already set:

* `pnpm check` runs `pnpm audit --audit-level=high` with no ignore flags.
* `pnpm-workspace.yaml` sets `audit.level: high` so a local `pnpm audit` matches CI.
* Exceptions are `audit.ignore` entries, GHSA ids only, each justified on the checklist. The list starts empty. `auditConfig.ignoreCves` is not used; current pnpm does not treat CVE ids as the ignore key.
* DevDependencies are included.

## 3. Pins and install scripts

### Lockfile

[0009](decisions/0009-repo-layout.md) already requires `pnpm-lock.yaml` and `--frozen-lockfile` in Docker. CI already installs with `--frozen-lockfile`. The rule to write down:

* A PR that changes any `package.json`, `pnpm-workspace.yaml`, or the `packageManager` field updates `pnpm-lock.yaml` in the same PR.
* `trustLockfile` stays unset. Setting it skips the supply-chain check on install. This repo is public and other agents edit the lockfile.

### Install scripts

pnpm does not run dependency lifecycle scripts unless `allowBuilds` allows them. Today the only entry is `esbuild: true`. A frozen install on 2026-10-26 ran that script and no other. esbuild stays allowed because the web build needs it.

* `strictDepBuilds: true`, so a new package with an install script fails `pnpm install` until someone adds it to `allowBuilds` and names it on the checklist.
* Do not add `onlyBuiltDependencies` or `neverBuiltDependencies`. `allowBuilds` replaces them. A `neverBuiltDependencies` list on its own means every other package may run scripts.
* The feature PR runs an install with `strictDepBuilds` on and adds an `allowBuilds` line only if a package already in the tree has a script the build needs. Each added line is called out in that PR.

### Release age

pnpm 11 and later default `minimumReleaseAge` to 1440 minutes, and that default is non-strict: if nothing in range is old enough, pnpm installs the new release anyway. Setting the value explicitly turns on strict mode, which fails the install instead of falling back. That is the behavior we want. A minutes-old release cannot be the one a public lockfile picks up just because it is the only match.

* Set `minimumReleaseAge: 1440`.
* `minimumReleaseAgeExclude` starts empty. An entry is a checklist item.
* 10080 minutes (seven days) was the stricter alternative. Taylor accepted 1440.

`blockExoticSubdeps` defaults to true. Transitive dependencies must come from the registry, not from a git URL or a raw tarball. Leave the default. Do not set it to false.

`trustPolicy: no-downgrade` is real protection and a noisy first enable, because older packages often have no provenance. It is priority 2, not part of the feature PR.

### GitHub Actions

`.github/workflows/ci.yml` uses floating tags: `actions/checkout@v5`, `pnpm/action-setup@v4`, `actions/setup-node@v5`. A tag can move. CI today has `permissions: contents: read` and no secrets, so a poisoned Action can lie about a green build and can read the public repo, which it could read anyway. The agent adding GHCR publishing will have a write token. SHA pins need to be the rule before that token exists.

* Pin every Action to the full 40-character commit SHA, with a trailing `# vX.Y.Z` comment. Dependabot's `github-actions` updates both.
* `actions/checkout` sets `persist-credentials: false`. CI does not push.
* Workflow `permissions` stay `contents: read` unless a job names a narrower extra permission. A job that runs on `pull_request` does not receive secrets and does not get `packages: write`.

### Images

Floating tags in the tree today: `postgres:16-alpine`, `node:22-alpine`, `nginx:1.27-alpine`, and on the NAS file `tailscale/tailscale:stable`. Dependabot will not add a digest to a tag that has none, unless an experiment flag is on. The feature PR adds the digests. Dependabot then updates tag and digest together.

* Third-party images are `name:tag@sha256:…`. The tag is a specific release, not `stable`, not `16-alpine`, not `22-alpine`, not `1.27-alpine`.
* Images built from this repo (`api`, `web`, `mcp`) stay `build:` entries. They are not pulled by digest.
* The feature PR pins Dockerfiles and the root `docker-compose.yml` only.

## 4. Checklist rows to add

[security review](security-review.md) already covers dependencies, secrets, auth, network, Compose, and logging. The feature PR appends these rows. It does not rewrite the 0013 list.

* Lockfile updated in the same PR as any manifest or `packageManager` change, or `n/a` with the files opened.
* `allowBuilds` and `minimumReleaseAgeExclude` are unchanged, or each new entry is named.
* `audit.ignore` is unchanged, or each GHSA is named.
* `pnpm audit --audit-level=high` output is pasted. Moderate advisories are listed and do not fail CI.
* Actions this PR touches are full SHAs. `permissions` are unchanged, or the new permission is named and is not on a `pull_request` job.
* Third-party image refs this PR touches include a digest. No new `ports:` key. Postgres is still unpublished.
* Logs, fixtures, and screenshots still contain no recipes, notes, or tokens. This row is already in 0013; it stays.

The PR template gains the same list, including the 0013 sections, so a reviewer does not have to assemble it from two docs. Docs-only PRs still fill it. `n/a` still requires the files that were opened.

## 5. Requirements for the NAS stack and GHCR

Another agent is adding the production Unraid Compose stack, GHCR publishing, and the setup guide. This work does not edit `deploy/nas/`. That agent should apply the following. They are requirements, not a second copy of the file.

* `db` has no `ports:` key. Do not bind `127.0.0.1:5432`.
* The database network is `internal: true` and its only members are `db` and `api`. Web, MCP, and the Tailscale sidecars are not on it. They reach the API on the app network.
* Three env values, no defaults, no `:-cookbook` fallback: `POSTGRES_SUPERUSER_PASSWORD` (init only, not set on the API container), `POSTGRES_MIGRATOR_PASSWORD` (`cookbook_migrator`), `POSTGRES_APP_PASSWORD` (`cookbook_app`). An init script creates the two roles. `cookbook_app` has no DDL. The local feature PR will add that script for the local file; the NAS file should mount the same script.
* Third-party images, including Postgres and `tailscale/tailscale`, use a specific version tag and a digest. `:stable` does not satisfy that.
* GHCR: pin Actions to a full SHA. Default workflow permissions are `contents: read`. `packages: write` is only on a job that runs for a push to the default branch or for `workflow_dispatch`, not for `pull_request`. Do not put Tailscale keys, the MCP token, or database passwords in GitHub Actions secrets used by a pull request workflow. The public repo must not receive NAS secrets.
* The setup guide includes the backup and directory-mode notes from 0013: `data/postgres` mode `0700`, `.env` mode `0600`, neither path shared over SMB or NFS, backups taken with `pg_dump` while Postgres is running.

`scripts/smoke.sh` renders the NAS file with dummy env values and does not start it. Whoever changes the NAS env names updates that render step in the same PR. The 0014 feature PR will not edit the NAS file to make the render pass.

## 6. What else is worth doing, and when

Priority 1 is the feature PR described above, plus the GitHub settings page, which this repo cannot commit. Turn on Dependabot alerts and Dependabot security updates. Turn on secret scanning, and push protection if that toggle is offered for this public repo.

Priority 2, a later PR, after this one is in and green:

* `trustPolicy: no-downgrade`, with `trustPolicyIgnoreAfter` if the first install is a pile of excludes. Do it when there is time to read those excludes. Do not block the Postgres work on it.
* Run the web image as non-root. API and MCP already set `USER node`. `docker/web.Dockerfile` uses the official nginx image, which runs as root and listens on port 80. Changing that is easy to get wrong and is not the supply-chain hole.

Priority 3, not recommended now:

* Trivy or Grype, CodeQL, a read-only root filesystem, dropped capabilities, TLS between API and Postgres on the two-member network, cosign, and an SBOM. Each is a real control on a larger or internet-facing system. Here they add a tool Taylor would have to trust, ahead of the pins that remove the mutable tags.
* An auth scheme for the HTTP API. There are no recipe routes yet. Tailscale is the boundary ([0002](decisions/0002-tailscale-only.md)). Decide auth with the first feature that returns a recipe.
* The local MCP dev token. [0007](decisions/0007-public-repo-secrets.md) allows `local-dev-token-not-for-nas` on the local Compose file only. That exception does not extend to database passwords.

## Feature PR

One PR after 0014 merges. Files it is expected to touch:

* `.github/dependabot.yml`
* `.github/workflows/ci.yml` (SHA pins, `persist-credentials: false`)
* `pnpm-workspace.yaml` and the root `package.json` `check` script
* `docker/api.Dockerfile`, `docker/mcp.Dockerfile`, `docker/web.Dockerfile`, root `docker-compose.yml`
* `db/init` role SQL, API connection split, `.env.example` placeholders, `scripts/smoke.sh` so local boot uses generated passwords and does not print them
* `.github/PULL_REQUEST_TEMPLATE.md`, [security review](security-review.md), a `features/` doc

It does not edit `deploy/nas/`. `pnpm check` and `pnpm smoke` stay green. Browser tests wait until Taylor has seen the stack run.

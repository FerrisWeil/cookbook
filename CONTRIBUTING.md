# Contributing

Cookbook is Taylor's household recipe app. Agents and humans follow the same rules.

## Agents

Hard rules from Taylor (2026-10-25). They apply to every agent working in this repo, including before starting a sub-agent.

1. Sub-agents may be started only with Composer 2.5 (`composer-2.5`) or Grok 4.7 (`grok-4.7-high` by default). Never a `-fast` variant. Never Claude, GPT, Gemini, or any other family.
2. Use Grok 4.7, not Grok 4.6 (`cursor-grok-4.6-*`). They are the same price. Use 4.6 only when you have a specific reason 4.7 cannot do the job, and say that reason.
3. Default Grok effort is high. Do not use extra-high (`xhigh`) unless high cannot meet Taylor's standard.
4. Context window stays at 256k. Ask Taylor before using a larger window. This is to save usage.

In-repo skills link to this file. They do not copy it.

## Work types

Confirmed by Taylor, 2026-10-26, in agent chat. This section is the source of truth. Each pull request declares its type and whether it needs an ADR (`yes` or `no`). Nothing is an accepted decision until Taylor confirms it in chat. Merged means accepted.

**Merged means accepted** (Taylor, 2026-10-26). Once an ADR pull request is merged to `master`, every ADR in it is accepted, including a file whose Status line still says Proposed. Record that by setting Status to accepted and Confirmed to the merge date, or to the earlier chat confirmation. That is why 0008 and 0010–0013 are accepted: foundation PR #1 merged while those files still said Proposed. A change of mind after merge is a new ADR that supersedes the old one. Do not rewrite a merged decision in place.

Do not merge an ADR pull request while a decision in it is still unconfirmed. Keep that pull request draft, and leave Status as Proposed, until Taylor confirms in chat and the Status lines are updated. The feature pull request waits for those Status lines to say accepted. Merging a draft that still says Proposed would accept those ADRs under the rule above, which is why the draft stays a draft.

Every pull request is checked against the [security checklist](docs/security-review.md) before it is marked ready. [0013](docs/decisions/0013-security-review.md) is accepted. That checklist says when a finding is written into the pull request.

| Type | Meaning | Required with the pull request |
| --- | --- | --- |
| Feature | New user-facing behavior | A page under `features/`, and a demo (screenshots or a recording) before Taylor confirms. Functional Playwright tests only after he confirms it works. |
| Task | Infrastructure or engineering work with no user-visible behavior. Supply-chain pins and Postgres roles are tasks. | CI verifies it. No demo. A short note in the pull request. No `features/` page. |
| Docs | Documentation and workflow rules only | The doc change. |
| Bug | A fix for broken behavior | A regression test that proves the fix, in this pull request. |
| Spike | A throwaway experiment | Labeled as a spike. Commits on a branch. No pull request. Never a commit on `master`. |
| Chore | A chore or dependency update, including Dependabot | A lighter review. |
| Security fix | A bug with priority | Handle it before other bugs. |

**Decision** is a separate axis. Any type needs an ADR pull request first when the change makes a hard-to-reverse call or has real alternatives. ADRs hold only decisions that rarely change. A change of mind is a new ADR that supersedes the old one. Unconfirmed ADR text stays **Proposed** ([template](docs/templates/adr.md)). What an ADR may contain is [Docs](#docs).

Taylor confirmed the same day when to ask, and when a plan is committed.

Ask in chat, and do not edit, only for an architecture decision or a feature decision Taylor has not already confirmed. Architecture means the Decision axis above: hard to reverse, or real alternatives (an ADR). A feature decision is user-facing behavior that was not already named. When the agent wants feedback, word each item as a question. Put every question in one chat message. Each question includes the reasoning, and a recommendation when a reasonable one exists. Taylor answers the ones he wants.

Design updates and fixes do not wait for approval. Do them, then prove them. Do not expand scope.

A plan stays in the chat and, when there is a pull request, in the pull request description. Do not commit a plan file. Commit writing only when the change is an ADR, or the documentation itself is the work.

## Docs

Taylor confirmed this on 2026-10-31.

1. An ADR records a stable, high-level decision that rarely changes. It has no versions, ports, file paths, env names, commands, or schemas.
2. Current state lives in docs and READMEs, and changes with the code.
3. Docs are brief and readable: less verbose, understandable over detail.
4. Requirements are functional (F), non-functional (N), or system (S). The index is [docs/requirements/](docs/requirements/). Do not put requirements in an ADR. An ADR never cites a requirement ID. Only tests and docs/requirements reference IDs.

   - One topic per file: a short heading (`F1`). A requirement (`F1.2`) is one sentence with a status tag. A detail (`F1.2.1`) is one sentence under it. The shape is in [docs/requirements/](docs/requirements/).
   - Removing a requirement deletes it and renumbers later siblings so IDs stay contiguous. Update tests that name the moved IDs in the same pull request.
   - Status tags are Proposed, Accepted, Implemented, or Verified, on the requirement line only. A requirement can merge before it is implemented.
   - Each requirement change is its own pull request.
   - Implemented and Verified need a describe block named with the requirement ID and a test named with each detail ID. With no details, a test named with the requirement ID sits inside that describe. Proposed and Accepted need no test.
   - A `[Manual]` tag on the requirement line covers that requirement and its details; a smoke or script mention covers the named ID.

The map is [docs/README.md](docs/README.md). Merged means accepted is in [Work types](#work-types). Do not copy it into an ADR.

ADR numbers are contiguous. A merged ADR keeps its number. Taylor allowed one rewrite on 2026-10-31 that renumbered the set to `0001`–`0018`. Do not renumber again. The next ADR is `0019`.

## Checks

`pnpm` is the only JavaScript package manager ([0009](docs/decisions/0009-repo-layout.md)). CI installs dependencies and then runs these commands. The steps live in the scripts, not in the workflow file.

```bash
pnpm check   # lint, unit tests, build, secret scan, requirement IDs
pnpm smoke   # docker compose up --build and health checks
```

Unit tests for functions and classes live next to the app they test (`apps/*/test`). Requirement IDs are checked by `scripts/requirements.mjs`. What else a pull request must show is in [Work types](#work-types).

## Full stack

One command starts the whole local stack, including seed data:

```bash
docker compose up --build
```

That is the path cloud agents use. NAS deploy does not publish host ports. The accepted production file is not in the tree ([0015](docs/decisions/0015-production.md)). The command below is the skeleton. It builds on the NAS and reads a repo-root `.env`.

```bash
docker compose --env-file .env -f deploy/nas/docker-compose.yml up --build -d
```

## Secrets

This repo is public. Never commit `.env`, tokens, Tailscale keys, or real recipes. Use `.env.example` placeholders only. See [0007](docs/decisions/0007-public-repo-secrets.md).

## Templates

* [ADR](docs/templates/adr.md) — problem, options considered, decision, consequences, status
* [Feature](docs/templates/feature.md) — what it does, acceptance checks, how to run it

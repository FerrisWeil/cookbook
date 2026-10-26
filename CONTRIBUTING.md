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

| Type | Meaning | Required with the pull request |
| --- | --- | --- |
| Feature | New user-facing behavior | A page under `features/`, and a demo (screenshots or a recording) before Taylor confirms. Functional Playwright tests only after he confirms it works. |
| Task | Infrastructure or engineering work with no user-visible behavior. Supply-chain pins and Postgres roles are tasks. | CI verifies it. No demo. A short note in the pull request. No `features/` page. |
| Docs | Documentation and workflow rules only | The doc change. |
| Bug | A fix for broken behavior | A regression test that proves the fix. |
| Spike | A throwaway experiment | Labeled as a spike. May be committed directly. |
| Chore | A chore or dependency update, including Dependabot | A lighter review, and the [security checklist](docs/security-review.md). |
| Security fix | A bug with priority | The [security checklist](docs/security-review.md), every time. |

**Decision** is a separate axis. Any type needs an ADR pull request first when the change makes a hard-to-reverse call or has real alternatives. ADRs hold only decisions that rarely change. A change of mind is a new ADR that supersedes the old one. Unconfirmed ADR text stays **Proposed** ([template](docs/templates/adr.md)).

## Checks

`pnpm` is the only JavaScript package manager ([0009](docs/decisions/0009-repo-layout.md)). CI installs dependencies and then runs these commands. The steps live in the scripts, not in the workflow file.

```bash
pnpm check   # lint, unit tests, build, secret scan
pnpm smoke   # docker compose up --build and health checks
```

Unit tests for functions and classes live next to the app they test (`apps/*/test`). What else a pull request must show is in [Work types](#work-types).

## Full stack

One command starts the whole local stack, including seed data:

```bash
docker compose up --build
```

That is the path cloud agents use. NAS deploy does not publish host ports:

```bash
docker compose --env-file .env -f deploy/nas/docker-compose.yml up --build -d
```

## Secrets

This repo is public. Never commit `.env`, tokens, Tailscale keys, or real recipes. Use `.env.example` placeholders only. See [0007](docs/decisions/0007-public-repo-secrets.md).

## Templates

* [ADR](docs/templates/adr.md) — context, options considered, decision, consequences, status
* [Feature](docs/templates/feature.md) — what it does, acceptance checks, how to run it

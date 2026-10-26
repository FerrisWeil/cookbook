# Contributing

Cookbook is Taylor's household recipe app. Agents and humans follow the same rules.

## Agents

Hard rules from Taylor (2026-10-25). They apply to every agent working in this repo, including before starting a sub-agent.

1. Sub-agents may be started only with Composer 2.5 (`composer-2.5`) or Grok 4.7 (`grok-4.7-high` by default). Never a `-fast` variant. Never Claude, GPT, Gemini, or any other family.
2. Use Grok 4.7, not Grok 4.6 (`cursor-grok-4.6-*`). They are the same price. Use 4.6 only when you have a specific reason 4.7 cannot do the job, and say that reason.
3. Default Grok effort is high. Do not use extra-high (`xhigh`) unless high cannot meet Taylor's standard.
4. Context window stays at 256k. Ask Taylor before using a larger window. This is to save usage.

## Two PRs per feature

Every feature is two pull requests:

1. **ADR PR** — durable decisions only: what we chose, why, and options considered. Link details into `docs/` files. ADRs rarely change. A change of mind is a **new** ADR that supersedes the old one. Features may not need an ADR; spikes and bug fixes can skip this PR.
2. **Feature PR** — the implementation. Every feature is documented under `features/`, even when it had no ADR.

Nothing is an accepted decision until Taylor confirms it in the agent chat. Unconfirmed write-ups stay **Proposed** in the ADR (see `docs/templates/adr.md`). Do not mark an ADR PR ready until those confirmations exist.

## Tests

Every feature is tested end to end both **manually** and **in code**.

* Unit tests cover functions and classes. They live next to the app they test (`apps/*/test`).
* Functional tests use a real browser to prove the feature works and does not regress.
* **Do not write functional tests until Taylor confirms the feature works end to end.** Demo first: screenshots or a recording on the PR, or Taylor runs it locally. Then add the browser tests.

## Checks

`pnpm` is the only JavaScript package manager ([0009](docs/decisions/0009-repo-layout.md)). CI installs dependencies and then runs these commands. The steps live in the scripts, not in the workflow file.

```bash
pnpm check   # lint, unit tests, build, secret scan
pnpm smoke   # docker compose up --build and health checks
```

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

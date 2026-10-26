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

Nothing is an accepted decision until Taylor confirms it in the agent chat. Unconfirmed write-ups stay **Proposed** in the ADR (see `docs/templates/adr.md`). Do not set Status to accepted, and do not mark an ADR PR ready, until those confirmations exist.

**Merged means accepted** (Taylor, 2026-10-26). Once an ADR pull request is merged to `master`, every ADR in it is accepted, including a file whose Status line still says Proposed. Record that by setting Status to accepted and Confirmed to the merge date, or to the earlier chat confirmation. That is why 0008 and 0010–0013 are accepted: foundation PR #1 merged while those files still said Proposed. A change of mind after merge is a new ADR that supersedes the old one. Do not rewrite a merged decision in place.

Do not merge an ADR pull request while a decision in it is still unconfirmed. Keep that pull request draft, and leave Status as Proposed, until Taylor confirms in chat and the Status lines are updated. The feature pull request waits for those Status lines to say accepted. Merging a draft that still says Proposed would accept those ADRs under the rule above, which is why the draft stays a draft.

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

That is the path cloud agents use. NAS deploy does not publish host ports. The accepted Unraid file is `docker-compose.unraid.yml` at the repo root ([0015](docs/decisions/0015-unraid-compose-manager.md)–[0020](docs/decisions/0020-update-and-rollback.md)). It is not in the tree yet, so the command below is still the skeleton: it builds on the NAS and reads a repo-root `.env`.

```bash
docker compose --env-file .env -f deploy/nas/docker-compose.yml up --build -d
```

## Secrets

This repo is public. Never commit `.env`, tokens, Tailscale keys, or real recipes. Use `.env.example` placeholders only. See [0007](docs/decisions/0007-public-repo-secrets.md).

## Templates

* [ADR](docs/templates/adr.md) — problem, options considered, decision, consequences, amendments, status
* [Feature](docs/templates/feature.md) — what it does, acceptance checks, how to run it

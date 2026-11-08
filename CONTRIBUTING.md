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

Confirmed by Taylor, 2026-10-26, in agent chat. This section is the source of truth. Each pull request declares its type. Do not merge without Taylor.

Taylor owns outcomes, priority, product tradeoffs, and merge. The Designer owns UX. The Engineer does discovery and research with Taylor in this chat, gets ahead of product and engineering issues, and asks him directly when his judgment matters, with a recommendation. The Engineer verifies both that new requirements faithfully reflect Taylor's design asks and that a pull request delivers those requirements, with observed evidence and explicit gaps. Green CI and `verifies()` mapping are not acceptance.

Every pull request is checked against the [security checklist](docs/security-review.md) before it is marked ready. [0013](docs/decisions/0013-security-review.md) is accepted. That checklist says when a finding is written into the pull request. Consequential behavior also gets the independent review in cookbook-review. Reversible wording does not get a second reviewer.

| Type | Meaning | Required with the pull request |
| --- | --- | --- |
| Feature | New user-facing behavior | In chat and the pull request body: outcome, scope, YAML IDs, the scenario, and open questions. Requirements YAML catalogs the behavior. A demo (screenshots or a recording) before Taylor confirms. `verifies()` binds a test to a leaf; it is not acceptance. Functional Playwright tests only after he confirms it works. |
| Task | Infrastructure or engineering work with no user-visible behavior. Supply-chain pins and Postgres roles are tasks. | CI verifies it. No demo. A short note in the pull request. |
| Docs | Documentation and workflow rules only | The doc change. |
| Bug | A fix for broken behavior | A regression test that proves the fix, in this pull request. |
| Spike | A throwaway experiment | Labeled as a spike. Commits on a branch. No pull request. Never a commit on `master`. |
| Chore | A chore or dependency update, including Dependabot | A lighter review. |
| Security fix | A bug with priority | Handle it before other bugs. |

Do not add new ADR files. Put new durable rationale in the living topic doc ([map](docs/README.md)). Existing ADRs stay as historical records until retired. Merged means accepted: a decision on `master` is accepted. A change of mind updates the living doc and, when an existing ADR disagrees, retires or amends that file. Do not rewrite a merged decision in silence.

Ask in chat, and do not edit, only for an architecture decision or a feature decision Taylor has not already confirmed. Architecture means a consequential or hard-to-reverse call: data safety, security boundaries, framework lock-in, or a meaningful user time commitment. A feature decision is user-facing behavior that was not already named. When the agent wants feedback, word each item as a question. Put every question in one chat message. Each question includes the reasoning, and a recommendation when a reasonable one exists. Taylor answers the ones he wants.

Design updates and fixes do not wait for approval. Do them, then prove them. Do not expand scope.

A plan stays in the chat and, when there is a pull request, in the pull request description. Do not commit a plan file, an OpenSpec tree, or a second spec artifact. Commit writing when the documentation itself is the work, including the living topic doc.

## Docs

Taylor confirmed this on 2026-10-31.

1. Do not add new ADR files. Existing ADRs are historical. New durable rationale goes in the living topic doc. An existing ADR has no versions, ports, file paths, env names, commands, or schemas.
2. Current state lives in docs and READMEs, and changes with the code.
3. Docs are brief and readable: less verbose, understandable over detail.
4. Requirements YAML is the portable application catalog: [docs/requirements/requirements.yaml](docs/requirements/requirements.yaml). `verifies()` binds one test to one leaf; it is not acceptance. Hosting, tailnet, NAS, and operator backup live in [unraid-production.md](docs/unraid-production.md). Do not put requirements in an ADR. An ADR never cites a requirement ID. Only tests and docs/requirements reference IDs. The shape is [docs/requirements/README.md](docs/requirements/README.md).

   - One forest, several roots, arbitrary depth. Nodes have `id`, `status`, `text`, and optional `children`. Parent and leaf are tree properties, not type fields. Quote every id (`"12"`). IDs are stable integers; do not renumber on move. New leaves start `status: accepted`. `implemented` means built. `verified` means one executed passing binding plus assertion review. Parent status rolls up over children and shared refs.
   - A requirement states testable product behavior, not a category or heading. It is timeless: no version, release, phase, or point in time ("for now", "yet", "initially", "currently", "later"). Good: "The MCP offers only the read, list, and save tools." Bad: "Search comes later." Bad: "Security." Prefer a positive, testable statement. A negative is allowed only when it guards a real limit: permission, data safety, or security. Good: "On the recipe screen, no control overlaps the title, ingredient lines, or steps." Bad: "Recipe text is never read through a control." A requirement names no specific person. An actor value such as taylor, chef, or system may stay when it is data. Good: "A user can open the app on a desktop browser or a phone." Bad: "Taylor and his wife can open the app." A design idea, a visual style, a version name, and a scope or non-goal live in the living topic doc or an existing ADR.
   - At most one `verifies(id, fingerprint, fn)` per leaf, wrapped around the test function. Verified leaves need that binding plus an executed passing run. Parents are not bound. Shared reuse is `{ ref: "12" }`, not a copied definition.
   - Batch wording changes in one pull request. Use a separate pull request when the behavior change is risky.

The map is [docs/README.md](docs/README.md). Existing ADR files keep their numbers. Retired ADRs are deleted; git history keeps the text. Do not reuse a retired number, and do not renumber to close a gap.

## Checks

`pnpm` is the only JavaScript package manager ([0009](docs/decisions/0009-repo-layout.md)). CI installs dependencies and then runs these commands. The steps live in the scripts, not in the workflow file.

```bash
pnpm check   # lint, unit tests, build, secret scan, requirement catalog
pnpm smoke   # docker compose up --build, health checks, and search Playwright
```

Unit tests use Node's built-in runner. They live next to the app they test (`apps/*/test`). A product leaf uses `verifies()` from `@cookbook/test`. That binds the test to an ID; it is not acceptance. Requirement IDs are checked by `scripts/requirements.mjs`. Say what is proven, what is only mapped, and what is unproven. What else a pull request must show is in [Work types](#work-types).

## Full stack

Run commands are in the [README](README.md). Cloud agents use the local command. NAS deploy does not publish host ports. The accepted production file is not in the tree ([0015](docs/decisions/0015-production.md), [0024](docs/decisions/0024-production-images-and-operator-deploy.md)).

## Secrets

This repo is public. Never commit `.env`, tokens, Tailscale keys, or real recipes. Use `.env.example` placeholders only. See [0007](docs/decisions/0007-public-repo-secrets.md).

## Templates

Existing ADRs use [this shape](docs/templates/adr.md). Do not add new ADR files from it.

# Docs system plan

Proposal only. No ADR is edited here. Phase 2 runs after Taylor confirms this file.

Work type: Docs. This pull request does not need an ADR. The philosophy is a workflow rule, same as Work types.

## Philosophy

Phase 2 writes these four rules into CONTRIBUTING.md. This file is not a second copy after that. Phase 2 deletes this plan once the rules and the rewrite have landed.

1. An ADR records a stable, high-level decision that rarely changes. It has no versions, ports, file paths, env names, commands, or schemas.
2. Current state lives in docs and READMEs, and changes with the code.
3. Docs are short and scannable.
4. Requirements will use a structured, enumerated format. Taylor will define it. This plan does not.

## Doc map

| File | What belongs | What does not |
| --- | --- | --- |
| `docs/decisions/NNNN-slug.md` | Problem, options, decision, consequences | Versions, ports, paths, env names, commands, schemas, task lists, "the feature PR will" |
| `docs/*.md`, `docs/design/*`, `README.md` | What is true now, or an accepted target marked not in the tree | Options, rejected alternatives, chat history |
| `docs/requirements/` | Nothing, until Taylor defines the format | Invented requirement ids, schemas parked "for now" |
| `docs/templates/adr.md` | The lean shape below | A restatement of the merged-means-accepted essay |
| `docs/templates/feature.md` | Feature page shape | Unchanged in this refactor |
| `CONTRIBUTING.md` | How we work, including the four rules above | A copy of each ADR |
| `features/` | One page per feature | ADRs |
| `.cursor/skills/` | When to run, with a link to CONTRIBUTING | A copy of the docs rules |
| `.github/PULL_REQUEST_TEMPLATE.md` | Type, ADR axis, the one-line content ban | A pasted checklist |

`docs/README.md` becomes a map of those types. The hand-edited status table goes away. Status stays in each ADR. [0012](../decisions/0012-parallel-agents.md) already called for that removal.

## Ideal system

One fact, one file. An agent can read the decision set in one pass, then open a topic doc only for a name, a command, or a value.

Recommended shape after the rewrite: **18 ADRs**, down from 26, each the decision and not the procedure. Topic docs keep the facts. They lose the second copy of the argument.

### Ideas

Each row is a recommendation.

| Idea | Recommendation | Why |
| --- | --- | --- |
| Philosophy lives in CONTRIBUTING, not in a new ADR | Yes | Work types already live there. A docs-policy ADR would need a superseding ADR for every wording tweak. |
| Merge [0015](../decisions/0015-unraid-compose-manager.md)–[0020](../decisions/0020-update-and-rollback.md) into one production ADR | Yes | Six files are one deploy choice. A later change (Serve on, automatic updates) is a new ADR either way. |
| Collapse [0021](../decisions/0021-kitchen-ui-principles.md)–[0026](../decisions/0026-floating-glass-chrome.md) into three: kitchen UI, UI package, demos | Yes | Principles, screens, chrome, and the accessibility bar are one product decision. The package boundary and the demo gate are separate and get reused alone. |
| Keep [0008](../decisions/0008-typescript-stack.md), [0009](../decisions/0009-repo-layout.md), [0010](../decisions/0010-migration-tooling.md), and [0011](../decisions/0011-test-tooling.md) separate | Yes | Switching the database tool should not reopen the language decision. |
| Renumber survivors to a new contiguous `0001`–`0018` and delete the old files | Yes | Stubs are files an agent still opens. Gaps fight the sequence check [0012](../decisions/0012-parallel-agents.md) already chose. Git history is the archive. |
| Drop the Amendments section | Yes | Strikethrough made [0022](../decisions/0022-navigation-ia.md), [0024](../decisions/0024-tokens-accessibility-iphone.md), and [0026](../decisions/0026-floating-glass-chrome.md) harder to read than the decision. A changed decision is a new ADR. |
| Current-state docs may describe an accepted target that is not built, in present tense, with one "not in the tree" line | Yes | Deleting [unraid-production.md](../unraid-production.md) would make the next agent invent image names and tags. Keeping it as a future task list is how these docs grew. Facts stay. Options and "the feature PR will" go. |
| Delete `docs/design/principles.md` | Yes | After the fold, it only repeats the kitchen UI decision. Tokens, information architecture, chrome, and demo stay. |
| Postgres shape has one home, `docs/security-review.md` | Yes | The same roles are restated in the security doc, the supply-chain doc, and the Unraid doc. |
| No ADR linter in this refactor | Yes | A ban-list regex false-positives on ordinary words. The template and review are enough until that fails. |
| Slug-only ADR filenames | No | [0012](../decisions/0012-parallel-agents.md) already rejected this. Short ids are what the other docs cite. |
| One `architecture.md` instead of ADRs | No | It becomes the same essay, and a change of mind rewrites history. |
| Leave all 26 files, trim in place, no renumber | No | Safest diff, and it keeps the amendment scars and the six-way production split. Use only if the merges below are rejected. |

### What phase 2 does to a current-state doc

- Lead with the current rule.
- No options. No strikethrough. No chat narration.
- Commands, paths, ports, env names, versions, and schemas live here.
- If the tree disagrees with the doc, fix the doc to the tree in the same rewrite, and mark an accepted-but-unbuilt target in one line.

Known drift to fix then, not now: the README NAS section still describes Serve and a loopback bind; [0013](../decisions/0013-security-review.md) still says the local compose file publishes the database port; the README says it does not. The ADR loses the "today the file does X" sentence. The README keeps the fact.

## Per ADR

Disposition is against the philosophy above. "Survives" is the decision text phase 2 keeps. Specifics move out.

| ID | Disposition | Survives | Specifics move to |
| --- | --- | --- | --- |
| [0001](../decisions/0001-self-host-on-unraid.md) | Trim → new 0001 | Self-host on the household NAS with Compose. Not a public host. Not a cluster. Local runs use a separate compose file that may publish ports. | Appdata path, file names, timezone → `docs/unraid-production.md`, `README.md` |
| [0002](../decisions/0002-tailscale-only.md) | Trim, absorb the Serve outcome of 0018 → new 0002 | No public exposure. Separate tailnet identities for the family app and MCP. Least privilege. Bots reach MCP only. Funnel off. Tailnet HTTPS deferred. | Tag strings, ports, bind addresses, file paths → `docs/unraid-production.md` |
| [0003](../decisions/0003-mcp-bearer-token.md) | Trim → new 0003 | MCP requires a shared secret in addition to the network boundary. Liveness is unauthenticated and returns status only. | Env name, minimum length, compare algorithm, status code, response body → `docs/security-review.md` |
| [0004](../decisions/0004-postgres-migrations.md) | Trim → new 0004 | Postgres. Not an embedded database. Not files. Schema changes are ordered migrations. The recipe schema is not this decision. | `app_meta`, backup mechanics → README, security doc |
| [0005](../decisions/0005-v1-scope.md) | Trim → new 0005 | v1 is a responsive installable web app, an API, Postgres, and a cookbook MCP. Not a native app. Chef is not in this repo. | Manifest and "the skeleton proves hello" → README |
| [0006](../decisions/0006-one-repo-one-mcp.md) | Trim → new 0006 | One repo for the product. One MCP container per NAS project, with its own identity and secret. | Hostname layout → Unraid doc |
| [0007](../decisions/0007-public-repo-secrets.md) | Trim → new 0007 | Public repo. Secrets, recipes, and notes are not committed. CI scans for secrets. Local boot may use a non-secret token that is not valid on the NAS. | Token literal, allowlist, scanner name → README, security doc |
| [0008](../decisions/0008-typescript-stack.md) | Trim → new 0008 | TypeScript for web, API, and MCP. React for UI. Shared types in one package. Not a second language. | Vite, SDK package name, "no web framework" → README |
| [0009](../decisions/0009-repo-layout.md) | Trim → new 0009 | pnpm is the only JavaScript package manager. Workspaces. No task-runner layer. | Directory tree, lockfile name, script names → README. Tree stays current as packages are added. |
| [0010](../decisions/0010-migration-tooling.md) | Trim → new 0010 | The API applies ordered SQL at startup. No ORM until a new ADR. MCP does not migrate. | `db/migrations`, `schema_migrations` → README or a short `docs` note if README is the wrong home. Prefer README. |
| [0011](../decisions/0011-test-tooling.md) | Trim → new 0011 | Unit tests use Node's built-in runner. A browser runner waits until a feature is confirmed. | The "when" rule stays in CONTRIBUTING only. Playwright, `tsx` → that section and `docs/design/demo.md` |
| [0012](../decisions/0012-parallel-agents.md) | Trim → new 0012 | A feature is a folder. Presence registers it. Migration and ADR numbers are contiguous and checked. Concurrent local stacks are isolated. No timestamps. No claim file. | Ports, env vars, path templates → `docs/parallel-agents.md`. That doc drops its repeated options. |
| [0013](../decisions/0013-security-review.md) | Trim → new 0013 | Every PR is checked. The PR body records a finding only when there is one. Gates are secret scanning and high-severity advisories. No second scanner. The database is not published. The request role cannot change the schema. The migrator is a different role. The image superuser is init-only. | Checklist, role names, env names, network names → `docs/security-review.md` |
| [0014](../decisions/0014-supply-chain.md) | Trim → new 0014 | Dependabot, not a second bot. Grouped version updates, immediate security updates, no automerge. Install from the lockfile. Do not flatten the lockfile for a graph parser. Actions and third-party images are pinned. A short release-age wait is accepted. | Grouping, cooldown, ignore list, `allowBuilds`, release-age minutes, pin syntax → `docs/supply-chain.md` |
| [0015](../decisions/0015-unraid-compose-manager.md) | Merge | One production ADR, new 0015. | See the merged list below. |
| [0016](../decisions/0016-ghcr-images.md) | Merge into new 0015 | Images are built in CI and pulled. The NAS does not compile the app. One CPU architecture, the NAS machine. | Image names, workflow file, visibility steps → Unraid doc |
| [0017](../decisions/0017-production-compose.md) | Merge into new 0015 | Production compose is separate from dev, publishes no ports, and has no secret defaults. | File names, healthcheck command, password env vars → Unraid doc |
| [0018](../decisions/0018-tailscale-sidecars.md) | Merge into new 0015. Serve outcome also folded into new 0002. | Tailscale runs as sidecars, not inside the app images. | Tags, hostnames, ACL JSON, bind addresses → Unraid doc |
| [0019](../decisions/0019-data-dir-and-backups.md) | Merge into new 0015 | Backups are logical dumps of a running database. The env file is not in the data directory. A hot copy of the data files is not a backup. | Paths, modes, `pg_dump` command → Unraid doc |
| [0020](../decisions/0020-update-and-rollback.md) | Merge into new 0015 | Updates are a pinned tag, dump first. No automatic puller. Rollback is the previous tag, or a restore if a migration already ran. No down migrations. | Tag variable, command sequence → Unraid doc |
| [0021](../decisions/0021-kitchen-ui-principles.md) | Merge | Kitchen UI, new 0016. Fold the amendment into the decision. No strikethrough. | — |
| [0022](../decisions/0022-navigation-ia.md) | Merge into new 0016 | Three screens: list, recipe, settings. Settings is theme only. No search, plan, fullscreen, Chef panel, or live updates. | Routes, placeholder copy, example ids → `docs/design/information-architecture.md` |
| [0023](../decisions/0023-design-system-approach.md) | Trim → new 0017 | One shared UI package. Screens import it. A component library inside it is not a product decision. | Package name, path → `docs/design/system.md` when the package exists. Until then the doc says it is not in the tree. |
| [0024](../decisions/0024-tokens-accessibility-iphone.md) | Merge the bar into new 0016. Demote the values. | WCAG 2.2 AA. Targets large enough for the kitchen. System fonts. One wide breakpoint. Phone safe area. Theme follows the system. | Hex, rem, token names, `48rem`, `44px`, storage key → `docs/design/tokens.md` |
| [0025](../decisions/0025-ui-demos.md) | Trim → new 0018 | UI work is shown at desktop and phone size, example data only, before any browser test. A review route exists and is not a cooking screen. Later browser tests cover list, recipe, empty, and failed load. | Pixel sizes, route path → `docs/design/demo.md` |
| [0026](../decisions/0026-floating-glass-chrome.md) | Merge into new 0016. Fold the amendment in. | Controls float. No rail, header bar, or bottom bar. Controls are opaque. Text is not read through a control. | Material notes → `docs/design/chrome.md` |

New 0015, in one paragraph: one Compose Manager stack and one env file, not per-container templates. The NAS pulls images built in CI and does not compile the app. Production compose is separate from dev, publishes no ports, and has no secret defaults. Tailscale is sidecars. Updates are a pinned tag after a dump. No automatic puller. No down migrations. Backups are logical dumps. The env file is not in the data directory.

Nothing in 0001–0026 is deleted without a surviving decision. The cuts are specifics, duplicates, and future-task narration.

[0027](https://github.com/FerrisWeil/cookbook/pull/20) is not on `master`. It is handled under open pull requests. It does not join this set until it is split.

## Lean template

```markdown
# NNNN. Title

* Status: proposed | accepted | superseded by NNNN
* Date: YYYY-MM-DD
* Confirmed: Taylor, YYYY-MM-DD (accepted only)

Status stays proposed until Taylor confirms in chat. Do not merge the pull request before that.

## Problem

One sentence.

## Options considered

1. **Name** — tradeoff.
2. **Name** — tradeoff.

## Decision

The choice and why. No versions, ports, file paths, env names, commands, or schemas.

## Consequences

What is easier, harder, or off-limits. What this decision does not decide.
```

No Amendments section. A change of mind is a new ADR. A clarification that does not change the decision is an ordinary edit.

The merged-means-accepted paragraph is not copied into the template or into each file. It stays in CONTRIBUTING.

## Merged means accepted, and numbering

The rule does not change. Merging an ADR pull request to `master` accepts the ADRs in it. Do not merge one while a decision in it is still unconfirmed. A later change of mind is a new ADR. Do not rewrite a merged decision in place.

This refactor is the exception Taylor allowed on 2026-10-31: a rewrite of the records, not a new product decision. Phase 2 keeps each surviving decision's original Confirmed date. It does not stamp the refactor date. After this pull request merges, the rule is back in force, including on these files.

Numbering after the rewrite:

- Survivors are `0001`–`0018`, contiguous, no stubs.
- The old→new map lives in the phase 2 pull request body, not in a permanent doc.
- The next ADR is `0019`.
- Superseded ADRs keep their number. No second renumber.
- [0012](../decisions/0012-parallel-agents.md)'s sequence check still covers ADRs and migrations. Update the convention sentence that says a merged ADR is never renumbered, so it names this one-time exception and then forbids another.

Phase 2 does not add the sequence script. That follow-up is still [0012](../decisions/0012-parallel-agents.md)'s, and it is not this docs rewrite.

## Open pull requests

| PR | State | Touch | What to do |
| --- | --- | --- | --- |
| [#9](https://github.com/FerrisWeil/cookbook/pull/9) | Merged | Renumbered the kitchen UI ADRs to 0021–0026 | None. Those numbers are what is on `master` today. This plan renumbers them again, once, with the rest. |
| [#19](https://github.com/FerrisWeil/cookbook/pull/19) | Open | Adds an Amendments block to 0014 and edits `docs/supply-chain.md` (one version-update group per ecosystem, weekly Monday, majors ignored for Postgres, the Node image, and `@types/node`) | Let it merge first. Phase 2 puts those facts in `docs/supply-chain.md` only. The trimmed ADR stays "grouped updates, no automerge." The ignore list is current state, not a permanent decision. |
| [#20](https://github.com/FerrisWeil/cookbook/pull/20) | Open | Adds 0027, a 451-line recipe schema, and a row in `docs/README.md` | Do not merge it as written. Schemas do not belong in ADRs. Hold it as a draft. After this refactor, split it: a short ADR (the next number) for the positions already confirmed, and hold the column list until the requirements format exists. |

This plan PR adds only `docs/plans/docs-system.md`. It does not touch `docs/README.md`, `docs/decisions/`, or `docs/supply-chain.md`, so it does not conflict with #19 or #20.

If #19 is still open when phase 2 starts, phase 2 waits. Rewriting 0014 in parallel means doing the amendment twice.

If #20 merges first anyway, phase 2 still splits it under the same exception. That is the worse order, because merge would accept the schema text as the decision.

## Requirements placeholder

Phase 2 adds `docs/requirements/README.md` with this text and nothing else:

```markdown
# Requirements

Taylor has not defined the format yet.

Do not add requirements to this folder.
Do not invent the format.
Do not put requirements in an ADR.
```

## Phase 2

After confirmation, on this same branch, still without merging:

- Replace `docs/decisions/` with the 18 ADRs. Original Confirmed dates. Status accepted.
- Replace `docs/templates/adr.md` with the lean template.
- Add the philosophy, the content ban, and the numbering exception to CONTRIBUTING. Keep merged-means-accepted there once.
- Point `cookbook-workflow` and `cookbook-review` at that section. Do not copy it. No change to `cookbook-verify` or `cookbook-debug` unless a sentence now contradicts the ban.
- PR template: one line under ADRs that the body has no versions, ports, paths, env names, commands, or schemas.
- Rewrite the topic docs as current state. Delete `docs/design/principles.md`. Add the requirements placeholder.
- `docs/README.md` becomes the map. No status table.
- Delete this plan file in the same pull request, after the rules have a home.
- Run `pnpm check`. Fill the security checklist. Mark the pull request ready. Do not merge.

Phase 2 does not implement Unraid, the sequence check, or the recipe schema.

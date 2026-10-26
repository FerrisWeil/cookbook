# Agent skills

* Skill set: **proposed**
* Date: 2026-10-26
* Confirmed: (none for the skill set)

> **Proposed.** The skill set is not a decision until Taylor confirms it in chat. Work types are already confirmed. They live in [CONTRIBUTING.md](../CONTRIBUTING.md#work-types). This file does not restate them.

## Why

PStack's `/interrogate` skill and the Superpowers skills are installed as plugins. They contradict this repo: forbidden reviewer models, a design-spec-plan loop beside our work types, and test-first rules that ignore the Feature and Bug rows. Taylor will remove those plugins once in-repo skills exist, so the replacements have to stand alone and load for a cloud agent.

Rules stay in CONTRIBUTING.md. A skill links there. A skill that pastes a rule is drift.

## Inventory

Read from the installed plugins on 2026-10-26. Calls are **keep**, **merge**, **rewrite**, or **drop**.

### Interrogate (PStack)

On demand only. The agent states intent, sends the same prompt to readonly reviewers, and does not apply their edits. Agreement across reviewers outranks a lone finding. The lead sorts findings into Act on, Consider, Noted, and Dismissed, and throws out nits, hypotheticals, premature abstractions, and "I would have written it differently." The rubric covers correctness, root cause, structure, verification, complexity, and security.

| Piece | Call | Why |
| --- | --- | --- |
| Intent, readonly reviewers, no auto-apply, one shared prompt | keep | Taylor decides what to change. |
| Act on / Consider / Noted / Dismissed, and the lead-judgment filters | keep | This is the useful output. |
| Rubric lenses, kept short | merge | Into `cookbook-review`. Security findings follow the checklist only when [Work types](../CONTRIBUTING.md#work-types) says so. |
| Default reviewers `claude-opus-5-5-xhigh` and `grok-4.7-xhigh-fast` | drop | Claude is forbidden. Fast is forbidden. Extra-high is off unless high cannot meet the bar, and the skill never asks. |
| Fallback to those models, and picking speed from poteto-mode | drop | Same forbid list. |
| Ambitious "code judo" restructure lens | drop | It pushes rework past the change Taylor asked for. |
| `git diff main` | rewrite | The default branch is `master`. |
| Two reviewers on every run | rewrite | One `grok-4.7-high` reviewer unless Taylor asks for a second on that diff. A second review costs about as much as the first. Cross-family agreement is the part we give up to keep the model rules. |

### Superpowers

| Skill | Call | What happens to it |
| --- | --- | --- |
| using-superpowers | rewrite | User instructions and CONTRIBUTING.md win. Drop the rule that any 1% chance means invoke a skill before answering. |
| brainstorming | merge | Options and a recommendation belong in an ADR when the decision axis says yes, and in the pull request note otherwise. Drop `docs/superpowers/specs/`, the visual companion, and the handoff into writing-plans. |
| writing-plans | drop | Drop committed plans and pasted implementations. A multi-step change names its files in the pull request. |
| executing-plans | merge | Stop when blocked. Stay off `master`. Drop the handoff that offers a local merge. |
| subagent-driven-development | rewrite | A subagent is `grok-4.7-high` or `composer-2.5`, named in the dispatch. Composer 2.5 is for a mechanical edit whose result is already specified. One writer on a checkout. One review before the pull request is marked ready. Drop per-task implementers, per-task reviewers, the progress ledger, and "use a fast, cheap model." |
| test-driven-development | rewrite | A test that never failed is weak evidence, and test-first is allowed for a unit test. The iron law and "delete the code if you wrote it first" are dropped. Feature and Bug verification are the Work types rows. |
| systematic-debugging | rewrite | Becomes `cookbook-debug`: reproduce, one hypothesis, fix the cause. Drop the long rationalization tables and the extra technique files. |
| requesting-code-review | merge | Into `cookbook-review`. One review before ready. The agent does not merge. |
| receiving-code-review | merge | Read it, check it against the code, then change it or push back. A reviewer finding is not a decision. Taylor's confirmation is. |
| verification-before-completion | rewrite | Becomes `cookbook-verify`. The commands are `pnpm check` and `pnpm smoke`. |
| finishing-a-development-branch | drop | Open a pull request and stop. Merged means accepted. |
| dispatching-parallel-agents | drop | One writer on a checkout. [Parallel agents](parallel-agents.md) is still proposed. |
| using-git-worktrees | drop | A cloud agent already has its own branch. Do not create a worktree unless Taylor asks. |
| writing-skills | merge | `SKILL.md` name matches the folder, and the description says when to use it. Drop the pressure-test loop that spends a subagent to prove the skill. |

The rest of the PStack plugin (poteto-mode and the principle skills) is out of this inventory. Taylor named `/interrogate`.

## Proposed set

Four skills. One mega-skill would sit in context on every edit. One skill per Superpowers file would copy the cost and the contradictions.

| Skill | Purpose | When it triggers |
| --- | --- | --- |
| `cookbook-workflow` | Declare the work type, follow CONTRIBUTING.md, open the pull request, stop | Starting a feature, task, bug, docs change, spike, chore, or security fix |
| `cookbook-review` | One adversarial read, lead judgment, no automatic edits | Asked to review or interrogate, or about to mark a pull request ready |
| `cookbook-debug` | Root cause before a fix | A test, build, smoke check, or runtime behavior fails |
| `cookbook-verify` | Evidence before a completion claim | About to say the work is done, a check passed, or a pull request is ready |

Each skill starts with: read [CONTRIBUTING.md](../CONTRIBUTING.md) and follow it. Do not restate work types, the decision axis, model rules, checks, or secrets.

Models, when a skill starts a subagent: the [Agents](../CONTRIBUTING.md#agents) section. The slug is `grok-4.7-high` or `composer-2.5`. Fast variants stay off. `cookbook-review` uses one readonly `generalPurpose` subagent on `grok-4.7-high`. The parent does the lead judgment. Composer 2.5 does not review. A second `grok-4.7-high` reviewer runs only after Taylor says yes for that diff. Chore uses that same single review. That is the lighter review.

`cookbook-debug` does not spawn a subagent unless the parent is stuck. Then it spawns one `grok-4.7-high` and says so. It does not log tokens, recipes, or notes. After three failed fixes it stops and tells Taylor.

`cookbook-verify` runs `pnpm check` when the change can affect lint, unit tests, the build, or secrets, and `pnpm smoke` when the change touches Compose, images, health, or startup. It cites the output from this turn. A Feature demo is the evidence Work types asks for. Another agent's report is not evidence.

Each `SKILL.md` stays short, under about 80 lines. `disable-model-invocation` stays off, and the description is the trigger, so a review skill does not load during an ordinary edit.

## Where they live

Cursor loads project skills from `.cursor/skills/` and from `.agents/skills/` ([Agent Skills](https://cursor.com/docs/skills)). Cloud agents always see project skills in the repo they check out ([Cloud Agents](https://cursor.com/help/ai-features/cloud-agents)). An automation picks up a repo skill from `.cursor/skills/` ([the same skills doc](https://cursor.com/docs/skills): "To give an automation a skill, add it to the repository's `.cursor/skills/` folder.").

Proposed location, one tree:

```text
.cursor/skills/<name>/SKILL.md
```

`.agents/skills/` would be a second copy. `.claude/skills/` and `.codex/skills/` also load, for compatibility, and we will not use them. `~/.cursor/skills/` reaches a cloud agent only if that user turns on Sync Skills, and automations do not load the synced copy.

`name` matches the folder. This repo already uses `.cursor/rules/` and `.cursor/environment.json`.

A fresh cloud agent has not been started to watch discovery. The files are not written yet. After Taylor confirms the set, the same pull request gets the files, and the check is a new cloud agent whose skill list includes these four from `.cursor/skills/` and whose work follows CONTRIBUTING.md.

## Maintenance

Git history is the version. There is no vendored upstream copy and no separate version number. A skill edit is a Docs pull request with ADR `no`, unless the edit makes a hard-to-reverse call.

Adding a fifth skill means saying which of the four cannot cover the job, and telling Taylor what it costs. Per-task subagents, a standing second reviewer, and a baseline agent that exists to fail on purpose are the expensive patterns these plugins use. Tell Taylor before spending that.

## Removing the plugins

After the skill files are in the repo and Taylor confirms they load:

1. Disable the Superpowers plugin and the PStack plugin that provides `/interrogate`.
2. Start a new cloud agent on this repo.
3. Confirm the agent lists `cookbook-workflow`, `cookbook-review`, `cookbook-debug`, and `cookbook-verify` from `.cursor/skills/`.
4. Confirm a review uses `grok-4.7-high` and does not use Claude or a fast model.

Leave `.cursor/skills/` in place. Personal skill sync is a separate switch and does not replace these files.

## Open questions

1. Are these four skills the set, with the triggers and the reviewer panel above?
2. Chore and security-fix pull requests fill [the security checklist](security-review.md). That file still says the checklist is not in force, because [0013](decisions/0013-security-review.md) is proposed. Should those two types fill it before 0013 is accepted? Should any other type fill it?
3. Spike says "may be committed directly." Does that mean a labeled commit on a branch with no pull request, or a commit on `master`?
4. A Bug needs a regression test. For a broken screen, does that test wait for the same demo confirmation a Feature needs before Playwright, or does the bug's regression test land in the fix pull request?

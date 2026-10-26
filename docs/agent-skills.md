# Agent skills

Four skills in `.cursor/skills/<name>/SKILL.md`. Rules live in [CONTRIBUTING.md](../CONTRIBUTING.md). The skills link there and do not copy it.

| Skill | When it runs |
| --- | --- |
| [cookbook-workflow](../.cursor/skills/cookbook-workflow/SKILL.md) | Starting a feature, task, bug, docs change, spike, chore, or security fix |
| [cookbook-review](../.cursor/skills/cookbook-review/SKILL.md) | A review or interrogate, or just before a pull request is marked ready |
| [cookbook-debug](../.cursor/skills/cookbook-debug/SKILL.md) | A test, build, smoke check, or runtime failure, before a fix |
| [cookbook-verify](../.cursor/skills/cookbook-verify/SKILL.md) | About to claim the work is done, a check passed, or a pull request is ready |

Cursor loads `.cursor/skills/` and `.agents/skills/`. This repo uses `.cursor/skills/` only. Cloud agents see project skills from the checkout, and automations read `.cursor/skills/` ([Agent Skills](https://cursor.com/docs/skills), [Cloud Agents](https://cursor.com/help/ai-features/cloud-agents)). `.claude/skills/` and `.codex/skills/` are unused. `name` matches the folder. Git history is the version.

These four replace the PStack `/interrogate` skill and the Superpowers workflow skills. Reviewer count, model slugs, and the Act on / Consider / Noted / Dismissed buckets are in `cookbook-review`.

A fifth skill has to name which of the four cannot cover the job, and what it costs to run. A standing second reviewer, a subagent per task, and a baseline agent that exists only to fail are costs to raise with Taylor first.

## Removing the external plugins

Disable the Superpowers plugin and the PStack plugin that provides `/interrogate`. Then start a new cloud agent and confirm:

1. It lists these four skills from `.cursor/skills/`.
2. A review uses `grok-4.7-high` and does not use a fast model.

Leave `.cursor/skills/` in place. Personal skill sync does not replace these files.

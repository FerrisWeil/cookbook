---
name: cookbook-workflow
description: Use when starting a feature, task, bug, docs change, spike, chore, or security fix in this repo.
---

# Cookbook workflow

Read [CONTRIBUTING.md](../../../CONTRIBUTING.md) and follow it. Do not restate it.

Docs stay brief and readable: understandable over detail. Requirements and the other rules live in [Docs](../../../CONTRIBUTING.md#docs). Do not copy them.

## Start

1. Name the work type and whether an ADR is required (`yes` or `no`). The rules are [Work types](../../../CONTRIBUTING.md#work-types). An ADR follows [Docs](../../../CONTRIBUTING.md#docs). Do not copy those rules.
2. A Spike follows that row.
3. Any other type is a pull request against `master`. Do not merge it.
4. Stop and ask only for an architecture or feature decision Taylor has not confirmed. Put every open question in one message. Otherwise do the work. When to ask, the form of a question, and when a plan is committed, is in [Work types](../../../CONTRIBUTING.md#work-types).

## Models

Follow [Agents](../../../CONTRIBUTING.md#agents). Name the slug on every subagent.

- Judgment and implementation: `grok-4.7-high`.
- A mechanical edit whose result is already specified: `composer-2.5`.
- `composer-2.5` does not review. A fast variant is never a slug.

One writer on this checkout. Do not create a git worktree unless Taylor asks. Do not dispatch a subagent per task.

## Finish

Before marking a pull request ready, read `cookbook-verify` and `cookbook-review`. Fill the security checklist. The rule is in Work types.

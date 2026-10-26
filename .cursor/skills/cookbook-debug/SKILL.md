---
name: cookbook-debug
description: Use when a test, build, smoke check, or runtime behavior fails, before proposing a fix.
---

# Cookbook debug

Read [CONTRIBUTING.md](../../../CONTRIBUTING.md) and follow it. Do not restate it. Find the cause before writing a fix.

## Steps

1. Read the error, including the stack.
2. Reproduce it with exact steps. If it does not reproduce, gather more evidence and do not guess a fix.
3. Check what changed: the diff, a new dependency, or the environment.
4. State one hypothesis. Test it with the smallest change. If it fails, form a new hypothesis. Do not stack fixes.
5. Fix that cause. Follow the Bug and Feature rows in [Work types](../../../CONTRIBUTING.md#work-types).
6. Re-run the failing command. Read [cookbook-verify](../cookbook-verify/SKILL.md) before claiming it is fixed.

Do not log tokens, recipes, or notes. Secrets are in CONTRIBUTING.md.

## When to stop

After three failed fixes, stop and tell Taylor. Ask before a fourth attempt.

Do not spawn a subagent unless the parent is stuck. Then spawn one `grok-4.7-high` and say so. Follow [Agents](../../../CONTRIBUTING.md#agents).

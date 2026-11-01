---
name: cookbook-verify
description: Use when about to claim work is done, a check passed, or a pull request is ready.
---

# Cookbook verify

Read [CONTRIBUTING.md](../../../CONTRIBUTING.md) and follow it. Do not restate it. Claim a result only after the command output from this turn. When to ask, and when a plan is committed, is in [Work types](../../../CONTRIBUTING.md#work-types).

## Before any success claim

1. Name the command that proves the claim.
2. Run the full command.
3. Read the output and the exit code.
4. State the claim with that output, or state what actually happened.

Another agent's report is not evidence. A screenshot is not a passing test.

## Which command

Follow [Checks](../../../CONTRIBUTING.md#checks) and [Work types](../../../CONTRIBUTING.md#work-types).

- `pnpm check` when the change can affect lint, unit tests, the build, secrets, or requirement IDs.
- `pnpm smoke` when the change touches Compose, images, health, or startup.
- A Feature demo is the evidence that row requires. Collect it before claiming the feature works.

Fill [docs/security-review.md](../../../docs/security-review.md) before marking a pull request ready. The rule is in Work types.

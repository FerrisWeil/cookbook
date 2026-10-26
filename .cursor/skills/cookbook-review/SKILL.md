---
name: cookbook-review
description: Use when asked to review, interrogate, or stress-test a change, or just before marking a pull request ready.
---

# Cookbook review

Read [CONTRIBUTING.md](../../../CONTRIBUTING.md) and follow it. Do not restate it.

Design updates and fixes are applied, then proved. Read [cookbook-verify](../cookbook-verify/SKILL.md). When to ask is [Work types](../../../CONTRIBUTING.md#work-types). An architecture or feature finding is a question in one chat message with the other open questions. It is not a silent edit, and it is not a packet waiting for Taylor to approve the details.

## Setup

State the intent in one paragraph, from the request, the commits, and the diff.

Diff against `master`.

## Reviewer

One readonly `generalPurpose` subagent. Model `grok-4.7-high`. The parent does the lead judgment.

A second `grok-4.7-high` reviewer runs only if Taylor already said yes for that diff.

`composer-2.5` does not review. Follow [Agents](../../../CONTRIBUTING.md#agents) for every other model rule. A fast variant is never a slug.

A chore uses this same single reviewer. That is the lighter review.

Give every reviewer the same prompt: the intent, the diff, and the lenses below.

## Lenses

Use the ones that fit the diff.

- Correctness, including the failing path.
- Root cause, or a patch on a symptom.
- Structure. Simpler code that still works.
- Verification. Tests, or a demo, as Work types requires.
- Complexity that the change does not need.
- Security. Read [docs/security-review.md](../../../docs/security-review.md). Work types says when to fill it. Do not paste the checklist here.

## Lead judgment

Sort each finding into one bucket. Name who raised it.

- **Act on.** Correctness, security, or a maintainability break that would block the pull request.
- **Consider.** Real, and the cost of doing it now is unclear.
- **Noted.** Valid, and not worth a change now.
- **Dismissed.** Wrong, a nit, a hypothetical that cannot happen, a premature abstraction, or a preference for a different design. Say why.

A finding is not itself an architecture or feature decision. Check it against the code. Push back with the code or the command output when it is wrong.

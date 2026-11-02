# 0022. Requirement coverage helper

* Status: proposed
* Date: 2026-11-02

Status stays proposed until Taylor confirms in chat. Do not merge the pull request before that.

## Problem

A requirement prefix on a test title mixed the behavior under test with the coverage claim, and a bad ID was silent until the batch check ran.

## Options considered

1. **Keep the prefix in the title** — no extra API, titles stay noisy, a bad ID is not caught when the test runs.
2. **A helper the test calls** — the title stays a behavior, the helper checks the ID, one form for unit tests and later browser tests.
3. **Comments or a sidecar map** — they drift from the test that actually runs.

## Decision

A test names the details it covers by calling a helper. The helper rejects an unknown or removed ID. Coverage is those calls. A title is not coverage.

## Consequences

* One test still covers a detail. Two tests covering the same detail still fail.
* Browser tests can use the same helper when they exist.
* How the helper is imported, and how the check reads it, is current state.

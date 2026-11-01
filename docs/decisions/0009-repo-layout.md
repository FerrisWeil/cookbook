# 0009. pnpm workspaces

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25

## Problem

One repo needs one package manager and a layout agents can navigate.

## Options considered

1. **npm workspaces** — no extra toolchain. Taylor chose one package manager, and he chose pnpm.
2. **pnpm workspaces** — one binary for install, lint, test, and build.
3. **A task-runner layer on top** — task graphs this repo does not need.

## Decision

pnpm is the only JavaScript package manager. Workspaces. No task-runner layer.

## Consequences

* A package-manager change is a new ADR.
* The directory tree is in the README and stays current as packages are added.
* Check entry points are in [CONTRIBUTING.md](../../CONTRIBUTING.md).

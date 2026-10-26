# 0007. Public portfolio repo; secrets stay out of git

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25, agent chat (foundation PR)

## Context

This repo is public on purpose (portfolio). Recipes, personal notes, Tailscale keys, and MCP tokens must never appear in git history. GitHub will host code and docs only.

## Options considered

1. **Private repository** — Safer by default, but Taylor wants this public as portfolio work.
2. **Public repo with real secrets in compose or docs** — Convenient, unacceptable.
3. **Public repo; personal and secret values only in uncommitted env files; `.gitignore`, `.env.example` with placeholders, secret scanning in CI; recipes and notes only in the NAS database.**

## Decision

Keep the repo public. Anything personal or secret lives in env files that are never committed. Ship `.gitignore`, `.env.example` with placeholders only, and secret scanning in CI. Recipes and personal notes live only in the NAS database.

## Consequences

* `.env` is gitignored. `.env.example` uses obvious placeholders, never real keys.
* Local Compose may use a well-known **local-only** MCP token default so `docker compose up --build` works with no files to copy. That default is not a NAS secret and is allowlisted in gitleaks. NAS Compose requires real env values.
* CI fails if gitleaks finds a secret in the tree.
* Do not commit screenshots or recordings that show real recipes, notes, tokens, or tailnet names. Redact demos.

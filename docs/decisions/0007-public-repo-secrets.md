# 0007. Public repo, secrets stay out

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25

## Problem

The repo is public on purpose. Recipes, notes, and secrets must never enter git.

## Options considered

1. **A private repo** — safer by default. Taylor wants this public as portfolio work.
2. **A public repo with secrets in the tree** — convenient, and unacceptable.
3. **A public repo; secrets and personal data only outside git** — placeholders, a secret scan in CI, recipes in the database.

## Decision

Public repo. Secrets, recipes, and notes are not committed. CI scans for secrets. Local boot may use a non-secret token that is not valid on the NAS.

## Consequences

* Demos are redacted. No real recipes, notes, tokens, or tailnet names.
* The local token and the scanner are in the README and the security doc.

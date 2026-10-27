# Docs

Durable decisions live in [decisions/](decisions/). An ADR records a decision that rarely changes. [CONTRIBUTING.md](../CONTRIBUTING.md) says when a change needs an ADR.

How we work lives in [CONTRIBUTING.md](../CONTRIBUTING.md). In-repo agent skills are in [agent skills](agent-skills.md). Feature pages live in [features/](../features/).

Templates:

- [ADR](templates/adr.md)
- [Feature](templates/feature.md)

## Decisions

| ID | Title | Status |
| --- | --- | --- |
| [0001](decisions/0001-self-host-on-unraid.md) | Self-host on Unraid via Docker Compose | accepted |
| [0002](decisions/0002-tailscale-only.md) | No public exposure; Tailscale-only with tag-based ACLs | accepted |
| [0003](decisions/0003-mcp-bearer-token.md) | Bearer token on the MCP server | accepted |
| [0004](decisions/0004-postgres-migrations.md) | Postgres, migrations from day one, schema deferred | accepted |
| [0005](decisions/0005-v1-scope.md) | v1: web PWA, API, Postgres, cookbook MCP | accepted |
| [0006](decisions/0006-one-repo-one-mcp.md) | One repo; one MCP container per NAS project | accepted |
| [0007](decisions/0007-public-repo-secrets.md) | Public portfolio repo; secrets stay out of git | accepted |
| [0008](decisions/0008-typescript-stack.md) | Language and framework stack | accepted |
| [0009](decisions/0009-repo-layout.md) | Repo layout and pnpm workspaces | accepted |
| [0010](decisions/0010-migration-tooling.md) | Postgres migration tooling | accepted |
| [0011](decisions/0011-test-tooling.md) | Test tooling | accepted |
| [0012](decisions/0012-parallel-agents.md) | Parallel feature agents | accepted |
| [0013](decisions/0013-security-review.md) | Security review and Postgres access | accepted |
| [0014](decisions/0014-supply-chain.md) | Dependency updates and supply-chain hygiene | accepted |
| [0015](decisions/0015-unraid-compose-manager.md) | Unraid deploy via Compose Manager | accepted |
| [0016](decisions/0016-ghcr-images.md) | Publish images to GHCR | accepted |
| [0017](decisions/0017-production-compose.md) | Production Compose file | accepted |
| [0018](decisions/0018-tailscale-sidecars.md) | Tailscale sidecars; Serve deferred | accepted |
| [0019](decisions/0019-data-dir-and-backups.md) | Data directory, backups, permissions | accepted |
| [0020](decisions/0020-update-and-rollback.md) | Update and rollback | accepted |
| [0021](decisions/0021-kitchen-ui-principles.md) | Kitchen UI principles | accepted |
| [0022](decisions/0022-navigation-ia.md) | Navigation and information architecture | accepted |
| [0023](decisions/0023-design-system-approach.md) | Design system approach | accepted |
| [0024](decisions/0024-tokens-accessibility-iphone.md) | Tokens, accessibility, and iPhone layout | accepted |
| [0025](decisions/0025-ui-demos.md) | How UI work is demoed | accepted |
| [0026](decisions/0026-floating-glass-chrome.md) | Floating glass chrome | accepted |
| [0027](decisions/0027-v1-recipe-data-model.md) | v1 recipe data model | proposed |

[0012](decisions/0012-parallel-agents.md) is accepted. The convention is in [parallel-agents.md](parallel-agents.md). Its sequence check and the removal of this hand-edited table are still follow-up. [0013](decisions/0013-security-review.md) is accepted. The checklist is in [security-review.md](security-review.md). [0014](decisions/0014-supply-chain.md) is accepted, with the comparison in [supply-chain.md](supply-chain.md). The production stack is accepted in [0015](decisions/0015-unraid-compose-manager.md)–[0020](decisions/0020-update-and-rollback.md), with the detail in [unraid production](unraid-production.md). The feature that puts `docker-compose.unraid.yml` at the repo root is not written yet. The skeleton is still `deploy/nas/docker-compose.yml`.

The kitchen UI decisions [0021](decisions/0021-kitchen-ui-principles.md) through [0026](decisions/0026-floating-glass-chrome.md) are accepted. [0026](decisions/0026-floating-glass-chrome.md) supersedes the heavy shell only. Detail and wireframes are in [design/](design/). The ADR template now uses Problem. Merged ADRs 0001–0013 still say Context.

[0027](decisions/0027-v1-recipe-data-model.md) is proposed. It is the recipe model [0004](decisions/0004-postgres-migrations.md) deferred. It adds no migration and no API.

Reference that already proved Docker, Tailscale, bearer tokens, and `docs/decisions/` on this NAS: [FerrisWeil/nas-mcp](https://github.com/FerrisWeil/nas-mcp).

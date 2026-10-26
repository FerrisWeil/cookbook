# Docs

Durable decisions live in [decisions/](decisions/). They rarely change. A change of mind is a new ADR that supersedes the old one.

How we work, including the two-PR workflow, lives in [CONTRIBUTING.md](../CONTRIBUTING.md). Feature-by-feature docs live in [features/](../features/).

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
| [0014](decisions/0014-unraid-compose-manager.md) | Unraid deploy via Compose Manager | **proposed** |
| [0015](decisions/0015-ghcr-images.md) | Publish images to GHCR | **proposed** |
| [0016](decisions/0016-production-compose.md) | Production Compose file | **proposed** |
| [0017](decisions/0017-tailscale-sidecars.md) | Tailscale sidecars; Serve deferred | **proposed** |
| [0018](decisions/0018-data-dir-and-backups.md) | Data directory, backups, permissions | **proposed** |
| [0019](decisions/0019-update-and-rollback.md) | Update and rollback | **proposed** |

[0012](decisions/0012-parallel-agents.md) is accepted. The convention is in [parallel-agents.md](parallel-agents.md). Its sequence check and the removal of this hand-edited table are still follow-up. [0013](decisions/0013-security-review.md) is accepted. The checklist is in [security-review.md](security-review.md). The production stack is proposed in [0014](decisions/0014-unraid-compose-manager.md)–[0019](decisions/0019-update-and-rollback.md), with the detail in [unraid production](unraid-production.md). Those six are not in force.

Reference that already proved Docker, Tailscale, bearer tokens, and `docs/decisions/` on this NAS: [FerrisWeil/nas-mcp](https://github.com/FerrisWeil/nas-mcp).

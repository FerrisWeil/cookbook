# Docs

Decisions are in [decisions/](decisions/). Status is in each file. The rules for what an ADR may contain are in [CONTRIBUTING.md](../CONTRIBUTING.md).

Current state:

| Topic | Doc |
| --- | --- |
| Security checklist, database roles, MCP auth | [security-review.md](security-review.md) |
| Dependency updates and pins | [supply-chain.md](supply-chain.md) |
| Unraid production | [unraid-production.md](unraid-production.md) |
| Parallel agents | [parallel-agents.md](parallel-agents.md) |
| Kitchen UI values and screens | [design/](design/) |
| Requirements | [requirements/](requirements/) |
| Agent skills | [agent-skills.md](agent-skills.md) |

Template: [ADR](templates/adr.md).

How we work is [CONTRIBUTING.md](../CONTRIBUTING.md). Requirements define a user-facing feature.

The production Compose file is not in the tree. The skeleton is [deploy/nas/docker-compose.yml](../deploy/nas/docker-compose.yml). The UI package is not in the tree. The sequence check is not in the tree.

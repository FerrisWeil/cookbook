# Docs

Existing decisions are in [decisions/](decisions/). Do not add new ADR files. New durable rationale goes in the living doc for that topic. How we work is [CONTRIBUTING.md](../CONTRIBUTING.md).

Current state:

| Topic | Doc |
| --- | --- |
| Security checklist, database roles, MCP and API auth | [security-review.md](security-review.md) |
| MCP tools and how they reach recipes | [mcp.md](mcp.md) |
| Household API recipe routes and caller tokens | [api.md](api.md) |
| Recipe tables and domain rules | [recipes.md](recipes.md) |
| Kitchen web rendering, proxy, theme, install | [web.md](web.md) |
| Dependency updates and pins | [supply-chain.md](supply-chain.md) |
| Unraid production | [unraid-production.md](unraid-production.md) |
| Parallel agents | [parallel-agents.md](parallel-agents.md) |
| Kitchen UI values and screens | [design/](design/) |
| Requirements | [requirements/requirements.yaml](requirements/requirements.yaml) |
| Agent skills | [agent-skills.md](agent-skills.md) |

Requirements YAML catalogs portable application behavior. It is not acceptance. Hosting stays in the Unraid doc.

The production Compose file is not in the tree. The skeleton is [deploy/nas/docker-compose.yml](../deploy/nas/docker-compose.yml). Settings, `/guide`, and the sequence check are not in the tree.

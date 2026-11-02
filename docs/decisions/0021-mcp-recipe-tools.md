# 0021. MCP recipe tools call the API

* Status: proposed
* Date: 2026-11-02

## Problem

Chef needs to read one recipe, list recipes, and save a recipe through the cookbook MCP, without a second path onto the database.

## Options considered

1. **MCP talks to Postgres** — fewer hops, and a second client on the database network.
2. **A shared library, MCP still connects** — one query implementation, same network cost.
3. **MCP calls the API** — one writer. MCP stays off the database network.

## Decision

MCP is an adapter. Recipe read, list, and save go through the household API. MCP does not connect to Postgres.

The recipe tools are read, list, and save. Journal, tag, and search are not offered. The foundation ping stays; it is not a recipe tool.

A missing required value, an unknown field, and a missing or hidden recipe each return a sentence. Hidden recipes are not found. The list omits them.

Recipe calls use the existing shared secret. Liveness stays open and returns status only.

The API routes that store recipes do not use that secret. Their boundary is the tailnet and the Docker network, as with the rest of the API.

## Consequences

* A compromised MCP can call the API and cannot run SQL.
* The first recipe HTTP routes land with this feature, even though the kitchen UI does not use them yet.
* Adding journal, tag, or search is a new decision.
* Tool arguments, valid fields, and the sentences are in the MCP doc.
* Auth mechanics stay in the security doc ([0003](0003-mcp-bearer-token.md)).

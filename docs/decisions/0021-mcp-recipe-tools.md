# 0021. MCP recipe tools call the API

* Status: accepted
* Date: 2026-11-02
* Confirmed: Taylor, 2026-11-02

## Problem

Chef needs to read one recipe, list recipes, and save a recipe through the cookbook MCP, without a second path onto the database.

## Options considered

1. **MCP talks to Postgres** — fewer hops, and a second client on the database network.
2. **A shared library, MCP still connects** — one query implementation, same network cost.
3. **MCP calls the API** — one writer. MCP stays off the database network.
4. **Recipe HTTP with no extra secret** — the network is enough, and a published local port can write recipes.
5. **One API secret shared by MCP and the web** — one value to rotate, one leak is both callers.
6. **A secret per caller; the web server proxies** — a leak of one caller does not mint the other. The browser never holds a token.

## Decision

MCP is an adapter. Recipe read, list, and save go through the household API. MCP does not connect to Postgres.

The recipe tools are read, list, and save. Journal, tag, and search are not offered. The foundation ping stays; it is not a recipe tool.

A missing required value, an unknown field, and a missing or hidden recipe each return a sentence. Hidden recipes are not found. The list omits them.

Recipe calls on MCP use the existing shared secret. Recipe routes on the API require a bearer too. Each caller has its own secret: one for MCP, one for the web app. The web app's server holds the web secret and proxies the browser. The browser never sees a token. Liveness stays open on both. Secrets live in the environment and are not committed.

## Consequences

* A compromised MCP can call the API with its own caller secret and cannot run SQL.
* A leaked caller secret can use the recipe routes until it is revoked. It is not the other caller's secret and cannot call MCP.
* The first recipe HTTP routes land with this feature, even though the kitchen UI does not use them yet.
* Adding journal, tag, or search is a new decision.
* Tool arguments, valid fields, and the sentences are in the MCP doc.
* Recipe routes and caller tokens are in the API doc.
* Auth mechanics stay in the security doc ([0003](0003-mcp-bearer-token.md), [0007](0007-public-repo-secrets.md)).

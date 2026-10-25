# 0003. Bearer token on the MCP server

* Status: accepted
* Date: 2026-10-25
* Confirmed: Taylor, 2026-10-25, agent chat (foundation PR)

## Context

Tailscale ACLs limit which devices can open a TCP connection. A compromised or overly broad tailnet peer could still call tools if the MCP server trusted the network alone. MCP Streamable HTTP has no built-in shared-secret check; the host must verify tokens in front of the handler. nas-mcp already uses this pattern.

## Options considered

1. **Network trust only** — One ACL mistake becomes full MCP access, including future write tools that save recipes.
2. **Mutual TLS** — Strong, but more operational burden than a household app needs.
3. **Bearer token** — A long random secret in env, `Authorization: Bearer …` on every MCP call except liveness. Proven in nas-mcp.

## Decision

Require a bearer token on the cookbook MCP server.

* Require `MCP_AUTH_TOKEN` at process start. Refuse to boot if it is missing or shorter than 16 characters.
* Require `Authorization: Bearer <token>` on every request except `GET /health`.
* Compare tokens with SHA-256 + `timingSafeEqual` so length differences do not leak via compare time.
* Return `401` with `WWW-Authenticate: Bearer` when the header is missing or wrong.
* Leave `/health` unauthenticated. It returns only `{ "status": "ok" }` so Docker can probe liveness without embedding the secret in a healthcheck command.

## Consequences

* Network ACLs and the token are independent controls. Both are required for MCP calls.
* Callers (curl, MCP Inspector, Chef) must be configured with the token.
* `/health` is a deliberate exception. Rotate the token if it is ever written into logs or compose files.
* The token lives in env files that are never committed ([0007](0007-public-repo-secrets.md)).
